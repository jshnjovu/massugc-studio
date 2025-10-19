"""
TTS Service

Handles text-to-speech generation using ElevenLabs API.
"""

import os
from elevenlabs.client import ElevenLabs


class TTSService:
    """Manages text-to-speech operations using ElevenLabs."""
    
    DEFAULT_MODEL = "eleven_multilingual_v2"
    MONOLINGUAL_MODEL = "eleven_monolingual_v1"
    
    @classmethod
    def generate_audio(
        cls,
        api_key: str,
        script_text: str,
        voice_id: str,
        output_path: str,
        language: str = "English"
    ) -> tuple[bool, str]:
        """
        Generate audio from text using ElevenLabs API.
        
        Args:
            api_key: ElevenLabs API key
            script_text: Text to convert to speech
            voice_id: ElevenLabs voice ID
            output_path: Path to save generated audio
            language: Language for TTS (affects model selection)
            
        Returns:
            Tuple of (success, error_message_if_failed)
        """
        print(f"Generating audio with ElevenLabs Voice ID: {voice_id}...")
        
        try:
            if not script_text or not script_text.strip():
                return False, "Cannot generate audio from empty script"
            
            if not api_key:
                return False, "ElevenLabs API key is required"
            
            # Initialize client
            client = ElevenLabs(api_key=api_key)
            
            # Select model based on language
            model = cls.MONOLINGUAL_MODEL if language == "English" else cls.DEFAULT_MODEL
            
            # Generate audio
            audio_bytes = client.text_to_speech.convert(
                text=script_text,
                voice_id=voice_id,
                model_id=model,
                output_format="mp3_44100_128"
            )
            
            # Save audio to file
            with open(output_path, 'wb') as f:
                for chunk in audio_bytes:
                    if isinstance(chunk, bytes):
                        f.write(chunk)
            
            # Verify file creation
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f"Audio successfully generated: {output_path}")
                return True, ""
            else:
                error_msg = f"Audio file is missing or empty: {output_path}"
                print(f"Error: {error_msg}")
                if os.path.exists(output_path):
                    os.remove(output_path)
                return False, error_msg
                
        except Exception as e:
            error_msg = f"ElevenLabs audio generation failed: {str(e)}"
            print(f"Error: {error_msg}")
            
            # Clean up partial file if exists
            if os.path.exists(output_path):
                try:
                    os.remove(output_path)
                except:
                    pass
            
            return False, error_msg
    
    @classmethod
    def validate_voice_id(cls, voice_id: str) -> tuple[bool, str]:
        """
        Validate voice ID format.
        
        Args:
            voice_id: ElevenLabs voice ID to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not voice_id:
            return False, "Voice ID is required"
        
        if len(voice_id) < 10:
            return False, "Voice ID appears invalid (too short)"
        
        return True, ""

