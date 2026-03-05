import Groq from 'groq-sdk';

const client = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
});

/**
 * Classify an API error into a typed error with a user-friendly message.
 */
function classifyError(err) {
    const status = err?.status || err?.response?.status || err?.statusCode;
    const msg = (err?.message || '').toLowerCase();

    if (status === 429 || msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many requests')) {
        const e = new Error('GROQ rate limit reached. The free API allows 30 requests/min. Please wait a few seconds and try again.');
        e.type = 'rate_limit';
        return e;
    }
    if (status === 401 || status === 403 || msg.includes('invalid api key') || msg.includes('authentication')) {
        const e = new Error('Invalid GROQ API key. Please check your .env file and restart the app.');
        e.type = 'auth';
        return e;
    }
    const e = new Error('Could not reach the AI. Please check your internet connection and try again.');
    e.type = 'network';
    return e;
}

/**
 * Sleep for ms milliseconds.
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Send a chat completion request to Groq with retry.
 * @param {Array} messages - Array of { role, content } objects
 * @param {Object} options - Optional overrides (model, temperature, etc.)
 * @returns {Promise<string>} - The assistant's response text
 */
export async function groqChat(messages, options = {}) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const completion = await client.chat.completions.create({
                model: options.model || 'llama-3.3-70b-versatile',
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens || 1024,
                ...options.extra,
            });
            return completion.choices[0]?.message?.content || '';
        } catch (err) {
            const classified = classifyError(err);
            // Don't retry auth errors
            if (classified.type === 'auth') throw classified;
            // Retry rate-limit and network errors
            if (attempt < maxRetries) {
                const delay = (attempt + 1) * 2000; // 2s, 4s
                console.warn(`[groqChat] Attempt ${attempt + 1} failed (${classified.type}), retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            throw classified;
        }
    }
}

/**
 * Stream a chat completion from Groq with retry.
 * @param {Array} messages
 * @param {Function} onChunk - called with each text chunk
 * @param {Object} options
 */
export async function groqChatStream(messages, onChunk, options = {}) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const stream = await client.chat.completions.create({
                model: options.model || 'llama-3.3-70b-versatile',
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens || 1024,
                stream: true,
                ...options.extra,
            });
            for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) onChunk(text);
            }
            return; // Success
        } catch (err) {
            const classified = classifyError(err);
            if (classified.type === 'auth') throw classified;
            if (attempt < maxRetries) {
                const delay = (attempt + 1) * 2000;
                console.warn(`[groqChatStream] Attempt ${attempt + 1} failed (${classified.type}), retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            throw classified;
        }
    }
}

/**
 * Transcribe audio using Groq Whisper (with retry).
 * @param {Blob} audioBlob - The recorded audio blob (webm, mp4, wav, etc.)
 * @param {string} language - Language code, default 'en'
 * @returns {Promise<string>} - The transcribed text
 */
export async function groqWhisper(audioBlob, language = 'en') {
    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' });
            const transcription = await client.audio.transcriptions.create({
                file,
                model: 'whisper-large-v3-turbo',
                language,
                response_format: 'text',
            });
            return (typeof transcription === 'string' ? transcription : transcription?.text || '').trim();
        } catch (err) {
            const classified = classifyError(err);
            if (classified.type === 'auth') throw classified;
            if (attempt < maxRetries) {
                const delay = (attempt + 1) * 2000;
                console.warn(`[groqWhisper] Attempt ${attempt + 1} failed (${classified.type}), retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            throw classified;
        }
    }
}

export default client;
