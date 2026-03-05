const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
});

// In-memory room store
// rooms: { roomCode -> { topic, hostId, participants: [{id, name, speech, submitted}], phase } }
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GD-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Host creates a room
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

  // Participant joins a room
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

  // Host sets the topic and starts the discussion
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

  // Participant submits their speech
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

  // Host triggers evaluation
  socket.on('request-evaluation', ({ evaluationResult }, callback) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return callback?.({ success: false });
    room.phase = 'results';
    io.to(code).emit('phase-change', { phase: 'results' });
    io.to(code).emit('evaluation-result', evaluationResult);
    callback?.({ success: true });
  });

  // Host ends the room
  socket.on('end-room', () => {
    const code = socket.data.roomCode;
    if (code) {
      io.to(code).emit('room-ended');
      rooms.delete(code);
    }
  });

  // Get room speeches (for host to run evaluation)
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

// Strip sensitive data before sending to clients
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

const PORT = 3001;
httpServer.listen(PORT, () => console.log(`CommSkill Pro backend running on port ${PORT}`));
