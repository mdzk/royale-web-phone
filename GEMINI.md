# GEMINI.md - Web SIP Client Tracker

## Architectural Guidelines
- **Core Library:** JsSIP (Vanilla TypeScript).
- **Paradigm:** Separation of concerns. No UI frameworks (React/Vue/etc.).
- **Logic Isolation:** SIP signaling must reside in `src/sip/client.ts`.
- **Media Handling:** Handle WebRTC audio streams via native `<audio>` elements.
- **Safety:** Never log SIP passwords or sensitive SIP headers in production.

## Progress Checklist
- [x] Project Initialization (Vite + Vanilla TS)
- [x] Create `GEMINI.md`
- [x] Install JsSIP dependency
- [x] Implement `src/sip/client.ts` (SIP Logic)
- [x] Design HTML UI (`index.html`)
- [x] Wire UI with SIP Logic (`src/main.ts`)
- [x] Implement Media/Audio handling
- [ ] Basic Validation (Registration & Calling)

## Technical Reference
- [JsSIP Documentation](https://jssip.net/documentation/3.10.x/api/ua/)
- [WebRTC API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
