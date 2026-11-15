require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Neighbourhood Hero API',
    status: 'ok',
    endpoints: ['/health', '/api/user/:userId', '/api/karma-level/:points', '/api/complete-task', '/api/karma/award']
  });
});

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel's serverless runtime needs the app exported, not listening.
// Only bind a port when run directly (npm start / npm run dev / Railway).
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Neighborhood Hero Backend running on port ${PORT}`);
  });
}

module.exports = app;
