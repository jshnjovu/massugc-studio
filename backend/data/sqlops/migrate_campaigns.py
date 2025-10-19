#!/usr/bin/env python3
"""
Standalone migration script for converting campaigns.yaml to SQLite.

Usage:
    python migrate_campaigns.py [yaml_path] [db_path]
    
    If paths are not provided, uses default paths:
    - YAML: ~/.zyra-video-agent/campaigns.yaml
    - DB:   ~/.zyra-video-agent/campaigns.db

Examples:
    # Migrate using default paths
    python migrate_campaigns.py
    
    # Migrate with custom paths
    python migrate_campaigns.py /path/to/campaigns.yaml /path/to/campaigns.db
    
    # Verify migration
    python migrate_campaigns.py --verify
    
    # Export DB back to YAML
    python migrate_campaigns.py --export
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data.sqlops import (
    migrate_from_yaml,
    export_to_yaml,
    verify_migration,
    get_database_info
)


def get_default_paths():
    """Get default paths for YAML and database files."""
    config_dir = Path.home() / ".zyra-video-agent"
    yaml_path = config_dir / "campaigns.yaml"
    db_path = config_dir / "campaigns.db"
    return yaml_path, db_path


def print_banner():
    """Print script banner."""
    print("\n" + "=" * 70)
    print("  🔄 MassUGC Campaign Migration Tool")
    print("  YAML → SQLite Database Converter")
    print("=" * 70)


def cmd_migrate(yaml_path: Path, db_path: Path, force: bool = False):
    """
    Migrate campaigns from YAML to SQLite.
    
    Args:
        yaml_path: Path to campaigns.yaml
        db_path: Path to output SQLite database
        force: If True, recreate database even if it exists
    """
    print_banner()
    print(f"\n📂 Source:      {yaml_path}")
    print(f"📂 Destination: {db_path}")
    
    # Check if YAML exists
    if not yaml_path.exists():
        print(f"\n❌ Error: YAML file not found: {yaml_path}")
        print("   Please specify a valid path or ensure the file exists.")
        sys.exit(1)
    
    # Check if database already exists
    if db_path.exists() and not force:
        print(f"\n⚠️ Warning: Database already exists: {db_path}")
        response = input("   Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print("   Migration cancelled.")
            sys.exit(0)
    
    # Perform migration
    try:
        results = migrate_from_yaml(yaml_path, db_path, create_backup=True)
        
        # Print detailed results
        print("\n" + "=" * 70)
        print("  📊 Migration Results")
        print("=" * 70)
        print(f"  Jobs found:    {results['jobs_found']}")
        print(f"  Jobs migrated: {results['jobs_migrated']}")
        print(f"  Jobs failed:   {results['jobs_failed']}")
        
        if results['backup_path']:
            print(f"  Backup saved:  {results['backup_path']}")
        
        if results['errors']:
            print(f"\n  ⚠️ Errors encountered:")
            for error in results['errors'][:10]:  # Show first 10 errors
                print(f"     - {error}")
        
        # Show database info
        info = get_database_info()
        print(f"\n  📦 Database Info:")
        print(f"     Size: {info['size_mb']} MB")
        print(f"     Jobs: {info['job_count']}")
        
        if results['success']:
            print("\n  🎉 Migration completed successfully!")
            print("\n  ✅ Next steps:")
            print("     1. Verify migration: python migrate_campaigns.py --verify")
            print("     2. Update app.py to use SQLite (see documentation)")
            print("     3. Test application thoroughly")
            print("     4. Keep YAML backup for 30 days")
        else:
            print("\n  ⚠️ Migration completed with errors.")
            print("     Review errors above and retry if needed.")
        
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_verify(yaml_path: Path, db_path: Path):
    """
    Verify migration by comparing YAML and SQLite data.
    
    Args:
        yaml_path: Path to campaigns.yaml
        db_path: Path to SQLite database
    """
    print_banner()
    print("\n🔍 Verifying Migration")
    print(f"   YAML: {yaml_path}")
    print(f"   DB:   {db_path}")
    
    if not yaml_path.exists():
        print(f"\n❌ Error: YAML file not found: {yaml_path}")
        sys.exit(1)
    
    if not db_path.exists():
        print(f"\n❌ Error: Database not found: {db_path}")
        sys.exit(1)
    
    try:
        results = verify_migration(yaml_path, db_path)
        
        print("\n" + "=" * 70)
        print("  📊 Verification Results")
        print("=" * 70)
        print(f"  YAML jobs:     {results['yaml_jobs']}")
        print(f"  DB jobs:       {results['db_jobs']}")
        print(f"  Matches:       {results['matches']}")
        
        if results['missing_in_db']:
            print(f"  Missing in DB: {len(results['missing_in_db'])}")
            for job_id in results['missing_in_db'][:5]:
                print(f"     - {job_id}")
        
        if results['extra_in_db']:
            print(f"  Extra in DB:   {len(results['extra_in_db'])}")
            for job_id in results['extra_in_db'][:5]:
                print(f"     - {job_id}")
        
        if results['success']:
            print("\n  ✅ Verification successful! Data matches perfectly.")
        else:
            print("\n  ⚠️ Verification found discrepancies.")
            print("     Review differences above.")
        
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_export(db_path: Path, yaml_path: Path):
    """
    Export database back to YAML format.
    
    Args:
        db_path: Path to SQLite database
        yaml_path: Path to output YAML file
    """
    print_banner()
    print("\n📤 Exporting Database to YAML")
    print(f"   Source:      {db_path}")
    print(f"   Destination: {yaml_path}")
    
    if not db_path.exists():
        print(f"\n❌ Error: Database not found: {db_path}")
        sys.exit(1)
    
    # Check if YAML exists
    if yaml_path.exists():
        print(f"\n⚠️ Warning: YAML file already exists: {yaml_path}")
        response = input("   Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print("   Export cancelled.")
            sys.exit(0)
    
    try:
        results = export_to_yaml(db_path, yaml_path, create_backup=True)
        
        print("\n" + "=" * 70)
        print("  📊 Export Results")
        print("=" * 70)
        print(f"  Jobs exported: {results['jobs_exported']}")
        
        if results['backup_path']:
            print(f"  Backup saved:  {results['backup_path']}")
        
        print("\n  ✅ Export completed successfully!")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Export failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_info(db_path: Path):
    """
    Show database information.
    
    Args:
        db_path: Path to SQLite database
    """
    print_banner()
    print("\n📊 Database Information")
    
    if not db_path.exists():
        print(f"\n❌ Error: Database not found: {db_path}")
        sys.exit(1)
    
    try:
        from data.sqlops import init_db, get_job_statistics
        
        init_db(db_path)
        info = get_database_info()
        stats = get_job_statistics()
        
        print("\n" + "=" * 70)
        print("  Database Details")
        print("=" * 70)
        print(f"  Path:           {info['path']}")
        print(f"  Size:           {info['size_mb']} MB")
        print(f"  Total jobs:     {stats.total_jobs}")
        print(f"  Enabled jobs:   {stats.enabled_jobs}")
        print(f"  Disabled jobs:  {stats.disabled_jobs}")
        print(f"  Unique products: {stats.unique_products}")
        print(f"  Unique personas: {stats.unique_personas}")
        
        if stats.jobs_by_product:
            print("\n  Top Products:")
            for item in stats.jobs_by_product[:5]:
                print(f"     - {item['product']}: {item['count']} jobs")
        
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Failed to get database info: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Migrate MassUGC campaigns between YAML and SQLite formats",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Migrate with default paths:
    python migrate_campaigns.py
  
  Migrate with custom paths:
    python migrate_campaigns.py /path/to/campaigns.yaml /path/to/campaigns.db
  
  Verify migration:
    python migrate_campaigns.py --verify
  
  Export database to YAML:
    python migrate_campaigns.py --export /path/to/output.yaml
  
  Show database info:
    python migrate_campaigns.py --info
        """
    )
    
    parser.add_argument(
        'yaml_path',
        nargs='?',
        type=Path,
        help='Path to campaigns.yaml (default: ~/.zyra-video-agent/campaigns.yaml)'
    )
    
    parser.add_argument(
        'db_path',
        nargs='?',
        type=Path,
        help='Path to SQLite database (default: ~/.zyra-video-agent/campaigns.db)'
    )
    
    parser.add_argument(
        '--verify',
        action='store_true',
        help='Verify migration by comparing YAML and database'
    )
    
    parser.add_argument(
        '--export',
        type=Path,
        metavar='OUTPUT_YAML',
        help='Export database to YAML file'
    )
    
    parser.add_argument(
        '--info',
        action='store_true',
        help='Show database information'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force overwrite existing database'
    )
    
    args = parser.parse_args()
    
    # Get default paths if not provided
    default_yaml, default_db = get_default_paths()
    yaml_path = args.yaml_path or default_yaml
    db_path = args.db_path or default_db
    
    # Execute command
    if args.verify:
        cmd_verify(yaml_path, db_path)
    elif args.export:
        cmd_export(db_path, args.export)
    elif args.info:
        cmd_info(db_path)
    else:
        # Default: migrate
        cmd_migrate(yaml_path, db_path, force=args.force)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Operation cancelled by user.")
        sys.exit(130)

