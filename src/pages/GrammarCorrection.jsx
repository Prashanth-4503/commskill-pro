import React, { useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, RefreshCw, Zap } from 'lucide-react';
import { groqChat } from '../utils/groqClient';
import './GrammarCorrection.css';

const LT_API = 'https://api.languagetool.org/v2/check';

const CATEGORY_META = {
    GRAMMAR: { label: 'Grammar', color: 'var(--color-danger)', bgClass: 'err-grammar' },
    TYPOS: { label: 'Spelling', color: 'var(--color-warning)', bgClass: 'err-spelling' },
    SPELLING: { label: 'Spelling', color: 'var(--color-warning)', bgClass: 'err-spelling' },
    STYLE: { label: 'Style', color: 'var(--color-blue)', bgClass: 'err-style' },
    PUNCTUATION: { label: 'Punctuation', color: 'var(--color-warning)', bgClass: 'err-spelling' },
    default: { label: 'Suggestion', color: 'var(--color-blue)', bgClass: 'err-style' },
};

function getMeta(categoryId) {
    return CATEGORY_META[categoryId] || CATEGORY_META.default;
}

export default function GrammarCorrection() {
    const [inputText, setInputText] = useState('');
    const [matches, setMatches] = useState([]);
    const [checking, setChecking] = useState(false);
    const [correctedText, setCorrectedText] = useState('');
    const [activeMatch, setActiveMatch] = useState(null);
    const [explanation, setExplanation] = useState('');
    const [explaining, setExplaining] = useState(false);
    const [error, setError] = useState('');
    const [checked, setChecked] = useState(false);

    const checkGrammar = async () => {
        if (!inputText.trim()) return;
        setChecking(true);
        setChecked(false);
        setError('');
        setMatches([]);
        setActiveMatch(null);
        setCorrectedText('');
        try {
            const params = new URLSearchParams({ text: inputText, language: 'en-US', enabledOnly: 'false' });
            const res = await fetch(LT_API, { method: 'POST', body: params });
            if (!res.ok) throw new Error('LanguageTool API error');
            const data = await res.json();
            setMatches(data.matches || []);
            setChecked(true);
        } catch {
            setError('Grammar check failed. The LanguageTool API may be temporarily unavailable. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    const autoFixAll = useCallback(() => {
        if (!matches.length) return;
        let text = inputText;
        let offset = 0;
        const sorted = [...matches].sort((a, b) => a.offset - b.offset);
        for (const m of sorted) {
            if (!m.replacements?.length) continue;
            const replacement = m.replacements[0].value;
            const start = m.offset + offset;
            const end = start + m.length;
            text = text.slice(0, start) + replacement + text.slice(end);
            offset += replacement.length - m.length;
        }
        setCorrectedText(text);
        setMatches([]);
        setActiveMatch(null);
    }, [matches, inputText]);

    const applySingle = (match) => {
        if (!match.replacements?.length) return;
        const replacement = match.replacements[0].value;
        const before = inputText.slice(0, match.offset);
        const after = inputText.slice(match.offset + match.length);
        setInputText(before + replacement + after);
        setMatches(prev => prev.filter(m => m !== match));
        setActiveMatch(null);
    };

    const explainError = async (match) => {
        setActiveMatch(match);
        setExplanation('');
        setExplaining(true);
        try {
            const exp = await groqChat([
                { role: 'system', content: 'You are a grammar tutor. Explain grammar errors in plain, friendly English in 2-3 sentences. No jargon.' },
                {
                    role: 'user',
                    content: `The following grammar/style error was found in a sentence.\nError message: "${match.message}"\nOriginal text: "${match.context?.text}"\nSuggested correction: "${match.replacements?.[0]?.value || 'none'}"\n\nExplain this error in simple terms.`,
                },
            ], { maxTokens: 200 });
            setExplanation(exp.trim());
        } catch (err) {
            setExplanation(err?.message || 'Could not fetch explanation. Please try again.');
        } finally {
            setExplaining(false);
        }
    };

    const buildHighlightedText = () => {
        if (!inputText || !matches.length) return <span>{inputText}</span>;
        const parts = [];
        let cursor = 0;
        const sorted = [...matches].sort((a, b) => a.offset - b.offset);
        for (const match of sorted) {
            if (match.offset > cursor) {
                parts.push(<span key={`t-${cursor}`}>{inputText.slice(cursor, match.offset)}</span>);
            }
            const meta = getMeta(match.rule?.category?.id);
            const isActive = activeMatch === match;
            parts.push(
                <mark
                    key={`m-${match.offset}`}
                    className={`gc-highlight ${meta.bgClass} ${isActive ? 'gc-active' : ''}`}
                    onClick={() => explainError(match)}
                    title={match.message}
                >
                    {inputText.slice(match.offset, match.offset + match.length)}
                    <span className="gc-highlight-tooltip">{match.message}</span>
                </mark>
            );
            cursor = match.offset + match.length;
        }
        if (cursor < inputText.length) {
            parts.push(<span key={`t-end`}>{inputText.slice(cursor)}</span>);
        }
        return parts;
    };

    const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length;
    const sentenceCount = inputText.split(/[.!?]+/).filter(s => s.trim()).length;

    return (
        <div className="gc-page">
            <div className="page-header">
                <div className="container">
                    <h1 className="page-header-title">Grammar Correction</h1>
                    <p className="page-header-subtitle">Paste any text to check grammar, spelling, and style with AI-powered explanations</p>
                </div>
            </div>

            <div className="container gc-content">
                {/* Stats bar */}
                <div className="gc-stats-bar card">
                    <div className="gc-stat">
                        <span className="gc-stat-val">{wordCount}</span>
                        <span className="gc-stat-label">Words</span>
                    </div>
                    <div className="gc-stat">
                        <span className="gc-stat-val">{sentenceCount}</span>
                        <span className="gc-stat-label">Sentences</span>
                    </div>
                    <div className="gc-stat">
                        <span className={`gc-stat-val ${matches.length > 0 ? 'text-danger' : checked ? 'text-success' : ''}`}>{matches.length}</span>
                        <span className="gc-stat-label">Issues Found</span>
                    </div>
                    <div className="gc-stat">
                        <span className="gc-stat-val">{matches.filter(m => getMeta(m.rule?.category?.id).label === 'Grammar').length}</span>
                        <span className="gc-stat-label">Grammar</span>
                    </div>
                    <div className="gc-stat">
                        <span className="gc-stat-val">{matches.filter(m => getMeta(m.rule?.category?.id).label === 'Spelling').length}</span>
                        <span className="gc-stat-label">Spelling</span>
                    </div>
                    <div className="gc-stat">
                        <span className="gc-stat-val">{matches.filter(m => getMeta(m.rule?.category?.id).label === 'Style').length}</span>
                        <span className="gc-stat-label">Style</span>
                    </div>
                    <div className="gc-stat-actions">
                        <button className="btn btn-primary" onClick={checkGrammar} disabled={!inputText.trim() || checking}>
                            {checking ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Checking...</> : 'Check Grammar'}
                        </button>
                        {matches.length > 0 && (
                            <button className="btn btn-success" onClick={autoFixAll}>
                                <Zap size={15} /> Auto-Fix All
                            </button>
                        )}
                        {(correctedText || inputText) && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setInputText(''); setCorrectedText(''); setMatches([]); setChecked(false); setActiveMatch(null); setExplanation(''); }}>
                                <RefreshCw size={14} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

                {/* Legend */}
                {checked && (
                    <div className="gc-legend fade-in">
                        <div className="gc-legend-item"><span className="gc-dot err-grammar" />Grammar</div>
                        <div className="gc-legend-item"><span className="gc-dot err-spelling" />Spelling / Punctuation</div>
                        <div className="gc-legend-item"><span className="gc-dot err-style" />Style</div>
                        <span className="text-sm text-muted">Click any highlighted word for details and to apply a fix.</span>
                    </div>
                )}

                <div className="gc-main-layout">
                    {/* Input / Highlighted panel */}
                    <div className="gc-panel">
                        <div className="gc-panel-header">
                            <span className="gc-panel-title">Input Text</span>
                            {checked && matches.length === 0 && (
                                <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={13} /> No issues found
                                </span>
                            )}
                        </div>
                        {checked && matches.length > 0 ? (
                            <div className="gc-highlighted-view">{buildHighlightedText()}</div>
                        ) : (
                            <textarea
                                className="form-input form-textarea gc-textarea"
                                placeholder="Paste or type your text here. For best results, write at least 2-3 complete sentences."
                                value={inputText}
                                onChange={e => { setInputText(e.target.value); setChecked(false); setMatches([]); setCorrectedText(''); }}
                                rows={14}
                            />
                        )}
                    </div>

                    {/* Output / Corrections panel */}
                    <div className="gc-panel">
                        <div className="gc-panel-header">
                            <span className="gc-panel-title">
                                {correctedText ? 'Corrected Text' : 'Corrections'}
                            </span>
                        </div>

                        {correctedText && (
                            <div className="gc-corrected-text">{correctedText}</div>
                        )}

                        {!correctedText && matches.length === 0 && (
                            <div className="gc-empty-state">
                                {checked ? (
                                    <><CheckCircle size={40} color="var(--color-success)" style={{ marginBottom: 12 }} /><p>No issues found. Your text looks good.</p></>
                                ) : (
                                    <><Info size={40} color="var(--color-blue)" style={{ marginBottom: 12 }} /><p>Enter text on the left and click "Check Grammar" to begin analysis.</p></>
                                )}
                            </div>
                        )}

                        {!correctedText && matches.length > 0 && (
                            <div className="gc-matches-list">
                                {matches.map((m, i) => {
                                    const meta = getMeta(m.rule?.category?.id);
                                    const isActive = activeMatch === m;
                                    return (
                                        <div key={i} className={`gc-match-card ${isActive ? 'gc-match-active' : ''}`} onClick={() => explainError(m)}>
                                            <div className="gc-match-header">
                                                <span className="badge" style={{ background: meta.color + '20', color: meta.color }}>{meta.label}</span>
                                                <span className="gc-match-word">"{m.context?.text?.slice(m.context.offset, m.context.offset + m.context.length)}"</span>
                                            </div>
                                            <p className="gc-match-message">{m.message}</p>
                                            {m.replacements?.length > 0 && (
                                                <div className="gc-match-suggestions">
                                                    {m.replacements.slice(0, 3).map((r, ri) => (
                                                        <button
                                                            key={ri}
                                                            className="badge badge-blue gc-suggestion-btn"
                                                            onClick={(e) => { e.stopPropagation(); applySingle(m); }}
                                                        >
                                                            {r.value}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {isActive && (
                                                <div className="gc-explanation fade-in">
                                                    {explaining ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                                            <span className="text-sm text-muted">Generating explanation...</span>
                                                        </div>
                                                    ) : explanation ? (
                                                        <p className="gc-explanation-text">{explanation}</p>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
