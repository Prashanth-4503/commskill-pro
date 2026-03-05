import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw, Play, Square, Mic, MicOff } from 'lucide-react';
import { groqChat } from '../utils/groqClient';
import { useWhisper } from '../hooks/useWhisper';
import './JAM.css';

const JAM_TOPICS = [
    'The importance of digital literacy in the modern world',
    'Why failure is the best teacher',
    'The role of technology in education',
    'Should social media have an age restriction?',
    'The value of reading books in a digital age',
    'Time management is the key to success',
    'Is competition good or bad for personal growth?',
    'The impact of inflation on everyday life',
    'Why public speaking is an essential life skill',
    'The pros and cons of artificial intelligence',
    'Should college education be mandatory?',
    'The relationship between health and productivity',
    'Why critical thinking matters more than memorisation',
    'Climate change: individual responsibility vs government policy',
    'The future of work in an automated world',
];

const TOTAL_TIME = 60;
const PREP_TIME = 5;

export default function JAM() {
    const [phase, setPhase] = useState('ready'); // ready | prep | speaking | evaluating | results
    const [topic, setTopic] = useState('');
    const [prepCountdown, setPrepCountdown] = useState(PREP_TIME);
    const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
    const [fullTranscript, setFullTranscript] = useState('');
    const [evaluation, setEvaluation] = useState(null);
    const [error, setError] = useState('');

    const timerRef = useRef(null);
    const prepRef = useRef(null);
    const transcriptRef = useRef('');

    const { isRecording, error: whisperError, startRecording, stopRecording, cancelRecording } = useWhisper();

    const pickTopic = () => JAM_TOPICS[Math.floor(Math.random() * JAM_TOPICS.length)];

    useEffect(() => {
        setTopic(pickTopic());
        return () => {
            clearInterval(timerRef.current);
            clearInterval(prepRef.current);
            cancelRecording();
        };
    }, []);

    const startPrep = () => {
        setPhase('prep');
        setPrepCountdown(PREP_TIME);
        setFullTranscript('');
        transcriptRef.current = '';
        setError('');
        let count = PREP_TIME;
        prepRef.current = setInterval(() => {
            count--;
            setPrepCountdown(count);
            if (count <= 0) {
                clearInterval(prepRef.current);
                beginSpeaking();
            }
        }, 1000);
    };

    const beginSpeaking = async () => {
        setPhase('speaking');
        setTimeLeft(TOTAL_TIME);
        transcriptRef.current = '';

        // Start Whisper recording — each chunk updates transcript live
        await startRecording((chunk) => {
            transcriptRef.current += (transcriptRef.current ? ' ' : '') + chunk;
            setFullTranscript(transcriptRef.current);
        });

        let t = TOTAL_TIME;
        timerRef.current = setInterval(() => {
            t--;
            setTimeLeft(t);
            if (t <= 0) {
                clearInterval(timerRef.current);
                finishSpeaking();
            }
        }, 1000);
    };

    const finishSpeaking = useCallback(async () => {
        clearInterval(timerRef.current);
        setPhase('evaluating');
        // Stop recording — returns the full final transcript
        const finalText = await stopRecording();
        const text = finalText || transcriptRef.current;
        setFullTranscript(text);
        setTimeout(() => runEvaluation(text), 300);
    }, [stopRecording]);

    const runEvaluation = async (text) => {
        if (!text.trim()) {
            setError('No speech was detected. Please try again and allow microphone access.');
            setPhase('ready');
            return;
        }
        try {
            const result = await groqChat([
                { role: 'system', content: 'You are a JAM (Just A Minute) speech evaluator for interview preparation.' },
                {
                    role: 'user',
                    content: `Evaluate the following JAM speech on the topic: "${topic}"\n\nSpeech transcript:\n"${text}"\n\nReturn ONLY valid JSON with this exact structure (no markdown):\n{\n  "fluency": 0-10,\n  "vocabulary": 0-10,\n  "relevance": 0-10,\n  "grammar": 0-10,\n  "overall": 0.0-10.0,\n  "filler_words": ["list", "of", "filler", "words", "found"],\n  "word_count": number,\n  "feedback": "2-sentence personalised feedback",\n  "strengths": ["strength 1", "strength 2"],\n  "improvements": ["improvement 1", "improvement 2"]\n}`,
                },
            ], { maxTokens: 512 });
            const parsed = JSON.parse(result.trim());
            setEvaluation(parsed);
            setPhase('results');
        } catch (err) {
            setError(err?.message || 'Evaluation failed. Please try again.');
            setPhase('ready');
        }
    };

    const reset = () => {
        clearInterval(timerRef.current);
        clearInterval(prepRef.current);
        cancelRecording();
        setPhase('ready');
        setTopic(pickTopic());
        setTimeLeft(TOTAL_TIME);
        setPrepCountdown(PREP_TIME);
        setFullTranscript('');
        setEvaluation(null);
        transcriptRef.current = '';
        setError('');
    };

    const timerClass = timeLeft <= 10 ? 'danger' : timeLeft <= 20 ? 'warning' : '';

    const highlightFillers = (text, fillers) => {
        if (!fillers?.length || !text) return text;
        const pattern = new RegExp(`\\b(${fillers.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
        return text.replace(pattern, `<mark class="jam-filler">$1</mark>`);
    };

    return (
        <div className="jam-page">
            <div className="page-header">
                <div className="container page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 className="page-header-title">JAM — Just A Minute</h1>
                        <p className="page-header-subtitle">Speak on a topic for 60 seconds and receive an AI evaluation</p>
                    </div>
                    {phase !== 'ready' && (
                        <button className="btn btn-outline btn-sm la-end-btn" onClick={reset}>
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="container jam-content">
                <div className="jam-layout">
                    {/* Main card */}
                    <div className="card card-padded jam-main">

                        {/* Topic */}
                        <div className="jam-topic-section">
                            <div className="form-label">Topic</div>
                            <p className="jam-topic">{topic}</p>
                        </div>

                        <div className="divider" style={{ margin: '20px 0' }} />

                        {/* PHASE: READY */}
                        {phase === 'ready' && (
                            <div className="jam-phase-center fade-in">
                                {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}
                                {whisperError && <div className="alert alert-error" style={{ marginBottom: 20 }}>{whisperError}</div>}
                                <div className="jam-timer-display timer-display" style={{ fontSize: 72, color: 'var(--color-navy)', opacity: 0.2 }}>
                                    {TOTAL_TIME}
                                </div>
                                <p className="text-secondary" style={{ marginBottom: 28, fontSize: 14 }}>
                                    Read your topic carefully. When ready, click Start. You will have {PREP_TIME} seconds to prepare before speaking begins.
                                </p>
                                <button className="btn btn-navy btn-lg" onClick={startPrep}>
                                    <Play size={18} /> Start JAM Session
                                </button>
                            </div>
                        )}

                        {/* PHASE: PREP */}
                        {phase === 'prep' && (
                            <div className="jam-phase-center fade-in">
                                <div className="form-label" style={{ marginBottom: 8 }}>Preparation Time</div>
                                <div className={`timer-display ${prepCountdown <= 2 ? 'danger' : 'warning'}`} style={{ fontSize: 80 }}>
                                    {prepCountdown}
                                </div>
                                <p className="text-secondary" style={{ marginTop: 12 }}>Collect your thoughts. Speaking starts automatically...</p>
                            </div>
                        )}

                        {/* PHASE: SPEAKING */}
                        {phase === 'speaking' && (
                            <div className="jam-speaking-layout fade-in">
                                <div className="jam-timer-col">
                                    <div className="form-label" style={{ marginBottom: 8 }}>Time Remaining</div>
                                    <div className={`timer-display ${timerClass}`}>{timeLeft}s</div>
                                    <div className="progress-bar-track" style={{ marginTop: 12, width: 180 }}>
                                        <div className="progress-bar-fill" style={{ width: `${(timeLeft / TOTAL_TIME) * 100}%` }} />
                                    </div>
                                    {isRecording && (
                                        <div className="la-listening-indicator" style={{ marginTop: 16 }}>
                                            <span className="pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} />
                                            Recording your speech...
                                        </div>
                                    )}
                                    <button className="btn btn-danger btn-sm" onClick={finishSpeaking} style={{ marginTop: 20 }}>
                                        <Square size={14} /> Stop Early
                                    </button>
                                </div>
                                <div className="jam-transcript-col">
                                    <div className="form-label" style={{ marginBottom: 8 }}>Live Transcript</div>
                                    <div className="jam-live-text">
                                        {fullTranscript}
                                        {!fullTranscript && (
                                            <span className="text-muted" style={{ fontSize: 14 }}>Speak now — your words will appear here in ~5 second chunks...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PHASE: EVALUATING */}
                        {phase === 'evaluating' && (
                            <div className="jam-phase-center fade-in">
                                <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
                                <p className="text-secondary" style={{ marginTop: 20 }}>Finalising transcript and analysing your speech with AI...</p>
                            </div>
                        )}

                        {/* PHASE: RESULTS */}
                        {phase === 'results' && evaluation && (
                            <div className="jam-results fade-in">
                                <div className="jam-scores-grid">
                                    {[
                                        { label: 'Fluency', val: evaluation.fluency },
                                        { label: 'Vocabulary', val: evaluation.vocabulary },
                                        { label: 'Relevance', val: evaluation.relevance },
                                        { label: 'Grammar', val: evaluation.grammar },
                                        { label: 'Overall', val: evaluation.overall, highlight: true },
                                    ].map(({ label, val, highlight }) => (
                                        <div key={label} className={`jam-score-card ${highlight ? 'jam-score-highlight' : ''}`}>
                                            <div className="jam-score-val">{val}<span>/10</span></div>
                                            <div className="jam-score-label">{label}</div>
                                            <div className="progress-bar-track" style={{ marginTop: 8 }}>
                                                <div className="progress-bar-fill" style={{ width: `${(val / 10) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {evaluation.feedback && (
                                    <div className="alert alert-info" style={{ marginBottom: 20 }}>{evaluation.feedback}</div>
                                )}

                                <div className="jam-feedback-row">
                                    <div className="jam-feedback-col">
                                        <div className="jam-feedback-head text-success">Strengths</div>
                                        {evaluation.strengths?.map((s, i) => <div key={i} className="gd-feedback-item">{s}</div>)}
                                    </div>
                                    <div className="jam-feedback-col">
                                        <div className="jam-feedback-head text-warning">Areas to Improve</div>
                                        {evaluation.improvements?.map((s, i) => <div key={i} className="gd-feedback-item">{s}</div>)}
                                    </div>
                                </div>

                                {evaluation.filler_words?.length > 0 && (
                                    <div className="jam-fillers-section">
                                        <div className="form-label" style={{ marginBottom: 8 }}>Filler Words Detected</div>
                                        <div className="jam-filler-tags">
                                            {evaluation.filler_words.map(f => (
                                                <span key={f} className="badge badge-warning">{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {fullTranscript && (
                                    <div className="jam-transcript-section">
                                        <div className="form-label" style={{ marginBottom: 8 }}>
                                            Your Transcript
                                            {evaluation.word_count && (
                                                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                                                    {evaluation.word_count} words
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className="jam-transcript-text"
                                            dangerouslySetInnerHTML={{ __html: highlightFillers(fullTranscript, evaluation.filler_words) }}
                                        />
                                    </div>
                                )}

                                <button className="btn btn-navy btn-lg" onClick={reset} style={{ marginTop: 24 }}>
                                    <RotateCcw size={17} /> Try Again with New Topic
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Side tips */}
                    <div className="jam-side">
                        <div className="card card-padded">
                            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-navy)', marginBottom: 14 }}>JAM Tips</h3>
                            <ul className="la-tips-list">
                                <li>State your position on the topic in the first 10 seconds</li>
                                <li>Use examples and data points to support your views</li>
                                <li>Avoid filler words like "um", "uh", "like", "you know"</li>
                                <li>Speak at a measured pace — neither too fast nor too slow</li>
                                <li>Conclude with a strong summary in the last 10 seconds</li>
                            </ul>
                        </div>
                        <div className="card card-padded" style={{ marginTop: 16 }}>
                            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-navy)', marginBottom: 10 }}>Scoring Criteria</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { label: 'Fluency', desc: 'Smoothness and natural flow of speech' },
                                    { label: 'Vocabulary', desc: 'Range and precision of words used' },
                                    { label: 'Relevance', desc: 'How closely the speech addresses the topic' },
                                    { label: 'Grammar', desc: 'Correctness of sentence construction' },
                                ].map(({ label, desc }) => (
                                    <div key={label}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-navy)' }}>{label}</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
