/**
 * Chat History — localStorage utility for saving/loading Live Assistant sessions.
 * Key: commskill_chat_history
 */

const STORAGE_KEY = 'commskill_chat_history';

function readAll() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function writeAll(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** Get all saved sessions, newest first. */
export function getSessions() {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Get a single session by ID. */
export function getSession(id) {
    return readAll().find(s => s.id === id) || null;
}

/** Save (create or update) a session. */
export function saveSession(session) {
    const sessions = readAll();
    const idx = sessions.findIndex(s => s.id === session.id);
    const now = Date.now();

    const updated = {
        ...session,
        updatedAt: now,
        createdAt: session.createdAt || now,
        title: session.title || generateTitle(session.messages),
    };

    if (idx >= 0) {
        sessions[idx] = updated;
    } else {
        sessions.push(updated);
    }
    writeAll(sessions);
    return updated;
}

/** Delete a session by ID. */
export function deleteSession(id) {
    writeAll(readAll().filter(s => s.id !== id));
}

/** Clear all sessions. */
export function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
}

/** Generate a title from the first user message. */
function generateTitle(messages) {
    const first = messages?.find(m => m.role === 'user');
    if (!first) return 'New Conversation';
    const text = first.content.trim();
    return text.length > 50 ? text.slice(0, 50) + '...' : text;
}

/** Generate a unique session ID. */
export function newSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
