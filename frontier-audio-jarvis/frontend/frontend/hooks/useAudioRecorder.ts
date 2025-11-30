import { useState, useRef, useCallback } from 'react';

export type RecordingState = 'idle' | 'recording' | 'error';

export interface AudioRecorderHook {
    recordingState: RecordingState;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    error: string | null;
}

export function useAudioRecorder(
    onAudioData?: (data: Blob) => void
): AudioRecorderHook {
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [error, setError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Silence detection refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const isStoppingRef = useRef<boolean>(false); // Guard against multiple stops

    const SILENCE_THRESHOLD = 0.1; // Increased significantly to handle noisy environments
    const SILENCE_DURATION = 1000; // Reduced to 1 second for faster response

    const cleanupAudioContext = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        silenceStartRef.current = null;
    }, []);

    const stopRecording = useCallback(() => {
        // Prevent multiple calls
        if (isStoppingRef.current) return;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('Stopping recording...');
            isStoppingRef.current = true;
            try {
                mediaRecorderRef.current.stop();
            } catch (error) {
                console.error('Error stopping media recorder:', error);
                isStoppingRef.current = false; // Reset guard if stop fails
                isRecordingRef.current = false;
                cleanupAudioContext();
            }
        }
    }, [cleanupAudioContext]);

    const detectSilence = useCallback(() => {
        if (!analyserRef.current || !isRecordingRef.current) return;

        const bufferLength = analyserRef.current.fftSize;
        const dataArray = new Float32Array(bufferLength);
        analyserRef.current.getFloatTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square) volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Debug logging (throttled)
        if (Math.random() < 0.05) {
            console.log(`Current RMS: ${rms.toFixed(4)} (Threshold: ${SILENCE_THRESHOLD})`);
        }

        // Check for silence
        if (rms < SILENCE_THRESHOLD) {
            if (silenceStartRef.current === null) {
                silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
                console.log('Silence detected (duration exceeded), stopping recording...');
                stopRecording();
                return; // Stop loop
            }
        } else {
            // Reset silence timer if noise is detected
            if (silenceStartRef.current !== null) {
                // console.log('Noise detected, resetting silence timer');
                silenceStartRef.current = null;
            }
        }

        animationFrameRef.current = requestAnimationFrame(detectSilence);
    }, [stopRecording]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            isStoppingRef.current = false; // Reset stop guard

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100,
                    channelCount: 1,
                }
            });

            streamRef.current = stream;

            // Setup AudioContext for silence detection
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            // Create MediaRecorder with webm format
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000,
            });

            mediaRecorderRef.current = mediaRecorder;

            // Handle audio data chunks
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && onAudioData) {
                    onAudioData(event.data);
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                setError('Recording error occurred');
                setRecordingState('error');
                cleanupAudioContext();
            };

            mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped');
                setRecordingState('idle');
                isRecordingRef.current = false;
                isStoppingRef.current = false;
                cleanupAudioContext();

                // Clean up stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            };

            // Start recording with chunks every 100ms for real-time streaming
            mediaRecorder.start(100);
            setRecordingState('recording');
            isRecordingRef.current = true;

            // Start silence detection loop
            detectSilence();

        } catch (err) {
            console.error('Failed to start recording:', err);
            setError(err instanceof Error ? err.message : 'Failed to access microphone');
            setRecordingState('error');
            cleanupAudioContext();
        }
    }, [onAudioData, detectSilence, cleanupAudioContext]);

    return {
        recordingState,
        startRecording,
        stopRecording,
        error,
    };
}
