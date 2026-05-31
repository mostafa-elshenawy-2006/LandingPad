const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://landingpad-425865427791.us-west1.run.app/auth/google/callback';
let gmailTokens = null;

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  client.on('tokens', tokens => {
    gmailTokens = { ...(gmailTokens || {}), ...tokens };
  });
  if (gmailTokens) client.setCredentials(gmailTokens);
  return client;
}

function encodeEmailHeader(value = '') {
  return String(value).replace(/[\r\n]/g, ' ').trim();
}

function createRawEmail({ to, subject, body }) {
  const message = [
    `To: ${encodeEmailHeader(to)}`,
    `Subject: ${encodeEmailHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body || ''
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const SYSTEM_PROMPT = `You are LandingPad, a warm and helpful guide for immigrants and newcomers arriving in a new country.

CRITICAL Rules:
- Keep responses SHORT — 2 to 3 sentences maximum
- Always respond in the SAME language the user writes in
- Never use ** bold markdown ** or bullet points — plain natural sentences only
- ALWAYS recommend 1 or 2 specific real places by their FULL official name (e.g. "Charnelton Community Clinic at 151 W 7th Ave" or "Food for Lane County on 770 Bailey Hill Rd")
- Give the address when mentioning a place so the user can find it
- NEVER ask more than one follow-up question — and only ask if truly necessary
- If the user asks for a place or resource, just recommend it directly — don't ask clarifying questions first
- Be warm and human, like a helpful friend — not a government brochure
- Never make the user feel lost or overwhelmed

Your goal is to immediately point people to real named places they can visit, with addresses.`;

app.post('/chat', async (req, res) => {
  const { message, history, userContext } = req.body;
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });
    const chat = model.startChat({ history: history || [] });
    const contextPrefix = userContext
      ? `[User context: From ${userContext.country}, currently in ${userContext.location}, needs help with: ${userContext.need}. RESPOND IN: ${userContext.language || 'English'}]\n\n`
      : '';
    const result = await chat.sendMessage(contextPrefix + message);
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/email', async (req, res) => {
  const { prompt, language } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(
      `Write a professional email for this request: "${prompt}".
      Write it in ${language || 'English'}.
      Output ONLY the email with Subject line and body.
      Start with "Subject:" on the first line.
      Do not include any explanation or commentary.`
    );
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate email' });
  }
});

app.get('/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google OAuth is not configured');
  }

  const authUrl = getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing OAuth code');

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    gmailTokens = tokens;
    res.redirect('/?gmail=connected');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to connect Gmail');
  }
});

app.get('/auth/status', (req, res) => {
  res.json({ connected: Boolean(gmailTokens && (gmailTokens.access_token || gmailTokens.refresh_token)) });
});

app.post('/send-email', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!gmailTokens) return res.status(401).json({ error: 'Gmail is not connected' });
  if (!to || !subject || !body) return res.status(400).json({ error: 'Missing to, subject, or body' });

  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: createRawEmail({ to, subject, body })
      }
    });
    gmailTokens = { ...gmailTokens, ...oauth2Client.credentials };
    res.json({ ok: true, id: result.data.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 3000;

app.get('/config', (req, res) => {
  res.json({ mapsApiKey: process.env.MAPS_API_KEY });
});

app.get('/place-details', async (req, res) => {
  const { placeId } = req.query;
  if (!placeId) return res.status(400).json({ error: 'Missing placeId' });
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,opening_hours,photos,rating,website,url&key=${process.env.MAPS_API_KEY}`
    );
    const data = await response.json();
    res.json(data.result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

app.get('/place-photo', async (req, res) => {
  const { ref } = req.query;
  try {
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${process.env.MAPS_API_KEY}`;
    const response = await fetch(photoUrl);
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'image/jpeg');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

app.listen(PORT, () => console.log(`LandingPad running on port ${PORT}`));
