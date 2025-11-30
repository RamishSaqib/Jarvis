from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import json
import io
from openai import OpenAI
from pydub import AudioSegment
import tempfile
from github_service import GitHubService
from search_service import SearchService
from voice_service import VoiceService

load_dotenv()

app = FastAPI()

# CORS configuration for production
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    os.getenv("FRONTEND_URL", ""),
    os.getenv("BACKEND_URL", "")
]
# Filter out empty strings and add wildcard for Vercel/Railway
allowed_origins = [origin for origin in allowed_origins if origin]
allowed_origins.append("*")  # Allow all for now, restrict in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize GitHub service
github_service = GitHubService()

# Initialize Search service
search_service = SearchService()

# Initialize Voice service
voice_service = VoiceService(client)

# Store conversation history per connection
conversations = {}
# Store interrupt flags per connection
interrupt_flags = {}

@app.get("/")
async def root():
    return {"message": "AI Service is running with Whisper & GPT-4"}

@app.get("/health")
async def health():
    """Lightweight health check endpoint for monitoring services"""
    return {
        "status": "healthy",
        "service": "jarvis-ai-service",
        "version": "1.0.0"
    }

@app.websocket("/ws/ai")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Get session_id from query params, fallback to connection ID if not provided
    session_id = websocket.query_params.get("session_id")
    connection_id = session_id if session_id else str(id(websocket))
    
    print(f"Backend connected to AI Service (ID: {connection_id})")
    
    # Initialize conversation history if new session
    if connection_id not in conversations:
        conversations[connection_id] = [
            {
                "role": "system",
                "content": """You are Jarvis, a helpful and intelligent voice assistant. Follow these guidelines:
            
1. Provide concise, accurate, and friendly responses.
2. Always cite your sources when using external information.
3. If you're uncertain about something, clearly state "I'm not certain" or "I don't know".
4. When providing code examples, include links to documentation or GitHub repositories.
5. Express confidence levels when appropriate (e.g., "I'm confident that...", "Based on the documentation...").
6. Avoid speculation - stick to facts you can verify.
7. If a question is outside your knowledge, suggest where the user might find the answer.

You have access to the following tools and capabilities:
- **Web Search**: You can search the web for real-time information. Use this when asked about current events, facts, or things you don't know.
  SEARCH_WEB: {"query": "search query here"}
  - **IMPORTANT**: If the user asks about "my anime list" or "MAL", they are referring to the public website `myanimelist.net`. You SHOULD search this website for ratings and information. It is NOT a private file.
- **GitHub Integration**: You can search public GitHub repositories for code and documentation.
- **Real-time Interaction**: You can be interrupted by the user at any time.
- **PR Creation**: If the user asks you to create a pull request, you can do so by responding with a special command format:
  CREATE_PR: {"repo": "owner/repo", "title": "PR title", "body": "PR description", "branch": "branch-name", "file_path": "path/to/file", "file_content": "file content", "commit_message": "commit message"}

Your limitations:
- You cannot access the user's private files or local system unless explicitly provided.
- You cannot perform actions on the user's behalf outside of this chat interface.
- PR creation requires a valid GitHub token with write access.
"""
            }
        ]
    else:
        print(f"Restoring session {connection_id}")
    interrupt_flags[connection_id] = False
    
    # Buffer for audio chunks
    audio_buffer = bytearray()
    is_recording = False  # Track if we're actively recording
    
    try:
        # Send connection confirmation
        await websocket.send_text(json.dumps({
            "type": "system",
            "message": "AI Service Connected - Whisper & GPT-4 Ready"
        }))
        
        while True:
            message = await websocket.receive()
            
            if "text" in message:
                data = json.loads(message["text"])
                
                # Handle interrupt signal
                if data.get("type") == "interrupt":
                    print(f"Interrupt signal received for connection {connection_id}")
                    interrupt_flags[connection_id] = True
                    await websocket.send_text(json.dumps({
                        "type": "system",
                        "message": "Processing interrupted"
                    }))
                    continue
                
                # Handle stop recording signal
                if data.get("type") == "stop_recording":
                    print(f"Stop recording signal received. Buffer size: {len(audio_buffer)} bytes")
                    
                    # Reset interrupt flag for new request
                    interrupt_flags[connection_id] = False
                    
                    if len(audio_buffer) > 0:
                        # Send transcribing status
                        await websocket.send_text(json.dumps({
                            "type": "status",
                            "message": "Transcribing audio..."
                        }))
                        
                        # Check for interrupt before processing
                        if interrupt_flags[connection_id]:
                            print("Interrupted before transcription")
                            audio_buffer.clear()
                            continue
                        
                        try:
                            # Whisper API supports WebM format natively - no conversion needed!
                            # Save audio buffer directly to temporary WebM file
                            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False, mode='wb') as temp_audio:
                                temp_audio.write(audio_buffer)
                                temp_audio.flush()  # Ensure all data is written
                                temp_audio_path = temp_audio.name
                            # File is now closed and fully written
                            
                            # Check for interrupt before API call
                            if interrupt_flags[connection_id]:
                                print("Interrupted before Whisper API call")
                                os.unlink(temp_audio_path)
                                audio_buffer.clear()
                                continue
                            
                            # Transcribe with Whisper
                            print("Sending to Whisper API...")
                            with open(temp_audio_path, "rb") as audio_file:
                                transcription = client.audio.transcriptions.create(
                                    model="whisper-1",
                                    file=audio_file,
                                    language="en",
                                    prompt="Jarvis, AI, code, function, variable, React, TypeScript, Python, API, database, Anime, Manga, Naruto, One Piece, Movies, Music, Weather, News, Search, Super Bowl, NFL, 2024, 2025, winner, game, sports"
                                )
                            
                            # Clean up temp file
                            os.unlink(temp_audio_path)
                            
                            # Check for interrupt after transcription
                            if interrupt_flags[connection_id]:
                                print("Interrupted after transcription")
                                audio_buffer.clear()
                                continue
                            
                            transcribed_text = transcription.text
                            print(f"Transcription: {transcribed_text}")
                            
                            # Send transcription to frontend
                            await websocket.send_text(json.dumps({
                                "type": "transcription",
                                "text": transcribed_text
                            }))
                            
                            # Add to conversation history
                            conversations[connection_id].append({
                                "role": "user",
                                "content": transcribed_text
                            })
                            
                            # Check for GitHub context
                            github_context = None
                            if github_service.is_code_related_query(transcribed_text):
                                print("Detected code-related query, fetching GitHub context...")
                                github_context = github_service.get_code_context(transcribed_text)
                            
                            # Send thinking status
                            await websocket.send_text(json.dumps({
                                "type": "status",
                                "message": "AI is thinking..."
                            }))
                            
                            # Check for interrupt before GPT call
                            if interrupt_flags[connection_id]:
                                print("Interrupted before GPT-4 call")
                                audio_buffer.clear()
                                continue
                            
                            # Generate AI response with GPT-4
                            print("Generating GPT-4 response...")
                            
                            # Ensure conversation history exists (safety check for reconnections)
                            if connection_id not in conversations:
                                print(f"Warning: Conversation history missing for {connection_id}, reinitializing")
                                conversations[connection_id] = [
                                    {
                                        "role": "system",
                                        "content": "You are Jarvis, a helpful and intelligent voice assistant."
                                    }
                                ]
                            
                            # --- Main Processing Loop (Thought Loop) ---
                            max_iterations = 3
                            iteration = 0
                            final_response_text = ""
                            pr_url = None
                            
                            while iteration < max_iterations:
                                iteration += 1
                                print(f"Iteration {iteration}/{max_iterations}")
                                
                                # Prepare messages with GitHub context if available
                                messages_for_gpt = conversations[connection_id].copy()
                                if github_context:
                                    messages_for_gpt.append({
                                        "role": "system",
                                        "content": f"Additional context from GitHub:\n{github_context}\n\nUse this information to provide accurate code examples and include the GitHub links in your response."
                                    })
                                
                                response = client.chat.completions.create(
                                    model=os.getenv("GPT_MODEL", "gpt-4"),
                                    messages=messages_for_gpt,
                                    max_tokens=500, # Increased for search results
                                    temperature=0.7
                                )
                                
                                ai_response = response.choices[0].message.content
                                print(f"AI Response (Iter {iteration}): {ai_response}")
                                
                                # Check for SEARCH_WEB command
                                if "SEARCH_WEB:" in ai_response:
                                    try:
                                        import re
                                        # Try to match JSON first
                                        json_match = re.search(r'SEARCH_WEB:\s*({.*?})', ai_response, re.DOTALL)
                                        if json_match:
                                            search_data = json.loads(json_match.group(1))
                                            query = search_data.get("query")
                                        else:
                                            # Fallback to plain text capture
                                            text_match = re.search(r'SEARCH_WEB:\s*(.+)', ai_response, re.DOTALL)
                                            if text_match:
                                                query = text_match.group(1).strip()
                                            else:
                                                query = None
                                        
                                        if query:
                                            
                                            # Send status update
                                            await websocket.send_text(json.dumps({
                                                "type": "status",
                                                "message": f"Searching web for: {query}..."
                                            }))
                                            
                                            # Execute search
                                            search_results = search_service.search(query)
                                            
                                            # Add search results to conversation history
                                            conversations[connection_id].append({
                                                "role": "assistant",
                                                "content": ai_response # Keep the thought process
                                            })
                                            conversations[connection_id].append({
                                                "role": "system",
                                                "content": f"Search Results for '{query}':\n{search_results}"
                                            })
                                            
                                            # Continue to next iteration to let AI use the results
                                            continue
                                    except Exception as e:
                                        print(f"Error executing search: {e}")
                                        conversations[connection_id].append({
                                            "role": "system",
                                            "content": f"Error executing search: {str(e)}"
                                        })
                                        continue

                                # Check for PR creation command (existing logic)
                                if "CREATE_PR:" in ai_response:
                                    # ... (existing PR logic) ...
                                    try:
                                        import re
                                        pr_match = re.search(r'CREATE_PR:\s*({.*?})', ai_response, re.DOTALL)
                                        if pr_match:
                                            pr_data = json.loads(pr_match.group(1))
                                            repo = pr_data.get("repo")
                                            title = pr_data.get("title")
                                            body = pr_data.get("body")
                                            branch = pr_data.get("branch")
                                            file_path = pr_data.get("file_path")
                                            file_content = pr_data.get("file_content")
                                            commit_message = pr_data.get("commit_message")
                                            
                                            if github_service.create_branch(repo, branch):
                                                if github_service.create_file(repo, file_path, file_content, commit_message, branch):
                                                    pr_url = github_service.create_pull_request(repo, title, body, branch)
                                                    if pr_url:
                                                        ai_response = ai_response.replace(pr_match.group(0), f"\n\nI've created a pull request: {pr_url}")
                                    except Exception as e:
                                        print(f"Error creating PR: {e}")
                                
                                # If no tool commands, this is the final response
                                final_response_text = ai_response
                                break
                            
                            # --- End of Loop ---

                            # Add final response to history
                            conversations[connection_id].append({
                                "role": "assistant",
                                "content": final_response_text
                            })
                            
                            # Generate Voice Audio
                            audio_response = None
                            try:
                                # Filter out code blocks or long text if needed, but for now just TTS everything
                                # Maybe skip TTS if it's just a PR confirmation? No, let's speak it.
                                audio_response = voice_service.generate_speech(final_response_text)
                            except Exception as e:
                                print(f"Error generating voice: {e}")

                            # Prepare response with metadata
                            response_data = {
                                "type": "ai_response",
                                "text": final_response_text
                            }
                            
                            # Add source metadata if GitHub context was used or PR was created
                            if github_context or pr_url:
                                response_data["has_sources"] = True
                                response_data["source_type"] = "github"
                            
                            # Send text response
                            await websocket.send_text(json.dumps(response_data))
                            
                            # Send audio response (as binary)
                            if audio_response:
                                await websocket.send_bytes(audio_response)
                            
                        except Exception as e:
                            print(f"Error processing audio: {e}")
                            # CRITICAL: Clear buffer even on error to prevent corruption on next request
                            audio_buffer.clear()
                            is_recording = False
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": f"Error processing audio: {str(e)}"
                            }))
                        
                        # Clear buffer after successful processing
                        audio_buffer.clear()
                        is_recording = False  # Reset for next recording
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "No audio data received"
                        }))
                
            elif "bytes" in message:
                # Buffer audio chunks
                data = message["bytes"]
                
                # If this is the first chunk of a new recording, validate it's a WebM header
                if not is_recording:
                    # Check for WebM EBML ID: 1A 45 DF A3
                    if len(data) >= 4 and data[:4] == b'\x1a\x45\xdf\xa3':
                        if len(audio_buffer) > 0:
                            print(f"Warning: Clearing leftover buffer data ({len(audio_buffer)} bytes) from previous request")
                            audio_buffer.clear()
                        is_recording = True
                        print("New WebM stream detected")
                    else:
                        print(f"Warning: Ignoring trailing chunk ({len(data)} bytes) - not a WebM header")
                        continue
                
                audio_buffer.extend(data)
                print(f"Buffered audio chunk: {len(data)} bytes (total: {len(audio_buffer)} bytes)")

    except WebSocketDisconnect:
        print(f"Backend disconnected (ID: {connection_id})")
        # Clean up conversation history and interrupt flag
        if connection_id in conversations:
            del conversations[connection_id]
        if connection_id in interrupt_flags:
            del interrupt_flags[connection_id]
    except Exception as e:
        print(f"Connection error: {e}")
        if connection_id in conversations:
            del conversations[connection_id]
        if connection_id in interrupt_flags:
            del interrupt_flags[connection_id]
