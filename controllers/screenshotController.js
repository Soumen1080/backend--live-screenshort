const screenshotService = require('../services/screenshotService');
const ScreenshotJob = require('../models/ScreenshotJob');
const path = require('path');
const fs = require('fs');

// Create a new screenshot job
exports.createScreenshotJob = async (req, res) => {
  try {
    const { url, mode } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!mode || !['light', 'dark'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be either "light" or "dark"' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Start screenshot service
    const jobId = await screenshotService.startScreenshotJob(url, mode);
    
    // Save to database
    const screenshotPath = path.join(__dirname, '../screenshots', `${jobId}.png`);
    const jobRecord = await ScreenshotJob.create({
      jobId,
      url,
      mode,
      status: 'active',
      screenshotPath
    });

    // Use BASE_URL from environment variable
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const apiUrl = `${baseUrl}/api/image/${jobId}`;
    
    // Get interval from env
    const intervalSeconds = (parseInt(process.env.SCREENSHOT_INTERVAL) || 15000) / 1000;

    res.json({
      success: true,
      jobId,
      url,
      mode,
      apiUrl,
      message: `Screenshot job created. Screenshots will update every ${intervalSeconds} seconds with 7s page load wait.`,
      usage: `Use this URL in your GitHub README: ![Live Screenshot](${apiUrl})`
    });
  } catch (error) {
    console.error('Error creating screenshot job:', error);
    res.status(500).json({ error: 'Failed to create screenshot job' });
  }
};

// Get screenshot info
exports.getScreenshot = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await ScreenshotJob.findOne({ jobId: id });

    if (!job) {
      return res.status(404).json({ error: 'Screenshot job not found' });
    }

    const screenshotPath = path.join(__dirname, '../screenshots', `${id}.png`);
    const exists = fs.existsSync(screenshotPath);

    res.json({
      jobId: id,
      url: job.url,
      mode: job.mode,
      status: job.status,
      createdAt: job.createdAt,
      lastScreenshotAt: job.lastScreenshotAt,
      screenshotCount: job.screenshotCount,
      screenshotAvailable: exists,
      screenshotUrl: exists ? `/screenshots/${id}.png` : null
    });
  } catch (error) {
    console.error('Error getting screenshot:', error);
    res.status(500).json({ error: 'Failed to get screenshot info' });
  }
};

// Get latest screenshot image (for GitHub README)
exports.getLatestImage = async (req, res) => {
  try {
    const { id } = req.params;
    const screenshotPath = path.join(__dirname, '../screenshots', `${id}.png`);

    if (!fs.existsSync(screenshotPath)) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }

    // Set headers to prevent caching
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.sendFile(screenshotPath);
  } catch (error) {
    console.error('Error serving screenshot:', error);
    res.status(500).json({ error: 'Failed to serve screenshot' });
  }
};

// Stop screenshot job
exports.stopScreenshotJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await ScreenshotJob.findOne({ jobId: id });
    
    if (!job) {
      return res.status(404).json({ error: 'Screenshot job not found' });
    }

    // Stop the service
    screenshotService.stopScreenshotJob(id);
    
    // Update database
    await job.stopJob();

    // Optionally delete the screenshot file
    const screenshotPath = path.join(__dirname, '../screenshots', `${id}.png`);
    if (fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
    }

    res.json({
      success: true,
      message: 'Screenshot job stopped and files cleaned up'
    });
  } catch (error) {
    console.error('Error stopping screenshot job:', error);
    res.status(500).json({ error: 'Failed to stop screenshot job' });
  }
};

// Get all active jobs
exports.getActiveJobs = async (req, res) => {
  try {
    const jobs = await ScreenshotJob.getActiveJobs();

    res.json({
      activeJobs: jobs.length,
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        url: job.url,
        mode: job.mode,
        status: job.status,
        createdAt: job.createdAt,
        screenshotCount: job.screenshotCount,
        lastScreenshotAt: job.lastScreenshotAt
      }))
    });
  } catch (error) {
    console.error('Error getting active jobs:', error);
    res.status(500).json({ error: 'Failed to get active jobs' });
  }
};
