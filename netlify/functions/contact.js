import nodemailer from 'nodemailer';

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  // Parse body
  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON body' }) };
  }

  const { name, email, subject, message, company, _honeypot } = data;

  // Honeypot
  if (_honeypot) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // Validate
  if (!name || name.trim().length < 2) return bad('Name is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Valid email required.');
  if (!subject || subject.trim().length < 3) return bad('Subject too short.');
  if (!message || message.trim().length < 10) return bad('Message must be at least 10 characters.');

  // Env vars (configured in Netlify UI)
  const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, CONTACT_TO, CONTACT_DEBUG } = process.env;
  const port = parseInt(SMTP_PORT, 10);

  // Normalize / trim values (don't expose actual secrets in any response)
  const envPresence = {
    SMTP_HOST: !!(SMTP_HOST && SMTP_HOST.trim()),
    SMTP_USER: !!(SMTP_USER && SMTP_USER.trim()),
    SMTP_PASS: !!(SMTP_PASS && SMTP_PASS.trim()),
    CONTACT_TO: !!((CONTACT_TO && CONTACT_TO.trim()) || (SMTP_USER && SMTP_USER.trim()))
  };

  const dryRun = Object.values(envPresence).some(v => v === false);

  if (dryRun) {
    // If debug requested via query param ?debug=1 or CONTACT_DEBUG=1, include which are missing
    const debugRequested = CONTACT_DEBUG === '1' || (event.queryStringParameters && event.queryStringParameters.debug === '1');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        dryRun: true,
        message: 'Dry run (missing SMTP configuration).',
        ...(debugRequested ? { envPresence } : {})
      })
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
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
      <p>Sent via Netlify serverless contact form.</p>
    `;

    await transporter.sendMail({
      from: `Portfolio Contact <${SMTP_USER}>`,
      to: CONTACT_TO || SMTP_USER,
      replyTo: email,
      subject: `[Portfolio] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`,
      html: htmlBody
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Message sent successfully.' }) };
  } catch (err) {
    console.error('Function email error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Server error sending email.' }) };
  }
}

function bad(error) {
  return { statusCode: 400, body: JSON.stringify({ success: false, error }) };
}
