import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import LiveAssistant from './pages/LiveAssistant';
import GroupDiscussion from './pages/GroupDiscussion';
import JAM from './pages/JAM';
import GrammarCorrection from './pages/GrammarCorrection';
import ChatHistory from './pages/ChatHistory';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="page-wrapper">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live-assistant" element={<LiveAssistant />} />
          <Route path="/group-discussion" element={<GroupDiscussion />} />
          <Route path="/jam" element={<JAM />} />
          <Route path="/grammar" element={<GrammarCorrection />} />
          <Route path="/history" element={<ChatHistory />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
