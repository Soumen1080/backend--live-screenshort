const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const screenshotRoutes = require('./routes/screenshot');
const connectDB = require('./config/database');
const { restoreActiveJobs } = require('./utils/jobRestore');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB and restore active jobs
connectDB().then(() => {
  // Restore active screenshot jobs after DB connection
  setTimeout(() => {
    restoreActiveJobs();
  }, 2000); // Wait 2 seconds for DB to be fully ready
});

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/screenshots', express.static(screenshotsDir));

// Routes
app.use('/api', screenshotRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Screenshot service is running',
    database: 'connected'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`📸 Screenshot interval: ${(parseInt(process.env.SCREENSHOT_INTERVAL) || 15000) / 1000}s`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
