"""
Migration utilities for converting between YAML and SQLite storage.

This module provides functions to migrate data from the legacy YAML
format to SQLite, and to export data back to YAML if needed.
"""

import shutil
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from .database import init_db, get_db_connection
from .crud import add_job, bulk_add_jobs, get_job, list_jobs
from .models import Job


def migrate_from_yaml(
    yaml_path: Path,
    db_path: Path,
    create_backup: bool = True
) -> Dict[str, Any]:
    """
    Migrate jobs from YAML file to SQLite database.
    
    Args:
        yaml_path: Path to campaigns.yaml file
        db_path: Path to SQLite database file
        create_backup: Whether to create backup of YAML file
        
    Returns:
        Dictionary with migration results
    """
    print("=" * 70)
    print("🔄 Starting migration from YAML to SQLite")
    print("=" * 70)
    
    results = {
        "success": False,
        "yaml_path": str(yaml_path),
        "db_path": str(db_path),
        "backup_path": None,
        "jobs_found": 0,
        "jobs_migrated": 0,
        "jobs_failed": 0,
        "errors": [],
        "started_at": datetime.now().isoformat(),
        "completed_at": None
    }
    
    try:
        # Step 1: Create backup if requested
        if create_backup and yaml_path.exists():
            backup_path = yaml_path.with_suffix('.yaml.backup')
            backup_suffix = 1
            while backup_path.exists():
                backup_path = yaml_path.with_suffix(f'.yaml.backup.{backup_suffix}')
                backup_suffix += 1
            
            shutil.copy2(yaml_path, backup_path)
            results["backup_path"] = str(backup_path)
            print(f"✅ Backup created: {backup_path}")
        
        # Step 2: Initialize database
        print(f"\n📦 Initializing database: {db_path}")
        init_db(db_path, force_recreate=False)
        
        # Step 3: Load jobs from YAML
        print(f"\n📖 Loading jobs from: {yaml_path}")
        
        if not yaml_path.exists():
            results["errors"].append(f"YAML file not found: {yaml_path}")
            print(f"❌ YAML file not found: {yaml_path}")
            return results
        
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            results["errors"].append("YAML file is empty or invalid")
            print("❌ YAML file is empty or invalid")
            return results
        
        jobs = data.get('jobs', [])
        results["jobs_found"] = len(jobs)
        print(f"✅ Found {len(jobs)} jobs to migrate")
        
        if not jobs:
            print("⚠️ No jobs to migrate")
            results["success"] = True
            results["completed_at"] = datetime.now().isoformat()
            return results
        
        # Step 4: Migrate jobs
        print(f"\n🔄 Migrating {len(jobs)} jobs...")
        print("-" * 70)
        
        migrated = 0
        failed = 0
        
        for i, job_data in enumerate(jobs, 1):
            job_name = job_data.get('job_name', 'Unknown')
            job_id = job_data.get('id')
            
            if not job_id:
                # Generate ID if missing
                import uuid
                job_id = str(uuid.uuid4()).replace('-', '')
                job_data['id'] = job_id
                print(f"  ⚠️ Generated missing ID for job: {job_name}")
            
            try:
                add_job(job_data)
                migrated += 1
                print(f"  [{i}/{len(jobs)}] ✅ Migrated: {job_name} ({job_id[:8]}...)")
                
            except ValueError as e:
                # Job already exists - skip or update?
                if "already exists" in str(e):
                    print(f"  [{i}/{len(jobs)}] ⚠️ Skipped (exists): {job_name}")
                    migrated += 1  # Count as migrated
                else:
                    failed += 1
                    error_msg = f"Job '{job_name}': {e}"
                    results["errors"].append(error_msg)
                    print(f"  [{i}/{len(jobs)}] ❌ Failed: {job_name} - {e}")
                    
            except Exception as e:
                failed += 1
                error_msg = f"Job '{job_name}': {e}"
                results["errors"].append(error_msg)
                print(f"  [{i}/{len(jobs)}] ❌ Failed: {job_name} - {e}")
        
        results["jobs_migrated"] = migrated
        results["jobs_failed"] = failed
        results["success"] = failed == 0
        results["completed_at"] = datetime.now().isoformat()
        
        # Step 5: Summary
        print("-" * 70)
        print(f"\n✨ Migration Summary:")
        print(f"  • Jobs found:    {results['jobs_found']}")
        print(f"  • Jobs migrated: {results['jobs_migrated']}")
        print(f"  • Jobs failed:   {results['jobs_failed']}")
        
        if results["backup_path"]:
            print(f"  • Backup saved:  {results['backup_path']}")
        
        if failed > 0:
            print(f"\n⚠️ Migration completed with {failed} errors")
            print("  See errors above for details")
        else:
            print(f"\n🎉 Migration completed successfully!")
        
        print("=" * 70)
        
        return results
        
    except Exception as e:
        results["errors"].append(f"Migration failed: {e}")
        results["completed_at"] = datetime.now().isoformat()
        print(f"\n❌ Migration failed: {e}")
        print("=" * 70)
        raise


def export_to_yaml(
    db_path: Path,
    yaml_path: Path,
    create_backup: bool = True
) -> Dict[str, Any]:
    """
    Export jobs from SQLite database to YAML file.
    
    Args:
        db_path: Path to SQLite database file
        yaml_path: Path to output YAML file
        create_backup: Whether to backup existing YAML file
        
    Returns:
        Dictionary with export results
    """
    print("=" * 70)
    print("📤 Exporting jobs from SQLite to YAML")
    print("=" * 70)
    
    results = {
        "success": False,
        "db_path": str(db_path),
        "yaml_path": str(yaml_path),
        "backup_path": None,
        "jobs_exported": 0,
        "started_at": datetime.now().isoformat(),
        "completed_at": None
    }
    
    try:
        # Create backup if requested
        if create_backup and yaml_path.exists():
            backup_path = yaml_path.with_suffix('.yaml.export_backup')
            shutil.copy2(yaml_path, backup_path)
            results["backup_path"] = str(backup_path)
            print(f"✅ Backup created: {backup_path}")
        
        # Initialize database connection
        init_db(db_path)
        
        # Load all jobs
        print("\n📖 Loading jobs from database...")
        jobs = list_jobs()
        results["jobs_exported"] = len(jobs)
        print(f"✅ Found {len(jobs)} jobs to export")
        
        # Write to YAML
        print(f"\n💾 Writing to YAML: {yaml_path}")
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(yaml_path, 'w', encoding='utf-8') as f:
            yaml.safe_dump({"jobs": jobs}, f, default_flow_style=False, sort_keys=False)
        
        results["success"] = True
        results["completed_at"] = datetime.now().isoformat()
        
        print(f"✅ Successfully exported {len(jobs)} jobs")
        print("=" * 70)
        
        return results
        
    except Exception as e:
        results["completed_at"] = datetime.now().isoformat()
        print(f"❌ Export failed: {e}")
        print("=" * 70)
        raise


def verify_migration(yaml_path: Path, db_path: Path) -> Dict[str, Any]:
    """
    Verify that migration was successful by comparing YAML and SQLite data.
    
    Args:
        yaml_path: Path to YAML file
        db_path: Path to SQLite database
        
    Returns:
        Dictionary with verification results
    """
    print("=" * 70)
    print("🔍 Verifying migration")
    print("=" * 70)
    
    results = {
        "success": False,
        "yaml_jobs": 0,
        "db_jobs": 0,
        "matches": 0,
        "mismatches": [],
        "missing_in_db": [],
        "extra_in_db": []
    }
    
    try:
        # Load YAML jobs
        with open(yaml_path, 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
        yaml_jobs = yaml_data.get('jobs', [])
        results["yaml_jobs"] = len(yaml_jobs)
        
        # Load database jobs
        init_db(db_path)
        db_jobs = list_jobs()
        results["db_jobs"] = len(db_jobs)
        
        print(f"YAML jobs: {results['yaml_jobs']}")
        print(f"DB jobs:   {results['db_jobs']}")
        
        # Create lookup dictionaries
        yaml_jobs_dict = {job.get('id'): job for job in yaml_jobs if job.get('id')}
        db_jobs_dict = {job.get('id'): job for job in db_jobs if job.get('id')}
        
        # Find matches and mismatches
        for job_id, yaml_job in yaml_jobs_dict.items():
            if job_id in db_jobs_dict:
                results["matches"] += 1
            else:
                results["missing_in_db"].append(job_id)
        
        # Find extra jobs in DB
        for job_id in db_jobs_dict:
            if job_id not in yaml_jobs_dict:
                results["extra_in_db"].append(job_id)
        
        # Determine success
        results["success"] = (
            len(results["missing_in_db"]) == 0 and
            len(results["extra_in_db"]) == 0 and
            results["yaml_jobs"] == results["db_jobs"]
        )
        
        # Print results
        print(f"\n✅ Matches:      {results['matches']}")
        
        if results["missing_in_db"]:
            print(f"❌ Missing in DB: {len(results['missing_in_db'])}")
            for job_id in results["missing_in_db"][:5]:  # Show first 5
                print(f"   - {job_id}")
        
        if results["extra_in_db"]:
            print(f"⚠️ Extra in DB:   {len(results['extra_in_db'])}")
            for job_id in results["extra_in_db"][:5]:  # Show first 5
                print(f"   - {job_id}")
        
        if results["success"]:
            print("\n🎉 Verification successful! Data matches.")
        else:
            print("\n⚠️ Verification found discrepancies.")
        
        print("=" * 70)
        
        return results
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        print("=" * 70)
        raise

