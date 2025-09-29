import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
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

// Rate limiting (per IP)
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many messages from this IP. Please try again later.' }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, company, _honeypot } = req.body;

    // Honeypot bot trap
    if (_honeypot) {
      return res.status(200).json({ success: true, message: 'Thank you.' });
    }

    // Basic validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Name is required.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Valid email required.' });
    }
    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Subject too short.' });
    }
    if (!message || message.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Message must be at least 10 characters.' });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const toAddress = process.env.CONTACT_TO || smtpUser;

    const dryRun = !(smtpHost && smtpUser && smtpPass && toAddress);

    // Build presence map for debugging missing env vars (not returned unless debug requested)
    const envPresence = {
      SMTP_HOST: !!smtpHost,
      SMTP_USER: !!smtpUser,
      SMTP_PASS: !!smtpPass,
      CONTACT_TO: !!toAddress
    };

    if (dryRun) {
      const debug = req.query.debug === '1';
      return res.status(200).json({
        success: true,
        dryRun: true,
        message: 'Dry run success (configure SMTP to actually send).',
        ...(debug ? { envPresence } : {})
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const htmlBody = `
      <h2>New Portfolio Contact Message</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-line;">${message}</p>
      <hr />
      <p>Sent via portfolio contact form.</p>
    `;

    const mailOptions = {
      from: `Portfolio Contact <${smtpUser}>`,
      to: toAddress,
      replyTo: email,
      subject: `[Portfolio] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`,
      html: htmlBody
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ success: false, error: 'Internal server error. Please try again later.' });
  }
});

// Serve static portfolio if desired
app.use(express.static('.'));

app.listen(PORT, () => {
  console.log(`Contact backend running on http://localhost:${PORT}`);
});
