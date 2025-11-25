import { useCallback, useRef } from 'react';

type SoundType = 'start' | 'stop' | 'error' | 'success';

export function useSoundEffects() {
    const audioContextRef = useRef<AudioContext | null>(null);

    const getAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    };

    const playSound = useCallback((type: SoundType) => {
        try {
            const ctx = getAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            const now = ctx.currentTime;

            switch (type) {
                case 'start':
                    // Rising tone
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(440, now);
                    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                    break;

                case 'stop':
                    // Falling tone
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(880, now);
                    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.1);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                    break;

                case 'error':
                    // Low buzz
                    oscillator.type = 'sawtooth';
                    oscillator.frequency.setValueAtTime(150, now);
                    oscillator.frequency.linearRampToValueAtTime(100, now + 0.3);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
                    oscillator.start(now);
                    oscillator.stop(now + 0.3);
                    break;

                case 'success':
                    // High ping
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(880, now);
                    oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
                    gainNode.gain.setValueAtTime(0.05, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                    oscillator.start(now);
                    oscillator.stop(now + 0.2);
                    break;
            }
        } catch (error) {
            console.error('Failed to play sound:', error);
        }
    }, []);

    return { playSound };
}
