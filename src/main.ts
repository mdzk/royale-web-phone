import { SIPClient } from './sip/client';

let sipClient: SIPClient | null = null;
let callStartTime: number = 0;
let timerInterval: any = null;

// UI Elements: Screens
const loginScreen = document.getElementById('loginScreen') as HTMLDivElement;
const mainScreen = document.getElementById('mainScreen') as HTMLDivElement;
const dialScreen = document.getElementById('dialScreen') as HTMLDivElement;
const chatScreen = document.getElementById('chatScreen') as HTMLDivElement;
const callOverlay = document.getElementById('callOverlay') as HTMLDivElement;
const incomingModal = document.getElementById('incomingModal') as HTMLDivElement;

// UI Elements: Navigation
const navDial = document.getElementById('navDial') as HTMLButtonElement;
const navChat = document.getElementById('navChat') as HTMLButtonElement;
const btnLogoutNav = document.getElementById('btnLogoutNav') as HTMLButtonElement;

// UI Elements: Controls
const btnLogin = document.getElementById('btnLogin') as HTMLButtonElement;
const btnCallAudio = document.getElementById('btnCallAudio') as HTMLButtonElement;
const btnCallVideo = document.getElementById('btnCallVideo') as HTMLButtonElement;
const btnHangup = document.getElementById('btnHangup') as HTMLButtonElement;
const btnAnswerAudio = document.getElementById('btnAnswerAudio') as HTMLButtonElement;
const btnAnswerVideo = document.getElementById('btnAnswerVideo') as HTMLButtonElement;
const btnReject = document.getElementById('btnReject') as HTMLButtonElement;
const btnSendMessage = document.getElementById('btnSendMessage') as HTMLButtonElement;

// UI Elements: Info
const regStatusSpan = document.getElementById('regStatus') as HTMLSpanElement;
const headerUser = document.getElementById('headerUser') as HTMLDivElement;
const dialpadDisplay = document.getElementById('dialpadDisplay') as HTMLDivElement;
const callTimer = document.getElementById('callTimer') as HTMLDivElement;
const overlayTarget = document.getElementById('overlayTarget') as HTMLDivElement;
const overlayStatus = document.getElementById('overlayStatus') as HTMLDivElement;
const incomingCaller = document.getElementById('incomingCaller') as HTMLDivElement;
const messageList = document.getElementById('messageList') as HTMLDivElement;
const msgInput = document.getElementById('msgInput') as HTMLInputElement;
const chatTarget = document.getElementById('chatTarget') as HTMLInputElement;

// Inputs
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const domainInput = document.getElementById('domain') as HTMLInputElement;
const wsPortInput = document.getElementById('wsPort') as HTMLInputElement;

// --- NAVIGATION LOGIC ---
navDial.addEventListener('click', () => switchTab('dial'));
navChat.addEventListener('click', () => switchTab('chat'));

function switchTab(tab: 'dial' | 'chat') {
    dialScreen.classList.toggle('active', tab === 'dial');
    chatScreen.classList.toggle('active', tab === 'chat');
    navDial.classList.toggle('active', tab === 'dial');
    navChat.classList.toggle('active', tab === 'chat');
}

// --- MESSAGING LOGIC ---
function addMessageBubble(sender: string, text: string, isIncoming: boolean) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${isIncoming ? 'msg-in' : 'msg-out'}`;
    div.innerHTML = `
        <span class="msg-sender">${isIncoming ? sender : 'You'}</span>
        ${text}
    `;
    
    // Remove "No messages" placeholder
    if (messageList.innerText.includes('No messages yet')) {
        messageList.innerHTML = '';
    }
    
    messageList.appendChild(div);
    messageList.scrollTop = messageList.scrollHeight;
}

btnSendMessage.addEventListener('click', () => {
    const target = chatTarget.value;
    const text = msgInput.value;
    if (!target || !text || !sipClient) return;

    const domain = domainInput.value;
    const fullUri = `sip:${target}@${domain}`;
    
    try {
        sipClient.sendMessage(fullUri, text);
        addMessageBubble('Me', text, false);
        msgInput.value = '';
    } catch (e) {
        alert("Failed to send message: " + e);
    }
});

// --- AUTH LOGIC ---
btnLogin.addEventListener('click', () => {
    const username = usernameInput.value;
    const domain = domainInput.value;
    const password = passwordInput.value;
    const port = wsPortInput.value;

    const isSecure = port === '8089' || port === '443';
    const config = {
        wssUrl: `${isSecure ? 'wss' : 'ws'}://${domain}:${port}/ws`,
        sipUri: `sip:${username}@${domain}`,
        password: password,
        displayName: username
    };

    btnLogin.innerText = "Authenticating...";
    btnLogin.disabled = true;

    sipClient = new SIPClient(config);
    
    sipClient.onRegistered = () => {
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        headerUser.innerText = `${username}@${domain}`;
        btnLogin.innerText = "Authenticate";
        btnLogin.disabled = false;
    };

    sipClient.onRegistrationFailed = (cause) => {
        alert(`Auth Failed: ${cause}`);
        btnLogin.innerText = "Authenticate";
        btnLogin.disabled = false;
        sipClient?.stop();
    };

    sipClient.onNewMessage = (sender, body) => {
        addMessageBubble(sender, body, true);
        // Maybe show a small badge on the Chat tab if not active
        if (!chatScreen.classList.contains('active')) {
            navChat.style.color = 'var(--royal-gold)';
        }
    };

    sipClient.onIncomingCall = () => {
        incomingCaller.innerText = "Incoming Request"; 
        incomingModal.classList.add('active');
    };

    sipClient.onSessionEnd = () => {
        stopTimer();
        callOverlay.classList.remove('active');
        incomingModal.classList.remove('active');
        dialpadDisplay.innerText = '';
    };

    sipClient.start();

    setInterval(() => {
        if (sipClient && mainScreen.classList.contains('active')) {
            const status = sipClient.getUAStatus();
            regStatusSpan.innerText = status;
            regStatusSpan.className = 'status-pill ' + (status === 'registered' ? 'status-registered' : '');
        }
    }, 1000);
});

btnLogoutNav.addEventListener('click', () => {
    sipClient?.stop();
    sipClient = null;
    mainScreen.classList.remove('active');
    loginScreen.classList.add('active');
});

// --- CALL LOGIC ---
function initiateCall(video: boolean) {
    if (!sipClient) return;
    const targetNumber = dialpadDisplay.innerText;
    if (!targetNumber) return;

    const domain = domainInput.value;
    const fullUri = `sip:${targetNumber}@${domain}`;

    try {
        const session = sipClient.call(fullUri, video);
        overlayTarget.innerText = targetNumber;
        overlayStatus.innerText = video ? "Video Call..." : "Audio Call...";
        callOverlay.classList.add('active');

        session.on('confirmed', () => {
            overlayStatus.innerText = "Connected";
            startTimer();
        });
    } catch (e) {
        alert(`Call Error: ${e}`);
    }
}

btnCallAudio.addEventListener('click', () => initiateCall(false));
btnCallVideo.addEventListener('click', () => initiateCall(true));

btnHangup.addEventListener('click', () => {
    sipClient?.hangup();
    callOverlay.classList.remove('active');
    stopTimer();
});

btnAnswerAudio.addEventListener('click', () => {
    sipClient?.answer(false);
    incomingModal.classList.remove('active');
    callOverlay.classList.add('active');
    overlayTarget.innerText = "Incoming Call";
    startTimer();
});

btnAnswerVideo.addEventListener('click', () => {
    sipClient?.answer(true);
    incomingModal.classList.remove('active');
    callOverlay.classList.add('active');
    overlayTarget.innerText = "Video Call";
    startTimer();
});

btnReject.addEventListener('click', () => {
    sipClient?.hangup();
    incomingModal.classList.remove('active');
});

// --- KEYBOARD SUPPORT ---
window.addEventListener('keydown', (e) => {
    if (loginScreen.classList.contains('active')) return; // Don't trigger dialpad on login screen
    
    if (/^[0-9\*#]$/.test(e.key)) {
        (window as any).appendDial(e.key);
    }
    else if (e.key === 'Backspace') {
        (window as any).backspaceDial();
    }
    else if (e.key === 'Enter') {
        if (incomingModal.classList.contains('active')) {
            btnAnswerAudio.click();
        } else if (!callOverlay.classList.contains('active') && dialScreen.classList.contains('active')) {
            btnCallAudio.click();
        }
    }
});

// Timer
function startTimer() {
    stopTimer();
    callStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        callTimer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    callTimer.innerText = "00:00";
}
