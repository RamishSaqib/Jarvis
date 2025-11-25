import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface Message {
    type: string;
    message?: string;
    text?: string;
    timestamp?: number;
    has_sources?: boolean;
    source_type?: string;
}

export function useWebSocket(url?: string) {
    // Use provided URL or environment variable, fallback to localhost
    const wsUrl = url || process.env.NEXT_PUBLIC_BACKEND_URL || 'ws://localhost:3001';

    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [messages, setMessages] = useState<Message[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const sessionIdRef = useRef<string>('');

    // Initialize session ID
    useEffect(() => {
        let storedSessionId = localStorage.getItem('jarvis_session_id');
        if (!storedSessionId) {
            storedSessionId = crypto.randomUUID();
            localStorage.setItem('jarvis_session_id', storedSessionId);
        }
        sessionIdRef.current = storedSessionId;
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnectionState('connecting');
        const wsUrlObj = new URL(wsUrl);
        if (sessionIdRef.current) {
            wsUrlObj.searchParams.append('session_id', sessionIdRef.current);
        }
        const ws = new WebSocket(wsUrlObj.toString());

        ws.onopen = () => {
            console.log('WebSocket connected');
            setConnectionState('connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const message: Message = {
                    ...data,
                    timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, message]);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnectionState('error');
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setConnectionState('disconnected');
            wsRef.current = null;

            // Attempt to reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log('Attempting to reconnect...');
                connect();
            }, 3000);
        };

        wsRef.current = ws;
    }, [url]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnectionState('disconnected');
    }, []);

    const sendMessage = useCallback((data: string | ArrayBuffer | Blob) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(data);
            return true;
        }
        console.warn('WebSocket is not connected');
        return false;
    }, []);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    return {
        connectionState,
        messages,
        sendMessage,
        connect,
        disconnect,
    };
}
