// Outgoing email. Picks a provider from environment variables:
//   BREVO_API_KEY   -> Brevo transactional API (HTTPS; works on Render's free plan)
//   RESEND_API_KEY  -> Resend API (HTTPS; needs a domain you own)
//   SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS) -> SMTP via nodemailer, if installed.
//     Render's free plan blocks outbound SMTP ports, so this only works on paid plans.
// MAIL_FROM (address) and MAIL_FROM_NAME set the sender. With nothing configured the
// app keeps working: it logs a redacted notice and the email is not sent.
// Never logs keys, tokens, links or full addresses.

let testTransport = null; // tests can capture mail with setTransport(fn)

function redact(addr) {
  const [u, d] = String(addr || '').split('@');
  if (!d) return '***';
  const dom = d.split('.');
  return `${u.slice(0, 1)}***@${dom[0].slice(0, 1)}***.${dom.slice(1).join('.') || '***'}`;
}

function provider(env = process.env) {
  if (testTransport) return 'test';
  if (env.BREVO_API_KEY) return 'brevo';
  if (env.RESEND_API_KEY) return 'resend';
  if (env.SMTP_HOST) return 'smtp';
  return null;
}

async function postJson(url, headers, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return true;
  } finally { clearTimeout(t); }
}

// sendMail({ to, subject, text, html }) -> { sent: boolean, provider }
async function sendMail(msg, env = process.env) {
  const p = provider(env);
  const from = env.MAIL_FROM || '';
  const fromName = env.MAIL_FROM_NAME || 'Fitness Coach';
  const label = msg.kind || 'email';
  try {
    if (p === 'test') { await testTransport(msg); return { sent: true, provider: p }; }
    if (!p) {
      console.warn(`[mailer] No email provider configured; ${label} to ${redact(msg.to)} was not sent. Set BREVO_API_KEY (or RESEND_API_KEY / SMTP_*) and MAIL_FROM.`);
      return { sent: false, provider: null };
    }
    if (!from) {
      console.warn(`[mailer] MAIL_FROM is not set; ${label} to ${redact(msg.to)} was not sent.`);
      return { sent: false, provider: p };
    }
    if (p === 'brevo') {
      await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': env.BREVO_API_KEY }, {
        sender: { name: fromName, email: from }, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, htmlContent: msg.html || undefined
      });
    } else if (p === 'resend') {
      await postJson('https://api.resend.com/emails', { Authorization: `Bearer ${env.RESEND_API_KEY}` }, {
        from: `${fromName} <${from}>`, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html || undefined
      });
    } else if (p === 'smtp') {
      let nodemailer;
      try { nodemailer = require('nodemailer'); } catch {
        console.warn(`[mailer] SMTP_HOST is set but nodemailer is not installed; ${label} to ${redact(msg.to)} was not sent.`);
        return { sent: false, provider: p };
      }
      const port = Number(env.SMTP_PORT) || 587;
      const tx = nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined, connectionTimeout: 10000 });
      await tx.sendMail({ from: `${fromName} <${from}>`, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    }
    console.log(`[mailer] ${label} sent to ${redact(msg.to)} via ${p}`);
    return { sent: true, provider: p };
  } catch (err) {
    // err.message is only "HTTP <status>" or a network error name: no secrets.
    console.warn(`[mailer] ${label} to ${redact(msg.to)} via ${p} failed: ${String(err && (err.name === 'AbortError' ? 'timeout' : err.message)).slice(0, 80)}`);
    return { sent: false, provider: p };
  }
}

function setTransport(fn) { testTransport = fn; }

module.exports = { sendMail, setTransport, redact, provider };
