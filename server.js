import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Basic security-minded configuration
app.disable('x-powered-by');

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'
}));
app.use(express.json());

// (Rate limiter retained if future endpoints added)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Informational GET for contact endpoint (avoids 'Cannot GET /api/contact')
app.get('/api/contact', (req, res) => {
  const debug = req.query.debug === '1';
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const toAddress = process.env.CONTACT_TO || smtpUser;
  const envPresence = {
    SMTP_HOST: !!smtpHost,
    SMTP_USER: !!smtpUser,
    SMTP_PASS: !!smtpPass,
    CONTACT_TO: !!toAddress
  };
  res.json({
    endpoint: '/api/contact',
    method: 'POST',
    requiredFields: ['name','email','subject','message'],
    optionalFields: ['company','_honeypot'],
    status: 'Ready',
    dryRun: !(smtpHost && smtpUser && smtpPass && toAddress),
    ...(debug ? { envPresence } : {}),
    hint: 'Send a POST request with JSON body to this endpoint to submit a contact message.'
  });
});


// Serve static portfolio if desired
app.use(express.static('.'));

app.listen(PORT, () => {
  console.log(`Contact backend running on http://localhost:${PORT}`);
});
