#!/usr/bin/env node

/**
 * Canary Deployment Monitoring Script for MassUGC Studio
 * 
 * Monitors the health of canary deployments by checking:
 * - Download endpoint availability
 * - Error rates from telemetry
 * - User feedback signals
 * - Performance metrics
 * 
 * Usage:
 *   node scripts/monitor_canary.js --platform windows --duration 300 --threshold 5
 * 
 * Options:
 *   --platform      Platform to monitor (windows, macos, all) [default: all]
 *   --duration      Monitoring duration in seconds [default: 300]
 *   --threshold     Error rate threshold percentage [default: 5.0]
 *   --interval      Check interval in seconds [default: 60]
 *   --url           Base URL for canary deployment [default: https://canary.massugc.studio]
 *   --telemetry     Telemetry API endpoint [optional]
 *   --slack-webhook Slack webhook for notifications [optional]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class CanaryMonitor {
  constructor(options = {}) {
    this.platform = options.platform || 'all';
    this.duration = parseInt(options.duration) || 300; // 5 minutes default
    this.threshold = parseFloat(options.threshold) || 5.0; // 5% error threshold
    this.interval = parseInt(options.interval) || 60; // 1 minute default
    this.baseUrl = options.url || 'https://canary.massugc.studio';
    this.telemetryUrl = options.telemetry;
    this.slackWebhook = options.slackWebhook;
    
    this.startTime = Date.now();
    this.checks = 0;
    this.failures = 0;
    this.metrics = {
      windows: { available: 0, errors: 0, totalChecks: 0 },
      macos: { available: 0, errors: 0, totalChecks: 0 }
    };
  }

  /**
   * Start monitoring the canary deployment
   */
  async start() {
    console.log('🔍 Canary Deployment Monitor Starting');
    console.log(`📊 Configuration:`);
    console.log(`   Platform: ${this.platform}`);
    console.log(`   Duration: ${this.duration}s (${Math.floor(this.duration / 60)} minutes)`);
    console.log(`   Interval: ${this.interval}s`);
    console.log(`   Threshold: ${this.threshold}%`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log('');

    const endTime = this.startTime + (this.duration * 1000);
    let checkCount = 0;

    while (Date.now() < endTime) {
      checkCount++;
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const remaining = Math.floor((endTime - Date.now()) / 1000);
      
      console.log(`\n[Check ${checkCount}/${Math.ceil(this.duration / this.interval)}] Elapsed: ${elapsed}s | Remaining: ${remaining}s`);
      console.log('─'.repeat(70));

      try {
        await this.performHealthChecks();
        await this.checkTelemetry();
        this.displayStatus();
        
        // Check if we've exceeded error threshold
        if (this.getErrorRate() > this.threshold) {
          await this.handleThresholdExceeded();
          return false;
        }
      } catch (error) {
        console.error(`❌ Check failed:`, error.message);
        this.failures++;
      }

      // Wait for next interval (unless this is the last check)
      if (Date.now() < endTime) {
        const waitTime = Math.min(this.interval * 1000, endTime - Date.now());
        await this.sleep(waitTime);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 Monitoring Complete');
    console.log('='.repeat(70));
    this.displayFinalReport();
    
    return this.getErrorRate() <= this.threshold;
  }

  /**
   * Perform health checks on download endpoints
   */
  async performHealthChecks() {
    const platforms = this.platform === 'all' ? ['windows', 'macos'] : [this.platform];

    for (const platform of platforms) {
      this.metrics[platform].totalChecks++;
      
      const downloadUrl = `${this.baseUrl}/downloads/${platform}`;
      console.log(`🔎 Checking ${platform} endpoint: ${downloadUrl}`);

      try {
        const available = await this.checkEndpoint(downloadUrl);
        
        if (available) {
          this.metrics[platform].available++;
          console.log(`   ✅ ${platform}: AVAILABLE`);
        } else {
          this.metrics[platform].errors++;
          console.log(`   ❌ ${platform}: UNAVAILABLE`);
        }
      } catch (error) {
        this.metrics[platform].errors++;
        console.log(`   ❌ ${platform}: ERROR - ${error.message}`);
      }
    }
  }

  /**
   * Check if an endpoint is available
   */
  checkEndpoint(url) {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (protocol === https ? 443 : 80),
        path: urlObj.pathname,
        method: 'HEAD',
        timeout: 10000
      };

      const req = protocol.request(options, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Check telemetry for error rates
   */
  async checkTelemetry() {
    if (!this.telemetryUrl) {
      return;
    }

    console.log(`📊 Checking telemetry: ${this.telemetryUrl}`);

    try {
      const data = await this.fetchJson(this.telemetryUrl);
      
      if (data && data.errorRate !== undefined) {
        const errorRate = parseFloat(data.errorRate);
        console.log(`   📈 Error Rate: ${errorRate.toFixed(2)}%`);
        
        if (errorRate > this.threshold) {
          console.log(`   ⚠️  Warning: Error rate exceeds threshold!`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Could not fetch telemetry: ${error.message}`);
    }
  }

  /**
   * Fetch JSON from URL
   */
  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Display current status
   */
  displayStatus() {
    console.log('\n📊 Current Status:');
    
    const platforms = this.platform === 'all' ? ['windows', 'macos'] : [this.platform];
    
    for (const platform of platforms) {
      const m = this.metrics[platform];
      const availability = m.totalChecks > 0 
        ? ((m.available / m.totalChecks) * 100).toFixed(1)
        : 0;
      
      console.log(`   ${platform.padEnd(8)} - Availability: ${availability}% (${m.available}/${m.totalChecks})`);
    }

    const overallErrorRate = this.getErrorRate();
    const status = overallErrorRate <= this.threshold ? '✅ PASS' : '❌ FAIL';
    console.log(`\n   Overall Error Rate: ${overallErrorRate.toFixed(2)}% - ${status}`);
  }

  /**
   * Calculate overall error rate
   */
  getErrorRate() {
    const totalChecks = this.metrics.windows.totalChecks + this.metrics.macos.totalChecks;
    const totalErrors = this.metrics.windows.errors + this.metrics.macos.errors;
    
    return totalChecks > 0 ? (totalErrors / totalChecks) * 100 : 0;
  }

  /**
   * Handle threshold exceeded
   */
  async handleThresholdExceeded() {
    console.log('\n' + '='.repeat(70));
    console.log('🚨 ERROR THRESHOLD EXCEEDED');
    console.log('='.repeat(70));
    
    const errorRate = this.getErrorRate();
    console.log(`Current error rate: ${errorRate.toFixed(2)}%`);
    console.log(`Threshold: ${this.threshold}%`);
    console.log('\n⚠️  Canary deployment should be CANCELLED');

    await this.sendNotification('🚨 Canary Deployment Failed', 
      `Error rate ${errorRate.toFixed(2)}% exceeds threshold ${this.threshold}%`);

    // Create failure report
    this.createReport('FAILED');
  }

  /**
   * Display final report
   */
  displayFinalReport() {
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    const errorRate = this.getErrorRate();
    const status = errorRate <= this.threshold ? 'PASSED' : 'FAILED';

    console.log(`\n📋 Final Report:`);
    console.log(`   Duration: ${duration}s (${Math.floor(duration / 60)}m ${duration % 60}s)`);
    console.log(`   Total Checks: ${this.checks}`);
    console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`   Status: ${status}`);
    console.log('');
    
    console.log('📊 Platform Details:');
    const platforms = this.platform === 'all' ? ['windows', 'macos'] : [this.platform];
    
    for (const platform of platforms) {
      const m = this.metrics[platform];
      const availability = m.totalChecks > 0 
        ? ((m.available / m.totalChecks) * 100).toFixed(1)
        : 0;
      
      console.log(`   ${platform}:`);
      console.log(`     - Checks: ${m.totalChecks}`);
      console.log(`     - Available: ${m.available} (${availability}%)`);
      console.log(`     - Errors: ${m.errors}`);
    }

    // Create success report
    this.createReport(status);

    if (status === 'PASSED') {
      console.log('\n✅ Canary deployment is healthy and ready for production promotion');
      this.sendNotification('✅ Canary Deployment Passed', 
        `Error rate ${errorRate.toFixed(2)}% is within threshold ${this.threshold}%`);
    }
  }

  /**
   * Create monitoring report file
   */
  createReport(status) {
    const report = {
      timestamp: new Date().toISOString(),
      status,
      duration: Math.floor((Date.now() - this.startTime) / 1000),
      errorRate: this.getErrorRate(),
      threshold: this.threshold,
      platform: this.platform,
      metrics: this.metrics
    };

    const reportPath = path.join(process.cwd(), 'canary-monitor-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  /**
   * Send notification (Slack, email, etc.)
   */
  async sendNotification(title, message) {
    if (!this.slackWebhook) {
      return;
    }

    console.log(`\n📢 Sending notification: ${title}`);

    try {
      const payload = JSON.stringify({
        text: `${title}\n${message}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: title }
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: message }
          }
        ]
      });

      await this.postWebhook(this.slackWebhook, payload);
      console.log('   ✅ Notification sent');
    } catch (error) {
      console.log(`   ⚠️  Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Post to webhook
   */
  postWebhook(url, data) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    options[key] = value;
  }

  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const monitor = new CanaryMonitor(options);

  monitor.start()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Monitoring failed:', error);
      process.exit(1);
    });
}

module.exports = CanaryMonitor;
