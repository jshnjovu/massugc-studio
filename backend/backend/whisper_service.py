"""
Whisper Transcription Service with API and Local Fallback
=========================================================
Professional-grade caption generation with word-level timing,
supporting both OpenAI Whisper API (fast) and local processing (free).

Author: MassUGC Development Team
Version: 1.0.0
"""

import os
import json
import time
import logging
import tempfile
import subprocess
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from pathlib import Path
import whisper
import numpy as np
from openai import OpenAI
import re

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


# ============== Configuration ==============

@dataclass
class TranscriptionSegment:
    """Single transcription segment with timing"""
    start: float
    end: float
    text: str
    words: Optional[List[Dict]] = None  # Word-level timing


@dataclass
class WhisperConfig:
    """Configuration for Whisper transcription"""
    api_key: Optional[str] = None
    use_api: bool = True  # Try API first if key available
    model_size: str = "base"  # For local: tiny, base, small, medium, large
    language: Optional[str] = None  # Auto-detect if None
    word_timestamps: bool = True
    highlight_words: List[str] = None  # Keywords to highlight
    max_line_width: int = 40  # Characters per line
    max_words_per_caption: int = 8


# ============== Caption Templates ==============

CAPTION_TEMPLATES = {
    "srt": """
{index}
{start_time} --> {end_time}
{text}

""",
    "vtt": """
{start_time} --> {end_time}
{text}

""",
    "ass": """
Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}
"""
}

# Keywords that should be highlighted in captions
DEFAULT_HIGHLIGHT_WORDS = [
    "amazing", "incredible", "secret", "hack", "pro tip",
    "game changer", "must have", "exclusive", "limited",
    "free", "new", "revolutionary", "breakthrough"
]


# ============== Main Whisper Service ==============

class WhisperService:
    """
    Professional transcription service with OpenAI API and local fallback.
    Generates perfect captions with word-level timing.
    """
    
    def __init__(self, config: Optional[WhisperConfig] = None):
        """Initialize Whisper service"""
        self.config = config or WhisperConfig()
        
        # Setup OpenAI client if API key provided
        self.api_client = None
        if self.config.api_key:
            try:
                self.api_client = OpenAI(api_key=self.config.api_key)
                logger.info("OpenAI Whisper API client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI client: {e}")
        
        # Setup local Whisper model
        self.local_model = None
        if not self.api_client or not self.config.use_api:
            self._initialize_local_model()
    
    
    def transcribe(
        self,
        audio_path: str,
        output_format: str = "srt",
        template_style: str = "tiktok_classic"
    ) -> Dict[str, Any]:
        """
        Main transcription function with automatic API/local selection
        
        Returns:
            Dict containing transcription, caption file path, and metadata
        """
        start_time = time.time()
        
        try:
            # Validate audio file
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
            # Try API first if available and configured
            if self.api_client and self.config.use_api:
                logger.info("Using OpenAI Whisper API for fast transcription...")
                result = self._transcribe_with_api(audio_path)
            else:
                logger.info("Using local Whisper model for transcription...")
                result = self._transcribe_local(audio_path)
            
            # Process transcription into segments
            segments = self._process_transcription(result)
            
            # Generate caption file
            caption_file = self._generate_caption_file(
                segments,
                output_format,
                template_style
            )
            
            processing_time = time.time() - start_time
            
            return {
                "success": True,
                "transcription": self._segments_to_text(segments),
                "segments": [self._segment_to_dict(s) for s in segments],
                "caption_file": caption_file,
                "format": output_format,
                "processing_time": processing_time,
                "method_used": "api" if (self.api_client and self.config.use_api) else "local",
                "word_count": sum(len(s.text.split()) for s in segments)
            }
            
        except Exception as e:
            logger.error(f"Transcription failed: {str(e)}")
            
            # If API fails, fallback to local
            if self.api_client and self.config.use_api:
                logger.info("API failed, falling back to local processing...")
                self.config.use_api = False
                return self.transcribe(audio_path, output_format, template_style)
            
            return {
                "success": False,
                "error": str(e),
                "method_used": "none"
            }
    
    
    def _transcribe_with_api(self, audio_path: str) -> Dict[str, Any]:
        """Transcribe using OpenAI Whisper API"""
        try:
            # Open audio file
            with open(audio_path, "rb") as audio_file:
                # Call Whisper API with detailed response
                response = self.api_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",  # Get detailed timing
                    timestamp_granularities=["word", "segment"] if self.config.word_timestamps else ["segment"],
                    language=self.config.language
                )
            
            # Convert API response to our format
            return {
                "segments": response.segments,
                "words": response.words if hasattr(response, 'words') else None,
                "text": response.text,
                "language": response.language
            }
            
        except Exception as e:
            logger.error(f"Whisper API error: {str(e)}")
            raise
    
    
    def _transcribe_local(self, audio_path: str) -> Dict[str, Any]:
        """Transcribe using local Whisper model"""
        try:
            # Ensure model is loaded
            if not self.local_model:
                self._initialize_local_model()
            
            # Transcribe with local model
            result = self.local_model.transcribe(
                audio_path,
                language=self.config.language,
                word_timestamps=self.config.word_timestamps,
                verbose=False
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Local Whisper error: {str(e)}")
            raise
    
    
    def _initialize_local_model(self):
        """Initialize local Whisper model"""
        try:
            logger.info(f"Loading local Whisper model: {self.config.model_size}")
            self.local_model = whisper.load_model(self.config.model_size)
            logger.info("Local Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load local Whisper model: {e}")
            raise
    
    
    def _process_transcription(self, result: Dict) -> List[TranscriptionSegment]:
        """Process raw transcription into segments with timing"""
        segments = []
        
        for segment in result.get('segments', []):
            # Extract word-level timing if available
            words = None
            if self.config.word_timestamps and 'words' in segment:
                words = [
                    {
                        'word': w.get('word', ''),
                        'start': w.get('start', 0),
                        'end': w.get('end', 0)
                    }
                    for w in segment['words']
                ]
            
            segments.append(TranscriptionSegment(
                start=segment.get('start', 0),
                end=segment.get('end', 0),
                text=segment.get('text', '').strip(),
                words=words
            ))
        
        return segments
    
    
    def _generate_caption_file(
        self,
        segments: List[TranscriptionSegment],
        output_format: str,
        template_style: str
    ) -> str:
        """Generate caption file with proper formatting"""
        
        # Split segments into caption-sized chunks
        captions = self._split_into_captions(segments)
        
        # Apply highlighting if configured
        if self.config.highlight_words:
            captions = self._apply_highlighting(captions, template_style)
        
        # Generate output file
        temp_dir = Path(tempfile.gettempdir()) / "whisper_captions"
        temp_dir.mkdir(exist_ok=True)
        
        extension = output_format.lower()
        caption_file = temp_dir / f"captions_{int(time.time())}.{extension}"
        
        with open(caption_file, 'w', encoding='utf-8') as f:
            if output_format == "vtt":
                f.write("WEBVTT\n\n")
            elif output_format == "ass":
                f.write(self._generate_ass_header(template_style))
            
            for i, caption in enumerate(captions, 1):
                formatted = self._format_caption(
                    caption,
                    i,
                    output_format
                )
                f.write(formatted)
        
        logger.info(f"Caption file generated: {caption_file}")
        return str(caption_file)
    
    
    def _split_into_captions(self, segments: List[TranscriptionSegment]) -> List[Dict]:
        """Split segments into properly sized captions"""
        captions = []
        
        for segment in segments:
            text = segment.text
            words = segment.words or []
            
            # Split long segments into multiple captions
            if len(text.split()) > self.config.max_words_per_caption:
                # Use word timing if available
                if words:
                    chunks = self._split_with_word_timing(words, self.config.max_words_per_caption)
                else:
                    chunks = self._split_text_evenly(text, segment.start, segment.end)
                
                captions.extend(chunks)
            else:
                captions.append({
                    'start': segment.start,
                    'end': segment.end,
                    'text': text
                })
        
        return captions
    
    
    def _split_with_word_timing(self, words: List[Dict], max_words: int) -> List[Dict]:
        """Split using word-level timing for perfect sync"""
        chunks = []
        current_chunk = []
        
        for word in words:
            current_chunk.append(word)
            
            if len(current_chunk) >= max_words:
                chunk_text = ' '.join(w['word'] for w in current_chunk)
                chunks.append({
                    'start': current_chunk[0]['start'],
                    'end': current_chunk[-1]['end'],
                    'text': chunk_text
                })
                current_chunk = []
        
        # Add remaining words
        if current_chunk:
            chunk_text = ' '.join(w['word'] for w in current_chunk)
            chunks.append({
                'start': current_chunk[0]['start'],
                'end': current_chunk[-1]['end'],
                'text': chunk_text
            })
        
        return chunks
    
    
    def _split_text_evenly(self, text: str, start: float, end: float) -> List[Dict]:
        """Split text evenly when word timing not available"""
        words = text.split()
        max_words = self.config.max_words_per_caption
        chunks = []
        
        # Calculate time per word
        duration = end - start
        time_per_word = duration / len(words) if words else 0
        
        for i in range(0, len(words), max_words):
            chunk_words = words[i:i + max_words]
            chunk_start = start + (i * time_per_word)
            chunk_end = start + ((i + len(chunk_words)) * time_per_word)
            
            chunks.append({
                'start': chunk_start,
                'end': min(chunk_end, end),
                'text': ' '.join(chunk_words)
            })
        
        return chunks
    
    
    def _apply_highlighting(self, captions: List[Dict], style: str) -> List[Dict]:
        """Apply keyword highlighting to captions"""
        highlight_words = self.config.highlight_words or DEFAULT_HIGHLIGHT_WORDS
        
        for caption in captions:
            text = caption['text']
            
            # Check for highlight words (case-insensitive)
            for word in highlight_words:
                pattern = re.compile(re.escape(word), re.IGNORECASE)
                
                if style == "ass":
                    # ASS format color codes
                    replacement = r'{\\c&H00FFFF&}' + word + r'{\\c&HFFFFFF&}'
                elif style == "srt" or style == "vtt":
                    # HTML-style tags for SRT/VTT
                    replacement = f'<font color="yellow">{word}</font>'
                else:
                    replacement = word.upper()
                
                text = pattern.sub(replacement, text)
            
            caption['text'] = text
        
        return captions
    
    
    def _format_caption(self, caption: Dict, index: int, format: str) -> str:
        """Format single caption according to template"""
        template = CAPTION_TEMPLATES.get(format, CAPTION_TEMPLATES['srt'])
        
        return template.format(
            index=index,
            start_time=self._format_time(caption['start'], format),
            end_time=self._format_time(caption['end'], format),
            text=caption['text']
        )
    
    
    def _format_time(self, seconds: float, format: str) -> str:
        """Format time for different caption formats"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        
        if format == "ass":
            # ASS format: 0:00:00.00
            return f"{hours}:{minutes:02d}:{secs:05.2f}"
        else:
            # SRT/VTT format: 00:00:00,000 or 00:00:00.000
            separator = "." if format == "vtt" else ","
            milliseconds = int((secs % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{int(secs):02d}{separator}{milliseconds:03d}"
    
    
    def _generate_ass_header(self, style: str) -> str:
        """Generate ASS subtitle header with styling"""
        return """[Script Info]
Title: Enhanced Captions
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&HFFFFFF,&HFFFFFF,&H000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    
    def _segments_to_text(self, segments: List[TranscriptionSegment]) -> str:
        """Convert segments to plain text"""
        return ' '.join(s.text for s in segments)
    
    
    def _segment_to_dict(self, segment: TranscriptionSegment) -> Dict:
        """Convert segment to dictionary"""
        return {
            'start': segment.start,
            'end': segment.end,
            'text': segment.text,
            'words': segment.words
        }
    
    
    def generate_ai_heading(
        self,
        transcription: str,
        product: str = "",
        emotion: str = "engaging"
    ) -> List[str]:
        """
        Generate AI-powered heading options based on transcription
        """
        if not self.api_client:
            # Fallback to template-based headings
            return self._get_fallback_headings(emotion)
        
        try:
            prompt = f"""
            Based on this video transcript about {product if product else 'this topic'}, 
            create 5 catchy TikTok-style headings.
            
            Transcript excerpt: {transcription[:500]}
            Emotion/Tone: {emotion}
            
            Requirements:
            - Maximum 8 words each
            - Include relevant emoji
            - Create urgency or curiosity
            - Match the {emotion} tone
            - Be authentic and engaging
            
            Format: Return only the 5 headings, one per line.
            """
            
            response = self.api_client.chat.completions.create(
                model="gpt-4o-mini",  # Faster, cheaper model for headings
                messages=[
                    {"role": "system", "content": "You are a viral TikTok content creator."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=200
            )
            
            headings = response.choices[0].message.content.strip().split('\n')
            # Clean and filter headings
            headings = [h.strip() for h in headings if h.strip() and len(h.strip()) < 60]
            
            return headings[:5] if len(headings) >= 5 else headings + self._get_fallback_headings(emotion)[:5-len(headings)]
            
        except Exception as e:
            logger.error(f"AI heading generation failed: {e}")
            return self._get_fallback_headings(emotion)
    
    
    def _get_fallback_headings(self, emotion: str) -> List[str]:
        """Get fallback heading options"""
        templates = {
            "engaging": [
                "Wait for it... 🤯",
                "This changes everything!",
                "You won't believe this",
                "Mind = Blown 🚀",
                "Game changer alert! 🚨"
            ],
            "educational": [
                "Here's how it works 📚",
                "Learn this in 30 seconds",
                "The science is amazing",
                "Expert tips inside 💡",
                "Knowledge bomb incoming 🎓"
            ],
            "urgent": [
                "Limited time only! ⏰",
                "Don't miss out!",
                "Last chance! 🏃",
                "Ending soon!",
                "Act fast! ⚡"
            ],
            "emotional": [
                "This hit different 🥺",
                "Not me crying rn",
                "Wholesome content alert ❤️",
                "This is everything",
                "Pure happiness 🌟"
            ]
        }
        
        return templates.get(emotion, templates["engaging"])


# ============== Performance Monitor ==============

class TranscriptionPerformanceMonitor:
    """Monitor and optimize transcription performance"""
    
    def __init__(self):
        self.metrics = {
            "api_calls": 0,
            "api_time_total": 0,
            "local_calls": 0,
            "local_time_total": 0,
            "api_failures": 0,
            "local_failures": 0
        }
    
    def record_transcription(self, method: str, time_taken: float, success: bool):
        """Record transcription metrics"""
        if method == "api":
            self.metrics["api_calls"] += 1
            if success:
                self.metrics["api_time_total"] += time_taken
            else:
                self.metrics["api_failures"] += 1
        else:
            self.metrics["local_calls"] += 1
            if success:
                self.metrics["local_time_total"] += time_taken
            else:
                self.metrics["local_failures"] += 1
    
    def get_average_times(self) -> Dict[str, float]:
        """Get average processing times"""
        api_avg = (self.metrics["api_time_total"] / self.metrics["api_calls"] 
                   if self.metrics["api_calls"] > 0 else 0)
        local_avg = (self.metrics["local_time_total"] / self.metrics["local_calls"]
                     if self.metrics["local_calls"] > 0 else 0)
        
        return {
            "api_average": api_avg,
            "local_average": local_avg,
            "recommendation": "api" if api_avg < local_avg and api_avg > 0 else "local"
        }
    
    def should_use_api(self, file_size_mb: float) -> bool:
        """Determine if API should be used based on metrics"""
        # Use API for files under 25MB and if it's been reliable
        if file_size_mb > 25:
            return False
        
        if self.metrics["api_failures"] > 3:
            return False
        
        averages = self.get_average_times()
        return averages["recommendation"] == "api"


# ============== Testing ==============

if __name__ == "__main__":
    # Test configuration
    config = WhisperConfig(
        api_key=os.getenv("OPENAI_WHISPER_API_KEY"),
        use_api=True,
        model_size="base",
        word_timestamps=True,
        highlight_words=["amazing", "secret", "pro tip"]
    )
    
    # Initialize service
    service = WhisperService(config)
    
    # Test transcription
    test_audio = "/path/to/test/audio.wav"
    
    if os.path.exists(test_audio):
        result = service.transcribe(
            audio_path=test_audio,
            output_format="srt",
            template_style="tiktok_classic"
        )
        
        if result["success"]:
            print(f"✅ Transcription successful!")
            print(f"📝 Method used: {result['method_used']}")
            print(f"⏱️ Processing time: {result['processing_time']:.2f}s")
            print(f"📄 Caption file: {result['caption_file']}")
            print(f"💬 Word count: {result['word_count']}")
        else:
            print(f"❌ Transcription failed: {result['error']}")
    
    # Test AI heading generation
    headings = service.generate_ai_heading(
        "This is an amazing product that will change your life",
        product="fitness tracker",
        emotion="engaging"
    )
    
    print("\n🎯 Generated headings:")
    for i, heading in enumerate(headings, 1):
        print(f"{i}. {heading}")