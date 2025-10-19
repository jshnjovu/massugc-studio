"""
Campaign Processors Registry

Factory pattern for campaign type processors. Add new campaign types here
to make them available to the system.
"""

from .base_processor import BaseCampaignProcessor
from .avatar_processor import AvatarCampaignProcessor
from .splice_processor import SpliceCampaignProcessor


# Registry mapping campaign types to their processor classes
CAMPAIGN_PROCESSORS = {
    'avatar': AvatarCampaignProcessor,
    'splice': SpliceCampaignProcessor,
}


def get_processor(campaign_type: str) -> BaseCampaignProcessor:
    """
    Factory function to get the appropriate processor for a campaign type.
    
    Args:
        campaign_type: Type of campaign ('avatar', 'splice', etc.)
        
    Returns:
        Instance of the appropriate processor class
        
    Raises:
        ValueError: If campaign_type is not registered
    """
    processor_class = CAMPAIGN_PROCESSORS.get(campaign_type)
    
    if not processor_class:
        available = ', '.join(CAMPAIGN_PROCESSORS.keys())
        raise ValueError(
            f"Unknown campaign type: '{campaign_type}'. "
            f"Available types: {available}"
        )
    
    return processor_class()


def get_available_campaign_types() -> list[str]:
    """
    Get list of all available campaign types.
    
    Returns:
        List of campaign type names
    """
    return list(CAMPAIGN_PROCESSORS.keys())


__all__ = [
    'BaseCampaignProcessor',
    'AvatarCampaignProcessor',
    'SpliceCampaignProcessor',
    'CAMPAIGN_PROCESSORS',
    'get_processor',
    'get_available_campaign_types',
]

