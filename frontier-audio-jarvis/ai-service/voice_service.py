from openai import OpenAI
import io

class VoiceService:
    def __init__(self, client: OpenAI):
        self.client = client

    def generate_speech(self, text):
        """
        Generates speech from text using OpenAI TTS.
        Returns audio bytes (MP3 format).
        """
        try:
            print(f"Generating speech for: {text[:50]}...")
            response = self.client.audio.speech.create(
                model="tts-1-hd",
                voice="shimmer",
                input=text
            )
            
            # Get audio data as bytes
            audio_data = io.BytesIO()
            for chunk in response.iter_bytes():
                audio_data.write(chunk)
            
            audio_data.seek(0)
            return audio_data.read()
            
        except Exception as e:
            print(f"TTS error: {e}")
            return None
