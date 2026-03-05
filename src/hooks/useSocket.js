import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useSocket() {
    const [socket] = useState(() => io(SOCKET_URL, { autoConnect: true }));
    const [socketId, setSocketId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [roomState, setRoomState] = useState(null);
    const [phase, setPhase] = useState('idle');
    const [evaluationResult, setEvaluationResult] = useState(null);
    const socketRef = useRef(socket);

    useEffect(() => {
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setSocketId(socket.id);
        });
        socket.on('disconnect', () => {
            setConnected(false);
            setSocketId(null);
        });
        socket.on('room-update', (data) => setRoomState(data));
        socket.on('phase-change', ({ phase: p, topic }) => {
            setPhase(p);
            if (topic) setRoomState(prev => prev ? { ...prev, topic } : prev);
        });
        socket.on('evaluation-result', (result) => setEvaluationResult(result));
        socket.on('room-ended', () => {
            setPhase('ended');
            setRoomState(null);
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('room-update');
            socket.off('phase-change');
            socket.off('evaluation-result');
            socket.off('room-ended');
            socket.disconnect();
        };
    }, [socket]);

    const createRoom = useCallback((name) => {
        return new Promise((resolve) => {
            socketRef.current?.emit('create-room', { name }, (res) => {
                if (res.success) setPhase('lobby');
                resolve(res);
            });
        });
    }, []);

    const joinRoom = useCallback((name, roomCode) => {
        return new Promise((resolve) => {
            socketRef.current?.emit('join-room', { name, roomCode }, (res) => {
                if (res.success) setPhase('lobby');
                resolve(res);
            });
        });
    }, []);

    const setTopic = useCallback((topic) => {
        return new Promise((resolve) => {
            socketRef.current?.emit('set-topic', { topic }, resolve);
        });
    }, []);

    const submitSpeech = useCallback((speech) => {
        return new Promise((resolve) => {
            socketRef.current?.emit('submit-speech', { speech }, resolve);
        });
    }, []);

    const getSpeeches = useCallback(() => {
        return new Promise((resolve) => {
            socketRef.current?.emit('get-speeches', resolve);
        });
    }, []);

    const broadcastEvaluation = useCallback((result) => {
        return new Promise((resolve) => {
            socketRef.current?.emit('request-evaluation', { evaluationResult: result }, resolve);
        });
    }, []);

    const endRoom = useCallback(() => {
        socketRef.current?.emit('end-room');
        setPhase('idle');
        setRoomState(null);
        setEvaluationResult(null);
    }, []);

    return {
        socket,
        connected,
        roomState,
        phase,
        evaluationResult,
        createRoom,
        joinRoom,
        setTopic,
        submitSpeech,
        getSpeeches,
        broadcastEvaluation,
        endRoom,
        socketId,
    };
}
