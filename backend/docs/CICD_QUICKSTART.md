# GitHub Actions CI/CD Quick Start Guide
## ZyraVideoAgentBackend - Multi-Platform Canary Deployment

**Last Updated:** October 3, 2025  
**Status:** Ready for Implementation

---

## 📋 Overview

This guide will help you set up GitHub Actions CI/CD with canary deployment for building and deploying ZyraVideoAgentBackend executables across Windows and macOS.

### What You'll Get

- ✅ Automated builds for Windows & macOS
- ✅ Comprehensive test suite validation (100% pass rate)
- ✅ Canary deployment with manual approval gates
- ✅ Environment protection rules
- ✅ Artifact management via GitHub

---

## 🚀 Quick Start (3 Steps)

### Step 1: Push to GitHub

```bash
# Add the workflow files (already created)
git add .github/workflows/build-and-deploy.yml
git commit -m "Add GitHub Actions CI/CD pipeline"
git push origin main
```

### Step 2: Configure Environments

1. Go to your GitHub repository
2. Navigate to: **Settings → Environments**
3. Create 4 environments with reviewers:
   - `canary-windows` (Required reviewers: 1)
   - `canary-macos` (Required reviewers: 1)
   - `production-windows` (Required reviewers: 2)
   - `production-macos` (Required reviewers: 2)
4. Add team members as required reviewers

### Step 3: Watch Your First Build!

Go to: **Actions → Build and Deploy**

Your workflow will run automatically on every push to `main`!

🎉 **Done!** Your pipeline is now running automatically.

---

## 📊 Workflow Jobs Explained

### 1. Build Jobs (Automated, Parallel)
- **build-windows**: Compiles Windows executable
- **build-macos**: Compiles macOS executable
- Uses PyInstaller with your spec file
- Saves artifacts for 7 days

### 2. Test Jobs (Automated)
- **test-windows**: Runs test suite on Windows build
- **test-macos**: Runs test suite on macOS build
- Must pass 100% to continue
- Generates test report JSON

### 3. Package Jobs (Automated, main branch only)
- **package-windows**: Collects executable + `_internal` folder
- **package-macos**: Collects executable + `_internal` folder
- Generates SHA256 checksums
- Saves release artifacts for 90 days

### 4. Canary Deploy Jobs (Manual Approval Required, main branch only)
- **deploy-canary-windows**: Creates canary release artifacts
- **deploy-canary-macos**: Creates canary release artifacts
- Requires 1 reviewer approval before proceeding
- Saves artifacts for 7 days
- Includes metadata (version, traffic %, deployment time)

### 5. Monitor Job (Automated)
- **monitor-canary**: Validates canary artifacts
- Verifies version consistency across platforms
- Checks artifact integrity and file counts
- Creates monitoring report (30-day retention)

### 6. Production Deploy Jobs (Manual Approval Required, main branch only)
- **deploy-production-windows**: Creates production release artifacts
- **deploy-production-macos**: Creates production release artifacts
- Requires 2 reviewers approval before proceeding
- Verifies canary health before proceeding
- Saves artifacts for 90 days with "stable" channel marker

---

## 🎮 Using the Workflow

### Viewing Workflow Status

1. Go to your GitHub repository
2. Click **Actions** tab
3. See all workflow runs with real-time status

### Downloading Build Artifacts

1. Go to **Actions → Build and Deploy → [Workflow Run]**
2. Scroll to **Artifacts** section
3. Click to download:
   - `zyra-windows-[sha]` - Windows build
   - `zyra-macos-[sha]` - macOS build
   - `zyra-windows-release-[sha]` - Windows release package
   - `zyra-macos-release-[sha]` - macOS release package
   - `zyra-windows-canary-[sha]` - Windows canary release (main branch)
   - `zyra-macos-canary-[sha]` - macOS canary release (main branch)
   - `canary-monitoring-report-[sha]` - Canary validation report (main branch)
   - `zyra-windows-production-[sha]` - Windows production release (main branch)
   - `zyra-macos-production-[sha]` - macOS production release (main branch)

### Approving Deployments (Main Branch Only)

When pushing to `main` branch, the workflow requires manual approvals:

1. **Package jobs complete** → Creates release artifacts
2. **⏸️ Workflow pauses** → Waiting for canary approval
3. **Approve canary** → Review deployments and approve
4. **Canary deploy jobs** → Creates canary release artifacts (7-day retention)
5. **Monitor-canary job** → Validates artifacts and creates monitoring report (30-day retention)
6. **⏸️ Workflow pauses** → Waiting for production approval
7. **Approve production** → Review deployments and approve
8. **Production deploy jobs** → Creates production artifacts (90-day retention)

### How to Approve

1. Go to **Actions → Build and Deploy → [Workflow Run]**
2. Look for **"Review deployments"** button
3. Click and select environments to approve
4. Click **"Approve and deploy"**

### Accessing Artifacts

All artifacts are available in the workflow run's **Artifacts** section:

- **Build artifacts**: Available for all branches
- **Release packages**: Available for all branches
- **Canary/Production/Monitoring**: Only available for `main` branch (after approval)

---

## 📦 Artifact Contents

### Build Artifacts
```
zyra-windows-[sha]/
└── ZyraVideoAgentBackend/
    ├── ZyraVideoAgentBackend.exe
    └── _internal/

zyra-macos-[sha]/
└── ZyraVideoAgentBackend/
    ├── ZyraVideoAgentBackend
    └── _internal/
```

### Release Packages
```
artifacts/
├── ZyraVideoAgentBackend/
│   ├── ZyraVideoAgentBackend.exe (or binary)
│   └── _internal/
└── checksums.txt
```

---

## 🔧 Configuration

### GitHub Secrets

The workflow uses **GitHub Artifacts exclusively** and requires **no external secrets** for basic operation.

Optional secrets for advanced features:

| Secret | Description | Use Case |
|--------|-------------|----------|
| `SIGNING_CERT` | Code signing certificate | Optional: Sign executables |
| `SLACK_WEBHOOK` | Slack notifications | Optional: Build notifications |
| `GH_TOKEN` | GitHub token | Optional: Create GitHub Releases |

### Environment Variables

Edit `.github/workflows/build-and-deploy.yml` to customize:

```yaml
env:
  PYTHON_VERSION: "3.9"  # Change Python version
  SPEC_FILE: "ZyraVideoAgentBackend-minimal.spec"  # Change spec file
  TEST_SCRIPT: "tests/test_dist_build/run_all_tests.py"  # Change test script
```

### Customizing the Workflow

**Change artifact retention:**
```yaml
- name: Upload canary artifact
  uses: actions/upload-artifact@v4
  with:
    name: zyra-windows-canary-${{ github.sha }}
    path: canary-release/
    retention-days: 7  # Change to desired days
```

**Add external deployment (optional):**
```yaml
- name: Deploy canary to external server
  run: |
    # Optional: Deploy artifacts to your own infrastructure
    aws s3 cp canary-release/ s3://your-bucket/canary/ --recursive
```

**Change artifact retention:**
```yaml
- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    retention-days: 7  # Change number of days
```

---

## 🐛 Troubleshooting

### Workflow Fails at Build Job

**Problem:** Dependencies not installing

**Solution:**
```bash
# Test locally
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
pyinstaller ZyraVideoAgentBackend-minimal.spec --clean --noconfirm
```

### Workflow Fails at Test Job

**Problem:** Tests not passing

**Solution:**
```bash
# Run tests locally
python tests/test_dist_build/run_all_tests.py
# Review test_report.json for specific failures
```

### Can't Download Artifacts

**Problem:** Artifacts expired or not found

**Solution:**
- Check artifact retention period (default: 7 days for builds)
- Ensure job completed successfully (green checkmark)
- Check if workflow run was for correct branch

### Artifacts Not Created

**Problem:** Canary/production artifacts missing

**Solution:**
- These artifacts are only created for `main` branch pushes
- Check you're on the `main` branch
- Verify the package jobs completed successfully
- Check workflow logs for any failures

### "No space left on device" Error

**Problem:** Runner storage full

**Solution:**
- Use GitHub-hosted runners (refreshed each run)
- Or clean up self-hosted runner storage
- Or use `actions/cache` to manage dependencies

---

## 📈 Monitoring & Metrics

### GitHub Actions Insights

View at: **Actions → Workflows → Build and Deploy → ··· → View workflow insights**

Metrics available:
- Success rate over time
- Workflow duration trends
- Job execution times
- Most time-consuming jobs

### Custom Monitoring Script

Use `scripts/monitor_canary.py` for detailed monitoring:

```bash
# Run locally or in workflow
python scripts/monitor_canary.py \
  --url https://your-deployment-url.com \
  --duration 1800 \
  --error-threshold 5.0
```

### Health Check Endpoints

Your application should expose:

```
GET /health
Response: 200 OK

GET /metrics
Response: { "status": "ok", "version": "1.0.0", ... }
```

---

## 🔐 Security Best Practices

### 1. Protect Secrets

- Mark secrets as **"Secrets"** not variables
- Use environment-specific secrets when possible
- Rotate secrets regularly

### 2. Environment Protection

- Require reviewers for production deployments
- Limit deployment branches (main only)
- Use deployment logs for audit trail

### 3. Code Signing (Recommended)

**Windows:**
```yaml
- name: Sign executable
  run: |
    signtool sign /f cert.pfx /p ${{ secrets.CERT_PASSWORD }} dist/ZyraVideoAgentBackend.exe
```

**macOS:**
```yaml
- name: Sign executable
  run: |
    codesign --force --deep --sign "Developer ID" dist/ZyraVideoAgentBackend
```

### 4. Branch Protection

1. Go to **Settings → Branches**
2. Add rule for `main` branch
3. Enable:
   - Require pull request reviews
   - Require status checks (build & test)
   - Require branches to be up to date

---

## 🎯 Best Practices

### 1. Branch Strategy

```
main      → Full pipeline + production deployment (with approval)
develop   → Full pipeline + canary deployment (with approval)
feature/* → Build + test only
```

### 2. Deployment Checklist

Before approving production deployment:

- [ ] All tests pass (100%)
- [ ] Code reviewed and approved
- [ ] Canary monitoring successful
- [ ] No critical bugs in issues
- [ ] Release notes prepared

### 3. Using GitHub Releases

Create releases for production deployments:

```bash
# After successful production deployment
gh release create v1.0.0 \
  --title "Release v1.0.0" \
  --notes "Release notes here" \
  artifacts/ZyraVideoAgentBackend/*
```

---

## 💡 Tips & Tricks

### Speed Up Workflows

1. **Use caching** (already enabled):
   ```yaml
   - uses: actions/setup-python@v5
     with:
       cache: 'pip'  # Caches pip dependencies
   ```

2. **Skip CI for docs**:
   ```yaml
   on:
     push:
       paths-ignore:
         - '**.md'
         - 'docs/**'
   ```

3. **Matrix builds** for multiple Python versions:
   ```yaml
   strategy:
     matrix:
       python-version: ['3.9', '3.10', '3.11']
   ```

### Reduce Costs

1. **Use GitHub-hosted runners for public repos** (unlimited)
2. **Self-host for private repos** (no minute charges)
3. **Limit workflow triggers**:
   ```yaml
   on:
     push:
       branches: [main, develop]
       paths:
         - 'backend/**'
         - 'requirements.txt'
   ```

### Improve Visibility

1. **Add status badge to README**:
   ```markdown
   ![Build Status](https://github.com/YOUR_ORG/massugc-video-service/actions/workflows/build-and-deploy.yml/badge.svg)
   ```

2. **Enable email notifications**:
   - Go to **Settings → Notifications**
   - Enable **Actions** notifications

3. **Add Slack notifications**:
   ```yaml
   - name: Notify Slack
     if: always()
     run: |
       curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
         -d '{"text":"Build ${{ job.status }}"}'
   ```

---

## 🆘 Getting Help

### Check Workflow Logs

1. Go to **Actions → Build and Deploy**
2. Click on failed workflow run
3. Click on failed job
4. Expand failed step to see logs

### Common Issues

| Issue | Solution |
|-------|----------|
| Permission denied | Check repository settings → Actions → General → Workflow permissions |
| Artifact not found | Ensure previous job completed successfully, check `needs:` dependency |
| Environment not found | Create environment in Settings → Environments |
| Secrets not accessible | Check secret name matches exactly (case-sensitive) |

### Support Resources

- **Architecture:** `docs/cicd-architecture.md`
- **Implementation:** `docs/CICD_IMPLEMENTATION_SUMMARY.md`
- **GitHub Docs:** https://docs.github.com/en/actions
- **GitHub Community:** https://github.community/

---

## ✅ Verification Checklist

Before considering setup complete:

- [ ] Workflow file committed to repository
- [ ] Environments configured with reviewers
- [ ] Secrets added (if needed)
- [ ] Workflow runs successfully on both platforms
- [ ] All tests pass (100% success rate)
- [ ] Artifacts downloaded and verified
- [ ] Executables run on target platforms
- [ ] Canary deployment tested
- [ ] Production deployment tested
- [ ] Team trained on approval process

---

**Ready to Deploy! 🚀**

Your GitHub Actions CI/CD pipeline is configured for multi-platform builds with canary deployment. Push your code and watch it build automatically!

For questions or issues, refer to the [Architecture Document](./cicd-architecture.md) or [Troubleshooting](#-troubleshooting) section.
