"""
SQLite database initialization and connection management.

This module handles database schema creation, connection pooling,
and database lifecycle management.
"""

import sqlite3
import threading
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

# Thread-local storage for database connections
_thread_local = threading.local()

# Database file path (will be set by init_db)
_db_path: Optional[Path] = None


def init_db(db_path: Path, force_recreate: bool = False) -> None:
    """
    Initialize SQLite database with proper schema.
    
    Args:
        db_path: Path to the SQLite database file
        force_recreate: If True, drop and recreate all tables (DESTRUCTIVE)
    """
    global _db_path
    _db_path = db_path
    
    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")  # Enable Write-Ahead Logging
    conn.execute("PRAGMA synchronous=NORMAL")  # Balanced safety/performance
    conn.execute("PRAGMA foreign_keys=ON")  # Enable foreign key constraints
    
    try:
        if force_recreate:
            conn.execute("DROP TABLE IF EXISTS jobs")
        
        # Create jobs table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
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
                data TEXT NOT NULL,
                -- V2 fields: Campaign management
                campaign_type TEXT,
                avatar_id TEXT,
                script_id TEXT,
                avatar_video_path TEXT,
                script_file TEXT,
                use_overlay BOOLEAN DEFAULT 0,
                automated_video_editing_enabled BOOLEAN DEFAULT 1,
                useExactScript BOOLEAN DEFAULT 0,
                UNIQUE(id)
            )
        """)
        
        # Create indexes for better query performance
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_enabled 
            ON jobs(enabled)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_product 
            ON jobs(product)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_persona 
            ON jobs(persona)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_language 
            ON jobs(language)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
            ON jobs(created_at)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_job_name 
            ON jobs(job_name)
        """)
        
        # V2 Indexes for new fields
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_campaign_type 
            ON jobs(campaign_type)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_avatar_id 
            ON jobs(avatar_id)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_script_id 
            ON jobs(script_id)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_use_overlay 
            ON jobs(use_overlay)
        """)
        
        # Create full-text search virtual table for advanced search
        # This allows efficient searching across job_name, product, brand_name
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(
                id UNINDEXED,
                job_name,
                product,
                brand_name,
                content='jobs',
                content_rowid='rowid'
            )
        """)
        
        # Create triggers to keep FTS table in sync
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS jobs_fts_insert AFTER INSERT ON jobs BEGIN
                INSERT INTO jobs_fts(rowid, id, job_name, product, brand_name)
                VALUES (new.rowid, new.id, new.job_name, new.product, new.brand_name);
            END
        """)
        
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS jobs_fts_delete AFTER DELETE ON jobs BEGIN
                DELETE FROM jobs_fts WHERE rowid = old.rowid;
            END
        """)
        
        conn.execute("""
            CREATE TRIGGER IF NOT EXISTS jobs_fts_update AFTER UPDATE ON jobs BEGIN
                DELETE FROM jobs_fts WHERE rowid = old.rowid;
                INSERT INTO jobs_fts(rowid, id, job_name, product, brand_name)
                VALUES (new.rowid, new.id, new.job_name, new.product, new.brand_name);
            END
        """)
        
        conn.commit()
        print(f"✅ Database initialized successfully at: {db_path}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error initializing database: {e}")
        raise
    finally:
        conn.close()


def get_db_connection() -> sqlite3.Connection:
    """
    Get thread-local database connection.
    
    Returns:
        SQLite connection object for the current thread
        
    Raises:
        RuntimeError: If database not initialized
    """
    if _db_path is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    
    # Check if connection exists for this thread
    if not hasattr(_thread_local, 'connection') or _thread_local.connection is None:
        _thread_local.connection = sqlite3.connect(str(_db_path))
        _thread_local.connection.row_factory = sqlite3.Row  # Enable column access by name
        _thread_local.connection.execute("PRAGMA foreign_keys=ON")
    
    return _thread_local.connection


def close_db_connection() -> None:
    """
    Close the thread-local database connection.
    """
    if hasattr(_thread_local, 'connection') and _thread_local.connection is not None:
        _thread_local.connection.close()
        _thread_local.connection = None


@contextmanager
def get_db_cursor():
    """
    Context manager for database cursor operations.
    
    Yields:
        Database cursor
        
    Example:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM jobs")
            results = cursor.fetchall()
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()


def vacuum_database() -> None:
    """
    Vacuum the database to reclaim space and optimize performance.
    Should be called periodically for maintenance.
    """
    if _db_path is None:
        raise RuntimeError("Database not initialized")
    
    conn = get_db_connection()
    conn.execute("VACUUM")
    conn.commit()
    print("✅ Database vacuumed successfully")


def get_database_size() -> int:
    """
    Get the size of the database file in bytes.
    
    Returns:
        Size in bytes
    """
    if _db_path is None or not _db_path.exists():
        return 0
    return _db_path.stat().st_size


def get_database_info() -> dict:
    """
    Get information about the database.
    
    Returns:
        Dictionary with database information
    """
    if _db_path is None:
        return {"initialized": False}
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get table count
    cursor.execute("SELECT COUNT(*) FROM jobs")
    job_count = cursor.fetchone()[0]
    
    # Get database size
    db_size = get_database_size()
    
    # Get page count and size
    cursor.execute("PRAGMA page_count")
    page_count = cursor.fetchone()[0]
    
    cursor.execute("PRAGMA page_size")
    page_size = cursor.fetchone()[0]
    
    return {
        "initialized": True,
        "path": str(_db_path),
        "size_bytes": db_size,
        "size_mb": round(db_size / (1024 * 1024), 2),
        "job_count": job_count,
        "page_count": page_count,
        "page_size": page_size,
    }

