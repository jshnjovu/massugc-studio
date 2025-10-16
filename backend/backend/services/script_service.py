"""
Script Service

Handles script generation using OpenAI API and script file processing.
"""

import re
from pathlib import Path
from openai import OpenAI


class ScriptService:
    """Manages script generation and processing."""
    
    DEFAULT_MODEL = "gpt-4o"
    TARGET_DURATION = "75 to 90 seconds"
    
    @classmethod
    def generate_script(
        cls,
        api_key: str,
        product: str,
        persona: str,
        setting: str,
        emotion: str,
        hook_guidance: str,
        example_script: str,
        language: str = "English",
        enhance_for_elevenlabs: bool = False,
        brand_name: str = ""
    ) -> tuple[bool, str]:
        """
        Generate script using OpenAI API.
        
        Args:
            api_key: OpenAI API key
            product: Product name
            persona: Creator persona
            setting: Video setting
            emotion: Emotional tone
            hook_guidance: Hook requirements
            example_script: Example script for style reference
            language: Target language
            enhance_for_elevenlabs: Whether to add SSML tags
            brand_name: Brand name to include
            
        Returns:
            Tuple of (success, script_content_or_error_message)
        """
        print(f"Generating script with OpenAI model: {cls.DEFAULT_MODEL}...")
        
        if not example_script or len(example_script.strip()) < 50:
            return False, "Example script is missing or too short (minimum 50 characters)"
        
        if not api_key:
            return False, "OpenAI API key is required"
        
        try:
            # Initialize client
            client = OpenAI(api_key=api_key)
            
            # Build system prompt
            system_prompt = cls._build_system_prompt()
            
            # Build user prompt
            user_prompt = cls._build_user_prompt(
                product=product,
                persona=persona,
                setting=setting,
                emotion=emotion,
                hook_guidance=hook_guidance,
                example_script=example_script,
                language=language,
                enhance_for_elevenlabs=enhance_for_elevenlabs,
                brand_name=brand_name
            )
            
            # Generate script
            response = client.chat.completions.create(
                model=cls.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7
            )
            
            script_content = response.choices[0].message.content.strip()
            
            # Clean up script based on SSML mode
            cleaned_script = cls._cleanup_script(script_content, enhance_for_elevenlabs)
            
            if not cleaned_script:
                return False, "Script content became empty after cleanup"
            
            print("Script generated successfully")
            return True, cleaned_script
            
        except Exception as e:
            error_msg = f"OpenAI script generation failed: {str(e)}"
            print(f"Error: {error_msg}")
            return False, error_msg
    
    @classmethod
    def read_script_file(cls, script_path: str) -> tuple[bool, str]:
        """
        Read script content from file.
        
        Args:
            script_path: Path to script file
            
        Returns:
            Tuple of (success, script_content_or_error_message)
        """
        try:
            if not script_path:
                return False, "Script file path is empty"
            
            script_file = Path(script_path)
            
            if not script_file.exists():
                return False, f"Script file not found: {script_path}"
            
            with open(script_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            
            if not content:
                return False, f"Script file is empty: {script_path}"
            
            return True, content
            
        except Exception as e:
            return False, f"Failed to read script file: {str(e)}"
    
    @classmethod
    def _build_system_prompt(cls) -> str:
        """Build the system prompt for script generation."""
        return (
            "You are a professional scriptwriter and persuasive storyteller focused on crafting emotionally resonant, "
            "high-converting TikTok Shop video scripts. Your goal is to transform simple prompts into compelling, "
            "human-centered narratives that flow naturally in voiceover — using structured storytelling, emotional insight, "
            "and subtle persuasion to spark trust and drive action. You are an introspective storyteller crafting grounded, "
            "emotionally compelling TikTok Shop scripts. Your scripts are written like personal reflections the kind of quiet "
            "honesty someone might share on a podcast or in a heartfelt voiceover. Avoid buzzwords, and sales tactics. "
            "Let the narrative unfold naturally, using human struggles like fatigue, burnout, loss of drive to guide the arc. "
            "Speak plainly and insightfully. Your goal is not to sell, but to share and in doing so, build quiet trust. "
            "Avoid overused supplement marketing clichés. Do not use words like zest, vital, game-changer, enhances. "
            "Speak like someone unpacking their personal journey in a quiet moment not performing. "
            "Strictly adhere to the output format requested. Do NOT include explanations, introductions, summaries, "
            "or any text other than the script content itself unless specifically asked to use SSML tags. "
            "Do NOT use markers like 'Script:', '[HOOK]', '[INTRO]', stage directions like '[camera pans]', or sound cues."
        )
    
    @classmethod
    def _build_user_prompt(
        cls,
        product: str,
        persona: str,
        setting: str,
        emotion: str,
        hook_guidance: str,
        example_script: str,
        language: str,
        enhance_for_elevenlabs: bool,
        brand_name: str
    ) -> str:
        """Build the user prompt for script generation."""
        lines = [
            f"Product: {product}",
            f"Creator Persona: {persona}",
            f"Setting: {setting}",
            f"Emotion: {emotion}",
            f"Language: {language}",
            f"Hook Requirement: {hook_guidance}",
            f"Brand Name to include naturally near the end: {brand_name}"
        ]
        
        # Add SSML or plain text formatting instructions
        if enhance_for_elevenlabs:
            lines.append(
                "\nIMPORTANT FORMATTING REQUIREMENT: "
                "Make this script perfect for ElevenLabs to make it sound very human-like. "
                "Wrap the entire script output in <speak> tags. Use SSML tags like <break time=\"Xs\"/> for pauses "
                "(vary duration appropriately, e.g., 0.3s, 0.7s, 1s) and <emphasis level=\"moderate\"> for moderate emphasis "
                "on key words/phrases to ensure a human-like delivery for ElevenLabs text-to-speech. "
                "Focus on natural pauses and tonality. But don't add anything that tries to change the pronunciation of specific words."
            )
            lines.append("The example script below MAY NOT contain SSML, but your output MUST use SSML tags as described above.")
            lines.append(
                f"\nGenerate one unique script based on these details. IMPORTANT: The total duration, including both the spoken "
                f"dialogue AND the <break> tag pause times, should be approximately {cls.TARGET_DURATION} long. "
                f"Please factor in the pause durations when determining script length."
            )
        else:
            lines.append(
                "\nIMPORTANT FORMATTING REQUIREMENT: "
                "Output ONLY the raw spoken dialogue text, with no extra tags (like SSML) or formatting."
            )
            lines.append(
                f"\nGenerate one unique script based on these details. The script should be suitable for a video "
                f"approximately {cls.TARGET_DURATION} long."
            )
        
        # Add example script
        lines.append(
            "\nHere is an example script primarily for structure, tone, and style inspiration, "
            "please follow this style closely (ignore its specific formatting if SSML was requested above):"
        )
        lines.append("\n--- BEGIN EXAMPLE SCRIPT ---")
        lines.append(example_script)
        lines.append("--- END EXAMPLE SCRIPT ---")
        
        # Add final reminder
        if enhance_for_elevenlabs:
            lines.append(
                "\nFinal Reminder: Output ONLY the script content enclosed in <speak> tags, using appropriate <break> and "
                "<emphasis> SSML tags as requested. Do not add any other commentary, introductions, summaries, bracketed notes, "
                "or stage directions."
            )
        else:
            lines.append(
                "\nFinal Reminder: Output ONLY the raw spoken dialogue text for the script. Do not add any commentary, "
                "introductions, summaries, SSML tags, bracketed notes, or stage directions."
            )
        
        return "\n".join(lines)
    
    @classmethod
    def _cleanup_script(cls, script_content: str, is_ssml: bool) -> str:
        """Clean up generated script content."""
        if is_ssml:
            # Minimal cleanup for SSML
            unwanted = ["```xml", "```", "Response:", "Output:", "Generated Script:"]
            cleaned = script_content
            
            for phrase in unwanted:
                if cleaned.startswith(phrase):
                    cleaned = cleaned[len(phrase):].lstrip()
                if cleaned.endswith(phrase):
                    cleaned = cleaned[:-len(phrase)].rstrip()
            
            # Validate SSML tags
            if not cleaned.startswith("<speak>"):
                print("Warning: SSML output doesn't start with <speak>")
            if not cleaned.endswith("</speak>"):
                print("Warning: SSML output doesn't end with </speak>")
            
            return cleaned.strip()
        else:
            # Aggressive cleanup for plain text
            unwanted = [
                "script:", "here's the script:", "script start", "script end",
                "--- begin script ---", "--- end script ---",
                "--- begin example script ---", "--- end example script ---",
                "okay, here is the script:", "sure, here's a script:", "certainly, here is the script:",
                "here is one script:", "one script:", "```markdown", "```",
                "Response:", "Output:", "Generated Script:", "Okay, here's a script...",
                "<speak>", "</speak>"
            ]
            
            cleaned = script_content
            modified = True
            
            while modified:
                modified = False
                for phrase in unwanted:
                    if cleaned.lower().startswith(phrase.lower()):
                        cleaned = cleaned[len(phrase):].lstrip(" \n\t:")
                        modified = True
                        break
                    if cleaned.lower().endswith(phrase.lower()):
                        cleaned = cleaned[:-len(phrase)].rstrip(" \n\t:")
                        modified = True
                        break
            
            # Remove bracketed notes
            cleaned = re.sub(r'\[.*?\]', '', cleaned)
            
            # Remove empty lines
            cleaned = "\n".join(line for line in cleaned.splitlines() if line.strip())
            
            return cleaned.strip()

