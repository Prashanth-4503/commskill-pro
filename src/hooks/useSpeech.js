import { useRef, useState, useCallback } from 'react';

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeech() {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);
    const stoppedManually = useRef(false);

    const stopListening = useCallback(() => {
        stoppedManually.current = true;
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (_) { }
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startListening = useCallback((onResult) => {
        if (!SpeechRecognition) {
            setError('Speech recognition is not supported. Please use Chrome or Edge.');
            return;
        }
        // Stop any existing session cleanly first
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (_) { }
            recognitionRef.current = null;
        }

        stoppedManually.current = false;

        const recognition = new SpeechRecognition();
        // continuous=false means it stops after a pause — avoids the "keeps listening" bug
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        let finalTranscript = '';

        recognition.onstart = () => setIsListening(true);

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += (finalTranscript ? ' ' : '') + t;
                    if (onResult) onResult(finalTranscript, true);
                } else {
                    interim = t;
                    if (onResult) onResult(interim, false);
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            setError(`Microphone error: ${event.error}. Please allow microphone access in browser settings.`);
            setIsListening(false);
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            if (!stoppedManually.current) {
                // Auto-restarted only in continuous-intent mode — trigger a new recognition
                // We do NOT auto-restart; caller decides
                setIsListening(false);
            } else {
                setIsListening(false);
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setError(null);
        } catch (e) {
            setError('Could not start microphone. Please check browser permissions.');
        }
    }, []);

    /**
     * Continuous listening — keeps restarting until stopListening() is called.
     * Used for JAM and GD where we want extended recording.
     */
    const startContinuousListening = useCallback((onFinalChunk) => {
        if (!SpeechRecognition) {
            setError('Speech recognition is not supported. Please use Chrome or Edge.');
            return;
        }
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (_) { }
            recognitionRef.current = null;
        }
        stoppedManually.current = false;

        const startSession = () => {
            if (stoppedManually.current) return;

            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                if (!stoppedManually.current) setIsListening(true);
            };

            recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        const chunk = event.results[i][0].transcript;
                        if (onFinalChunk) onFinalChunk(chunk);
                    }
                }
            };

            recognition.onerror = (event) => {
                if (event.error === 'aborted') return;
                // On no-speech or network hiccup, restart silently
                if (event.error === 'no-speech' || event.error === 'network') {
                    setTimeout(() => { if (!stoppedManually.current) startSession(); }, 500);
                    return;
                }
                setError(`Microphone error: ${event.error}. Please allow microphone access in browser settings.`);
            };

            recognition.onend = () => {
                if (!stoppedManually.current) {
                    // Auto-restart to maintain continuous recording
                    // 300ms delay prevents the "network" race condition with Google's servers
                    setTimeout(() => { if (!stoppedManually.current) startSession(); }, 300);
                } else {
                    recognitionRef.current = null;
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognition;
            try {
                recognition.start();
                setError(null);
            } catch (_) {
                setTimeout(() => { if (!stoppedManually.current) startSession(); }, 500);
            }
        };

        startSession();
    }, []);

    return { isListening, error, startListening, stopListening, startContinuousListening };
}
