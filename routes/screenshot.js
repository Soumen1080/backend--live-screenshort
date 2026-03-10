const express = require('express');
const router = express.Router();
const screenshotController = require('../controllers/screenshotController');

// Create new screenshot job
router.post('/screenshot/create', screenshotController.createScreenshotJob);

// Get screenshot by ID
router.get('/screenshot/:id', screenshotController.getScreenshot);

// Get latest screenshot image for GitHub README
router.get('/image/:id', screenshotController.getLatestImage);

// Stop screenshot job
router.delete('/screenshot/:id', screenshotController.stopScreenshotJob);

// Get active jobs
router.get('/jobs', screenshotController.getActiveJobs);

module.exports = router;
