"""
CRUD operations for SQLite job storage.

This module provides Create, Read, Update, Delete operations
for job data with optimal performance and error handling.
"""

import sqlite3
from typing import Optional, List, Dict, Any
from datetime import datetime

from .models import Job, JobFilter, JobStatistics
from .database import get_db_connection, get_db_cursor


def add_job(job_data: Dict[str, Any]) -> Job:
    """
    Add a new job to the database.
    
    Args:
        job_data: Dictionary containing job data
        
    Returns:
        Created Job instance
        
    Raises:
        ValueError: If job data is invalid
        sqlite3.IntegrityError: If job with same ID already exists
    """
    # Create Job instance from dictionary
    job = Job.from_dict(job_data)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO jobs (
                id, job_name, product, persona, setting, emotion, hook,
                elevenlabs_voice_id, language, brand_name, enabled,
                created_at, updated_at, data,
                campaign_type, avatar_id, script_id, avatar_video_path,
                script_file, use_overlay, automated_video_editing_enabled, useExactScript
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, job.to_db_tuple())
        
        conn.commit()
        print(f"✅ Job added: {job.job_name} ({job.id})")
        return job
        
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise ValueError(f"Job with ID '{job.id}' already exists") from e
    except Exception as e:
        conn.rollback()
        print(f"❌ Error adding job: {e}")
        raise
    finally:
        cursor.close()


def get_job(job_id: str) -> Optional[Job]:
    """
    Get a single job by ID.
    
    Args:
        job_id: Job identifier
        
    Returns:
        Job instance if found, None otherwise
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, job_name, product, persona, setting, emotion, hook,
                   elevenlabs_voice_id, language, brand_name, enabled,
                   created_at, updated_at, data,
                   campaign_type, avatar_id, script_id, avatar_video_path,
                   script_file, use_overlay, automated_video_editing_enabled, useExactScript
            FROM jobs
            WHERE id = ?
        """, (job_id,))
        
        row = cursor.fetchone()
        if row:
            return Job.from_db_row(tuple(row))
        return None
        
    finally:
        cursor.close()


def update_job(job_id: str, updates: Dict[str, Any]) -> Optional[Job]:
    """
    Update an existing job.
    
    Args:
        job_id: Job identifier
        updates: Dictionary with fields to update
        
    Returns:
        Updated Job instance if found, None otherwise
    """
    # Get current job
    job = get_job(job_id)
    if not job:
        return None
    
    # Merge updates into job data
    job_data = job.to_dict()
    job_data.update(updates)
    job_data['updated_at'] = datetime.now().isoformat()
    
    # Create updated job instance
    updated_job = Job.from_dict(job_data)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE jobs SET
                job_name = ?,
                product = ?,
                persona = ?,
                setting = ?,
                emotion = ?,
                hook = ?,
                elevenlabs_voice_id = ?,
                language = ?,
                brand_name = ?,
                enabled = ?,
                updated_at = ?,
                data = ?
            WHERE id = ?
        """, (
            updated_job.job_name,
            updated_job.product or '',
            updated_job.persona or '',
            updated_job.setting or '',
            updated_job.emotion or 'neutral',
            updated_job.hook or '',
            updated_job.elevenlabs_voice_id or '',
            updated_job.language or 'English',
            updated_job.brand_name or '',
            updated_job.enabled,
            updated_job.updated_at,
            updated_job.to_db_tuple()[13],  # JSON data
            job_id
        ))
        
        conn.commit()
        print(f"✅ Job updated: {updated_job.job_name} ({job_id})")
        return updated_job
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating job: {e}")
        raise
    finally:
        cursor.close()


def delete_job(job_id: str) -> bool:
    """
    Delete a job from the database.
    
    Args:
        job_id: Job identifier
        
    Returns:
        True if job was deleted, False if not found
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        
        if deleted:
            print(f"✅ Job deleted: {job_id}")
        else:
            print(f"⚠️ Job not found: {job_id}")
        
        return deleted
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error deleting job: {e}")
        raise
    finally:
        cursor.close()


def list_jobs(filters: Optional[JobFilter] = None) -> List[Dict[str, Any]]:
    """
    List jobs with optional filtering and pagination.
    
    Args:
        filters: Optional JobFilter instance for filtering
        
    Returns:
        List of job dictionaries
    """
    if filters is None:
        filters = JobFilter()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Build query
        query = "SELECT data FROM jobs"
        params = []
        conditions = []
        
        # Apply filters
        if filters.enabled is not None:
            conditions.append("enabled = ?")
            params.append(filters.enabled)
        
        if filters.product:
            conditions.append("product LIKE ?")
            params.append(f"%{filters.product}%")
        
        if filters.persona:
            conditions.append("persona LIKE ?")
            params.append(f"%{filters.persona}%")
        
        if filters.language:
            conditions.append("language = ?")
            params.append(filters.language)
        
        # V2 filters
        if filters.campaign_type:
            conditions.append("campaign_type = ?")
            params.append(filters.campaign_type)
        
        if filters.avatar_id:
            conditions.append("avatar_id = ?")
            params.append(filters.avatar_id)
        
        if filters.script_id:
            conditions.append("script_id = ?")
            params.append(filters.script_id)
        
        if filters.use_overlay is not None:
            conditions.append("use_overlay = ?")
            params.append(filters.use_overlay)
        
        if filters.search_term:
            conditions.append("(job_name LIKE ? OR product LIKE ? OR brand_name LIKE ?)")
            search_pattern = f"%{filters.search_term}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        # Add WHERE clause if we have conditions
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        # Add ORDER BY
        valid_order_fields = ['created_at', 'updated_at', 'job_name', 'product']
        order_by = filters.order_by if filters.order_by in valid_order_fields else 'created_at'
        order_dir = 'ASC' if filters.order_dir.upper() == 'ASC' else 'DESC'
        query += f" ORDER BY {order_by} {order_dir}"
        
        # Add pagination
        if filters.limit:
            query += f" LIMIT {filters.limit} OFFSET {filters.offset}"
        
        cursor.execute(query, params)
        
        # Parse JSON data and return
        jobs = []
        for row in cursor.fetchall():
            import json
            job_data = json.loads(row[0])
            jobs.append(job_data)
        
        return jobs
        
    finally:
        cursor.close()


def search_jobs(search_term: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Full-text search across jobs using FTS5.
    
    Args:
        search_term: Search term
        limit: Optional limit on results
        
    Returns:
        List of matching job dictionaries, ranked by relevance
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            SELECT j.data
            FROM jobs j
            INNER JOIN jobs_fts fts ON j.rowid = fts.rowid
            WHERE jobs_fts MATCH ?
            ORDER BY rank
        """
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query, (search_term,))
        
        # Parse JSON data and return
        jobs = []
        for row in cursor.fetchall():
            import json
            job_data = json.loads(row[0])
            jobs.append(job_data)
        
        return jobs
        
    except Exception as e:
        print(f"⚠️ FTS search error, falling back to LIKE: {e}")
        # Fallback to simple LIKE search
        return list_jobs(JobFilter(search_term=search_term, limit=limit))
    finally:
        cursor.close()


def get_job_statistics() -> JobStatistics:
    """
    Get comprehensive statistics about jobs in the database.
    
    Returns:
        JobStatistics instance with aggregated data
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get overall statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN enabled = 1 THEN 1 END) as enabled_jobs,
                COUNT(CASE WHEN enabled = 0 THEN 1 END) as disabled_jobs,
                COUNT(DISTINCT product) as unique_products,
                COUNT(DISTINCT persona) as unique_personas,
                COUNT(DISTINCT language) as unique_languages
            FROM jobs
        """)
        
        row = cursor.fetchone()
        stats = JobStatistics(
            total_jobs=row[0],
            enabled_jobs=row[1],
            disabled_jobs=row[2],
            unique_products=row[3],
            unique_personas=row[4],
            unique_languages=row[5]
        )
        
        # Get jobs by product
        cursor.execute("""
            SELECT product, COUNT(*) as count
            FROM jobs
            WHERE product IS NOT NULL AND product != ''
            GROUP BY product
            ORDER BY count DESC
        """)
        stats.jobs_by_product = [
            {"product": row[0], "count": row[1]}
            for row in cursor.fetchall()
        ]
        
        # Get jobs by persona
        cursor.execute("""
            SELECT persona, COUNT(*) as count
            FROM jobs
            WHERE persona IS NOT NULL AND persona != ''
            GROUP BY persona
            ORDER BY count DESC
        """)
        stats.jobs_by_persona = [
            {"persona": row[0], "count": row[1]}
            for row in cursor.fetchall()
        ]
        
        return stats
        
    finally:
        cursor.close()


def get_jobs_by_product() -> List[Dict[str, Any]]:
    """
    Get job counts grouped by product.
    
    Returns:
        List of dictionaries with product and count
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT product, COUNT(*) as count
            FROM jobs
            GROUP BY product
            ORDER BY count DESC
        """)
        
        return [{"product": row[0], "count": row[1]} for row in cursor.fetchall()]
        
    finally:
        cursor.close()


def job_exists(job_id: str) -> bool:
    """
    Check if a job exists in the database.
    
    Args:
        job_id: Job identifier
        
    Returns:
        True if job exists, False otherwise
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT COUNT(*) FROM jobs WHERE id = ?", (job_id,))
        count = cursor.fetchone()[0]
        return count > 0
        
    finally:
        cursor.close()


def bulk_add_jobs(jobs_data: List[Dict[str, Any]]) -> tuple[int, int]:
    """
    Add multiple jobs in a single transaction for better performance.
    
    Args:
        jobs_data: List of job dictionaries
        
    Returns:
        Tuple of (successful_count, failed_count)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    successful = 0
    failed = 0
    
    try:
        for job_data in jobs_data:
            try:
                job = Job.from_dict(job_data)
                cursor.execute("""
                    INSERT INTO jobs (
                        id, job_name, product, persona, setting, emotion, hook,
                        elevenlabs_voice_id, language, brand_name, enabled,
                        created_at, updated_at, data,
                        campaign_type, avatar_id, script_id, avatar_video_path,
                        script_file, use_overlay, automated_video_editing_enabled, useExactScript
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, job.to_db_tuple())
                successful += 1
            except Exception as e:
                print(f"⚠️ Failed to add job {job_data.get('id', 'unknown')}: {e}")
                failed += 1
        
        conn.commit()
        print(f"✅ Bulk insert: {successful} successful, {failed} failed")
        return (successful, failed)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Bulk insert failed: {e}")
        raise
    finally:
        cursor.close()

