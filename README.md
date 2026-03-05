# CommSkill Pro 🎙️
### AI-Powered Communication Skills Platform

> Practice interviews, group discussions, JAM sessions, and grammar correction — all in one place, powered by Groq AI.

🌐 **Live Demo:** [commskill-pro-frontend.vercel.app](https://commskill-pro-frontend.vercel.app)

---

## ✨ Features

### 🎤 Live AI Voice Assistant
- Real-time voice conversation with an AI interview coach
- Speak naturally — Whisper STT transcribes your speech
- AI responds with feedback, follow-up questions, and tips
- Supports multiple interview types: HR, Technical, Aptitude

### 👥 Group Discussion Simulator
- Create or join a room with a unique code
- Real-time multi-user discussion powered by Socket.io
- Host controls topic, starts discussion, and triggers AI evaluation
- All participants get scored and ranked at the end

### ⏱️ JAM Session (Just A Minute)
- 60-second timed speaking challenge on a random topic
- AI scores your fluency, coherence, vocabulary, and confidence
- Instant detailed feedback after each session

### ✍️ Grammar Correction
- Paste any text and get inline grammar corrections
- AI explains each error with suggestions
- Improves writing for emails, essays, and reports

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router v7 |
| Backend | Node.js, Express |
| Real-time | Socket.io |
| AI (LLM) | Groq SDK — LLaMA 3.3 70B |
| Speech-to-Text | Groq Whisper Large V3 Turbo |
| Styling | Tailwind CSS, Lucide Icons |
| Deployment | Vercel (frontend), Render (backend) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Groq API Key — get one free at [console.groq.com](https://console.groq.com)

### 1. Clone the repository
```bash
git clone https://github.com/Prashanth-4503/commskill-pro.git
cd commskill-pro
```

### 2. Install frontend dependencies
```bash
npm install
```

### 3. Install backend dependencies
```bash
cd backend
npm install
```

### 4. Set up environment variables

Create `.env` in the **root folder**:
```env
VITE_BACKEND_URL=http://localhost:3001
```

Create `.env` in the **backend folder**:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=3001
```

### 5. Run the app

**Terminal 1 — Start backend:**
```bash
cd backend
node server.js
```

**Terminal 2 — Start frontend:**
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser 🎉

---

## 📁 Project Structure

```
commskill-pro/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route pages
│   ├── utils/
│   │   └── groqClient.js  # Groq API proxy calls
│   └── main.jsx
├── backend/
│   ├── server.js          # Express + Socket.io + Groq API
│   ├── package.json
│   └── .env               # ← never committed
├── index.html
├── vite.config.js
├── package.json
└── .env                   # ← never committed
```

---

## 🔐 Security

- Groq API key is stored **only on the backend** — never exposed to the browser
- All AI requests are proxied through the Express backend
- `.env` files are excluded via `.gitignore`

---

## 🌐 Deployment

| Service | Purpose | URL |
|---------|---------|-----|
| Vercel | Frontend hosting | [commskill-pro-frontend.vercel.app](https://commskill-pro-frontend.vercel.app) |
| Render | Backend + API | commskill-pro-backend.onrender.com |

---

## 📌 Planned Features

- [ ] Aptitude Test Module
- [ ] Technical Round Simulator
- [ ] HR Interview Module
- [ ] Resume Analyser
- [ ] User Authentication & Progress Tracking

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📄 License

MIT License — feel free to use and modify!

---

<p align="center">Made with ❤️ by <a href="https://github.com/Prashanth-4503">Prashanth R</a></p>
