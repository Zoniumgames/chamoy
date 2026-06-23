const WORKER_URL = "https://chat-api.geovanny-ramos-4444.workers.dev";

let currentName = null;
let replyTo = null;
let lastMessages = [];

// DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const nameInput = document.getElementById('nameInput');
const passwordInput = document.getElementById('passwordInput');
const enterBtn = document.getElementById('enterBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const messagesEl = document.getElementById('messages');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');

enterBtn.addEventListener('click', tryEnter);
passwordInput.addEventListener('keydown', e => { if(e.key === 'Enter') tryEnter(); });
logoutBtn.addEventListener('click', logout);
sendBtn.addEventListener('click', sendMessage);
textInput.addEventListener('keydown', e => { if(e.key === 'Enter') sendMessage(); });

/* ---------------- LOGIN ---------------- */
async function tryEnter() {
  loginError.textContent = '';

  const name = nameInput.value.trim();
  const pwd = passwordInput.value;

  if (!name) {
    loginError.textContent = 'Ingresa tu nombre.';
    return;
  }

  try {
    const res = await fetch(WORKER_URL + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd })
    });

    const data = await res.json();

    if (!data.ok) {
      loginError.textContent = 'Clave incorrecta.';
      return;
    }

    currentName = name;
    sessionStorage.setItem('chat_name', currentName);

    showChat();
    startPolling();

  } catch (err) {
    console.error(err);
    loginError.textContent = 'Error de conexión.';
  }
}

/* ---------------- LOGOUT ---------------- */
function logout() {
  sessionStorage.removeItem('chat_name');
  currentName = null;
  loginScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  stopPolling();
}

/* ---------------- UI ---------------- */
function showChat() {
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
}

/* ---------------- POLLING (reemplaza onSnapshot) ---------------- */
let pollInterval = null;

function startPolling() {
  loadMessages();
  pollInterval = setInterval(loadMessages, 2000); // cada 2s
}

function stopPolling() {
  clearInterval(pollInterval);
}

/* ---------------- LOAD MESSAGES ---------------- */
async function loadMessages() {
  try {
    const res = await fetch(WORKER_URL + "/messages");
    const data = await res.json();

    renderMessages(data);

  } catch (err) {
    console.error(err);
  }
}

/* ---------------- RENDER LISTA ---------------- */
function renderMessages(messages) {

  const isSame =
    JSON.stringify(messages) === JSON.stringify(lastMessages);

  if (isSame) return;
  lastMessages = messages;

  const shouldAutoScroll =
    messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 100;

  messagesEl.innerHTML = '';

  messages.forEach(msg => renderMessage(msg));

  if (shouldAutoScroll) {
    smartScroll(true);
  }
}

/* ---------------- SCROLL INTELIGENTE ---------------- */
function smartScroll(force = false) {
  const threshold = 120;

  const atBottom =
    messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;

  if (atBottom || force) {
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior: 'smooth'
    });
  }
}

/* ---------------- SEND ---------------- */
async function sendMessage() {
  const text = textInput.value.trim();
  if (!text) return;

  sendBtn.disabled = true;

  try {
    await fetch(WORKER_URL + "/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentName,
        text,
        replyTo
      })
    });

    textInput.value = '';
    replyTo = null;

    loadMessages();

  } catch (err) {
    console.error(err);
  } finally {
    sendBtn.disabled = false;
  }
}

/* ---------------- REACCIONES ---------------- */
async function addReaction(id, emoji) {
  await fetch(WORKER_URL + "/react", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, emoji })
  });

  loadMessages();
}

/* ---------------- REPLY ---------------- */
function setReply(msg) {
  replyTo = {
    name: msg.name,
    text: msg.text
  };

  textInput.placeholder = `Respondiendo a ${msg.name}...`;
}

/* ---------------- RENDER MENSAJE ---------------- */
function renderMessage(msg) {

  const wrapper = document.createElement('div');
  wrapper.className = 'message ' + (msg.name === currentName ? 'me' : 'other');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${msg.name} · ${new Date(msg.timestamp || Date.now()).toLocaleString()}`;
  wrapper.appendChild(meta);

  if (msg.replyTo) {
    const reply = document.createElement('div');
    reply.style.fontSize = '12px';
    reply.style.opacity = '0.7';
    reply.textContent = `↩ ${msg.replyTo.name}: ${msg.replyTo.text}`;
    wrapper.appendChild(reply);
  }

  const text = document.createElement('div');
  text.textContent = msg.text;
  wrapper.appendChild(text);

  /* acciones */
  const actions = document.createElement('div');
  actions.style.fontSize = '12px';
  actions.style.marginTop = '5px';

  const replyBtn = document.createElement('button');
  replyBtn.textContent = "Responder";
  replyBtn.onclick = () => setReply(msg);

  const emojis = ["👍","❤️","😂","😢","⭐"];

  const reactBox = document.createElement('span');

  emojis.forEach(e => {
    const b = document.createElement('button');
    b.textContent = e;
    b.onclick = () => addReaction(msg.id, e);
    reactBox.appendChild(b);
  });

  actions.appendChild(replyBtn);
  actions.appendChild(reactBox);

  wrapper.appendChild(actions);

  /* reacciones visibles */
  if (msg.reactions?.length) {
    const r = document.createElement('div');
    r.style.fontSize = '14px';
    r.textContent = msg.reactions.join(' ');
    wrapper.appendChild(r);
  }

  messagesEl.appendChild(wrapper);
}

/* ---------------- AUTO LOGIN ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('chat_name');
  if (saved) nameInput.value = saved;
});
