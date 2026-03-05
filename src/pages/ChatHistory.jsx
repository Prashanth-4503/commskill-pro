import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Trash2, Clock, ChevronRight, AlertTriangle, Inbox } from 'lucide-react';
import { getSessions, deleteSession, clearAll } from '../utils/chatHistory';
import './ChatHistory.css';

export default function ChatHistory() {
    const [sessions, setSessions] = useState([]);
    const [confirmClear, setConfirmClear] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setSessions(getSessions());
    }, []);

    const handleDelete = (e, id) => {
        e.stopPropagation();
        deleteSession(id);
        setSessions(getSessions());
    };

    const handleClearAll = () => {
        if (!confirmClear) {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
            return;
        }
        clearAll();
        setSessions([]);
        setConfirmClear(false);
    };

    const handleResume = (id) => {
        navigate(`/live-assistant?session=${id}`);
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const msgCount = (msgs) => {
        if (!msgs) return 0;
        return msgs.filter(m => m.role !== 'system').length;
    };

    return (
        <div className="ch-page">
            <div className="page-header">
                <div className="container page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 className="page-header-title">Chat History</h1>
                        <p className="page-header-subtitle">Resume your past Live Assistant conversations</p>
                    </div>
                    {sessions.length > 0 && (
                        <button
                            className={`btn ${confirmClear ? 'btn-danger' : 'btn-outline'} btn-sm`}
                            onClick={handleClearAll}
                        >
                            {confirmClear ? (
                                <><AlertTriangle size={14} /> Confirm Clear All</>
                            ) : (
                                <><Trash2 size={14} /> Clear All</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="container ch-content">
                {sessions.length === 0 ? (
                    <div className="ch-empty-state fade-in">
                        <div className="ch-empty-icon">
                            <Inbox size={48} strokeWidth={1.5} />
                        </div>
                        <h2 className="ch-empty-title">No conversations yet</h2>
                        <p className="ch-empty-text">
                            Start a conversation in Live Assistant and it will automatically appear here.
                        </p>
                        <button className="btn btn-navy" onClick={() => navigate('/live-assistant')}>
                            <MessageSquare size={16} /> Start a Conversation
                        </button>
                    </div>
                ) : (
                    <div className="ch-sessions-list">
                        {sessions.map((session, idx) => (
                            <div
                                key={session.id}
                                className="ch-session-card card fade-in"
                                style={{ animationDelay: `${idx * 0.05}s` }}
                                onClick={() => handleResume(session.id)}
                            >
                                <div className="ch-session-icon">
                                    <MessageSquare size={20} />
                                </div>
                                <div className="ch-session-body">
                                    <div className="ch-session-title">{session.title || 'Untitled Conversation'}</div>
                                    <div className="ch-session-meta">
                                        <span className="ch-session-meta-item">
                                            <Clock size={12} /> {formatTime(session.updatedAt)}
                                        </span>
                                        <span className="ch-session-meta-item">
                                            {msgCount(session.messages)} messages
                                        </span>
                                    </div>
                                </div>
                                <div className="ch-session-actions">
                                    <button
                                        className="ch-delete-btn"
                                        onClick={(e) => handleDelete(e, session.id)}
                                        title="Delete conversation"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                    <ChevronRight size={18} className="ch-session-arrow" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
