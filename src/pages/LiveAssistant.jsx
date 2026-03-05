import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mic, Square, RotateCcw, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import { groqChatStream, groqChat } from '../utils/groqClient';
import { useWhisper } from '../hooks/useWhisper';
import { saveSession, getSession, newSessionId } from '../utils/chatHistory';
import './LiveAssistant.css';

const SYSTEM_PROMPT = `You are a professional communication coach helping someone prepare for interviews and improve spoken English.
Keep responses short, conversational, and spoken-friendly — 2 to 3 sentences maximum.
Be encouraging and professional. Never use bullet points, lists, markdown, or emojis.
After responding, occasionally ask a follow-up question to keep the conversation going.`;

const IDLE = 'idle';
const RECORDING = 'recording';
const THINKING = 'thinking';
const SPEAKING = 'speaking';
const ENDED = 'ended';

export default function LiveAssistant() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [status, setStatus] = useState(IDLE);
    const [userText, setUserText] = useState('');
    const [aiText, setAiText] = useState('');
    const [sessionLog, setSessionLog] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(null);

    const synth = useRef(window.speechSynthesis);
    const utterRef = useRef(null);
    const aiBuffer = useRef('');
    const historyRef = useRef([]);
    const activeRef = useRef(true);
    const statusRef = useRef(IDLE);
    const isMutedRef = useRef(false);
    const sessionIdRef = useRef(newSessionId());

    const { isRecording, error: whisperError, startRecording, stopRecording, cancelRecording } = useWhisper();

    // Keep refs in sync
    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    // Load session from URL param on mount
    useEffect(() => {
        activeRef.current = true;
        synth.current?.getVoices();

        const resumeId = searchParams.get('session');
        if (resumeId) {
            const saved = getSession(resumeId);
            if (saved && saved.messages?.length) {
                historyRef.current = saved.messages;
                setSessionLog([...saved.messages]);
                sessionIdRef.current = resumeId;
                // Clear the URL param so refresh doesn't re-load
                setSearchParams({}, { replace: true });
            }
        }

        return () => {
            activeRef.current = false;
            cancelRecording();
            synth.current?.cancel();
        };
    }, []);

    // Speak AI text aloud via browser TTS — uses refs to avoid stale closures
    const speakText = (text) => {
        synth.current?.cancel();
        if (isMutedRef.current || !text || !activeRef.current) {
            setStatus(IDLE);
            return;
        }

        const doSpeak = (voices) => {
            if (!activeRef.current) return;
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 0.95;
            utter.pitch = 1;
            utter.lang = 'en-US';
            const preferred = voices.find(v =>
                v.name.includes('Google US English') ||
                v.name.includes('Samantha') ||
                v.name.includes('Daniel')
            ) || voices.find(v => v.lang?.startsWith('en')) || voices[0];
            if (preferred) utter.voice = preferred;
            utter.onend = () => { if (activeRef.current) setStatus(IDLE); };
            utter.onerror = () => { if (activeRef.current) setStatus(IDLE); };
            utterRef.current = utter;
            setStatus(SPEAKING);
            synth.current.speak(utter);
        };

        let voices = synth.current.getVoices();
        if (voices.length > 0) {
            doSpeak(voices);
        } else {
            // Chrome loads voices lazily
            const handler = () => {
                voices = synth.current.getVoices();
                if (voices.length > 0) doSpeak(voices);
            };
            synth.current.onvoiceschanged = handler;
            // Fallback timeout
            setTimeout(() => {
                if (statusRef.current !== SPEAKING) doSpeak(synth.current.getVoices());
            }, 600);
        }
    };

    // Send transcribed text to Groq AI and speak the response
    const sendToAI = async (text) => {
        console.log('[LiveAssistant] sendToAI called with:', JSON.stringify(text));
        if (!text?.trim() || !activeRef.current) {
            console.log('[LiveAssistant] sendToAI: empty text or inactive, going IDLE');
            setStatus(IDLE);
            return;
        }

        const userMsg = { role: 'user', content: text };
        const newHistory = [...historyRef.current, userMsg];
        historyRef.current = newHistory;
        setSessionLog([...newHistory]);
        setStatus(THINKING);
        aiBuffer.current = '';
        setAiText('');

        let fullAI = '';

        try {
            console.log('[LiveAssistant] Calling groqChatStream...');
            await groqChatStream(
                [{ role: 'system', content: SYSTEM_PROMPT }, ...newHistory],
                (chunk) => {
                    if (!activeRef.current) return;
                    aiBuffer.current += chunk;
                    setAiText(aiBuffer.current);
                },
                { maxTokens: 180 }
            );
            fullAI = aiBuffer.current;
            console.log('[LiveAssistant] Stream complete, response:', fullAI?.substring(0, 80));
        } catch (streamErr) {
            console.warn('[LiveAssistant] Stream failed:', streamErr);
            try {
                console.log('[LiveAssistant] Trying non-streaming fallback...');
                const result = await groqChat(
                    [{ role: 'system', content: SYSTEM_PROMPT }, ...newHistory],
                    { maxTokens: 180 }
                );
                fullAI = result || '';
                aiBuffer.current = fullAI;
                setAiText(fullAI);
                console.log('[LiveAssistant] Non-stream response:', fullAI?.substring(0, 80));
            } catch (chatErr) {
                console.error('[LiveAssistant] Both stream and chat failed:', chatErr);
                setError(chatErr?.message || 'Could not reach the AI. Please try again.');
                setStatus(IDLE);
                return;
            }
        }

        if (!activeRef.current) return;
        if (!fullAI?.trim()) {
            setError('AI returned an empty response. Please try again.');
            setStatus(IDLE);
            return;
        }

        const aiMsg = { role: 'assistant', content: fullAI };
        historyRef.current = [...newHistory, aiMsg];
        setSessionLog(h => [...h, aiMsg]);

        // Auto-save session to history
        saveSession({
            id: sessionIdRef.current,
            messages: historyRef.current,
            module: 'live-assistant',
        });

        console.log('[LiveAssistant] Speaking AI response...');
        speakText(fullAI);
    };

    // Tap the orb/mic button
    const handleMicTap = async () => {
        const s = statusRef.current;
        console.log('[LiveAssistant] handleMicTap, current status:', s);

        // If AI is speaking, interrupt
        if (s === SPEAKING) {
            synth.current?.cancel();
            setStatus(IDLE);
            return;
        }

        // If thinking, ignore taps
        if (s === THINKING) return;

        // If already recording, stop and send to AI
        if (s === RECORDING) {
            setStatus(THINKING);
            console.log('[LiveAssistant] Stopping recording...');
            const text = await stopRecording();
            console.log('[LiveAssistant] Whisper returned:', JSON.stringify(text));
            setUserText(text || '');
            if (text?.trim()) {
                await sendToAI(text);
            } else {
                setError('No speech detected. Please try again and speak clearly.');
                setStatus(IDLE);
            }
            return;
        }

        // Start recording (single-shot mode, no onChunk)
        if (s === IDLE) {
            setError('');
            setUserText('');
            setAiText('');
            setStatus(RECORDING);
            console.log('[LiveAssistant] Starting recording...');
            await startRecording(); // no onChunk = single-shot mode
        }
    };

    const toggleMute = () => {
        const next = !isMuted;
        setIsMuted(next);
        if (next && statusRef.current === SPEAKING) {
            synth.current?.cancel();
            setStatus(IDLE);
        }
    };

    const endSession = async () => {
        cancelRecording();
        synth.current?.cancel();
        setStatus(ENDED);

        if (historyRef.current.length < 2) {
            setSummary({ error: 'Not enough conversation to evaluate.' });
            return;
        }

        const conversation = historyRef.current
            .map(m => `${m.role === 'user' ? 'You' : 'Coach'}: ${m.content}`)
            .join('\n');

        try {
            const res = await groqChat([
                { role: 'system', content: 'You are a communication skills evaluator.' },
                {
                    role: 'user',
                    content: `Evaluate this spoken conversation.\nReturn ONLY valid JSON (no markdown):\n{"vocabulary":0-10,"fluency":0-10,"confidence":0-10,"overall":0-10,"strengths":["...","..."],"improvements":["...","..."],"summary":"1 sentence"}\n\nConversation:\n${conversation}`,
                },
            ], { maxTokens: 400 });
            setSummary(JSON.parse(res.trim()));
        } catch {
            setSummary({ error: 'Evaluation unavailable. Please try again.' });
        }
    };

    const reset = () => {
        cancelRecording();
        synth.current?.cancel();
        setStatus(IDLE);
        setUserText('');
        setAiText('');
        setSessionLog([]);
        setSummary(null);
        historyRef.current = [];
        aiBuffer.current = '';
        setError('');
        sessionIdRef.current = newSessionId();
    };

    // Orb state classes
    const orbState =
        status === RECORDING ? 'orb-listening' :
            status === THINKING ? 'orb-thinking' :
                status === SPEAKING ? 'orb-speaking' : '';

    const statusLabel = {
        [IDLE]: sessionLog.length > 0 ? 'Tap to continue conversation' : 'Tap the orb to start speaking',
        [RECORDING]: 'Listening — tap again to send',
        [THINKING]: 'AI is thinking...',
        [SPEAKING]: 'Tap to interrupt',
        [ENDED]: 'Session ended',
    }[status];

    if (status === ENDED && summary) {
        return (
            <div className="la-page">
                <div className="page-header">
                    <div className="container page-header-row">
                        <div>
                            <h1 className="page-header-title">Live Assistant</h1>
                            <p className="page-header-subtitle">Session Complete</p>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={reset}>
                            <RotateCcw size={14} /> New Session
                        </button>
                    </div>
                </div>
                <div className="la-body container">
                    <div className="la-summary-overlay fade-in">
                        <div className="la-summary-card card card-padded">
                            <h2 className="la-summary-heading">Session Evaluation</h2>
                            {summary.error ? (
                                <p className="text-secondary">{summary.error}</p>
                            ) : (
                                <>
                                    <div className="la-score-grid">
                                        {[['Vocabulary', summary.vocabulary], ['Fluency', summary.fluency], ['Confidence', summary.confidence], ['Overall', summary.overall]].map(([l, v]) => (
                                            <div key={l} className="la-score-cell">
                                                <div className="la-score-num">{v}<span>/10</span></div>
                                                <div className="la-score-label">{l}</div>
                                                <div className="progress-bar-track" style={{ marginTop: 6 }}>
                                                    <div className="progress-bar-fill" style={{ width: `${v * 10}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {summary.summary && <p className="la-summary-text">{summary.summary}</p>}
                                    <div className="la-fb-row">
                                        <div>
                                            <div className="la-fb-head text-success">Strengths</div>
                                            {summary.strengths?.map((s, i) => <div key={i} className="la-fb-item">{s}</div>)}
                                        </div>
                                        <div>
                                            <div className="la-fb-head text-warning">Improve</div>
                                            {summary.improvements?.map((s, i) => <div key={i} className="la-fb-item">{s}</div>)}
                                        </div>
                                    </div>
                                </>
                            )}
                            <button className="btn btn-navy btn-full" style={{ marginTop: 20 }} onClick={reset}>
                                <RotateCcw size={15} /> Start New Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="la-page">
            {/* Header */}
            <div className="page-header">
                <div className="container page-header-row">
                    <div>
                        <h1 className="page-header-title">Live Assistant</h1>
                        <p className="page-header-subtitle">Voice-to-voice AI conversation coach</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button className="btn btn-outline btn-sm" onClick={toggleMute} title={isMuted ? 'Unmute AI' : 'Mute AI'}>
                            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                            {isMuted ? 'Unmuted' : 'Mute AI'}
                        </button>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={endSession}
                            disabled={historyRef.current.length < 2 || status === ENDED}
                            title="End session and see evaluation"
                        >
                            <PhoneOff size={14} /> End Session
                        </button>
                    </div>
                </div>
            </div>

            <div className="la-body container">
                <div className="la-voice-ui">

                    {/* Orb — tap this to talk */}
                    <button
                        className={`la-orb-btn orb ${orbState}`}
                        onClick={handleMicTap}
                        disabled={status === THINKING}
                        title={statusLabel}
                        aria-label={statusLabel}
                    >
                        <div className="orb-inner">
                            {status === RECORDING && <Square size={28} strokeWidth={2.5} color="white" />}
                            {status === IDLE && <Mic size={28} strokeWidth={2} color="white" />}
                            {status === SPEAKING && <Volume2 size={28} strokeWidth={2} color="white" />}
                            {status === THINKING && <span className="la-orb-spinner" />}
                        </div>
                        <div className="orb-ring orb-ring-1" />
                        <div className="orb-ring orb-ring-2" />
                        <div className="orb-ring orb-ring-3" />
                    </button>

                    {/* Status text */}
                    <div className="la-status-label">{statusLabel}</div>

                    {/* Errors */}
                    {(error || whisperError) && (
                        <div className="alert alert-error" style={{ maxWidth: 460, textAlign: 'center' }}>
                            {error || whisperError}
                        </div>
                    )}

                    {/* Conversation bubbles */}
                    <div className="la-text-area">
                        {/* Show user's transcribed text */}
                        {userText && (status === THINKING || status === SPEAKING || status === IDLE) && (
                            <div className="la-speech-bubble la-user-bubble fade-in">
                                <span className="la-bubble-label">You</span>
                                <p className="la-bubble-text">{userText}</p>
                            </div>
                        )}

                        {/* AI thinking / streaming / speaking */}
                        {(status === THINKING || status === SPEAKING) && (
                            <div className="la-speech-bubble la-ai-bubble fade-in">
                                <span className="la-bubble-label">AI Coach</span>
                                {status === THINKING && !aiText ? (
                                    <div className="typing-indicator" style={{ padding: '8px 0' }}>
                                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                                    </div>
                                ) : (
                                    <p className="la-bubble-text">{aiText}</p>
                                )}
                            </div>
                        )}

                        {/* Last AI message when idle */}
                        {status === IDLE && !userText && sessionLog.length > 0 && (() => {
                            const last = sessionLog[sessionLog.length - 1];
                            if (last.role === 'assistant') return (
                                <div className="la-speech-bubble la-ai-bubble la-last-bubble fade-in">
                                    <span className="la-bubble-label">AI Coach</span>
                                    <p className="la-bubble-text">{last.content}</p>
                                </div>
                            );
                            return null;
                        })()}
                    </div>

                    {/* Conversation counter */}
                    {sessionLog.length > 0 && (
                        <div className="la-turn-count">
                            {Math.ceil(sessionLog.length / 2)} {Math.ceil(sessionLog.length / 2) === 1 ? 'exchange' : 'exchanges'} · {sessionLog.length >= 4 ? 'Tap "End Session" when done' : 'Keep going!'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
