"""
Base Campaign Processor

Abstract base class defining the interface for all campaign processors.
"""

from abc import ABC, abstractmethod
from typing import Callable, Optional


class BaseCampaignProcessor(ABC):
    """
    Abstract base class for campaign processors.
    
    All campaign type processors must implement this interface to ensure
    consistent behavior and validation across different campaign types.
    """
    
    @abstractmethod
    def get_required_fields(self) -> list[str]:
        """
        Get list of required configuration fields for this campaign type.
        
        Returns:
            List of required field names
        """
        pass
    
    @abstractmethod
    def validate_config(self, job_config: dict) -> tuple[bool, str]:
        """
        Validate campaign configuration before processing.
        
        Args:
            job_config: Campaign configuration dictionary
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        pass
    
    @abstractmethod
    def process(
        self,
        job_config: dict,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> tuple[bool, str]:
        """
        Process the campaign and generate video output.
        
        Args:
            job_config: Campaign configuration dictionary
            progress_callback: Optional callback for progress updates (step, total, message)
            
        Returns:
            Tuple of (success, output_path_or_error_message)
        """
        pass
    
    def _validate_required_fields(self, job_config: dict) -> tuple[bool, str]:
        """
        Helper method to validate required fields are present in config.
        
        Args:
            job_config: Campaign configuration dictionary
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        required = self.get_required_fields()
        missing = [field for field in required if not job_config.get(field)]
        
        if missing:
            return False, f"Missing required fields: {', '.join(missing)}"
        
        return True, ""
    
    def _validate_api_keys(self, job_config: dict, required_keys: list[str]) -> tuple[bool, str]:
        """
        Helper method to validate required API keys are present.
        
        Args:
            job_config: Campaign configuration dictionary
            required_keys: List of required API key names
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        missing = [key for key in required_keys if not job_config.get(key)]
        
        if missing:
            return False, f"Missing required API keys: {', '.join(missing)}"
        
        return True, ""

