// CONFIGURACIÓN: reemplaza con tu config de Firebase (ver instrucciones)
const firebaseConfig = {
  apiKey: "AIzaSyC6jdpBCgNou-PgAjYXai6mSLe4IHKkLsQ",
  authDomain: "chat-777-444.firebaseapp.com",
  projectId: "chat-777-444",
  storageBucket: "chat-777-444.firebasestorage.app",
  messagingSenderId: "812716475458",
  appId: "1:812716475458:web:d7ca1981ec0f6e11a899db",
  measurementId: "G-W349S6TPH1"
};


let db, storage;
let currentName = null;
let messagesCol;
let unsubscribeListener = null;

//  estado global para reply
let replyTo = null;

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
passwordInput.addEventListener('keydown', e => { if(e.key==='Enter') tryEnter(); });
logoutBtn.addEventListener('click', logout);
sendBtn.addEventListener('click', sendMessage);
textInput.addEventListener('keydown', e => { if(e.key==='Enter') sendMessage(); });


async function tryEnter() {
  loginError.textContent = '';

  const name = nameInput.value.trim();
  const pwd = passwordInput.value;

  if (!name) {
    loginError.textContent = 'Ingresa tu nombre.';
    return;
  }

  try {
    const res = await fetch("https://TU-WORKER.workers.dev/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: pwd
      })
    });

    const data = await res.json();

    if (!data.ok) {
      loginError.textContent = 'Clave incorrecta.';
      return;
    }

    // login correcto
    currentName = name;
    sessionStorage.setItem('chat_name', currentName);
    showChat();

  } catch (err) {
    console.error(err);
    loginError.textContent = 'Error de conexión.';
  }
}



function logout(){
  sessionStorage.removeItem('chat_name');
  currentName = null;
  if(unsubscribeListener) unsubscribeListener();
  loginScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
}

function showChat(){
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  subscribeMessages();
}

function initFirebase(){
  if(!firebase.apps.length){
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    storage = firebase.storage();
    messagesCol = db.collection('messages');
  }
}

// Baja automáticamente si el usuario está abajo o si es un mensaje propio forzado
function smartScroll(force = false){
  const threshold = 120;
  const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < threshold;
  
  if(atBottom || force){
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior: 'smooth'
    });
  }
}

function subscribeMessages(){
  if(!messagesCol) return;

  unsubscribeListener = messagesCol
    .orderBy('timestamp')
    .limit(5000)
    .onSnapshot(snapshot => {

      messagesEl.innerHTML = '';

      snapshot.forEach(doc => {
        const data = doc.data();
        renderMessage(data, doc.id);
      });

      //  Se le da un breve respiro al navegador para asegurar que el HTML se renderizó y luego bajar el scroll
      setTimeout(() => {
        smartScroll(true);
      }, 50);
    });
}

//  seleccionar mensaje para responder
function setReply(msg, id){
  replyTo = { id, text: msg.text, name: msg.name };
  textInput.placeholder = `Respondiendo a ${msg.name}...`;
}

//  reacciones
async function addReaction(id, emoji){
  const docRef = messagesCol.doc(id);
  const doc = await docRef.get();
  const data = doc.data();

  let reactions = data.reactions || [];
  reactions.push(emoji);

  await docRef.update({ reactions });
}

function renderMessage(msg, id){
  const wrapper = document.createElement('div');
  wrapper.className = 'message ' + ((msg.name === currentName) ? 'me' : 'other');

  //  reply preview
  if(msg.replyTo){
    const replyBox = document.createElement('div');
    replyBox.style.fontSize = '12px';
    replyBox.style.opacity = '0.7';
    replyBox.textContent = `↩ ${msg.replyTo.name}: ${msg.replyTo.text}`;
    wrapper.appendChild(replyBox);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';

  const time = msg.timestamp && msg.timestamp.toDate
    ? msg.timestamp.toDate()
    : new Date(msg.timestamp || Date.now());

  meta.textContent = `${msg.name || 'Anónimo'} · ${time.toLocaleString()}`;
  wrapper.appendChild(meta);

  if(msg.text){
    const p = document.createElement('div');
    p.textContent = msg.text;
    wrapper.appendChild(p);
  }

  if(msg.imageUrl){
    const img = document.createElement('img');
    img.src = msg.imageUrl;
    wrapper.appendChild(img);
  }

  //  reacciones visibles
  if(msg.reactions?.length){
    const reactBox = document.createElement('div');
    reactBox.style.fontSize = '14px';
    reactBox.textContent = msg.reactions.join(' ');
    wrapper.appendChild(reactBox);
  }

  //  acciones (reply + reactions)
  const actions = document.createElement('div');
  actions.style.fontSize = '12px';
  actions.style.marginTop = '5px';

  // reply
  const replyBtn = document.createElement('button');
  replyBtn.textContent = "Responder";
  replyBtn.onclick = () => setReply(msg, id);

  // reacciones rápidas
  const emojis = ["👍","❤️","😂","😢","⭐"];

  const reactContainer = document.createElement('span');
  emojis.forEach(e => {
    const b = document.createElement('button');
    b.textContent = e;
    b.onclick = () => addReaction(id, e);
    reactContainer.appendChild(b);
  });

  actions.appendChild(replyBtn);
  actions.appendChild(reactContainer);
  wrapper.appendChild(actions);

  messagesEl.appendChild(wrapper);
}

//  FUNCIÓN REPARADA COMPLETAMENTE
async function sendMessage(){
  const text = textInput.value.trim();
  
  if(!text) return; // Como no hay fileInput en el HTML, solo validamos el texto
  sendBtn.disabled = true;

  try {
    const payload = {
      name: currentName || 'Anónimo',
      text: text || null,
      imageUrl: null, 
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      replyTo: replyTo || null,
      reactions: []
    };

    await messagesCol.add(payload);

    textInput.value = '';
    replyTo = null;
    textInput.placeholder = "Escribe un mensaje...";
    smartScroll(true);
  } catch(err){
    console.error('send error', err);
    alert('Error al enviar.');
  } finally {
    sendBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedName = sessionStorage.getItem('chat_name');
  if(savedName){
    nameInput.value = savedName;
  }
});
