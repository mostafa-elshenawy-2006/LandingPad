const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are LandingPad, a warm and helpful guide for immigrants and newcomers arriving in a new country.

CRITICAL Rules:
- Give clear, simple, step-by-step guidance — never use bureaucratic jargon
- Help with housing, healthcare, school enrollment, work, and legal questions
- Suggest real resources (like 211.org, USCIS, local clinics) when relevant
- Be warm, patient, and encouraging — moving to a new country is hard
- Break everything into small, doable steps
- If you don't know something specific, say so honestly and point them to where they can find out
- Keep response SHORT - 3 to 5 sentences maximum, 2 short paragraphs maximum
- Always respond in the SAME language the user writes in
- Be conversational, not like a textbook
- Give 1 or 2 concrete next steps, not a full list
- Ask ONE follow up questions if any clarification is needed to help the user in better ways
- Never use ** bold markdown ** or bullet points — write in plain natural sentences
- Be warm and human, like a friend who knows the system — not a government brochure

Your goal is to guide people step by step through conversation, not dump all information at once.

Never make the user feel lost or overwhelmed.`;

app.post('/chat', async (req, res) => {
  const { message, history, userContext } = req.body;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });

    const chat = model.startChat({ history: history || [] });

    const contextPrefix = userContext
      ? `[User context: From ${userContext.country}, currently in ${userContext.location}, needs help with: ${userContext.need}]\n\n`
      : '';

    const result = await chat.sendMessage(contextPrefix + message);
    res.json({ reply: result.response.text() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.listen(3000, () => console.log('LandingPad running on http://localhost:3000'));