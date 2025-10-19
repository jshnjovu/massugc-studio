"""
SQLite database operations for MassUGC campaigns/jobs.

This package provides a high-performance SQLite-based storage solution
for campaign jobs, replacing the flat-file YAML approach.
"""

from .database import init_db, get_db_connection, close_db_connection, get_database_info
from .models import Job, JobFilter, JobStatistics
from .crud import (
    add_job,
    get_job,
    update_job,
    delete_job,
    list_jobs,
    search_jobs,
    get_job_statistics,
    get_jobs_by_product,
    job_exists,
    bulk_add_jobs
)
from .migration import (
    migrate_from_yaml,
    export_to_yaml,
    verify_migration
)

__all__ = [
    # Database functions
    'init_db',
    'get_db_connection',
    'close_db_connection',
    'get_database_info',
    
    # Models
    'Job',
    'JobFilter',
    'JobStatistics',
    
    # CRUD operations
    'add_job',
    'get_job',
    'update_job',
    'delete_job',
    'list_jobs',
    'search_jobs',
    'get_job_statistics',
    'get_jobs_by_product',
    'job_exists',
    'bulk_add_jobs',
    
    # Migration
    'migrate_from_yaml',
    'export_to_yaml',
    'verify_migration',
]

