# ⚜️ Royale Web Phone

Royale Web Phone is a luxury-themed, lightweight, and high-performance WebRTC SIP softphone. Designed with a **Modern-Classic** aesthetic, it provides a seamless calling experience directly from your browser.

## ✨ Features
- **Modern Classic UI**: Elegant "Royal Midnight & Gold" theme.
- **Full Keyboard Support**: Dial numbers, answer, and hangup using your physical keyboard.
- **Secure Authentication**: Built-in validation before entering the dialer.
- **WebRTC Ready**: Optimized for Asterisk and FreePBX with DTLS-SRTP support.
- **Vanilla Power**: No heavy frameworks, just pure TypeScript and JsSIP.

## 🚀 Quick Start
1. Clone the repo: `git clone https://github.com/mdzk/-royale-web-phone.git`
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Open `http://localhost:5173` in your browser.

## ⚙️ Asterisk Requirements
To use this client, your Asterisk/FreePBX server must have:
- **WebSocket Enabled**: Port 8088 (WS) or 8089 (WSS).
- **WebRTC Extension**: AVPF, ICE, and DTLS-SRTP enabled.
- **Codec**: Opus, alaw, or ulaw.

## ⌨️ Keyboard Shortcuts
- **0-9, \*, #**: Dial numbers.
- **Enter**: Login or Place Call / Answer.
- **Backspace**: Delete last digit.
- **Escape**: Hangup or Reject Call.

## 📜 License
This project is licensed under the MIT License.
