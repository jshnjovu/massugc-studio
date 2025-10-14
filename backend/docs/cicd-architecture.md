# GitHub Actions CI/CD Architecture - Canary Deployment
## massugc-video-service

**Version:** 2.0  
**Status:** Draft  
**Last Updated:** October 3, 2025  
**Architect:** Winston

---

## Executive Summary

This document outlines a GitHub Actions CI/CD pipeline architecture for building, testing, and deploying the ZyraVideoAgentBackend across Windows and macOS platforms using canary deployment strategies.

### Key Features
- ✅ Multi-platform builds (Windows + macOS)
- ✅ Comprehensive test suite validation (100% success rate)
- ✅ Canary deployment with environment protection rules
- ✅ PyInstaller executable generation
- ✅ Artifact management and distribution
- ✅ Automated rollback capabilities

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Actions Pipeline                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Build] → [Test] → [Package] → [Deploy Canary]                 │
│                                       ↓                           │
│                                  [Monitor]                        │
│                                       ↓                           │
│                           [Deploy Production / Rollback]          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Jobs

1. **Build** - PyInstaller compilation (parallel Windows/macOS)
2. **Test** - Run comprehensive test suite (`run_all_tests.py`)
3. **Package** - Artifact collection and validation
4. **Deploy Canary** - 10% traffic deployment (requires approval)
5. **Monitor** - Health checks and metrics validation
6. **Deploy Production** - 100% rollout (requires approval)

---

## Multi-Platform Runner Strategy

### GitHub-Hosted Runners

GitHub Actions provides managed runners for Windows and macOS:

#### Windows Runner
```yaml
runs-on: windows-latest
# Specifications:
# - OS: Windows Server 2022
# - CPU: 4 cores
# - RAM: 16 GB
# - Storage: 14 GB SSD
```

#### macOS Runner
```yaml
runs-on: macos-latest
# Specifications:
# - OS: macOS 14 (Sonoma)
# - CPU: 4 cores (M1/Intel)
# - RAM: 14 GB
# - Storage: 14 GB SSD
```

### Self-Hosted Runners (Optional)

For better performance and cost control, you can use self-hosted runners:

**Windows Registration:**
```powershell
# Download runner
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-win-x64-2.311.0.zip -OutFile actions-runner-win.zip
Expand-Archive -Path actions-runner-win.zip -DestinationPath actions-runner
cd actions-runner

# Configure
.\config.cmd --url https://github.com/YOUR_ORG/massugc-video-service --token YOUR_TOKEN --labels windows,python,pyinstaller

# Install as service
.\svc.cmd install
.\svc.cmd start
```

**macOS Registration:**
```bash
# Download runner
curl -O -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-osx-x64-2.311.0.tar.gz
tar xzf actions-runner-osx-x64-2.311.0.tar.gz

# Configure
./config.sh --url https://github.com/YOUR_ORG/massugc-video-service --token YOUR_TOKEN --labels macos,python,pyinstaller

# Install as service
./svc.sh install
./svc.sh start
```

---

## GitHub Actions Workflow

### Workflow File: `.github/workflows/build-and-deploy.yml`

The workflow is triggered on:
- **Push** to `main` or `develop` branches
- **Pull requests** to `main` branch
- **Manual dispatch** (via GitHub UI)

### Job Flow

```
build-windows ─┐
               ├─> test-windows ──> package-windows ──┐
build-macos ───┤                                       ├─> deploy-canary-* ─> monitor ─> deploy-production-*
               └─> test-macos ────> package-macos ────┘
```

### Key Features

**Parallel Execution:**
- Windows and macOS builds run simultaneously
- Tests run independently per platform

**Dependency Caching:**
- Pip dependencies cached automatically
- 70% faster builds after first run

**Artifact Management:**
- Build artifacts stored for 7 days
- Release packages stored for 90 days
- Test reports stored for 30 days

---

## Deployment Strategy

### Artifact-Based Deployment Flow with Approvals

```
1. Build & Test (Automated)
   └─> Run on: All commits to all branches

2. Package (Automated, main branch only)
   └─> Create release artifacts with checksums

3. ⏸️ CANARY APPROVAL (Manual - 1 reviewer required)
   └─> Workflow pauses and waits for approval
   └─> Environments: canary-windows, canary-macos

4. Deploy Canary (After approval, main branch only)
   └─> Create canary release artifacts
   └─> Metadata: version, traffic %, deployment time
   └─> Retention: 7 days

5. Monitor & Validate (Automated)
   └─> Download and validate canary artifacts
   └─> Verify version consistency across platforms
   └─> Check artifact integrity and file counts
   └─> Create monitoring report (30-day retention)

6. ⏸️ PRODUCTION APPROVAL (Manual - 2 reviewers required)
   └─> Workflow pauses and waits for approval
   └─> Environments: production-windows, production-macos

7. Production Deploy (After approval, main branch only)
   └─> Verify canary health from monitoring report
   └─> Create production release artifacts
   └─> Metadata: version, channel (stable), deployment time
   └─> Retention: 90 days

All artifacts stored in GitHub - no external infrastructure required!
Approvals ensure human oversight before artifact creation.
```

### Artifact Retention & Approval Policy

GitHub Actions artifacts with retention rules and approval requirements:

| Artifact Type | Retention Period | Created On | Approval Required |
|--------------|------------------|------------|-------------------|
| Build artifacts | 7 days | All branches | No |
| Release packages | 90 days | All branches | No |
| Canary releases | 7 days | `main` branch only | Yes (1 reviewer) |
| Monitoring reports | 30 days | `main` branch only | No |
| Production releases | 90 days | `main` branch only | Yes (2 reviewers) |

**Environment Configuration:**
- `canary-windows` - Required reviewers: 1
- `canary-macos` - Required reviewers: 1
- `production-windows` - Required reviewers: 2
- `production-macos` - Required reviewers: 2

**Benefits:**
- No external infrastructure needed
- Human oversight before artifact releases
- All artifacts versioned by commit SHA
- Easy download from GitHub Actions UI
- Automatic cleanup after retention period
- Complete traceability throughout pipeline

---

## Artifact Management

### Output Structure

```
artifacts/
├── ZyraVideoAgentBackend/           # Main executable directory
│   ├── ZyraVideoAgentBackend.exe    # Windows executable
│   ├── ZyraVideoAgentBackend        # macOS executable
│   └── _internal/                   # Dependencies folder
│       ├── *.dll / *.dylib          # Platform libraries
│       ├── *.pyd                    # Python extensions
│       └── [PyInstaller runtime]    # Bundled components
├── checksums.txt                    # SHA256 verification
└── metadata.json                    # Build info
```

### Complete Artifact Chain

```
Build Artifacts (7 days)
    ↓
Release Packages (90 days) + Checksums
    ↓
Canary Releases (7 days) - main branch only
    ↓
Monitoring Report (30 days) - Validates canary health
    ↓
Production Releases (90 days) - main branch only
```

All artifacts include metadata files:
- `version.txt` - Commit SHA
- `deployed_at.txt` - Timestamp
- `traffic_percentage.txt` - Intended traffic split
- `channel.txt` - Release channel (canary/stable)

---

## Monitoring & Metrics

### Key Performance Indicators

1. **Build Success Rate**
   - Target: > 95%
   - Alert: < 90%

2. **Test Pass Rate**
   - Target: 100%
   - Alert: < 100%

3. **Workflow Duration**
   - Target: < 15 minutes
   - Alert: > 30 minutes

4. **Canary Success Rate**
   - Target: > 90%
   - Alert: < 80%

### GitHub Actions Insights

View metrics at: **Actions → Workflows → Build and Deploy → ··· → View workflow insights**

- Workflow run duration
- Success rate over time
- Job execution times
- Runner usage

---

## Security & Compliance

### Secrets Management

The workflow uses **GitHub Artifacts exclusively** and requires **no secrets** for basic operation.

Optional secrets for advanced features in **Settings → Secrets and variables → Actions**:

| Secret | Description | Use Case |
|--------|-------------|----------|
| `SIGNING_CERT` | Code signing certificate | Optional: Sign executables |
| `SLACK_WEBHOOK` | Slack notifications | Optional: Build notifications |
| `GH_TOKEN` | GitHub token | Optional: Create GitHub Releases |

### Code Signing

**Windows:**
```yaml
- name: Sign executable
  run: |
    signtool sign /f certificate.pfx /p ${{ secrets.CERT_PASSWORD }} /t http://timestamp.digicert.com dist/ZyraVideoAgentBackend.exe
```

**macOS:**
```yaml
- name: Sign and notarize
  run: |
    codesign --force --deep --sign "Developer ID" dist/ZyraVideoAgentBackend
    xcrun notarytool submit dist/ZyraVideoAgentBackend.zip --wait
```

### Security Scanning

```yaml
- name: Run security scan
  run: |
    pip install bandit safety
    bandit -r backend/
    safety check -r requirements.txt
```

---

## Rollback Procedures

### Automatic Rollback Triggers

GitHub Actions doesn't have built-in automatic rollback, but you can implement:

1. **Monitoring Job Failure**: Cancel production deployment
2. **Manual Cancellation**: Stop workflow before production
3. **Revert Deployment**: Run previous version workflow

### Manual Rollback Steps

```bash
# 1. Go to Actions → Build and Deploy
# 2. Find the last successful production deployment
# 3. Click "Re-run jobs" → "Re-run all jobs"
# 4. Approve production deployment when prompted

# Or use GitHub CLI
gh workflow run build-and-deploy.yml --ref <previous-commit-sha>
```

---

## Cost Analysis

### GitHub-Hosted Runners

| Plan | Minutes/Month | Cost |
|------|---------------|------|
| Free (Public) | Unlimited | $0 |
| Free (Private) | 2,000 min | $0 |
| Team | 3,000 min | Included |
| Enterprise | 50,000 min | Included |

### Multiplier for Different OS

- **Linux**: 1x
- **Windows**: 2x
- **macOS**: 10x

**Example Calculation:**
- Build time: 15 min (10 min Windows + 5 min macOS)
- Billable minutes: (10 × 2) + (5 × 10) = 70 minutes
- Builds per month: 30
- Total: 2,100 minutes/month (within Team plan)

### Self-Hosted Runners

- **Cost**: Infrastructure only
- **Minutes**: Unlimited (free)
- **Recommendation**: Use for high-volume builds

---

## Migration Path

### Phase 1: Setup (Week 1)
- [ ] Create `.github/workflows/` directory
- [ ] Push workflow file
- [ ] Configure GitHub environments
- [ ] Set up secrets

### Phase 2: Build & Test (Week 2)
- [ ] Trigger first workflow
- [ ] Validate build artifacts
- [ ] Verify test suite runs
- [ ] Download and test executables

### Phase 3: Canary Deployment (Week 3)
- [ ] Configure deployment targets
- [ ] Set up environment protection rules
- [ ] Test canary deployment
- [ ] Implement monitoring

### Phase 4: Production (Week 4)
- [ ] Deploy to production
- [ ] Monitor metrics
- [ ] Document process
- [ ] Train team

---

## GitHub Actions vs GitLab CI/CD

### Syntax Differences

| Feature | GitLab CI/CD | GitHub Actions |
|---------|-------------|----------------|
| File location | `.gitlab-ci.yml` | `.github/workflows/*.yml` |
| Trigger | `only:`/`except:` | `on:` |
| Runner selection | `tags:` | `runs-on:` |
| Job steps | `script:` | `steps:` with `run:` |
| Dependencies | `dependencies:` | `needs:` |
| Artifacts | `artifacts:` | `actions/upload-artifact` |
| Caching | `cache:` | `actions/cache` |
| Environments | `environment:` | `environment:` (same) |

### Advantages of GitHub Actions

✅ **Native GitHub Integration**
- Seamless with GitHub repositories
- Built-in artifact viewer
- PR checks integration

✅ **Marketplace Actions**
- 20,000+ pre-built actions
- Community-maintained
- Easy to use

✅ **Matrix Builds**
- Test multiple versions simultaneously
- Easy configuration

✅ **Better Free Tier (Public Repos)**
- Unlimited minutes for public repos
- More storage

---

## Technical Decisions

### Why GitHub Actions?

✅ **Pros:**
- Native GitHub integration
- Unlimited minutes for public repos
- Rich marketplace ecosystem
- Built-in environment protection
- Matrix builds support

❌ **Cons:**
- macOS runners expensive (10x multiplier)
- Less flexible than GitLab CI/CD
- Self-hosted runner setup more complex

### Why PyInstaller?

✅ **Single executable distribution**
✅ **Cross-platform support**
✅ **Minimal user setup required**
✅ **Proven track record with test suite (100% pass rate)**

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Environment Protection](https://docs.github.com/en/actions/deployment/targeting-different-environments)
- [PyInstaller Documentation](https://pyinstaller.org/en/stable/)
- Test Suite Results: `tests/test_dist_build/test_report.json`

---

## Appendix A: Complete Workflow Example

See `.github/workflows/build-and-deploy.yml` for the complete workflow configuration.

---

## Appendix B: Monitoring Script

See `scripts/monitor_canary.py` for the canary monitoring implementation.

---

**Document Status**: Ready for Implementation  
**Next Steps**: Begin Phase 1 - Workflow Setup
