# SQLite Database Operations for MassUGC

This package provides a high-performance SQLite-based storage solution for campaign jobs, replacing the flat-file YAML approach.

## Overview

The SQLite implementation offers significant performance improvements over the legacy YAML flat-file approach:

- **O(1) lookups** instead of O(n) for single job operations
- **Concurrent access** with proper transaction handling
- **Advanced querying** with indexed fields and full-text search
- **Data integrity** with ACID compliance
- **Scalability** for thousands of jobs

## Architecture

### Database Schema

The `jobs` table stores both structured fields (for efficient querying) and complete job data (as JSON):

```sql
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    job_name TEXT NOT NULL,
    product TEXT,
    persona TEXT,
    setting TEXT,
    emotion TEXT,
    hook TEXT,
    elevenlabs_voice_id TEXT,
    language TEXT DEFAULT 'English',
    brand_name TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL  -- Complete job data as JSON
)
```

### Indexes

Optimized indexes for common query patterns:
- `idx_jobs_enabled` - Filter enabled/disabled jobs
- `idx_jobs_product` - Query by product
- `idx_jobs_persona` - Query by persona
- `idx_jobs_language` - Query by language
- `idx_jobs_created_at` - Sort by creation date
- `idx_jobs_job_name` - Query by job name

### Full-Text Search

FTS5 virtual table for advanced search capabilities:
```sql
CREATE VIRTUAL TABLE jobs_fts USING fts5(...)
```

## Module Structure

```
backend/data/sqlops/
├── __init__.py      # Package exports
├── database.py      # Database initialization and connection management
├── models.py        # Data models (Job, JobFilter, JobStatistics)
├── crud.py          # CRUD operations
├── migration.py     # YAML ↔ SQLite migration utilities
└── README.md        # This file
```

## Usage Examples

### Initialize Database

```python
from pathlib import Path
from backend.data.sqlops import init_db

# Initialize database
db_path = Path("~/.zyra-video-agent/campaigns.db").expanduser()
init_db(db_path)
```

### Add a Job

```python
from backend.data.sqlops import add_job

job_data = {
    "id": "abc123",
    "job_name": "My Campaign",
    "product": "Product Name",
    "persona": "Friendly",
    "enabled": True,
    # ... other fields
}

job = add_job(job_data)
```

### Get a Job

```python
from backend.data.sqlops import get_job

job = get_job("abc123")
if job:
    print(f"Found job: {job.job_name}")
    job_dict = job.to_dict()
```

### Update a Job

```python
from backend.data.sqlops import update_job

updates = {
    "job_name": "Updated Campaign Name",
    "enabled": False
}

updated_job = update_job("abc123", updates)
```

### Delete a Job

```python
from backend.data.sqlops import delete_job

success = delete_job("abc123")
```

### List Jobs with Filters

```python
from backend.data.sqlops import list_jobs, JobFilter

# List all enabled jobs
jobs = list_jobs(JobFilter(enabled=True))

# List jobs for specific product with pagination
jobs = list_jobs(JobFilter(
    product="My Product",
    limit=10,
    offset=0,
    order_by="created_at",
    order_dir="DESC"
))
```

### Search Jobs

```python
from backend.data.sqlops import search_jobs

# Full-text search
results = search_jobs("marketing campaign", limit=20)
```

### Get Statistics

```python
from backend.data.sqlops import get_job_statistics

stats = get_job_statistics()
print(f"Total jobs: {stats.total_jobs}")
print(f"Enabled: {stats.enabled_jobs}")
print(f"By product: {stats.jobs_by_product}")
```

### Migrate from YAML

```python
from pathlib import Path
from backend.data.sqlops import migrate_from_yaml

yaml_path = Path("~/.zyra-video-agent/campaigns.yaml").expanduser()
db_path = Path("~/.zyra-video-agent/campaigns.db").expanduser()

# Migrate with automatic backup
results = migrate_from_yaml(yaml_path, db_path, create_backup=True)

print(f"Migrated: {results['jobs_migrated']}/{results['jobs_found']}")
```

### Export to YAML

```python
from backend.data.sqlops import export_to_yaml

# Export database back to YAML (for backup or compatibility)
results = export_to_yaml(db_path, yaml_path, create_backup=True)
```

### Verify Migration

```python
from backend.data.sqlops import verify_migration

# Verify migration was successful
results = verify_migration(yaml_path, db_path)

if results["success"]:
    print("✅ Migration verified successfully")
else:
    print(f"⚠️ Found {len(results['missing_in_db'])} missing jobs")
```

## Migration Strategy

### Automatic Migration on Startup

The system can automatically detect and migrate from YAML to SQLite:

```python
from pathlib import Path
from backend.data.sqlops import init_db, migrate_from_yaml

CONFIG_DIR = Path("~/.zyra-video-agent").expanduser()
YAML_PATH = CONFIG_DIR / "campaigns.yaml"
DB_PATH = CONFIG_DIR / "campaigns.db"

# Check if we need to migrate
if YAML_PATH.exists() and not DB_PATH.exists():
    print("Detected legacy YAML format, migrating...")
    init_db(DB_PATH)
    migrate_from_yaml(YAML_PATH, DB_PATH, create_backup=True)
else:
    init_db(DB_PATH)
```

### Rollback Strategy

If issues arise, you can rollback to YAML:

```python
# Export current DB to YAML
export_to_yaml(DB_PATH, YAML_PATH, create_backup=True)

# Delete SQLite database to use YAML
DB_PATH.unlink()
```

## Performance Comparison

| Operation | YAML (O notation) | SQLite (O notation) | Improvement |
|-----------|------------------|---------------------|-------------|
| Get single job | O(n) | O(1) | Excellent |
| Update job | O(n) | O(1) | Excellent |
| Delete job | O(n) | O(1) | Excellent |
| List all jobs | O(n) | O(n) | Similar |
| Search jobs | O(n) | O(log n) | Good |
| Filter by field | O(n) | O(log n) | Good |

### Real-World Impact

- **100 jobs**: Both systems perform well
- **1,000 jobs**: SQLite 10-100x faster for single operations
- **10,000+ jobs**: SQLite 100-1000x faster, YAML becomes unusable

## Data Integrity

### ACID Compliance

All operations are wrapped in transactions:
- **Atomicity**: Operations either complete fully or not at all
- **Consistency**: Database always in valid state
- **Isolation**: Concurrent operations don't interfere
- **Durability**: Committed data persists

### WAL Mode

Write-Ahead Logging enabled for:
- Better concurrent access
- Improved performance
- Crash recovery

### Backup Strategy

1. **Automatic YAML backup** during migration
2. **SQLite backup** using `.backup()` command
3. **Export to YAML** for version control compatibility

## Thread Safety

- **Thread-local connections**: Each thread gets its own connection
- **Automatic connection pooling**: Managed internally
- **Transaction isolation**: SERIALIZABLE isolation level

## Maintenance

### Vacuum Database

```python
from backend.data.sqlops.database import vacuum_database

# Reclaim space and optimize
vacuum_database()
```

### Get Database Info

```python
from backend.data.sqlops.database import get_database_info

info = get_database_info()
print(f"Size: {info['size_mb']} MB")
print(f"Jobs: {info['job_count']}")
```

## Error Handling

All functions raise appropriate exceptions:

- `ValueError`: Invalid input data
- `sqlite3.IntegrityError`: Duplicate ID or constraint violation
- `RuntimeError`: Database not initialized

Example:

```python
from backend.data.sqlops import add_job

try:
    job = add_job(job_data)
except ValueError as e:
    print(f"Invalid job data: {e}")
except sqlite3.IntegrityError as e:
    print(f"Job already exists: {e}")
```

## Best Practices

1. **Always initialize database first**: Call `init_db()` before operations
2. **Use filters for large datasets**: Avoid loading all jobs when possible
3. **Leverage full-text search**: Use `search_jobs()` for user-facing search
4. **Close connections gracefully**: Use context managers or call `close_db_connection()`
5. **Regular maintenance**: Vacuum database periodically
6. **Backup before migrations**: Always create backups before major operations

## Future Enhancements

Possible future improvements:

- [ ] Job history/audit trail
- [ ] Soft delete with trash/restore
- [ ] Job templates and versioning
- [ ] Advanced analytics queries
- [ ] Multi-database support (PostgreSQL, MySQL)
- [ ] Database replication for high availability

## Testing

Test the implementation:

```python
# Test script
from pathlib import Path
from backend.data.sqlops import *

# Initialize test database
test_db = Path("/tmp/test_campaigns.db")
init_db(test_db)

# Add test job
job_data = {
    "id": "test123",
    "job_name": "Test Job",
    "product": "Test Product",
    "enabled": True
}
add_job(job_data)

# Verify
job = get_job("test123")
assert job.job_name == "Test Job"

# Cleanup
test_db.unlink()
print("✅ All tests passed!")
```

## Migration Checklist

When migrating from YAML to SQLite:

- [ ] Backup current `campaigns.yaml`
- [ ] Initialize SQLite database
- [ ] Run migration script
- [ ] Verify migration results
- [ ] Test CRUD operations
- [ ] Update app.py to use new functions
- [ ] Test application functionality
- [ ] Keep YAML backup for 30 days
- [ ] Monitor performance and errors

## Support

For issues or questions:
1. Check this README
2. Review error messages carefully
3. Verify database is initialized
4. Check file permissions
5. Review migration logs

