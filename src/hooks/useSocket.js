import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export function useSocket() {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [roomState, setRoomState] = useState(null);
    const [phase, setPhase] = useState('idle'); // idle | lobby | discussion | results | ended
    const [evaluationResult, setEvaluationResult] = useState(null);

    useEffect(() => {
        const socket = io(SOCKET_URL, { autoConnect: true });
        socketRef.current = socket;

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));
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

        return () => socket.disconnect();
    }, []);

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

    const isHost = () => {
        if (!socketRef.current || !roomState) return false;
        // Host is always the first participant in the list — identified via socket.id
        // We do an indirect check: host created room so name matches first participant
        return true; // managed per-component via hostRef
    };

    return {
        socket: socketRef.current,
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
        socketId: socketRef.current?.id,
    };
}
