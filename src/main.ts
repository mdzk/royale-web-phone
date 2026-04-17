import { SIPClient } from './sip/client';

// Interfaces
interface Contact {
    id: string;
    name: string;
    number: string;
    type: 'user' | 'group';
    members?: string[]; // For groups
}

interface ChatMessage {
    sender: string;
    text: string;
    time: string;
    isIncoming: boolean;
}

// State
let sipClient: SIPClient | null = null;
let callStartTime: number = 0;
let timerInterval: any = null;
let contacts: Contact[] = JSON.parse(localStorage.getItem('contacts') || '[]');
let activeChatNumber: string | null = null;
let chatHistory: Record<string, ChatMessage[]> = JSON.parse(localStorage.getItem('chatHistory') || '{}');

// UI Screens
const loginScreen = document.getElementById('loginScreen') as HTMLDivElement;
const mainScreen = document.getElementById('mainScreen') as HTMLDivElement;
const dialScreen = document.getElementById('dialScreen') as HTMLDivElement;
const contactsScreen = document.getElementById('contactsScreen') as HTMLDivElement;
const chatScreen = document.getElementById('chatScreen') as HTMLDivElement;
const chatRoomScreen = document.getElementById('chatRoomScreen') as HTMLDivElement;
const callOverlay = document.getElementById('callOverlay') as HTMLDivElement;
const incomingModal = document.getElementById('incomingModal') as HTMLDivElement;
const addContactModal = document.getElementById('addContactModal') as HTMLDivElement;

// UI Components
const navButtons = document.querySelectorAll('.nav-btn');
const contactList = document.getElementById('contactList') as HTMLDivElement;
const chatList = document.getElementById('chatList') as HTMLDivElement;
const chatMessages = document.getElementById('chatMessages') as HTMLDivElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const chatBadge = document.getElementById('chatBadge') as HTMLSpanElement;
const headerTitle = document.getElementById('headerTitle') as HTMLSpanElement;

// Inputs
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const domainInput = document.getElementById('domain') as HTMLInputElement;
const wsPortInput = document.getElementById('wsPort') as HTMLInputElement;

// --- INITIALIZATION ---
updateContactList();
updateChatList();

// --- NAVIGATION ---
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.id;
        if (id === 'navDial') switchTab('dial');
        if (id === 'navContacts') switchTab('contacts');
        if (id === 'navChat') switchTab('chat');
    });
});

function switchTab(tab: 'dial' | 'contacts' | 'chat') {
    [dialScreen, contactsScreen, chatScreen].forEach(s => s.classList.remove('active'));
    navButtons.forEach(b => b.classList.remove('active'));
    chatRoomScreen.classList.remove('active');

    if (tab === 'dial') {
        dialScreen.classList.add('active');
        document.getElementById('navDial')?.classList.add('active');
        headerTitle.innerText = 'Phone';
    } else if (tab === 'contacts') {
        contactsScreen.classList.add('active');
        document.getElementById('navContacts')?.classList.add('active');
        headerTitle.innerText = 'Contacts';
        updateContactList();
    } else if (tab === 'chat') {
        chatScreen.classList.add('active');
        document.getElementById('navChat')?.classList.add('active');
        headerTitle.innerText = 'Messages';
        updateChatList();
        chatBadge.style.display = 'none';
        chatBadge.innerText = '0';
    }
}

// --- CONTACTS LOGIC ---
(window as any).showAddContactModal = () => addContactModal.classList.add('active');
(window as any).hideAddContactModal = () => addContactModal.classList.remove('active');

(window as any).saveNewContact = () => {
    const name = (document.getElementById('contactName') as HTMLInputElement).value;
    const number = (document.getElementById('contactNumber') as HTMLInputElement).value;
    if (!name || !number) return;

    const newContact: Contact = { id: Date.now().toString(), name, number, type: 'user' };
    contacts.push(newContact);
    localStorage.setItem('contacts', JSON.stringify(contacts));
    updateContactList();
    (window as any).hideAddContactModal();
};

function updateContactList() {
    contactList.innerHTML = '';
    contacts.forEach(c => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="avatar">${c.name[0].toUpperCase()}</div>
            <div class="item-info">
                <span class="item-name">${c.name}</span>
                <span class="item-sub">${c.number}</span>
            </div>
            <button class="nav-btn" onclick="startChat('${c.number}', '${c.name}')">✉</button>
        `;
        item.onclick = (e) => {
            if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                (document.getElementById('dialpadDisplay') as HTMLDivElement).innerText = c.number;
                switchTab('dial');
            }
        };
        contactList.appendChild(item);
    });
}

// --- CHAT LOGIC ---
(window as any).startChat = (number: string, name: string) => {
    activeChatNumber = number;
    document.getElementById('chatRoomName')!.innerText = name;
    document.getElementById('chatRoomNumber')!.innerText = number;
    chatRoomScreen.classList.add('active');
    renderMessages(number);
};

(window as any).closeChatRoom = () => {
    chatRoomScreen.classList.remove('active');
    activeChatNumber = null;
    updateChatList();
};

function renderMessages(number: string) {
    chatMessages.innerHTML = '';
    const history = chatHistory[number] || [];
    history.forEach(msg => {
        const div = document.createElement('div');
        div.className = `bubble ${msg.isIncoming ? 'bubble-in' : 'bubble-out'}`;
        div.innerHTML = `
            ${msg.text}
            <div class="bubble-time">${msg.time}</div>
        `;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateChatList() {
    chatList.innerHTML = '';
    const lastMessages = Object.keys(chatHistory);
    if (lastMessages.length === 0) {
        chatList.innerHTML = '<div style="text-align: center; color: #999; padding: 40px; font-size: 12px;">No active conversations</div>';
        return;
    }

    lastMessages.forEach(num => {
        const history = chatHistory[num];
        const lastMsg = history[history.length - 1];
        const contact = contacts.find(c => c.number === num);
        const name = contact ? contact.name : num;

        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="avatar">${name[0].toUpperCase()}</div>
            <div class="item-info">
                <span class="item-name">${name}</span>
                <span class="item-sub">${lastMsg.text}</span>
            </div>
        `;
        item.onclick = () => (window as any).startChat(num, name);
        chatList.appendChild(item);
    });
}

document.getElementById('btnSendChat')?.addEventListener('click', () => {
    const text = chatInput.value;
    if (!text || !activeChatNumber || !sipClient) return;

    const domain = domainInput.value;
    const fullUri = `sip:${activeChatNumber}@${domain}`;
    
    try {
        sipClient.sendMessage(fullUri, text);
        saveMessage(activeChatNumber, text, false);
        chatInput.value = '';
        renderMessages(activeChatNumber);
    } catch (e) {
        alert("Failed to send: " + e);
    }
});

function saveMessage(number: string, text: string, isIncoming: boolean) {
    if (!chatHistory[number]) chatHistory[number] = [];
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    chatHistory[number].push({ sender: isIncoming ? number : 'Me', text, time, isIncoming });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

// --- SIP & AUTH ---
document.getElementById('btnLogin')?.addEventListener('click', () => {
    const username = usernameInput.value;
    const domain = domainInput.value;
    const password = passwordInput.value;
    const port = wsPortInput.value;

    const config = {
        wssUrl: `ws://${domain}:${port}/ws`,
        sipUri: `sip:${username}@${domain}`,
        password: password,
        displayName: username
    };

    sipClient = new SIPClient(config);
    
    sipClient.onRegistered = () => {
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
    };

    sipClient.onRegistrationFailed = (cause) => alert("Failed: " + cause);

    sipClient.onNewMessage = (sender, body) => {
        saveMessage(sender, body, true);
        if (activeChatNumber === sender) {
            renderMessages(sender);
        } else {
            const currentBadge = parseInt(chatBadge.innerText) || 0;
            chatBadge.innerText = (currentBadge + 1).toString();
            chatBadge.style.display = 'flex';
        }
    };

    sipClient.onIncomingCall = () => {
        const session = (sipClient as any).currentSession;
        document.getElementById('incomingCaller')!.innerText = session.remote_identity.uri.user;
        incomingModal.classList.add('active');
    };

    sipClient.onSessionEnd = () => {
        stopTimer();
        callOverlay.classList.remove('active');
        incomingModal.classList.remove('active');
    };

    sipClient.start();
});

// --- CALL ACTIONS ---
document.getElementById('btnCallAudio')?.addEventListener('click', () => initiateCall(false));
document.getElementById('btnCallVideo')?.addEventListener('click', () => initiateCall(true));

function initiateCall(video: boolean) {
    const num = (document.getElementById('dialpadDisplay') as HTMLDivElement).innerText;
    if (!num || !sipClient) return;
    const fullUri = `sip:${num}@${domainInput.value}`;
    
    const session = sipClient.call(fullUri, video);
    document.getElementById('overlayTarget')!.innerText = num;
    callOverlay.classList.add('active');
    
    session.on('confirmed', () => {
        startTimer();
        if (!video) document.getElementById('localVideo')!.style.display = 'none';
    });
}

document.getElementById('btnHangup')?.addEventListener('click', () => sipClient?.hangup());
document.getElementById('btnAnswerAudio')?.addEventListener('click', () => {
    sipClient?.answer(false);
    incomingModal.classList.remove('active');
    callOverlay.classList.add('active');
});

// Timer
function startTimer() {
    callStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('callTimer')!.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('callTimer')!.innerText = "00:00";
}
