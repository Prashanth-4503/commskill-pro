import { useRef, useState, useCallback } from 'react';
import { groqWhisper } from '../utils/groqClient';

/**
 * useWhisper — MediaRecorder + Groq Whisper STT hook.
 * 
 * Uses a STOP/RESTART CYCLE approach: every ~6 seconds, the recorder is stopped
 * (producing a complete, valid audio file), transcribed via Whisper, then a new
 * recorder is started. This ensures every audio blob has proper container headers.
 *
 * Usage (continuous, for JAM / GD):
 *   startRecording((chunk) => setTranscript(t => t + ' ' + chunk));
 *   const final = await stopRecording();
 *
 * Usage (single-shot, for Live Assistant):
 *   startRecording();
 *   const text = await stopRecording();
 */

const CYCLE_DURATION = 6000; // 6 seconds per recording cycle

function getMimeType() {
    if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
        if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    }
    return 'audio/mp4';
}

async function transcribeBlob(blob) {
    if (!blob || blob.size < 2000) {
        console.log('[useWhisper] Blob too small:', blob?.size, 'bytes — skipping');
        return ''; // too small — silence
    }
    try {
        console.log('[useWhisper] Sending blob to Whisper, size:', blob.size, 'bytes');
        const text = await groqWhisper(blob);
        console.log('[useWhisper] Whisper returned:', JSON.stringify(text));
        // Whisper returns '.' or '..' for silence — filter that out
        if (!text || /^[.\s]+$/.test(text)) return '';
        return text.trim();
    } catch (e) {
        console.warn('[useWhisper] Whisper transcription error:', e);
        return '';
    }
}

export function useWhisper() {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);

    const streamRef = useRef(null);
    const recorderRef = useRef(null);
    const stoppedRef = useRef(false);
    const fullTranscriptRef = useRef('');
    const onChunkRef = useRef(null);
    const cycleTimerRef = useRef(null);
    const resolveStopRef = useRef(null);
    const singleChunksRef = useRef([]);

    /**
     * Start one recording cycle. When it stops (either by timer or manual stop),
     * the audio is transcribed and the callback is invoked. If not manually stopped,
     * a new cycle automatically begins.
     */
    const startCycle = useCallback((stream) => {
        if (stoppedRef.current || !stream.active) return;

        const mimeType = getMimeType();
        const recorder = new MediaRecorder(stream, { mimeType });
        const localChunks = [];

        recorder.ondataavailable = (e) => {
            if (e.data?.size > 0) localChunks.push(e.data);
        };

        recorder.onstop = async () => {
            // Build a complete, valid audio blob from this cycle
            const blob = new Blob(localChunks, { type: mimeType });
            const text = await transcribeBlob(blob);

            if (text) {
                fullTranscriptRef.current += (fullTranscriptRef.current ? ' ' : '') + text;
                if (onChunkRef.current) onChunkRef.current(text);
            }

            // If manually stopped, resolve the stopRecording promise
            if (stoppedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                recorderRef.current = null;
                setIsRecording(false);
                if (resolveStopRef.current) {
                    resolveStopRef.current(fullTranscriptRef.current);
                    resolveStopRef.current = null;
                }
            } else {
                // Start next cycle automatically
                startCycle(stream);
            }
        };

        recorderRef.current = recorder;
        recorder.start(); // No timeslice — ondataavailable fires once on stop with full data

        // Auto-stop after CYCLE_DURATION to create a cycle
        cycleTimerRef.current = setTimeout(() => {
            if (!stoppedRef.current && recorder.state === 'recording') {
                recorder.stop();
            }
        }, CYCLE_DURATION);
    }, []);

    /**
     * Start recording.
     * @param {Function|null} onChunk — called with each transcribed text chunk (for live display).
     *                                   If null, operates in single-shot mode.
     */
    const startRecording = useCallback(async (onChunk = null) => {
        setError(null);
        stoppedRef.current = false;
        fullTranscriptRef.current = '';
        onChunkRef.current = onChunk;
        singleChunksRef.current = [];

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });
        } catch {
            setError('Microphone access denied. Please allow microphone in browser settings.');
            return;
        }

        streamRef.current = stream;
        setIsRecording(true);

        if (onChunk) {
            // CONTINUOUS MODE: cycle stop/restart every 6 seconds
            startCycle(stream);
        } else {
            // SINGLE-SHOT MODE: record until stopRecording() is called
            const mimeType = getMimeType();
            const recorder = new MediaRecorder(stream, { mimeType });

            recorder.ondataavailable = (e) => {
                if (e.data?.size > 0) singleChunksRef.current.push(e.data);
            };

            recorderRef.current = recorder;
            recorder.start(); // No timeslice — fires once on stop
        }
    }, [startCycle]);

    /**
     * Stop recording and return the final transcript.
     * @returns {Promise<string>}
     */
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            stoppedRef.current = true;
            clearTimeout(cycleTimerRef.current);

            const recorder = recorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                // Already stopped — resolve with what we have
                setIsRecording(false);
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                resolve(fullTranscriptRef.current);
                return;
            }

            if (onChunkRef.current) {
                // CONTINUOUS MODE: let the cycle's onstop handler do the final transcription
                resolveStopRef.current = resolve;
                recorder.stop();
            } else {
                // SINGLE-SHOT MODE: stop, build blob, transcribe
                recorder.onstop = async () => {
                    const mimeType = getMimeType();
                    const blob = new Blob(singleChunksRef.current, { type: mimeType });
                    console.log('[useWhisper] Single-shot: chunks:', singleChunksRef.current.length, 'blob size:', blob.size);
                    const text = await transcribeBlob(blob);
                    console.log('[useWhisper] Single-shot transcript:', JSON.stringify(text));
                    fullTranscriptRef.current = text;

                    streamRef.current?.getTracks().forEach(t => t.stop());
                    streamRef.current = null;
                    recorderRef.current = null;
                    setIsRecording(false);

                    resolve(text);
                };
                recorder.stop();
            }
        });
    }, []);

    /**
     * Cancel recording without transcription (cleanup on unmount).
     */
    const cancelRecording = useCallback(() => {
        stoppedRef.current = true;
        clearTimeout(cycleTimerRef.current);
        setIsRecording(false);
        try {
            if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
        } catch (_) { }
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        singleChunksRef.current = [];
        resolveStopRef.current = null;
    }, []);

    return { isRecording, error, startRecording, stopRecording, cancelRecording };
}
