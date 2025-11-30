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
): AudioRecorderHook & { currentVolume: number } {
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [currentVolume, setCurrentVolume] = useState<number>(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Silence detection refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    const SILENCE_THRESHOLD = 0.05; // Adjusted to 0.05 (5%)
    const SILENCE_DURATION = 1500; // Back to 1.5s for stability

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
        setCurrentVolume(0);
    }, []);

    const stopRecording = useCallback(() => {
        console.log('stopRecording called. State:', mediaRecorderRef.current?.state);

        // Always force state to idle immediately to update UI
        setRecordingState('idle');
        isRecordingRef.current = false;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
                mediaRecorderRef.current.stop();
            } catch (error) {
                console.error('Error stopping media recorder:', error);
                cleanupAudioContext();
            }
        } else {
            // If not recording, just clean up
            cleanupAudioContext();
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

        // Update volume state for UI visualization
        setCurrentVolume(rms);

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
                silenceStartRef.current = null;
            }
        }

        animationFrameRef.current = requestAnimationFrame(detectSilence);
    }, [stopRecording]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);

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
                console.log('MediaRecorder stopped (onstop event)');
                // Ensure cleanup happens even if stopRecording wasn't called explicitly
                setRecordingState('idle');
                isRecordingRef.current = false;
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
        currentVolume,
    };
}
