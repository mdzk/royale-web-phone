import { SIPClient } from './sip/client';

// Interfaces
interface Contact {
    id: string;
    name: string;
    number: string;
    type: 'user' | 'group';
    members?: string[];
    color?: string;
}

interface ChatMessage {
    sender: string;
    text: string;
    time: string;
    date: string;
    isIncoming: boolean;
}

// State
let sipClient: SIPClient | null = null;
let callStartTime: number = 0;
let timerInterval: any = null;
let contacts: Contact[] = JSON.parse(localStorage.getItem('contacts') || '[]');
let activeChatId: string | null = null;
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
const regStatusSpan = document.getElementById('regStatus') as HTMLSpanElement;
const regStatusContainer = document.getElementById('regStatusContainer') as HTMLDivElement;

// Inputs
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const domainInput = document.getElementById('domain') as HTMLInputElement;
const wsPortInput = document.getElementById('wsPort') as HTMLInputElement;

// --- UTILS ---
function getAvatarColor(name: string): string {
    const colors = ['#1e293b', '#c5a059', '#166534', '#991b1b', '#1e40af', '#854d0e', '#3730a3', '#9f1239'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function formatDateLabel(dateStr: string): string {
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return dateStr;
}

// --- INITIALIZATION ---
window.onload = () => {
    updateContactList();
    updateChatList();
};

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
    [dialScreen, contactsScreen, chatScreen].forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
        s.style.opacity = '0';
    });
    navButtons.forEach(b => b.classList.remove('active'));
    chatRoomScreen.classList.remove('active');

    const activeScreen = tab === 'dial' ? dialScreen : (tab === 'contacts' ? contactsScreen : chatScreen);
    activeScreen.style.display = 'flex';
    activeScreen.classList.add('active');
    setTimeout(() => activeScreen.style.opacity = '1', 10);
    
    document.getElementById(`nav${tab.charAt(0).toUpperCase() + tab.slice(1)}`)?.classList.add('active');
    headerTitle.innerText = tab === 'dial' ? 'Royale Dial' : (tab === 'contacts' ? 'Contacts' : 'Messages');

    if (tab === 'chat') {
        updateChatList();
        chatBadge.style.display = 'none';
        chatBadge.innerText = '0';
    } else if (tab === 'contacts') {
        updateContactList();
    }
}

// --- CONTACTS LOGIC ---
(window as any).showAddContactModal = () => addContactModal.style.display = 'flex';
(window as any).hideAddContactModal = () => addContactModal.style.display = 'none';

(window as any).saveNewContact = () => {
    const nameInput = document.getElementById('contactName') as HTMLInputElement;
    const numInput = document.getElementById('contactNumber') as HTMLInputElement;
    const name = nameInput.value;
    const number = numInput.value;
    if (!name || !number) return;

    const newContact: Contact = { 
        id: Date.now().toString(), 
        name, 
        number, 
        type: 'user',
        color: getAvatarColor(name)
    };
    contacts.push(newContact);
    localStorage.setItem('contacts', JSON.stringify(contacts));
    nameInput.value = '';
    numInput.value = '';
    updateContactList();
    (window as any).hideAddContactModal();
};

(window as any).createGroupFromSelected = () => {
    const groupName = prompt("Enter Royal Group Name:");
    if (!groupName) return;
    
    const memberNumbers = contacts.filter(c => c.type === 'user').map(c => c.number);
    if (memberNumbers.length === 0) {
        alert("Add some individual contacts first!");
        return;
    }

    const newGroup: Contact = { 
        id: 'group_' + Date.now(), 
        name: groupName, 
        number: 'GROUP',
        type: 'group', 
        members: memberNumbers,
        color: 'var(--royal-gold)'
    };
    
    contacts.push(newGroup);
    localStorage.setItem('contacts', JSON.stringify(contacts));
    updateContactList();
    (window as any).hideAddContactModal();
};

function updateContactList() {
    contactList.innerHTML = '';
    if (contacts.length === 0) {
        contactList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">Your kingdom's contact list is empty. Add a new contact to begin.</div>
            </div>
        `;
        return;
    }
    contacts.forEach(c => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const color = c.color || getAvatarColor(c.name);
        item.innerHTML = `
            <div class="avatar" style="background: ${color}">${c.type === 'group' ? '👥' : c.name[0].toUpperCase()}</div>
            <div class="item-info">
                <span class="item-name">${c.name}</span>
                <span class="item-sub">${c.type === 'group' ? (c.members?.length + ' Members') : c.number}</span>
            </div>
            <button class="nav-btn" style="color: var(--royal-gold); font-size: 24px; padding: 10px;" onclick="event.stopPropagation(); startChat('${c.id}')">✉</button>
        `;
        item.onclick = () => {
            if (c.type === 'user') {
                (document.getElementById('dialpadDisplay') as HTMLDivElement).innerText = c.number;
                switchTab('dial');
            }
        };
        contactList.appendChild(item);
    });
}

// --- CHAT LOGIC ---
(window as any).startChat = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    const name = contact ? contact.name : contactId;
    const number = contact ? (contact.type === 'group' ? 'Group Chat' : contact.number) : contactId;

    activeChatId = contactId;
    document.getElementById('chatRoomName')!.innerText = name;
    document.getElementById('chatRoomNumber')!.innerText = number;
    chatRoomScreen.style.display = 'flex';
    setTimeout(() => chatRoomScreen.classList.add('active'), 10);
    renderMessages(contactId);
};

(window as any).closeChatRoom = () => {
    chatRoomScreen.classList.remove('active');
    setTimeout(() => chatRoomScreen.style.display = 'none', 300);
    activeChatId = null;
    updateChatList();
};

function renderMessages(contactId: string) {
    chatMessages.innerHTML = '';
    const history = chatHistory[contactId] || [];
    let lastDate = "";

    history.forEach(msg => {
        if (msg.date !== lastDate) {
            const dateLabel = document.createElement('div');
            dateLabel.style.cssText = "align-self: center; background: rgba(0,0,0,0.1); color: #555; padding: 4px 12px; border-radius: 20px; font-size: 10px; margin: 15px 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;";
            dateLabel.innerText = formatDateLabel(msg.date);
            chatMessages.appendChild(dateLabel);
            lastDate = msg.date;
        }

        const div = document.createElement('div');
        div.className = `bubble ${msg.isIncoming ? 'bubble-in' : 'bubble-out'}`;
        div.innerHTML = `
            <div style="font-size: 10px; font-weight: 800; margin-bottom: 4px; color: var(--royal-gold); display: ${msg.isIncoming ? 'block' : 'none'}">${msg.sender}</div>
            ${msg.text}
            <span class="bubble-time">${msg.time}</span>
        `;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateChatList() {
    chatList.innerHTML = '';
    const activeIds = Object.keys(chatHistory).sort((a, b) => {
        const histA = chatHistory[a];
        const histB = chatHistory[b];
        return new Date(histB[histB.length-1].date + ' ' + histB[histB.length-1].time).getTime() - 
               new Date(histA[histA.length-1].date + ' ' + histA[histA.length-1].time).getTime();
    });

    if (activeIds.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✉</div>
                <div class="empty-text">No royal messages yet. Speak your mind from the contacts list.</div>
            </div>
        `;
        return;
    }

    activeIds.forEach(id => {
        const history = chatHistory[id];
        const lastMsg = history[history.length - 1];
        const contact = contacts.find(c => c.id === id);
        const name = contact ? contact.name : id;
        const color = contact ? (contact.color || getAvatarColor(name)) : '#64748b';

        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="avatar" style="background: ${color}">${contact?.type === 'group' ? '👥' : name[0].toUpperCase()}</div>
            <div class="item-info">
                <span class="item-name">${name}</span>
                <span class="item-sub">${lastMsg.text}</span>
            </div>
            <div style="text-align: right; min-width: 60px;">
                <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">${lastMsg.time}</div>
            </div>
        `;
        item.onclick = () => (window as any).startChat(id);
        chatList.appendChild(item);
    });
}

document.getElementById('btnSendChat')?.addEventListener('click', () => {
    const text = chatInput.value;
    if (!text || !activeChatId || !sipClient) return;

    const contact = contacts.find(c => c.id === activeChatId);
    const domain = domainInput.value;
    
    try {
        if (contact && contact.type === 'group' && contact.members) {
            contact.members.forEach(num => {
                sipClient?.sendMessage(`sip:${num}@${domain}`, text);
            });
            saveMessage(activeChatId, text, false, 'Me');
        } else {
            const targetNum = contact ? contact.number : activeChatId;
            sipClient.sendMessage(`sip:${targetNum}@${domain}`, text);
            saveMessage(activeChatId, text, false, 'Me');
        }
        chatInput.value = '';
        renderMessages(activeChatId);
    } catch (e) {
        alert("Transmission failure: " + e);
    }
});

function saveMessage(id: string, text: string, isIncoming: boolean, sender: string) {
    if (!chatHistory[id]) chatHistory[id] = [];
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString();
    chatHistory[id].push({ sender, text, time, date, isIncoming });
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

    const btn = document.getElementById('btnLogin') as HTMLButtonElement;
    btn.innerText = "Authenticating...";
    btn.disabled = true;

    sipClient = new SIPClient(config);
    
    sipClient.onRegistered = () => {
        loginScreen.classList.remove('active');
        setTimeout(() => {
            loginScreen.style.display = 'none';
            mainScreen.style.display = 'flex';
            setTimeout(() => mainScreen.classList.add('active'), 10);
            regStatusSpan.innerText = 'Online';
            regStatusContainer.classList.add('status-registered');
            btn.innerText = "Begin Session";
            btn.disabled = false;
        }, 400);
    };

    sipClient.onRegistrationFailed = (cause) => {
        alert("Authentication failed: " + cause);
        btn.innerText = "Begin Session";
        btn.disabled = false;
    };

    sipClient.onNewMessage = (sender, body) => {
        const contact = contacts.find(c => c.number === sender);
        const chatId = contact ? contact.id : sender;
        
        saveMessage(chatId, body, true, sender);
        
        if (activeChatId === chatId) {
            renderMessages(chatId);
        } else {
            chatBadge.style.display = 'flex';
            chatBadge.innerText = (parseInt(chatBadge.innerText) + 1).toString();
        }
    };

    sipClient.onIncomingCall = () => {
        const session = (sipClient as any).currentSession;
        const callerNum = session.remote_identity.uri.user;
        const contact = contacts.find(c => c.number === callerNum);
        document.getElementById('incomingCaller')!.innerText = contact ? contact.name : callerNum;
        incomingModal.style.display = 'flex';
        setTimeout(() => (incomingModal as any).classList.add('active'), 10);
    };

    sipClient.onSessionEnd = () => {
        stopTimer();
        callOverlay.classList.remove('active');
        setTimeout(() => callOverlay.style.display = 'none', 500);
        incomingModal.classList.remove('active');
        setTimeout(() => incomingModal.style.display = 'none', 500);
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
    const contact = contacts.find(c => c.number === num);
    document.getElementById('overlayTarget')!.innerText = contact ? contact.name : num;
    document.getElementById('overlayStatus')!.innerText = video ? "Video Negotiating..." : "Voice Negotiating...";
    
    callOverlay.style.display = 'flex';
    setTimeout(() => callOverlay.classList.add('active'), 10);
    
    session.on('confirmed', () => {
        document.getElementById('overlayStatus')!.innerText = "Secure Connection";
        startTimer();
    });
}

document.getElementById('btnHangup')?.addEventListener('click', () => sipClient?.hangup());
document.getElementById('btnAnswerAudio')?.addEventListener('click', () => {
    sipClient?.answer(false);
    incomingModal.classList.remove('active');
    setTimeout(() => incomingModal.style.display = 'none', 500);
    
    callOverlay.style.display = 'flex';
    setTimeout(() => callOverlay.classList.add('active'), 10);
    document.getElementById('overlayStatus')!.innerText = "Secure Connection";
    startTimer();
});
document.getElementById('btnReject')?.addEventListener('click', () => {
    sipClient?.hangup();
    incomingModal.classList.remove('active');
    setTimeout(() => incomingModal.style.display = 'none', 500);
});

// Timer
function startTimer() {
    stopTimer();
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
