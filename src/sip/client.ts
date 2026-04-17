// @ts-ignore
import { UA, WebSocketInterface } from 'jssip';

export interface SIPConfig {
    wssUrl: string;
    sipUri: string;
    password?: string;
    displayName?: string;
}

export class SIPClient {
    private ua: any = null;
    private currentSession: any = null;
    
    // Callbacks
    public onIncomingCall?: () => void;
    public onSessionEnd?: () => void;
    public onRegistered?: () => void;
    public onRegistrationFailed?: (cause: string) => void;
    public onNewMessage?: (sender: string, body: string) => void;

    private config: SIPConfig;

    constructor(config: SIPConfig) {
        this.config = config;
    }

    public start() {
        if (this.ua) {
            console.warn('UA already started.');
            return;
        }

        const socket = new WebSocketInterface(this.config.wssUrl);
        const configuration = {
            sockets: [socket],
            uri: this.config.sipUri,
            password: this.config.password,
            display_name: this.config.displayName || 'WebSIP',
            session_timers: false,
        };

        this.ua = new UA(configuration);

        // UA Events
        this.ua.on('connecting', () => console.log('SIP: Connecting...'));
        this.ua.on('connected', () => console.log('SIP: Connected!'));
        this.ua.on('disconnected', () => console.warn('SIP: Disconnected!'));
        this.ua.on('registered', () => {
            console.log('SIP: Registered!');
            if (this.onRegistered) this.onRegistered();
        });
        this.ua.on('unregistered', () => console.warn('SIP: Unregistered!'));
        this.ua.on('registrationFailed', (data: any) => {
            console.error('SIP: Registration failed:', data.cause);
            if (this.onRegistrationFailed) this.onRegistrationFailed(data.cause);
        });

        // Inbound Sessions (Calls)
        this.ua.on('newRTCSession', (data: any) => {
            const session = data.session;
            console.log('SIP: New RTC Session (Direction:', data.originator, ')');

            if (data.originator === 'remote') {
                console.log('SIP: Incoming call from', session.remote_identity.uri.toString());
                if (this.onIncomingCall) this.onIncomingCall();
            }

            this.setupSession(session);
        });

        // Inbound Messages
        this.ua.on('newMessage', (data: any) => {
            console.log('SIP: New Message received from', data.originator);
            if (data.originator === 'remote') {
                const sender = data.request.from.uri.user;
                const body = data.request.body;
                if (this.onNewMessage) this.onNewMessage(sender, body);
            }
        });

        this.ua.start();
    }

    public stop() {
        if (this.ua) {
            this.ua.stop();
            this.ua = null;
        }
    }

    public call(targetUri: string, video: boolean = false) {
        if (!this.ua || !this.ua.isRegistered()) {
            throw new Error('UA is not registered.');
        }

        const options = {
            mediaConstraints: { audio: true, video: video },
            pcConfig: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun.services.mozilla.com' }
                ],
                rtcpMuxPolicy: 'require'
            },
            rtcOfferConstraints: {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: video ? 1 : 0
            }
        };

        const session = this.ua.call(targetUri, options);
        this.setupSession(session);
        return session;
    }

    public sendMessage(targetUri: string, body: string) {
        if (!this.ua || !this.ua.isRegistered()) {
            throw new Error('UA is not registered.');
        }
        const message = this.ua.sendMessage(targetUri, body);
        
        message.on('succeeded', () => console.log('SIP: Message sent successfully!'));
        message.on('failed', (data: any) => console.error('SIP: Message failed to send:', data.cause));
        
        return message;
    }

    private setupSession(session: any) {
        this.currentSession = session;

        session.on('progress', () => console.log('SIP: Call in progress...'));
        session.on('failed', (data: any) => {
            console.error('SIP: Call failed:', data.cause);
            this.currentSession = null;
            if (this.onSessionEnd) this.onSessionEnd();
        });
        session.on('ended', () => {
            console.log('SIP: Call ended.');
            this.currentSession = null;
            if (this.onSessionEnd) this.onSessionEnd();
        });
        session.on('confirmed', () => {
            console.log('SIP: Call confirmed.');
        });

        // PeerConnection events for media
        session.on('peerconnection', (data: any) => {
            const pc = data.peerconnection;
            pc.addEventListener('track', (event: RTCTrackEvent) => {
                console.log('SIP: Remote track received:', event.track.kind);
                
                if (event.track.kind === 'audio') {
                    const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
                    if (remoteAudio) remoteAudio.srcObject = event.streams[0];
                } else if (event.track.kind === 'video') {
                    const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
                    if (remoteVideo) remoteVideo.srcObject = event.streams[0];
                }
            });

            // Handle local stream for video preview
            const localStream = session.connection.getLocalStreams()[0];
            if (localStream) {
                const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
                if (localVideo) localVideo.srcObject = localStream;
            }
        });
    }

    public hangup() {
        if (this.currentSession) {
            this.currentSession.terminate();
        }
    }

    public answer(video: boolean = false) {
        if (this.currentSession && this.currentSession.direction === 'incoming') {
            this.currentSession.answer({
                mediaConstraints: { audio: true, video: video }
            });
        }
    }

    public getUAStatus() {
        if (!this.ua) return 'stopped';
        if (this.ua.isRegistered()) return 'registered';
        if (this.ua.isConnected()) return 'connected';
        return 'disconnected';
    }
}
