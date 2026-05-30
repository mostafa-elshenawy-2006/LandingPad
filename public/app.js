let userContext = {};
let chatHistory = [];

// INTAKE SCREEN
document.getElementById('start-btn').addEventListener('click', () => {
  const country = document.getElementById('country').value.trim();
  const location = document.getElementById('location').value.trim();
  const need = document.getElementById('need').value;

  if (!country || !location || !need) {
    alert('Please fill out all three fields!');
    return;
  }

  userContext = { country, location, need };

  // Show context in chat header
  document.getElementById('user-context-label').textContent =
    `From ${country} · ${location} · Needs help with: ${need}`;

  // Switch screens
  document.getElementById('intake-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  // Send welcome message
  addMessage('bot', `👋 Welcome to LandingPad! I'm here to help you navigate life in ${location}. You can type in any language and I'll respond in the same language. What's your first question?`);
});

// SEND MESSAGE
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const input = document.getElementById('user-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  addMessage('user', message);

  // Add typing indicator
  const typing = addMessage('typing', 'LandingPad is thinking...');

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: chatHistory,
        userContext
      })
    });

    const data = await response.json();
    typing.remove();

    const reply = data.reply || 'Sorry, something went wrong. Please try again.';
    addMessage('bot', reply);

    // Save to history
    chatHistory.push({ role: 'user', parts: [{ text: message }] });
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });

  } catch (error) {
    typing.remove();
    addMessage('bot', 'Connection error. Please check your internet and try again.');
  }
}

function addMessage(type, text) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.classList.add('message', type);
  div.textContent = text;
  div.textContent = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}