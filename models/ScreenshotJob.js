const mongoose = require('mongoose');

const screenshotJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  mode: {
    type: String,
    required: true,
    enum: ['light', 'dark'],
    default: 'light'
  },
  status: {
    type: String,
    enum: ['active', 'stopped', 'error'],
    default: 'active'
  },
  screenshotPath: {
    type: String,
    required: true
  },
  lastScreenshotAt: {
    type: Date,
    default: null
  },
  screenshotCount: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for faster queries
screenshotJobSchema.index({ status: 1, createdAt: -1 });

// Method to increment screenshot count
screenshotJobSchema.methods.incrementScreenshot = function() {
  this.screenshotCount += 1;
  this.lastScreenshotAt = new Date();
  return this.save();
};

// Method to record error
screenshotJobSchema.methods.recordError = function(errorMessage) {
  this.errorCount += 1;
  this.lastError = errorMessage;
  return this.save();
};

// Method to stop job
screenshotJobSchema.methods.stopJob = function() {
  this.status = 'stopped';
  return this.save();
};

// Static method to get active jobs
screenshotJobSchema.statics.getActiveJobs = function() {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};

// Static method to cleanup old stopped jobs (optional)
screenshotJobSchema.statics.cleanupOldJobs = function(daysOld = 7) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - daysOld);
  
  return this.deleteMany({
    status: 'stopped',
    updatedAt: { $lt: dateThreshold }
  });
};

const ScreenshotJob = mongoose.model('ScreenshotJob', screenshotJobSchema);

module.exports = ScreenshotJob;
