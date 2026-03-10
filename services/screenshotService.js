const puppeteer = require('puppeteer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ScreenshotJob = require('../models/ScreenshotJob');

const activeIntervals = new Map();
let browser = null;

// Initialize browser
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

// Take a screenshot
async function takeScreenshot(url, mode, outputPath, jobId = null) {
  try {
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();

    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });

    // Emulate color scheme based on mode
    await page.emulateMediaFeatures([
      {
        name: 'prefers-color-scheme',
        value: mode
      }
    ]);

    // Navigate to URL with comprehensive wait conditions
    await page.goto(url, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
      timeout: 45000
    });

    // Wait for any lazy-loaded images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
            setTimeout(resolve, 3000); // Max 3s per image
          }))
      );
    });

    // Additional wait for animations, dynamic content, and JavaScript rendering
    // This gives time for SPAs, lazy loading, and animations to complete
    console.log('Waiting 7 seconds for page to fully render...');
    await page.waitForTimeout(7000);

    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: false,
      type: 'png',
      captureBeyondViewport: false
    });

    await page.close();
    console.log(`Screenshot saved: ${outputPath}`);
    
    // Update database if jobId is provided
    if (jobId) {
      const job = await ScreenshotJob.findOne({ jobId });
      if (job) {
        await job.incrementScreenshot();
        console.log(`✅ Database updated for job ${jobId} - Count: ${job.screenshotCount + 1}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error taking screenshot:', error.message);
    
    // Record error in database if jobId is provided
    if (jobId) {
      const job = await ScreenshotJob.findOne({ jobId });
      if (job) {
        await job.recordError(error.message);
        console.log(`❌ Error recorded for job ${jobId}`);
      }
    }
    
    return false;
  }
}

// Start a screenshot job
async function startScreenshotJob(url, mode) {
  const jobId = uuidv4();
  const screenshotPath = path.join(__dirname, '../screenshots', `${jobId}.png`);

  // Take initial screenshot
  await takeScreenshot(url, mode, screenshotPath, jobId);

  // Set up interval for continuous screenshots (every 15 seconds)
  // Increased from 10s to account for 7s page load wait time
  const interval = setInterval(async () => {
    await takeScreenshot(url, mode, screenshotPath, jobId);
  }, parseInt(process.env.SCREENSHOT_INTERVAL) || 15000);

  activeIntervals.set(jobId, interval);

  return jobId;
}

// Restart an existing screenshot job (for server restart recovery)
async function restartScreenshotJob(jobId, url, mode) {
  const screenshotPath = path.join(__dirname, '../screenshots', `${jobId}.png`);

  // Don't take initial screenshot on restart, just set up the interval
  const interval = setInterval(async () => {
    await takeScreenshot(url, mode, screenshotPath, jobId);
  }, parseInt(process.env.SCREENSHOT_INTERVAL) || 15000);

  activeIntervals.set(jobId, interval);

  return jobId;
}

// Stop a screenshot job
function stopScreenshotJob(jobId) {
  const interval = activeIntervals.get(jobId);
  if (interval) {
    clearInterval(interval);
    activeIntervals.delete(jobId);
    return true;
  }
  return false;
}

// Cleanup on exit
process.on('exit', async () => {
  if (browser) {
    await browser.close();
  }
});

module.exports = {
  startScreenshotJob,
  restartScreenshotJob,
  stopScreenshotJob,
  takeScreenshot
};

