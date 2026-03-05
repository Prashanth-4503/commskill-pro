import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, Timer, FileText, ArrowRight, TrendingUp, Target, Award } from 'lucide-react';
import './Home.css';

const modules = [
    {
        to: '/live-assistant',
        icon: MessageSquare,
        title: 'Live Assistant',
        subtitle: 'AI Voice Coach',
        description: 'Voice-to-voice AI conversation partner. Speak naturally — the AI responds aloud, just like a real coaching session.',
        features: ['Gemini Live-style interface', 'Animated voice orb', 'Session evaluation'],
        color: 'blue',
    },
    {
        to: '/group-discussion',
        icon: Users,
        title: 'Group Discussion',
        subtitle: 'Multi-User GD Simulator',
        description: 'Create or join a live GD room with real participants. AI generates the topic, evaluates each person individually, and ranks everyone.',
        features: ['Live room with shareable code', 'Multi-participant rooms', 'Individual AI scoring + leaderboard'],
        color: 'navy',
        highlight: true,
    },
    {
        to: '/jam',
        icon: Timer,
        title: 'JAM Session',
        subtitle: 'Just A Minute Practice',
        description: 'Speak on a random topic for one minute while your speech is transcribed live. AI scores fluency, vocabulary, relevance and highlights filler words.',
        features: ['60-second timed speaking', 'Live transcription', 'Filler word detection'],
        color: 'green',
    },
    {
        to: '/grammar',
        icon: FileText,
        title: 'Grammar Check',
        subtitle: 'Writing Improvement',
        description: 'Paste any text for instant inline grammar, spelling, and style corrections. Click any error for an AI-powered plain-English explanation.',
        features: ['Inline error highlights', 'Auto-fix all errors', 'AI explanations per error'],
        color: 'purple',
    },
];

const stats = [
    { icon: TrendingUp, label: 'Modules Available', value: '4' },
    { icon: Target, label: 'Skills Covered', value: '12+' },
    { icon: Award, label: 'Interview Rounds', value: 'GD + JAM + Voice' },
];

export default function Home() {
    return (
        <div className="home">
            <section className="hero">
                <div className="container">
                    <div className="hero-label">Final Year Project — Communication Skills Platform</div>
                    <h1 className="hero-title">
                        Master the Communication Skills
                        <br />
                        <span className="hero-title-accent">That Interviews Demand</span>
                    </h1>
                    <p className="hero-description">
                        Today's generation struggles with verbal communication. CommSkill Pro provides structured,
                        AI-powered practice for Group Discussions, JAM sessions, live voice coaching, and written
                        grammar — everything you need before walking into an interview room.
                    </p>
                    <div className="hero-actions">
                        <Link to="/live-assistant" className="btn btn-navy btn-lg">
                            Start Practicing <ArrowRight size={18} />
                        </Link>
                        <Link to="/group-discussion" className="btn btn-outline btn-lg">
                            Join a GD Room
                        </Link>
                    </div>
                    <div className="hero-stats">
                        {stats.map(({ icon: Icon, label, value }) => (
                            <div key={label} className="stat-card card card-padded">
                                <Icon size={20} className="stat-icon" />
                                <div className="stat-value">{value}</div>
                                <div className="stat-label">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="modules-section">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Practice Modules</h2>
                        <p className="section-subtitle">Four focused modules covering every aspect of verbal and written communication</p>
                    </div>
                    <div className="modules-grid">
                        {modules.map((mod) => {
                            const Icon = mod.icon;
                            return (
                                <Link key={mod.to} to={mod.to} className={`module-card ${mod.highlight ? 'module-card-featured' : ''}`}>
                                    <div className={`module-icon-wrap color-${mod.color}`}>
                                        <Icon size={22} />
                                    </div>
                                    <div className="module-header">
                                        <h3 className="module-title">{mod.title}</h3>
                                        <span className="module-subtitle">{mod.subtitle}</span>
                                    </div>
                                    <p className="module-description">{mod.description}</p>
                                    <ul className="module-features">
                                        {mod.features.map(f => <li key={f}>{f}</li>)}
                                    </ul>
                                    <div className="module-cta">Open Module <ArrowRight size={14} /></div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="roadmap-section">
                <div className="container">
                    <div className="roadmap-card card">
                        <div className="roadmap-header">
                            <h2 className="roadmap-title">Roadmap — Coming Soon</h2>
                            <p className="roadmap-subtitle">Future modules to complete the end-to-end interview preparation experience</p>
                        </div>
                        <div className="roadmap-grid">
                            {[
                                { title: 'Aptitude Test', desc: 'Quantitative, logical, and verbal reasoning with explanations.' },
                                { title: 'Technical Round', desc: 'Domain MCQs and coding questions with AI evaluation.' },
                                { title: 'HR Interview', desc: 'AI mock HR interview with confidence and content scoring.' },
                                { title: 'Resume Analyser', desc: 'Upload your resume and get AI-driven improvement suggestions.' },
                            ].map(({ title, desc }) => (
                                <div key={title} className="roadmap-item">
                                    <div className="roadmap-item-title">{title}</div>
                                    <div className="roadmap-item-desc">{desc}</div>
                                    <span className="badge badge-muted" style={{ marginTop: 12, width: 'fit-content' }}>Planned</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
