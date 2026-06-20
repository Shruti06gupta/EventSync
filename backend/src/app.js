const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/user', userRoutes);

app.get('/health', (req, res) => {
  res.json({ message: 'EventSync API is running' });
});

module.exports = app;