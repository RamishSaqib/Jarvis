# Frontier Audio Jarvis

Real-time voice assistant powered by cutting-edge LLMs.

## Project Structure

- **backend/**: Node.js/TypeScript server handling WebSockets and orchestration.
- **ai-service/**: Python/FastAPI service for OpenAI integration.
- **frontend/**: Next.js application for the user interface.

## Prerequisites

- Node.js (v18+)
- Python (v3.11+)
- OpenAI API Key

## Getting Started

### 1. AI Service (Python)

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Create .env file with OPENAI_API_KEY=your_key
uvicorn main:app --reload --port 8000
```

### 2. Backend (TypeScript)

```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3001
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

## Usage

1. Open http://localhost:3000
2. Allow microphone access.
3. Click the Mic button to start recording/streaming.
4. Speak into the microphone.
5. The Backend will forward audio to the AI Service.
6. AI Service will process (echo for now) and return a response.
7. Frontend will display the response logs.

