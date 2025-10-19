"""
Schema Migration V2: Add missing indexed fields for campaign management.

This migration adds critical fields that are commonly queried:
- campaign_type: Distinguish between 'avatar' and 'randomized' campaigns
- avatar_id: For avatar campaign lookups
- script_id: For script management  
- avatar_video_path: Path to avatar video
- script_file: Path to script file
- use_overlay: Product overlay feature flag
- automated_video_editing_enabled: Video editing feature flag
- useExactScript: Exact script mode flag
"""

import sqlite3
from pathlib import Path
from typing import Optional
import json


def migrate_v1_to_v2(db_path: Path) -> None:
    """
    Migrate database from V1 to V2 schema.
    
    Adds new indexed columns for commonly queried campaign fields.
    
    Args:
        db_path: Path to the SQLite database
    """
    print("\n" + "=" * 70)
    print("  🔄 Schema Migration: V1 → V2")
    print("=" * 70)
    print(f"\n📂 Database: {db_path}")
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check current schema version
        cursor.execute("PRAGMA table_info(jobs)")
        columns = {row[1] for row in cursor.fetchall()}
        
        print(f"\n📋 Current columns: {len(columns)}")
        
        # Fields to add
        new_fields = [
            ("campaign_type", "TEXT", "Distinguish avatar vs randomized"),
            ("avatar_id", "TEXT", "Avatar identifier"),
            ("script_id", "TEXT", "Script identifier"),
            ("avatar_video_path", "TEXT", "Path to avatar video"),
            ("script_file", "TEXT", "Path to script file"),
            ("use_overlay", "BOOLEAN DEFAULT 0", "Product overlay feature"),
            ("automated_video_editing_enabled", "BOOLEAN DEFAULT 1", "Video editing feature"),
            ("useExactScript", "BOOLEAN DEFAULT 0", "Exact script mode"),
        ]
        
        added_count = 0
        
        for field_name, field_type, description in new_fields:
            if field_name not in columns:
                print(f"\n➕ Adding column: {field_name} ({field_type})")
                print(f"   Description: {description}")
                
                cursor.execute(f"""
                    ALTER TABLE jobs 
                    ADD COLUMN {field_name} {field_type}
                """)
                added_count += 1
            else:
                print(f"✓ Column already exists: {field_name}")
        
        if added_count > 0:
            # Populate new columns from JSON data
            print(f"\n🔄 Populating {added_count} new columns from JSON data...")
            
            cursor.execute("SELECT id, data FROM jobs")
            jobs = cursor.fetchall()
            
            for job_id, data_json in jobs:
                if not data_json:
                    continue
                
                try:
                    data = json.loads(data_json)
                    
                    # Extract values from JSON
                    updates = {
                        'campaign_type': data.get('campaignType') or data.get('campaign_type'),
                        'avatar_id': data.get('avatarId') or data.get('avatar_id'),
                        'script_id': data.get('scriptId') or data.get('script_id'),
                        'avatar_video_path': data.get('avatar_video_path') or data.get('avatarVideo'),
                        'script_file': data.get('example_script_file') or data.get('scriptFile') or data.get('script_file'),
                        'use_overlay': int(data.get('use_overlay', False) or data.get('useOverlay', False)),
                        'automated_video_editing_enabled': int(data.get('automated_video_editing_enabled', True)),
                        'useExactScript': int(data.get('useExactScript', False)),
                    }
                    
                    # Build update query
                    set_clauses = []
                    values = []
                    for field, value in updates.items():
                        if field in [col[0] for col in new_fields] and field not in columns:
                            set_clauses.append(f"{field} = ?")
                            values.append(value)
                    
                    if set_clauses:
                        values.append(job_id)
                        cursor.execute(f"""
                            UPDATE jobs 
                            SET {', '.join(set_clauses)}
                            WHERE id = ?
                        """, values)
                
                except json.JSONDecodeError:
                    print(f"⚠️ Failed to parse JSON for job: {job_id}")
                    continue
            
            print(f"✅ Populated data for {len(jobs)} jobs")
            
            # Create indexes for new columns
            print(f"\n📇 Creating indexes for new columns...")
            
            indexes = [
                ("idx_jobs_campaign_type", "campaign_type"),
                ("idx_jobs_avatar_id", "avatar_id"),
                ("idx_jobs_script_id", "script_id"),
                ("idx_jobs_use_overlay", "use_overlay"),
            ]
            
            for index_name, column_name in indexes:
                print(f"   Creating index: {index_name} on {column_name}")
                cursor.execute(f"""
                    CREATE INDEX IF NOT EXISTS {index_name}
                    ON jobs({column_name})
                """)
            
            conn.commit()
            print(f"\n✅ Migration completed! Added {added_count} columns and {len(indexes)} indexes")
        else:
            print(f"\n✓ Schema is already up to date")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()
    
    print("=" * 70)


def verify_migration(db_path: Path) -> bool:
    """
    Verify that migration completed successfully.
    
    Args:
        db_path: Path to the SQLite database
        
    Returns:
        True if migration is complete, False otherwise
    """
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        cursor.execute("PRAGMA table_info(jobs)")
        columns = {row[1] for row in cursor.fetchall()}
        
        required_columns = {
            'campaign_type', 'avatar_id', 'script_id', 
            'avatar_video_path', 'script_file', 'use_overlay',
            'automated_video_editing_enabled', 'useExactScript'
        }
        
        missing = required_columns - columns
        
        if missing:
            print(f"⚠️ Missing columns: {missing}")
            return False
        
        print("✅ All required columns present")
        return True
        
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python schema_migration_v2.py <database_path>")
        sys.exit(1)
    
    db_path = Path(sys.argv[1])
    migrate_v1_to_v2(db_path)
    verify_migration(db_path)

