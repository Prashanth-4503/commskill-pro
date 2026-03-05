const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function classifyError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('429')) {
    const e = new Error('GROQ rate limit reached. Please wait a few seconds and try again.');
    e.type = 'rate_limit';
    return e;
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid api key')) {
    const e = new Error('Invalid GROQ API key. Please check your server .env file.');
    e.type = 'auth';
    return e;
  }
  const e = new Error('Could not reach the AI. Please check your connection and try again.');
  e.type = 'network';
  return e;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function groqChat(messages, options = {}) {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/groq/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, options }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      return data.content || '';
    } catch (err) {
      const classified = classifyError(err);
      if (classified.type === 'auth') throw classified;
      if (attempt < maxRetries) {
        const delay = (attempt + 1) * 2000;
        console.warn(`[groqChat] Attempt ${attempt + 1} failed (${classified.type}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw classified;
    }
  }
}

export async function groqChatStream(messages, onChunk, options = {}) {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/groq/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, options }),
      });
      if (!res.ok) throw new Error(`${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') return;
            try {
              const { text } = JSON.parse(raw);
              if (text) onChunk(text);
            } catch {
              // skip malformed SSE chunks
            }
          }
        }
      }
      return;
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

export async function groqWhisper(audioBlob, language = 'en') {
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('language', language);

      const res = await fetch(`${BASE}/api/groq/whisper`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      return data.text?.trim() || '';
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
