require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');

async function start() {
  await connectDB();

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
