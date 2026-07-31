require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { testConnection } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const languageRoutes = require('./routes/language');
const lessonRoutes = require('./routes/lesson');
const progressRoutes = require('./routes/progress');
const voiceRoutes = require('./routes/voice');
const webhookRoutes = require('./routes/webhook');
const panelRoutes = require('./routes/panelRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Lingola Kids API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/voices', voiceRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/panel/v1', panelRoutes);


app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Server not started.');
      process.exit(1);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('========================================');
      console.log('  Lingola Kids Backend Server');
      console.log('========================================');
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Port: ${PORT}`);
      console.log(`  URL: http://localhost:${PORT}`);
      console.log(`  LAN: http://0.0.0.0:${PORT}`);
      console.log('========================================');
      console.log('  GET  /api/lessons');
      console.log('  GET  /api/progress/current');
      console.log('  PUT  /api/progress/:lessonSlug/:activitySlug');
      console.log('  GET  /api/voices/resolve');
      console.log('========================================');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = app;
