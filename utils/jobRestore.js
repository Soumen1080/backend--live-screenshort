const ScreenshotJob = require('../models/ScreenshotJob');
const screenshotService = require('../services/screenshotService');

/**
 * Restore active screenshot jobs from database on server restart
 * This ensures jobs continue running even after server restarts
 */
async function restoreActiveJobs() {
  try {
    const activeJobs = await ScreenshotJob.find({ status: 'active' });
    
    if (activeJobs.length === 0) {
      console.log('ℹ️  No active jobs to restore');
      return;
    }

    console.log(`🔄 Restoring ${activeJobs.length} active job(s)...`);

    for (const job of activeJobs) {
      try {
        // Restart the screenshot service for this job
        await screenshotService.restartScreenshotJob(job.jobId, job.url, job.mode);
        console.log(`✅ Restored job: ${job.jobId} - ${job.url}`);
      } catch (error) {
        console.error(`❌ Failed to restore job ${job.jobId}:`, error.message);
        // Mark job as error status
        job.status = 'error';
        job.lastError = `Failed to restore on server restart: ${error.message}`;
        await job.save();
      }
    }

    console.log(`✅ Job restoration complete`);
  } catch (error) {
    console.error('❌ Error restoring active jobs:', error);
  }
}

/**
 * Cleanup old stopped jobs (optional maintenance task)
 */
async function cleanupOldJobs(daysOld = 7) {
  try {
    const result = await ScreenshotJob.cleanupOldJobs(daysOld);
    console.log(`🧹 Cleaned up ${result.deletedCount} old stopped jobs (older than ${daysOld} days)`);
  } catch (error) {
    console.error('❌ Error cleaning up old jobs:', error);
  }
}

module.exports = {
  restoreActiveJobs,
  cleanupOldJobs
};
