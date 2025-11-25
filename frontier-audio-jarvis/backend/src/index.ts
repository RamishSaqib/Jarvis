import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'ws://localhost:8000/ws/ai';

// CORS configuration for production
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL || ''
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    console.log(`Client connected. Active connections: ${wss.clients.size}`);

    // Extract session_id from request URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session_id');

    // Connect to AI Service for this client
    const aiServiceUrl = new URL(AI_SERVICE_URL);
    if (sessionId) {
        aiServiceUrl.searchParams.append('session_id', sessionId);
    }

    console.log(`Connecting to AI service at: ${aiServiceUrl.toString()}`);
    const aiService = new WebSocket(aiServiceUrl.toString());

    aiService.on('open', () => {
        console.log('Connected to AI Service');
        ws.send(JSON.stringify({ type: 'system', message: 'AI Service Connected' }));
    });

    aiService.on('message', (data) => {
        // Forward AI response to Frontend
        // Data from AI service is likely JSON text string
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString());
        }
    });

    aiService.on('error', (error) => {
        console.error('AI Service error:', error);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'AI Service Unavailable' }));
        }
    });

    aiService.on('close', () => {
        console.log('Disconnected from AI Service');
    });

    ws.on('message', (message) => {
        // Forward Audio/Data to AI Service
        aiSocket.send(message);
    }
    });

ws.on('close', () => {
    console.log(`Client disconnected. Active connections: ${wss.clients.size}`);
    if (aiSocket.readyState === WebSocket.OPEN) {
        aiSocket.close();
    }
});
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'backend' });
});

server.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
