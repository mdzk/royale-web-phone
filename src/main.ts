import { SIPClient } from './sip/client';

let sipClient: SIPClient | null = null;
let callStartTime: number = 0;
let timerInterval: any = null;

// UI Elements
const loginScreen = document.getElementById('loginScreen') as HTMLDivElement;
const mainScreen = document.getElementById('mainScreen') as HTMLDivElement;
const callOverlay = document.getElementById('callOverlay') as HTMLDivElement;
const incomingModal = document.getElementById('incomingModal') as HTMLDivElement;
const logConsole = document.getElementById('logConsole') as HTMLDivElement;

const btnLogin = document.getElementById('btnLogin') as HTMLButtonElement;
const btnLogout = document.getElementById('btnLogout') as HTMLButtonElement;
const btnCall = document.getElementById('btnCall') as HTMLButtonElement;
const btnHangup = document.getElementById('btnHangup') as HTMLButtonElement;
const btnAnswer = document.getElementById('btnAnswer') as HTMLButtonElement;
const btnReject = document.getElementById('btnReject') as HTMLButtonElement;

const regStatusSpan = document.getElementById('regStatus') as HTMLSpanElement;
const headerUser = document.getElementById('headerUser') as HTMLDivElement;
const dialpadDisplay = document.getElementById('dialpadDisplay') as HTMLDivElement;
const callTimer = document.getElementById('callTimer') as HTMLDivElement;
const overlayTarget = document.getElementById('overlayTarget') as HTMLDivElement;
const overlayStatus = document.getElementById('overlayStatus') as HTMLDivElement;
const incomingCaller = document.getElementById('incomingCaller') as HTMLDivElement;

// Inputs
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const domainInput = document.getElementById('domain') as HTMLInputElement;
const wsPortInput = document.getElementById('wsPort') as HTMLInputElement;

function addLog(msg: string, type: 'info' | 'error' | 'warn' = 'info') {
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString().split(' ')[0];
    div.style.color = type === 'error' ? '#ff4444' : type === 'warn' ? '#ffbb33' : '#888';
    div.innerText = `[${time}] ${msg}`;
    logConsole.appendChild(div);
    logConsole.scrollTop = logConsole.scrollHeight;
}

// Redirect Console
const originalLog = console.log;
console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('SIP:')) {
        addLog(args.join(' '));
    }
    originalLog.apply(console, args);
};

// Keyboard Support
window.addEventListener('keydown', (e) => {
    if (/^[0-9\*#]$/.test(e.key)) {
        (window as any).appendDial(e.key);
    }
    else if (e.key === 'Backspace') {
        (window as any).backspaceDial();
    }
    else if (e.key === 'Enter') {
        if (loginScreen.classList.contains('active')) {
            btnLogin.click();
        } else if (mainScreen.classList.contains('active')) {
            if (incomingModal.classList.contains('active')) {
                btnAnswer.click();
            } else if (!callOverlay.classList.contains('active')) {
                btnCall.click();
            }
        }
    }
    else if (e.key === 'Escape') {
        if (callOverlay.classList.contains('active')) {
            btnHangup.click();
        } else if (incomingModal.classList.contains('active')) {
            btnReject.click();
        }
    }
});

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

    // UI Loading State
    btnLogin.innerText = "Authenticating...";
    btnLogin.disabled = true;
    addLog(`Initiating authentication for ${username}...`);

    sipClient = new SIPClient(config);
    
    // Auth Validation Logic
    sipClient.onRegistered = () => {
        addLog('Authentication Successful!', 'info');
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        headerUser.innerText = `${username}@${domain}`;
        btnLogin.innerText = "Authenticate";
        btnLogin.disabled = false;
    };

    sipClient.onRegistrationFailed = (cause) => {
        addLog(`Authentication Failed: ${cause}`, 'error');
        alert(`Gagal login: ${cause}. Pastikan username/password benar.`);
        btnLogin.innerText = "Authenticate";
        btnLogin.disabled = false;
        sipClient?.stop();
    };

    sipClient.onIncomingCall = () => {
        incomingCaller.innerText = "Incoming Call"; 
        incomingModal.classList.add('active');
    };

    sipClient.onSessionEnd = () => {
        stopTimer();
        callOverlay.classList.remove('active');
        incomingModal.classList.remove('active');
        dialpadDisplay.innerText = '';
    };

    sipClient.start();

    // Status Polling for the main screen
    const statusInterval = setInterval(() => {
        if (sipClient && mainScreen.classList.contains('active')) {
            const status = sipClient.getUAStatus();
            regStatusSpan.innerText = status;
            regStatusSpan.className = 'status-pill ' + (status === 'registered' ? 'status-registered' : '');
        } else if (!sipClient) {
            clearInterval(statusInterval);
        }
    }, 1000);
});

btnLogout.addEventListener('click', () => {
    sipClient?.stop();
    sipClient = null;
    mainScreen.classList.remove('active');
    loginScreen.classList.add('active');
    addLog('Session terminated.');
});

btnCall.addEventListener('click', () => {
    if (!sipClient) return;
    const targetNumber = dialpadDisplay.innerText;
    if (!targetNumber) return;

    const domain = domainInput.value;
    const fullUri = `sip:${targetNumber}@${domain}`;

    try {
        const session = sipClient.call(fullUri);
        overlayTarget.innerText = targetNumber;
        overlayStatus.innerText = "Requesting...";
        callOverlay.classList.add('active');

        session.on('confirmed', () => {
            overlayStatus.innerText = "Connected";
            startTimer();
        });
    } catch (e) {
        addLog(`Call Error: ${e}`, 'error');
    }
});

btnHangup.addEventListener('click', () => {
    sipClient?.hangup();
    callOverlay.classList.remove('active');
    stopTimer();
});

btnAnswer.addEventListener('click', () => {
    sipClient?.answer();
    incomingModal.classList.remove('active');
    callOverlay.classList.add('active');
    overlayTarget.innerText = "Incoming Call";
    overlayStatus.innerText = "Connected";
    startTimer();
});

btnReject.addEventListener('click', () => {
    sipClient?.hangup();
    incomingModal.classList.remove('active');
});

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
