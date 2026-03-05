/* global require, process */
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Groq = require('groq-sdk');
const multer = require('multer');
const upload = multer();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST']
}));

app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Groq Chat ──────────────────────────────────────────────
app.post('/api/groq/chat', async (req, res) => {
  try {
    const { messages, options = {} } = req.body;
    const completion = await groq.chat.completions.create({
      model: options.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 1024,
      ...options.extra,
    });
    res.json({ content: completion.choices[0]?.message?.content || '' });
  } catch (err) {
    console.error('[/api/groq/chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Groq Chat Stream ───────────────────────────────────────
app.post('/api/groq/chat-stream', async (req, res) => {
  try {
    const { messages, options = {} } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await groq.chat.completions.create({
      model: options.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 1024,
      stream: true,
      ...options.extra,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[/api/groq/chat-stream]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Groq Whisper ───────────────────────────────────────────
app.post('/api/groq/whisper', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = new File(
      [req.file.buffer],
      'audio.webm',
      { type: req.file.mimetype || 'audio/webm' }
    );
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: req.body.language || 'en',
      response_format: 'text',
    });
    res.json({
      text: typeof transcription === 'string'
        ? transcription
        : transcription?.text || ''
    });
  } catch (err) {
    console.error('[/api/groq/whisper]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Socket.io setup ────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GD-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('create-room', ({ name }, callback) => {
    const code = generateRoomCode();
    const room = {
      topic: null,
      hostId: socket.id,
      participants: [{ id: socket.id, name, speech: '', submitted: false }],
      phase: 'lobby'
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;
    callback({ success: true, roomCode: code });
    io.to(code).emit('room-update', sanitizeRoom(room, code));
    console.log(`Room ${code} created by ${name}`);
  });

  socket.on('join-room', ({ name, roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return callback({ success: false, error: 'Room not found. Check the code and try again.' });
    if (room.phase !== 'lobby') return callback({ success: false, error: 'Discussion has already started. You cannot join now.' });
    if (room.participants.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      return callback({ success: false, error: 'That name is already taken in this room.' });
    }
    room.participants.push({ id: socket.id, name, speech: '', submitted: false });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name;
    callback({ success: true });
    io.to(roomCode).emit('room-update', sanitizeRoom(room, roomCode));
    console.log(`${name} joined room ${roomCode}`);
  });

  socket.on('set-topic', ({ topic }, callback) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return callback?.({ success: false });
    room.topic = topic;
    room.phase = 'discussion';
    io.to(code).emit('room-update', sanitizeRoom(room, code));
    io.to(code).emit('phase-change', { phase: 'discussion', topic });
    callback?.({ success: true });
  });

  socket.on('submit-speech', ({ speech }, callback) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return callback?.({ success: false });
    const participant = room.participants.find(p => p.id === socket.id);
    if (!participant) return callback?.({ success: false });
    participant.speech = speech;
    participant.submitted = true;
    io.to(code).emit('room-update', sanitizeRoom(room, code));
    callback?.({ success: true });
    console.log(`${participant.name} submitted speech in room ${code}`);
  });

  socket.on('request-evaluation', ({ evaluationResult }, callback) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return callback?.({ success: false });
    room.phase = 'results';
    io.to(code).emit('phase-change', { phase: 'results' });
    io.to(code).emit('evaluation-result', evaluationResult);
    callback?.({ success: true });
  });

  socket.on('end-room', () => {
    const code = socket.data.roomCode;
    if (code) {
      io.to(code).emit('room-ended');
      rooms.delete(code);
    }
  });

  socket.on('get-speeches', (callback) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return callback?.({ success: false });
    callback({ success: true, participants: room.participants, topic: room.topic });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.participants = room.participants.filter(p => p.id !== socket.id);
    if (room.hostId === socket.id) {
      io.to(code).emit('room-ended');
      rooms.delete(code);
    } else {
      io.to(code).emit('room-update', sanitizeRoom(room, code));
    }
  });
});

function sanitizeRoom(room, code) {
  return {
    roomCode: code,
    topic: room.topic,
    phase: room.phase,
    participants: room.participants.map(p => ({
      name: p.name,
      submitted: p.submitted
    }))
  };
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`CommSkill Pro backend running on port ${PORT}`));
