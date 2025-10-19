"""
Data models for SQLite job storage.

These models define the structure of job data and provide
validation and serialization utilities.
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List
from datetime import datetime
import json


@dataclass
class Job:
    """
    Job/Campaign data model.
    
    This class represents a video generation job with all its configuration.
    Structured fields are stored in database columns for efficient querying,
    while the complete job data is stored as JSON for full fidelity.
    """
    
    # Primary identifier
    id: str
    
    # Core fields (indexed for performance)
    job_name: str
    product: Optional[str] = ""
    persona: Optional[str] = ""
    setting: Optional[str] = ""
    emotion: Optional[str] = "neutral"
    hook: Optional[str] = ""
    elevenlabs_voice_id: Optional[str] = ""
    language: str = "English"
    brand_name: Optional[str] = ""
    enabled: bool = True
    
    # V2 fields: Campaign management (indexed for performance)
    campaign_type: Optional[str] = None  # 'avatar' or 'randomized'
    avatar_id: Optional[str] = None
    script_id: Optional[str] = None
    avatar_video_path: Optional[str] = None
    script_file: Optional[str] = None
    use_overlay: bool = False
    automated_video_editing_enabled: bool = True
    useExactScript: bool = False
    
    # Timestamps
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    # Complete job data as JSON (stores everything)
    data: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Initialize timestamps if not provided."""
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = datetime.now().isoformat()
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Job':
        """
        Create Job instance from dictionary.
        
        Args:
            data: Dictionary containing job data
            
        Returns:
            Job instance
        """
        # Extract structured fields
        job_id = data.get('id')
        if not job_id:
            raise ValueError("Job must have an 'id' field")
        
        return cls(
            id=job_id,
            job_name=data.get('job_name', ''),
            product=data.get('product', ''),
            persona=data.get('persona', ''),
            setting=data.get('setting', ''),
            emotion=data.get('emotion', 'neutral'),
            hook=data.get('hook', ''),
            elevenlabs_voice_id=data.get('elevenlabs_voice_id', ''),
            language=data.get('language', 'English'),
            brand_name=data.get('brand_name', ''),
            enabled=data.get('enabled', True),
            # V2 fields - handle multiple naming conventions
            campaign_type=data.get('campaignType') or data.get('campaign_type'),
            avatar_id=data.get('avatarId') or data.get('avatar_id'),
            script_id=data.get('scriptId') or data.get('script_id'),
            avatar_video_path=data.get('avatar_video_path') or data.get('avatarVideo'),
            script_file=data.get('example_script_file') or data.get('scriptFile') or data.get('script_file'),
            use_overlay=data.get('use_overlay', False) or data.get('useOverlay', False),
            automated_video_editing_enabled=data.get('automated_video_editing_enabled', True),
            useExactScript=data.get('useExactScript', False),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            data=data  # Store complete data
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Job instance to dictionary.
        
        Returns:
            Dictionary representation of the job
        """
        # Return the complete data dictionary
        if self.data:
            # Ensure timestamps are updated
            result = dict(self.data)
            result['updated_at'] = self.updated_at
            result['created_at'] = self.created_at
            return result
        
        # Fallback: return structured fields
        return {
            'id': self.id,
            'job_name': self.job_name,
            'product': self.product,
            'persona': self.persona,
            'setting': self.setting,
            'emotion': self.emotion,
            'hook': self.hook,
            'elevenlabs_voice_id': self.elevenlabs_voice_id,
            'language': self.language,
            'brand_name': self.brand_name,
            'enabled': self.enabled,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }
    
    def to_db_tuple(self) -> tuple:
        """
        Convert Job to tuple for database insertion.
        
        Returns:
            Tuple of values for database insertion
        """
        return (
            self.id,
            self.job_name,
            self.product or '',
            self.persona or '',
            self.setting or '',
            self.emotion or 'neutral',
            self.hook or '',
            self.elevenlabs_voice_id or '',
            self.language or 'English',
            self.brand_name or '',
            self.enabled,
            self.created_at,
            self.updated_at,
            json.dumps(self.data) if self.data else json.dumps(self.to_dict()),
            # V2 fields
            self.campaign_type or '',
            self.avatar_id or '',
            self.script_id or '',
            self.avatar_video_path or '',
            self.script_file or '',
            self.use_overlay,
            self.automated_video_editing_enabled,
            self.useExactScript,
        )
    
    @classmethod
    def from_db_row(cls, row: tuple) -> 'Job':
        """
        Create Job instance from database row.
        
        Args:
            row: Database row tuple
            
        Returns:
            Job instance
        """
        # Assuming row order matches the database schema
        # V1 schema: 14 fields
        # V2 schema: 22 fields (14 + 8 new fields)
        has_v2_fields = len(row) >= 22
        
        return cls(
            id=row[0],
            job_name=row[1],
            product=row[2],
            persona=row[3],
            setting=row[4],
            emotion=row[5],
            hook=row[6],
            elevenlabs_voice_id=row[7],
            language=row[8],
            brand_name=row[9],
            enabled=bool(row[10]),
            created_at=row[11],
            updated_at=row[12],
            data=json.loads(row[13]) if row[13] else {},
            # V2 fields (if available)
            campaign_type=row[14] if has_v2_fields else None,
            avatar_id=row[15] if has_v2_fields else None,
            script_id=row[16] if has_v2_fields else None,
            avatar_video_path=row[17] if has_v2_fields else None,
            script_file=row[18] if has_v2_fields else None,
            use_overlay=bool(row[19]) if has_v2_fields else False,
            automated_video_editing_enabled=bool(row[20]) if has_v2_fields else True,
            useExactScript=bool(row[21]) if has_v2_fields else False,
        )


@dataclass
class JobFilter:
    """
    Filter criteria for querying jobs.
    """
    enabled: Optional[bool] = None
    product: Optional[str] = None
    persona: Optional[str] = None
    language: Optional[str] = None
    search_term: Optional[str] = None
    # V2 filters
    campaign_type: Optional[str] = None  # 'avatar' or 'randomized'
    avatar_id: Optional[str] = None
    script_id: Optional[str] = None
    use_overlay: Optional[bool] = None
    limit: Optional[int] = None
    offset: int = 0
    order_by: str = "created_at"
    order_dir: str = "DESC"  # ASC or DESC


@dataclass
class JobStatistics:
    """
    Statistics about jobs in the database.
    """
    total_jobs: int = 0
    enabled_jobs: int = 0
    disabled_jobs: int = 0
    unique_products: int = 0
    unique_personas: int = 0
    unique_languages: int = 0
    jobs_by_product: List[Dict[str, Any]] = field(default_factory=list)
    jobs_by_persona: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert statistics to dictionary."""
        return asdict(self)

