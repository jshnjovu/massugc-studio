"""
File Service

Handles file operations, working directories, and output path management.
"""

import os
import uuid
from pathlib import Path
from datetime import datetime


class FileService:
    """Manages file operations and working directories for video processing."""
    
    # Global working directory setup
    HOME_DIR = Path.home() / ".zyra-video-agent"
    WORKING_DIR = HOME_DIR / "working-dir"
    OUTPUT_BASE_DIR = HOME_DIR / "output"
    
    @classmethod
    def initialize_directories(cls):
        """Ensure working and output directories exist."""
        for directory in (cls.WORKING_DIR, cls.OUTPUT_BASE_DIR):
            directory.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def get_temp_audio_path(cls, job_name: str = "audio") -> str:
        """
        Generate a temporary audio file path.
        
        Args:
            job_name: Base name for the audio file
            
        Returns:
            Full path to temporary audio file
        """
        cls.initialize_directories()
        unique_id = uuid.uuid4().hex[:8]
        filename = f"temp_{job_name}_{unique_id}.mp3"
        return str(cls.WORKING_DIR / filename)
    
    @classmethod
    def get_temp_video_path(cls, job_name: str = "video") -> str:
        """
        Generate a temporary video file path.
        
        Args:
            job_name: Base name for the video file
            
        Returns:
            Full path to temporary video file
        """
        cls.initialize_directories()
        unique_id = uuid.uuid4().hex[:8]
        filename = f"temp_{job_name}_{unique_id}.mp4"
        return str(cls.WORKING_DIR / filename)
    
    @classmethod
    def get_output_path(cls, product: str, job_name: str, custom_output_dir: str = None) -> str:
        """
        Generate final output path with organized directory structure.
        
        Args:
            product: Product name for folder organization
            job_name: Job name for the output filename
            custom_output_dir: Optional custom output directory
            
        Returns:
            Full path for the output video file
        """
        if custom_output_dir:
            base_dir = Path(custom_output_dir)
        else:
            base_dir = cls.OUTPUT_BASE_DIR
        
        # Create date-based folder structure
        date_folder = datetime.now().strftime("%Y-%m-%d")
        product_folder = product.replace(" ", "_").replace("/", "-")
        
        output_dir = base_dir / date_folder / product_folder
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%H%M%S")
        clean_job_name = job_name.replace(" ", "_").replace("/", "-")
        filename = f"{clean_job_name}_{timestamp}.mp4"
        
        return str(output_dir / filename)
    
    @classmethod
    def cleanup_temp_file(cls, file_path: str):
        """
        Safely remove a temporary file.
        
        Args:
            file_path: Path to file to remove
        """
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not clean up temp file {file_path}: {e}")
    
    @classmethod
    def validate_file_exists(cls, file_path: str, file_description: str = "File") -> tuple[bool, str]:
        """
        Validate that a file exists.
        
        Args:
            file_path: Path to validate
            file_description: Description for error messages
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not file_path:
            return False, f"{file_description} path is empty"
        
        if not os.path.exists(file_path):
            return False, f"{file_description} not found: {file_path}"
        
        if not os.path.isfile(file_path):
            return False, f"{file_description} is not a file: {file_path}"
        
        return True, ""
    
    @classmethod
    def validate_directory_exists(cls, dir_path: str, dir_description: str = "Directory") -> tuple[bool, str]:
        """
        Validate that a directory exists and contains files.
        
        Args:
            dir_path: Directory path to validate
            dir_description: Description for error messages
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not dir_path:
            return False, f"{dir_description} path is empty"
        
        if not os.path.exists(dir_path):
            return False, f"{dir_description} not found: {dir_path}"
        
        if not os.path.isdir(dir_path):
            return False, f"{dir_description} is not a directory: {dir_path}"
        
        return True, ""


# Initialize directories on module import
FileService.initialize_directories()

