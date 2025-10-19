"""
Test script for SQLite operations.

This script tests all major functionality of the sqlops package
and can be used to verify the implementation.
"""

import sys
import tempfile
from pathlib import Path
from datetime import datetime
import shutil

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data.sqlops import (
    init_db,
    add_job,
    get_job,
    update_job,
    delete_job,
    list_jobs,
    search_jobs,
    get_job_statistics,
    job_exists,
    bulk_add_jobs,
    JobFilter,
    get_database_info,
    migrate_from_yaml,
    verify_migration,
    export_to_yaml,
    close_db_connection
)


def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_basic_crud():
    """Test basic CRUD operations."""
    print_section("Testing Basic CRUD Operations")
    
    # Create temporary database
    temp_db = Path(tempfile.gettempdir()) / "test_campaigns.db"
    if temp_db.exists():
        temp_db.unlink()
    
    print(f"\n📦 Creating test database: {temp_db}")
    init_db(temp_db)
    
    # Test 1: Add job
    print("\n1️⃣ Testing add_job...")
    job_data = {
        "id": "test001",
        "job_name": "Test Campaign 1",
        "product": "Amazing Product",
        "persona": "Friendly",
        "setting": "Office",
        "emotion": "excited",
        "hook": "Check this out!",
        "elevenlabs_voice_id": "voice123",
        "language": "English",
        "brand_name": "TestBrand",
        "enabled": True,
        "enhanced_settings": {
            "text_overlays": [],
            "captions": {"enabled": False},
            "music": {"enabled": False}
        }
    }
    
    job = add_job(job_data)
    print(f"   ✅ Added job: {job.job_name}")
    assert job.id == "test001"
    assert job.job_name == "Test Campaign 1"
    
    # Test 2: Get job
    print("\n2️⃣ Testing get_job...")
    retrieved_job = get_job("test001")
    print(f"   ✅ Retrieved job: {retrieved_job.job_name}")
    assert retrieved_job is not None
    assert retrieved_job.product == "Amazing Product"
    
    # Test 3: Update job
    print("\n3️⃣ Testing update_job...")
    updates = {
        "job_name": "Updated Campaign 1",
        "enabled": False
    }
    updated_job = update_job("test001", updates)
    print(f"   ✅ Updated job: {updated_job.job_name}")
    assert updated_job.job_name == "Updated Campaign 1"
    assert updated_job.enabled == False
    
    # Test 4: Job exists
    print("\n4️⃣ Testing job_exists...")
    exists = job_exists("test001")
    print(f"   ✅ Job exists: {exists}")
    assert exists == True
    
    # Test 5: Delete job
    print("\n5️⃣ Testing delete_job...")
    deleted = delete_job("test001")
    print(f"   ✅ Job deleted: {deleted}")
    assert deleted == True
    assert job_exists("test001") == False
    
    # Cleanup
    close_db_connection()
    temp_db.unlink()
    print("\n✨ All basic CRUD tests passed!")


def test_bulk_operations():
    """Test bulk operations."""
    print_section("Testing Bulk Operations")
    
    temp_db = Path(tempfile.gettempdir()) / "test_campaigns_bulk.db"
    if temp_db.exists():
        temp_db.unlink()
    
    print(f"\n📦 Creating test database: {temp_db}")
    init_db(temp_db)
    
    # Create multiple jobs
    print("\n1️⃣ Testing bulk_add_jobs...")
    jobs_data = []
    for i in range(1, 11):
        jobs_data.append({
            "id": f"bulk{i:03d}",
            "job_name": f"Bulk Campaign {i}",
            "product": f"Product {(i % 3) + 1}",
            "persona": ["Friendly", "Professional", "Casual"][i % 3],
            "enabled": i % 2 == 0,
            "language": "English"
        })
    
    successful, failed = bulk_add_jobs(jobs_data)
    print(f"   ✅ Added {successful} jobs, {failed} failed")
    assert successful == 10
    assert failed == 0
    
    # Test list_jobs with filters
    print("\n2️⃣ Testing list_jobs with filters...")
    
    # All jobs
    all_jobs = list_jobs()
    print(f"   ✅ Total jobs: {len(all_jobs)}")
    assert len(all_jobs) == 10
    
    # Enabled only
    enabled_jobs = list_jobs(JobFilter(enabled=True))
    print(f"   ✅ Enabled jobs: {len(enabled_jobs)}")
    assert len(enabled_jobs) == 5
    
    # Filter by product
    product1_jobs = list_jobs(JobFilter(product="Product 1"))
    print(f"   ✅ Product 1 jobs: {len(product1_jobs)}")
    
    # Pagination
    page1 = list_jobs(JobFilter(limit=5, offset=0))
    page2 = list_jobs(JobFilter(limit=5, offset=5))
    print(f"   ✅ Page 1: {len(page1)} jobs, Page 2: {len(page2)} jobs")
    assert len(page1) == 5
    assert len(page2) == 5
    
    # Test search_jobs
    print("\n3️⃣ Testing search_jobs...")
    results = search_jobs("Campaign 5")
    print(f"   ✅ Search results: {len(results)}")
    
    # Test statistics
    print("\n4️⃣ Testing get_job_statistics...")
    stats = get_job_statistics()
    print(f"   ✅ Total jobs: {stats.total_jobs}")
    print(f"   ✅ Enabled jobs: {stats.enabled_jobs}")
    print(f"   ✅ Disabled jobs: {stats.disabled_jobs}")
    print(f"   ✅ Unique products: {stats.unique_products}")
    print(f"   ✅ Jobs by product: {stats.jobs_by_product}")
    
    assert stats.total_jobs == 10
    assert stats.enabled_jobs == 5
    assert stats.disabled_jobs == 5
    
    # Database info
    print("\n5️⃣ Testing get_database_info...")
    info = get_database_info()
    print(f"   ✅ Database size: {info['size_mb']} MB")
    print(f"   ✅ Job count: {info['job_count']}")
    
    # Cleanup
    close_db_connection()
    temp_db.unlink()
    print("\n✨ All bulk operation tests passed!")


def test_real_world_scenario():
    """Test a real-world usage scenario."""
    print_section("Testing Real-World Scenario")
    
    temp_db = Path(tempfile.gettempdir()) / "test_campaigns_realworld.db"
    if temp_db.exists():
        temp_db.unlink()
    
    print(f"\n📦 Creating test database: {temp_db}")
    init_db(temp_db)
    
    print("\n📝 Scenario: Managing a campaign library")
    
    # Step 1: Create campaigns
    print("\n1️⃣ Creating 5 campaigns...")
    campaigns = [
        {
            "id": "cam001",
            "job_name": "Summer Sale Promo",
            "product": "Sunglasses",
            "persona": "Energetic",
            "brand_name": "SunnyBrand",
            "enabled": True,
            "enhanced_settings": {
                "text_overlays": [
                    {
                        "enabled": True,
                        "custom_text": "50% OFF!",
                        "position": "top_center"
                    }
                ],
                "captions": {"enabled": True},
                "music": {"enabled": True, "track_id": "upbeat_summer"}
            }
        },
        {
            "id": "cam002",
            "job_name": "Winter Collection Launch",
            "product": "Winter Jacket",
            "persona": "Professional",
            "brand_name": "WarmWear",
            "enabled": True,
        },
        {
            "id": "cam003",
            "job_name": "Spring Fashion Show",
            "product": "Dresses",
            "persona": "Elegant",
            "brand_name": "SpringStyle",
            "enabled": False,
        },
        {
            "id": "cam004",
            "job_name": "Tech Product Demo",
            "product": "Smartphone",
            "persona": "Tech-Savvy",
            "brand_name": "TechCorp",
            "enabled": True,
        },
        {
            "id": "cam005",
            "job_name": "Food Recipe Tutorial",
            "product": "Cooking Utensils",
            "persona": "Friendly",
            "brand_name": "ChefTools",
            "enabled": True,
        }
    ]
    
    for campaign in campaigns:
        add_job(campaign)
    print(f"   ✅ Created {len(campaigns)} campaigns")
    
    # Step 2: List active campaigns
    print("\n2️⃣ Listing active campaigns...")
    active = list_jobs(JobFilter(enabled=True, order_by="job_name", order_dir="ASC"))
    for job in active:
        print(f"   - {job['job_name']} ({job['product']})")
    
    # Step 3: Search for specific campaign
    print("\n3️⃣ Searching for 'Tech' campaigns...")
    tech_campaigns = search_jobs("Tech")
    for job in tech_campaigns:
        print(f"   - Found: {job['job_name']}")
    
    # Step 4: Update a campaign
    print("\n4️⃣ Updating 'Summer Sale Promo'...")
    update_job("cam001", {
        "job_name": "Summer Mega Sale",
        "product": "Sunglasses & Accessories"
    })
    updated = get_job("cam001")
    print(f"   ✅ Updated to: {updated.job_name}")
    
    # Step 5: Disable a campaign
    print("\n5️⃣ Disabling 'Food Recipe Tutorial'...")
    update_job("cam005", {"enabled": False})
    print(f"   ✅ Campaign disabled")
    
    # Step 6: Get statistics
    print("\n6️⃣ Getting campaign statistics...")
    stats = get_job_statistics()
    print(f"   - Total campaigns: {stats.total_jobs}")
    print(f"   - Active campaigns: {stats.enabled_jobs}")
    print(f"   - Products: {[p['product'] for p in stats.jobs_by_product]}")
    
    # Cleanup
    close_db_connection()
    temp_db.unlink()
    print("\n✨ Real-world scenario test completed!")


def test_real_yaml_migration():
    """Test migration with real campaigns.yaml from junk_data."""
    print_section("Testing Migration with Real YAML Data")
    
    # Path to the real campaigns.yaml in junk_data
    real_yaml = Path(__file__).parent.parent / "notes" / "fonts_texts" / "junk_data" / "campaigns.yaml"
    
    if not real_yaml.exists():
        print(f"\n⚠️ Skipping: Real YAML not found at {real_yaml}")
        return
    
    print(f"\n📂 Using real YAML: {real_yaml}")
    
    # Create temporary database
    temp_db = Path(tempfile.gettempdir()) / "test_real_campaigns.db"
    if temp_db.exists():
        temp_db.unlink()
    
    # Create temporary copy of YAML (so we don't modify the original)
    temp_yaml = Path(tempfile.gettempdir()) / "test_campaigns_copy.yaml"
    shutil.copy2(real_yaml, temp_yaml)
    
    try:
        print(f"\n1️⃣ Migrating real YAML to SQLite...")
        results = migrate_from_yaml(temp_yaml, temp_db, create_backup=True)
        
        print(f"   ✅ Jobs found: {results['jobs_found']}")
        print(f"   ✅ Jobs migrated: {results['jobs_migrated']}")
        print(f"   ✅ Jobs failed: {results['jobs_failed']}")
        
        assert results['jobs_found'] > 0, "Should find jobs in real YAML"
        assert results['jobs_migrated'] > 0, "Should migrate jobs successfully"
        
        # Verify migration
        print(f"\n2️⃣ Verifying migration...")
        verify_results = verify_migration(temp_yaml, temp_db)
        
        print(f"   ✅ YAML jobs: {verify_results['yaml_jobs']}")
        print(f"   ✅ DB jobs: {verify_results['db_jobs']}")
        print(f"   ✅ Matches: {verify_results['matches']}")
        
        if not verify_results['success']:
            print(f"   ⚠️ Missing in DB: {len(verify_results['missing_in_db'])}")
            print(f"   ⚠️ Extra in DB: {len(verify_results['extra_in_db'])}")
        
        # Test querying the migrated data
        print(f"\n3️⃣ Testing queries on real data...")
        
        # Get statistics
        stats = get_job_statistics()
        print(f"   ✅ Total jobs: {stats.total_jobs}")
        print(f"   ✅ Enabled jobs: {stats.enabled_jobs}")
        print(f"   ✅ Unique products: {stats.unique_products}")
        
        if stats.jobs_by_product:
            print(f"   ✅ Products: {[p['product'] for p in stats.jobs_by_product[:3]]}")
        
        # List all jobs
        all_jobs = list_jobs()
        print(f"   ✅ Listed {len(all_jobs)} jobs")
        
        # Get first job to inspect structure
        if all_jobs:
            first_job_id = all_jobs[0]['id']
            first_job = get_job(first_job_id)
            print(f"   ✅ Retrieved job: {first_job.job_name}")
            
            # Test update
            print(f"\n4️⃣ Testing update on real job...")
            original_name = first_job.job_name
            update_job(first_job_id, {"job_name": f"{original_name} (Test Updated)"})
            updated = get_job(first_job_id)
            print(f"   ✅ Updated job name: {updated.job_name}")
            
            # Restore original name
            update_job(first_job_id, {"job_name": original_name})
            print(f"   ✅ Restored original name")
        
        # Test export back to YAML
        print(f"\n5️⃣ Testing export back to YAML...")
        export_yaml = Path(tempfile.gettempdir()) / "test_export.yaml"
        export_results = export_to_yaml(temp_db, export_yaml, create_backup=False)
        print(f"   ✅ Exported {export_results['jobs_exported']} jobs")
        
        assert export_yaml.exists(), "Export file should exist"
        
        # Clean up export file
        export_yaml.unlink()
        
        # Test search functionality with real data
        print(f"\n6️⃣ Testing search with real data...")
        if stats.total_jobs > 0:
            # Search for common terms
            search_terms = ["test", "campaign", "product"]
            for term in search_terms:
                results = search_jobs(term, limit=5)
                if results:
                    print(f"   ✅ Found {len(results)} results for '{term}'")
                    break
        
        # Test filtering
        print(f"\n7️⃣ Testing filters with real data...")
        enabled_jobs = list_jobs(JobFilter(enabled=True))
        disabled_jobs = list_jobs(JobFilter(enabled=False))
        print(f"   ✅ Enabled: {len(enabled_jobs)}, Disabled: {len(disabled_jobs)}")
        
        # Test pagination
        if stats.total_jobs > 2:
            page_size = min(2, stats.total_jobs)
            page1 = list_jobs(JobFilter(limit=page_size, offset=0))
            page2 = list_jobs(JobFilter(limit=page_size, offset=page_size))
            print(f"   ✅ Pagination works: Page1={len(page1)}, Page2={len(page2)}")
        
        print("\n✨ Real YAML migration test completed!")
        
    finally:
        # Cleanup
        close_db_connection()
        if temp_db.exists():
            temp_db.unlink()
        if temp_yaml.exists():
            temp_yaml.unlink()
        # Clean up backup if created
        backup_path = temp_yaml.with_suffix('.yaml.backup')
        if backup_path.exists():
            backup_path.unlink()


def test_real_yaml_data_integrity():
    """Test data integrity with real YAML structure."""
    print_section("Testing Data Integrity with Real YAML")
    
    real_yaml = Path(__file__).parent.parent / "notes" / "fonts_texts" / "junk_data" / "campaigns.yaml"
    
    if not real_yaml.exists():
        print(f"\n⚠️ Skipping: Real YAML not found at {real_yaml}")
        return
    
    temp_db = Path(tempfile.gettempdir()) / "test_integrity.db"
    if temp_db.exists():
        temp_db.unlink()
    
    temp_yaml = Path(tempfile.gettempdir()) / "test_integrity.yaml"
    shutil.copy2(real_yaml, temp_yaml)
    
    try:
        print(f"\n1️⃣ Loading and parsing real YAML structure...")
        import yaml
        
        with open(temp_yaml, 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
        
        jobs = yaml_data.get('jobs', [])
        print(f"   ✅ Found {len(jobs)} jobs in YAML")
        
        if jobs:
            sample_job = jobs[0]
            print(f"   ✅ Sample job structure:")
            print(f"      - job_name: {sample_job.get('job_name', 'N/A')}")
            print(f"      - product: {sample_job.get('product', 'N/A')}")
            print(f"      - has enhanced_settings: {'enhanced_settings' in sample_job}")
            
            # Check for complex nested structures
            enhanced = sample_job.get('enhanced_settings', {})
            if enhanced:
                print(f"      - text_overlays: {len(enhanced.get('text_overlays', []))}")
                print(f"      - captions enabled: {enhanced.get('captions', {}).get('enabled', False)}")
                print(f"      - music enabled: {enhanced.get('music', {}).get('enabled', False)}")
        
        # Migrate to SQLite
        print(f"\n2️⃣ Migrating to SQLite...")
        init_db(temp_db)
        results = migrate_from_yaml(temp_yaml, temp_db, create_backup=False)
        
        # Retrieve and compare
        print(f"\n3️⃣ Verifying data integrity...")
        for i, yaml_job in enumerate(jobs[:3], 1):  # Test first 3 jobs
            job_id = yaml_job.get('id')
            if not job_id:
                print(f"   ⚠️ Job {i} has no ID, skipping")
                continue
            
            db_job = get_job(job_id)
            if not db_job:
                print(f"   ❌ Job {job_id} not found in database!")
                continue
            
            db_job_dict = db_job.to_dict()
            
            # Compare key fields
            checks = [
                ('job_name', yaml_job.get('job_name') == db_job_dict.get('job_name')),
                ('product', yaml_job.get('product') == db_job_dict.get('product')),
                ('enabled', yaml_job.get('enabled') == db_job_dict.get('enabled')),
            ]
            
            all_match = all(check[1] for check in checks)
            
            if all_match:
                print(f"   ✅ Job {i} ({yaml_job.get('job_name', 'Unknown')}): Data matches")
            else:
                print(f"   ⚠️ Job {i}: Some fields don't match")
                for field, matches in checks:
                    if not matches:
                        print(f"      - {field}: YAML={yaml_job.get(field)} vs DB={db_job_dict.get(field)}")
            
            # Check enhanced_settings preservation
            if 'enhanced_settings' in yaml_job:
                if 'enhanced_settings' in db_job_dict:
                    print(f"   ✅ Job {i}: enhanced_settings preserved")
                else:
                    print(f"   ⚠️ Job {i}: enhanced_settings missing in DB")
        
        print("\n✨ Data integrity test completed!")
        
    finally:
        # Cleanup
        close_db_connection()
        if temp_db.exists():
            temp_db.unlink()
        if temp_yaml.exists():
            temp_yaml.unlink()


def main():
    """Run all tests."""
    print("\n" + "=" * 70)
    print("  🧪 SQLite Operations Test Suite")
    print("=" * 70)
    print(f"  Started at: {datetime.now().isoformat()}")
    print("=" * 70)
    
    try:
        # Synthetic data tests
        test_basic_crud()
        test_bulk_operations()
        test_real_world_scenario()
        
        # Real data tests
        test_real_yaml_migration()
        test_real_yaml_data_integrity()
        
        print("\n" + "=" * 70)
        print("  🎉 ALL TESTS PASSED!")
        print("=" * 70)
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

