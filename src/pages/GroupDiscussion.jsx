import React, { useState, useRef } from 'react';
import { Users, Copy, Check, Mic, MicOff, ChevronRight, Trophy, RefreshCw } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useWhisper } from '../hooks/useWhisper';
import { groqChat } from '../utils/groqClient';
import './GroupDiscussion.css';

const GD_TOPICS_FALLBACK = [
    'Social media is doing more harm than good to society.',
    'Artificial intelligence will replace more jobs than it creates.',
    'Remote work is the future of employment.',
    'Climate change is the most pressing issue of our generation.',
    'Higher education should be free for all citizens.',
    'Technology is making human beings less empathetic.',
    'Brain drain is a serious threat to developing nations.',
    'Is the 9-to-5 work model still relevant today?',
    'Can economic growth and environmental sustainability coexist?',
    'Should social media platforms be regulated by governments?',
];

export default function GroupDiscussion() {
    const {
        connected, roomState, phase,
        createRoom, joinRoom, setTopic,
        submitSpeech, getSpeeches, broadcastEvaluation, endRoom,
        evaluationResult,
    } = useSocket();

    const { isRecording, error: whisperError, startRecording, stopRecording, cancelRecording } = useWhisper();

    // Setup state
    const [mode, setMode] = useState('choose'); // choose | create | join
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [setupError, setSetupError] = useState('');
    const [myRoomCode, setMyRoomCode] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [copied, setCopied] = useState(false);

    // Discussion state
    const [speech, setSpeech] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [topicLoading, setTopicLoading] = useState(false);
    const [generatedTopic, setGeneratedTopic] = useState('');
    const [evaluating, setEvaluating] = useState(false);

    const myName = useRef('');

    const handleCreate = async () => {
        if (!name.trim()) return setSetupError('Please enter your name.');
        setSetupError('');
        const res = await createRoom(name.trim());
        if (res.success) {
            setMyRoomCode(res.roomCode);
            setIsHost(true);
            myName.current = name.trim();
        } else {
            setSetupError(res.error || 'Failed to create room.');
        }
    };

    const handleJoin = async () => {
        if (!name.trim()) return setSetupError('Please enter your name.');
        if (!roomCode.trim()) return setSetupError('Please enter the room code.');
        setSetupError('');
        const res = await joinRoom(name.trim(), roomCode.trim().toUpperCase());
        if (res.success) {
            setMyRoomCode(roomCode.trim().toUpperCase());
            myName.current = name.trim();
        } else {
            setSetupError(res.error || 'Failed to join room.');
        }
    };

    const handleGenerateTopic = async () => {
        setTopicLoading(true);
        try {
            const topic = await groqChat([
                { role: 'system', content: 'You generate Group Discussion topics for interview practice. Return ONLY the topic statement, no explanation, no numbering.' },
                { role: 'user', content: 'Generate one thought-provoking, interview-relevant GD topic on social issues, technology, economy, or career. Make it debatable and clear.' },
            ], { maxTokens: 80 });
            const cleanTopic = topic.trim().replace(/^["']|["']$/g, '');
            setGeneratedTopic(cleanTopic);
            await setTopic(cleanTopic);
        } catch (err) {
            const fallback = GD_TOPICS_FALLBACK[Math.floor(Math.random() * GD_TOPICS_FALLBACK.length)];
            setGeneratedTopic(fallback);
            await setTopic(fallback);
        } finally {
            setTopicLoading(false);
        }
    };

    const handleSubmitSpeech = async () => {
        if (!speech.trim()) return;
        const res = await submitSpeech(speech.trim());
        if (res?.success !== false) setSubmitted(true);
    };

    const handleEvaluateAll = async () => {
        setEvaluating(true);
        const data = await getSpeeches();
        if (!data?.success) { setEvaluating(false); return; }
        const { topic, participants } = data;
        const participantText = participants.map(p =>
            `Participant: ${p.name}\nSpeech: ${p.speech || '[No speech submitted]'}`
        ).join('\n\n');

        try {
            const result = await groqChat([
                { role: 'system', content: 'You are a professional Group Discussion evaluator for interview assessment.' },
                {
                    role: 'user', content: `Evaluate the following Group Discussion on the topic: "${topic}"\n\n${participantText}\n\nReturn a JSON object with this exact structure (no markdown, no explanation):\n{\n  "participants": [\n    {\n      "name": "...",\n      "relevance": 0-10,\n      "depth": 0-10,\n      "clarity": 0-10,\n      "communication": 0-10,\n      "overall": 0.0-10.0,\n      "strengths": ["...", "..."],\n      "improvements": ["...", "..."]
    }\n  ],\n  "winner": "name of best performer",\n  "discussion_summary": "2-sentence overall summary"\n}`,
                },
            ], { maxTokens: 1024 });
            const parsed = JSON.parse(result.trim());
            await broadcastEvaluation(parsed);
        } catch (err) {
            console.error('Evaluation error:', err?.message || err);
        } finally {
            setEvaluating(false);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(myRoomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const transcriptRef = useRef('');

    const handleMic = async () => {
        if (isRecording) {
            await stopRecording();
        } else {
            transcriptRef.current = speech;
            await startRecording((chunk) => {
                transcriptRef.current = transcriptRef.current + (transcriptRef.current ? ' ' : '') + chunk;
                setSpeech(transcriptRef.current);
            });
        }
    };

    const handleLeave = () => {
        endRoom();
        setMode('choose');
        setSpeech('');
        setSubmitted(false);
        setGeneratedTopic('');
        setMyRoomCode('');
        setIsHost(false);
        myName.current = '';
        cancelRecording();
    };


    const allSubmitted = roomState?.participants?.every(p => p.submitted);

    /* ===== PHASE: CHOOSE ===== */
    if (phase === 'idle' && mode === 'choose') {
        return (
            <div className="gd-page">
                <div className="page-header">
                    <div className="container">
                        <h1 className="page-header-title">Group Discussion</h1>
                        <p className="page-header-subtitle">Multi-user real-time discussion with AI evaluation</p>
                    </div>
                </div>
                <div className="container gd-content">
                    <div className="gd-choose-grid">
                        <button className="gd-choose-card card" onClick={() => setMode('create')}>
                            <div className="gd-choose-icon"><Users size={28} /></div>
                            <h2 className="gd-choose-title">Create a Room</h2>
                            <p className="gd-choose-desc">Start a new GD session. You will receive a room code to share with other participants.</p>
                            <span className="btn btn-navy btn-sm" style={{ pointerEvents: 'none', marginTop: 16 }}>Create Room</span>
                        </button>
                        <button className="gd-choose-card card" onClick={() => setMode('join')}>
                            <div className="gd-choose-icon gd-choose-icon-blue"><ChevronRight size={28} /></div>
                            <h2 className="gd-choose-title">Join a Room</h2>
                            <p className="gd-choose-desc">Enter a room code shared by the host to join an active GD session.</p>
                            <span className="btn btn-outline btn-sm" style={{ pointerEvents: 'none', marginTop: 16 }}>Join Room</span>
                        </button>
                    </div>
                    <div className="gd-how-it-works card card-padded" style={{ marginTop: 32 }}>
                        <h3 style={{ fontWeight: 700, color: 'var(--color-navy)', marginBottom: 16, fontSize: 16 }}>How It Works</h3>
                        <div className="gd-steps">
                            {[
                                { step: '01', title: 'Host Creates a Room', desc: 'The host creates a room and gets a shareable code.' },
                                { step: '02', title: 'Participants Join', desc: 'Others enter the code and join the lobby.' },
                                { step: '03', title: 'AI Generates Topic', desc: 'The host triggers an AI-generated GD topic for everyone.' },
                                { step: '04', title: 'Everyone Speaks', desc: 'Each participant submits their points (text or voice).' },
                                { step: '05', title: 'AI Evaluates All', desc: 'The host triggers evaluation. AI scores each participant individually.' },
                            ].map(({ step, title, desc }) => (
                                <div key={step} className="gd-step">
                                    <div className="gd-step-num">{step}</div>
                                    <div>
                                        <div className="gd-step-title">{title}</div>
                                        <div className="gd-step-desc">{desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ===== PHASE: SETUP FORM ===== */
    if (phase === 'idle') {
        return (
            <div className="gd-page">
                <div className="page-header">
                    <div className="container">
                        <h1 className="page-header-title">Group Discussion — {mode === 'create' ? 'Create Room' : 'Join Room'}</h1>
                    </div>
                </div>
                <div className="container gd-content">
                    <div className="gd-setup-card card card-padded">
                        {!connected && (
                            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                                Connecting to server... Make sure the backend is running on port 3001.
                            </div>
                        )}
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Your Name</label>
                            <input
                                className="form-input"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                maxLength={32}
                            />
                        </div>
                        {mode === 'join' && (
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Room Code</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. GD-4X9K"
                                    value={roomCode}
                                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                                    maxLength={7}
                                    style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, fontSize: 18 }}
                                />
                            </div>
                        )}
                        {setupError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{setupError}</div>}
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setMode('choose'); setSetupError(''); }}>Back</button>
                            <button
                                className="btn btn-navy"
                                onClick={mode === 'create' ? handleCreate : handleJoin}
                                disabled={!connected}
                            >
                                {mode === 'create' ? 'Create Room' : 'Join Room'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ===== PHASE: RESULTS ===== */
    if (phase === 'results' && evaluationResult) {
        const sorted = [...(evaluationResult.participants || [])].sort((a, b) => b.overall - a.overall);
        return (
            <div className="gd-page">
                <div className="page-header">
                    <div className="container page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h1 className="page-header-title">GD Results — Evaluation Complete</h1>
                            <p className="page-header-subtitle">Topic: {roomState?.topic || generatedTopic}</p>
                        </div>
                        <button className="btn btn-outline btn-sm la-end-btn" onClick={handleLeave}>
                            <RefreshCw size={14} /> New Session
                        </button>
                    </div>
                </div>
                <div className="container gd-content">
                    {evaluationResult.winner && (
                        <div className="gd-winner-banner card card-padded fade-in">
                            <Trophy size={22} className="trophy-icon" />
                            <div>
                                <div className="gd-winner-label">Best Performer</div>
                                <div className="gd-winner-name">{evaluationResult.winner}</div>
                            </div>
                        </div>
                    )}
                    {evaluationResult.discussion_summary && (
                        <div className="card card-padded gd-summary-card fade-in">
                            <div className="form-label" style={{ marginBottom: 8 }}>Discussion Summary</div>
                            <p style={{ fontSize: 14.5, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{evaluationResult.discussion_summary}</p>
                        </div>
                    )}
                    <div className="gd-results-grid">
                        {sorted.map((p, idx) => (
                            <div key={p.name} className={`card gd-result-card fade-in ${idx === 0 ? 'gd-result-card-top' : ''}`}>
                                <div className="gd-result-header">
                                    <span className="gd-result-rank">#{idx + 1}</span>
                                    <span className="gd-result-name">{p.name}</span>
                                    <span className="gd-result-overall">{p.overall}<span style={{ fontSize: 13, fontWeight: 400 }}>/10</span></span>
                                </div>
                                <div className="gd-scores-row">
                                    {[
                                        { label: 'Relevance', val: p.relevance },
                                        { label: 'Depth', val: p.depth },
                                        { label: 'Clarity', val: p.clarity },
                                        { label: 'Communication', val: p.communication },
                                    ].map(({ label, val }) => (
                                        <div key={label} className="gd-score-col">
                                            <div className="gd-score-val">{val}</div>
                                            <div className="gd-score-label">{label}</div>
                                            <div className="progress-bar-track" style={{ marginTop: 4 }}>
                                                <div className="progress-bar-fill" style={{ width: `${(val / 10) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="gd-feedback-row">
                                    <div className="gd-feedback-col">
                                        <div className="gd-feedback-head" style={{ color: 'var(--color-success)' }}>Strengths</div>
                                        {p.strengths?.map((s, i) => <div key={i} className="gd-feedback-item">{s}</div>)}
                                    </div>
                                    <div className="gd-feedback-col">
                                        <div className="gd-feedback-head" style={{ color: 'var(--color-warning)' }}>Areas to Improve</div>
                                        {p.improvements?.map((s, i) => <div key={i} className="gd-feedback-item">{s}</div>)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /* ===== PHASE: LOBBY & DISCUSSION ===== */
    return (
        <div className="gd-page">
            <div className="page-header">
                <div className="container page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 className="page-header-title">Group Discussion</h1>
                        <p className="page-header-subtitle">
                            {phase === 'lobby' ? 'Waiting for participants to join...' : `Topic: ${roomState?.topic}`}
                        </p>
                    </div>
                    <button className="btn btn-outline btn-sm la-end-btn" onClick={handleLeave}>Leave Room</button>
                </div>
            </div>
            <div className="container gd-content">
                <div className="gd-room-layout">
                    {/* Left: Main area */}
                    <div className="gd-main">
                        {/* Room code banner */}
                        {phase === 'lobby' && (
                            <div className="card card-padded gd-room-banner fade-in">
                                <div>
                                    <div className="form-label" style={{ marginBottom: 6 }}>Room Code — Share this with participants</div>
                                    <div className="gd-room-code">{myRoomCode}</div>
                                </div>
                                <button className="btn btn-outline btn-sm" onClick={handleCopyCode}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copied' : 'Copy Code'}
                                </button>
                            </div>
                        )}

                        {/* Topic display */}
                        {roomState?.topic && (
                            <div className="card card-padded gd-topic-card fade-in">
                                <div className="form-label" style={{ marginBottom: 8 }}>GD Topic</div>
                                <p className="gd-topic-text">{roomState.topic}</p>
                            </div>
                        )}

                        {/* Discussion input */}
                        {phase === 'discussion' && !submitted && (
                            <div className="card card-padded gd-speech-card fade-in">
                                <div className="gd-speech-header">
                                    <h3 className="gd-speech-title">Your Points</h3>
                                    <button className={`mic-btn ${isRecording ? 'active' : ''}`} onClick={handleMic}>
                                        {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>
                                </div>
                                {whisperError && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 13 }}>{whisperError}</div>}
                                {isRecording && (
                                    <div className="la-listening-indicator" style={{ marginBottom: 8 }}>
                                        <span className="pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} />
                                        Recording — your speech will appear in ~5s chunks...
                                    </div>
                                )}
                                <textarea
                                    className="form-input form-textarea gd-speech-area"
                                    placeholder="Type your talking points and arguments here. Be structured: state your view, support with examples, address counterarguments."
                                    value={speech}
                                    onChange={e => setSpeech(e.target.value)}
                                    rows={8}
                                />
                                <div className="gd-speech-footer">
                                    <span className="text-sm text-muted">{speech.split(/\s+/).filter(Boolean).length} words</span>
                                    <button className="btn btn-navy" onClick={handleSubmitSpeech} disabled={!speech.trim()}>
                                        Submit My Points
                                    </button>
                                </div>
                            </div>
                        )}

                        {submitted && phase === 'discussion' && (
                            <div className="alert alert-success fade-in">
                                Your points have been submitted. Waiting for other participants to submit...
                            </div>
                        )}

                        {/* Host controls */}
                        {isHost && phase === 'lobby' && (
                            <div className="card card-padded gd-host-controls fade-in">
                                <h3 className="gd-speech-title" style={{ marginBottom: 12 }}>Host Controls</h3>
                                <button className="btn btn-navy" onClick={handleGenerateTopic} disabled={topicLoading}>
                                    {topicLoading ? <><span className="spinner" /> Generating Topic...</> : 'Generate Topic and Start Discussion'}
                                </button>
                                {roomState?.participants?.length < 2 && (
                                    <p className="text-sm text-muted" style={{ marginTop: 8 }}>Tip: Wait for at least one more participant before starting.</p>
                                )}
                            </div>
                        )}

                        {isHost && phase === 'discussion' && (
                            <div className="card card-padded gd-host-controls fade-in">
                                <h3 className="gd-speech-title" style={{ marginBottom: 8 }}>Host Controls</h3>
                                <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
                                    {allSubmitted ? 'All participants have submitted. You can evaluate now.' : 'Waiting for all participants to submit their points.'}
                                </p>
                                <button className="btn btn-navy" onClick={handleEvaluateAll} disabled={evaluating}>
                                    {evaluating ? <><span className="spinner" /> Evaluating...</> : 'Evaluate All Participants'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Participants panel */}
                    <div className="gd-participants-panel card card-padded">
                        <h3 className="gd-panel-title">Participants ({roomState?.participants?.length || 0})</h3>
                        <div className="gd-participants-list">
                            {roomState?.participants?.map((p, i) => (
                                <div key={p.name} className="gd-participant-row">
                                    <div className="gd-participant-avatar">{p.name[0].toUpperCase()}</div>
                                    <div className="gd-participant-name">
                                        {p.name}
                                        {i === 0 && <span className="badge badge-navy" style={{ marginLeft: 6, fontSize: 10 }}>Host</span>}
                                    </div>
                                    {phase === 'discussion' && (
                                        <span className={`badge ${p.submitted ? 'badge-success' : 'badge-muted'}`}>
                                            {p.submitted ? 'Submitted' : 'Pending'}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
