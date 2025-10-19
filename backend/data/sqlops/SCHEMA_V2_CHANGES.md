# SQLite Schema V2 - Campaign Management Fields

## Overview

This document describes the V2 schema update that adds critical indexed fields for efficient campaign management, based on the actual campaign structure used in the application (see `campaign_job_structure.json`).

## Changes Summary

### New Indexed Fields

The following fields have been added to the `jobs` table and are indexed for efficient querying:

| Field Name | Type | Description | Index |
|-----------|------|-------------|--------|
| `campaign_type` | TEXT | Distinguish between 'avatar' and 'randomized' campaigns | ✓ |
| `avatar_id` | TEXT | Avatar identifier for avatar campaigns | ✓ |
| `script_id` | TEXT | Script identifier for script management | ✓ |
| `avatar_video_path` | TEXT | Path to avatar video file | - |
| `script_file` | TEXT | Path to script file | - |
| `use_overlay` | BOOLEAN | Product overlay feature flag | ✓ |
| `automated_video_editing_enabled` | BOOLEAN | Video editing feature flag (default: true) | - |
| `useExactScript` | BOOLEAN | Exact script mode flag (default: false) | - |

### Why These Fields?

These fields were identified from the real campaign structure (`campaign_job_structure.json` and `campaigns.yaml`) as commonly queried fields that should be indexed for performance:

1. **`campaign_type`** - Essential for filtering avatar vs randomized campaigns
2. **`avatar_id`** & **`script_id`** - Key foreign keys for asset management
3. **`use_overlay`** - Feature flag frequently used in queries
4. **Other fields** - Stored for quick access without parsing JSON

## Data Handling

### Multiple Naming Conventions

The schema handles multiple naming conventions found in the codebase:

```python
# Both camelCase (frontend) and snake_case (backend) are supported
campaign_type = data.get('campaignType') or data.get('campaign_type')
avatar_id = data.get('avatarId') or data.get('avatar_id')
script_id = data.get('scriptId') or data.get('script_id')
avatar_video_path = data.get('avatar_video_path') or data.get('avatarVideo')
script_file = data.get('example_script_file') or data.get('scriptFile') or data.get('script_file')
use_overlay = data.get('use_overlay') or data.get('useOverlay')
```

### Complete Data Preservation

All original data is still preserved in the `data` JSON column. The indexed fields are extracted for fast querying, but the complete campaign structure (including `enhanced_settings` with text overlays, captions, and music) remains intact in JSON.

## New Query Capabilities

### Filter by Campaign Type

```python
from data.sqlops import list_jobs, JobFilter

# Get all avatar campaigns
avatar_campaigns = list_jobs(JobFilter(campaign_type='avatar'))

# Get all randomized campaigns
randomized_campaigns = list_jobs(JobFilter(campaign_type='randomized'))
```

### Filter by Avatar or Script

```python
# Get all campaigns using a specific avatar
campaigns = list_jobs(JobFilter(avatar_id='6957f47b95094a168c20781b07e31be8'))

# Get all campaigns using a specific script
campaigns = list_jobs(JobFilter(script_id='e907375cba9e4357ba60442d728f9012'))
```

### Filter by Feature Flags

```python
# Get campaigns with product overlay enabled
overlay_campaigns = list_jobs(JobFilter(use_overlay=True))

# Combine filters
active_avatar_overlays = list_jobs(JobFilter(
    enabled=True,
    campaign_type='avatar',
    use_overlay=True
))
```

## Migration Path

### For New Databases

New databases created with `init_db()` automatically include all V2 fields.

### For Existing Databases

Use the migration script to upgrade existing V1 databases:

```bash
python backend/data/sqlops/schema_migration_v2.py /path/to/campaigns.db
```

The migration script:
1. Adds new columns to the `jobs` table
2. Populates them from existing JSON data
3. Creates indexes for performance
4. Verifies the migration succeeded

### Manual Migration in Code

```python
from pathlib import Path
from data.sqlops.schema_migration_v2 import migrate_v1_to_v2

db_path = Path("campaigns.db")
migrate_v1_to_v2(db_path)
```

## Backward Compatibility

The schema is **fully backward compatible**:

- V1 code can read V2 databases (extra columns are ignored)
- V2 code can read V1 databases (new fields default to None/False)
- The `Job.from_db_row()` method auto-detects schema version

## Files Modified

### Core Schema Files
- `backend/data/sqlops/database.py` - Updated table schema and indexes
- `backend/data/sqlops/models.py` - Added V2 fields to Job and JobFilter
- `backend/data/sqlops/crud.py` - Updated INSERT/SELECT statements

### Migration Tools
- `backend/data/sqlops/schema_migration_v2.py` - New migration script

### Documentation
- `backend/data/sqlops/SCHEMA_V2_CHANGES.md` - This document

## Performance Impact

### Query Performance
- **Improved**: Queries filtering by campaign_type, avatar_id, script_id, or use_overlay
- **Unchanged**: Queries on other fields continue to use existing indexes
- **Disk Space**: ~8 bytes per row for new indexed fields (minimal)

### Index Storage
- 4 new indexes: `idx_jobs_campaign_type`, `idx_jobs_avatar_id`, `idx_jobs_script_id`, `idx_jobs_use_overlay`
- Estimated overhead: < 1% of database size for typical workloads

## Testing

All existing tests pass with V2 schema:
- ✅ Basic CRUD operations
- ✅ Bulk operations  
- ✅ Filtering and search
- ✅ Statistics
- ✅ Real-world scenarios

## Future Enhancements

Potential V3 fields to consider (not yet implemented):
- `created_by` - User who created the campaign
- `last_run_at` - Timestamp of last job execution
- `success_count` / `failure_count` - Job execution statistics
- `tags` - Array of tags for categorization

## References

- Campaign structure: `backend/notes/fonts_texts/junk_data/campaign_job_structure.json`
- Sample data: `backend/notes/fonts_texts/junk_data/campaigns.yaml`
- Test suite: `backend/data/sqlops/test_sqlops.py`

