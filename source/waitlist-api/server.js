const http = require("http");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3100;
const DB_PATH = process.env.WAITLIST_DB_PATH || path.join(__dirname, "data", "waitlist.db");
const FROM = process.env.RESEND_FROM || "Landomo <hello@landomo.cz>";
const REPLY_TO = process.env.RESEND_REPLY_TO || "feedback@landomo.cz";
const MAX_BODY_BYTES = 10 * 1024; // 10KB
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || crypto.randomBytes(32).toString("hex");
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || null;

// CORS — restrict to known origins in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null; // null = allow all (dev mode)

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ─── Rate limiter (in-memory, per-IP) ───
const rateBuckets = new Map(); // ip → { post: [timestamps], get: [timestamps] }
const RATE_LIMITS = { post: { max: 5, windowMs: 60_000 }, get: { max: 30, windowMs: 60_000 } };

function isRateLimited(ip, method) {
  if (!ip) return false;
  const key = method === "POST" ? "post" : "get";
  const limit = RATE_LIMITS[key];
  if (!rateBuckets.has(ip)) rateBuckets.set(ip, { post: [], get: [] });
  const bucket = rateBuckets.get(ip);
  const now = Date.now();
  bucket[key] = bucket[key].filter((t) => now - t < limit.windowMs);
  if (bucket[key].length >= limit.max) return true;
  bucket[key].push(now);
  return false;
}

// Clean up stale rate-limit entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    bucket.post = bucket.post.filter((t) => now - t < 60_000);
    bucket.get = bucket.get.filter((t) => now - t < 60_000);
    if (bucket.post.length === 0 && bucket.get.length === 0) rateBuckets.delete(ip);
  }
}, 60_000);

// ─── Database ───
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip TEXT,
    user_agent TEXT,
    ref TEXT,
    locale TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    email_sent_at TEXT,
    unsubscribed_at TEXT
  )
`);

// Add columns if upgrading from older schema
for (const col of ["ref", "locale", "referrer", "utm_source", "utm_medium", "utm_campaign", "email_sent_at", "unsubscribed_at", "segment"]) {
  try { db.exec(`ALTER TABLE waitlist ADD COLUMN ${col} TEXT`); } catch {}
}

const insertStmt = db.prepare(
  "INSERT INTO waitlist (email, ip, user_agent, ref, locale, referrer, utm_source, utm_medium, utm_campaign, segment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
const countStmt = db.prepare("SELECT COUNT(*) as count FROM waitlist");

function addEmail(email, ip, userAgent, ref, locale, referrer, utm_source, utm_medium, utm_campaign, segment) {
  try {
    insertStmt.run(email.toLowerCase().trim(), ip || null, userAgent || null, ref || null, locale || null, referrer || null, utm_source || null, utm_medium || null, utm_campaign || null, segment || null);
    return { success: true };
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return { success: false, error: "already_subscribed" };
    }
    throw err;
  }
}

function getCount() {
  return countStmt.get().count;
}

const markEmailSent = db.prepare(
  "UPDATE waitlist SET email_sent_at = datetime('now') WHERE email = ?"
);

const unsubscribeStmt = db.prepare(
  "UPDATE waitlist SET unsubscribed_at = datetime('now') WHERE email = ? AND unsubscribed_at IS NULL"
);

const subscribersStmt = db.prepare(
  "SELECT email, locale, segment, created_at FROM waitlist WHERE unsubscribed_at IS NULL ORDER BY created_at DESC"
);

// ─── Unsubscribe token ───
function generateUnsubscribeToken(email) {
  return crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(email.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function verifyUnsubscribeToken(email, token) {
  return generateUnsubscribeToken(email) === token;
}

function generateUnsubscribeUrl(email, locale) {
  const domain = locale === "cs" ? "landomo.cz" : "landomo.com";
  const token = generateUnsubscribeToken(email);
  return `https://${domain}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}&locale=${locale || "en"}`;
}

function sendFeedbackEmail(email, locale) {
  if (!resend) return;

  const isCz = locale === "cs";
  const from = isCz
    ? "Samuel from Landomo <hello@landomo.cz>"
    : "Samuel from Landomo <hello@landomo.com>";
  const replyTo = isCz ? "hello@landomo.cz" : "hello@landomo.com";
  const domain = isCz ? "landomo.cz" : "landomo.com";

  const subject = isCz
    ? "V\u00edtejte v Landomo. AI agent je skoro p\u0159ipraven"
    : "Welcome to Landomo. Your AI agent is almost ready";

  const unsubscribeUrl = generateUnsubscribeUrl(email, locale);

  const tld = isCz ? "cz" : "com";
  const logoHtml = `<a href="https://${domain}" style="text-decoration: none !important;"><span style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #111827 !important;">landomo</span><span style="font-size: 22px; font-weight: 700; color: #84CC16 !important;">.</span><span style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #111827 !important;">${tld}</span></a>`;

  const emailHead = `<!DOCTYPE html><html><head><meta charset="utf-8"><style type="text/css">a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}</style></head><body>`;
  const emailTail = `</body></html>`;
  const domainText = `<a href="https://${domain}" style="color: #999 !important; text-decoration: none !important;">landomo.${tld}</a>`;

  const html = isCz
    ? emailHead + `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <div style="margin-bottom: 32px;">
    ${logoHtml}
  </div>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    D\u011bkuji za registraci! Jsem Samuel, zakladatel Landomo.
  </p>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Vytv\u00e1\u0159\u00edm n\u011bco, co m\u011b samotn\u00e9mu chyb\u011blo, kdy\u017e jsem hledal sv\u016fj prvn\u00ed byt. Zaj\u00edm\u00e1 m\u011b proto, <strong>co t\u011b te\u010f na hled\u00e1n\u00ed nemovitost\u00ed nejv\u00edce \u0161tve?</strong>
  </p>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 32px; font-weight: 500;">
    Sta\u010d\u00ed odpov\u011b\u010f jen jedn\u00edm slovem. P\u0159e\u010dtu si ka\u017ed\u00fd email.
  </p>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 4px;">
    Samuel<br/><span style="color: #6B7280; font-size: 14px;">Zakladatel, Landomo</span>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;" />
  <p style="font-size: 12px; color: #999; margin: 0;">
    Tento email jste obdr\u017eeli, proto\u017ee jste se zaregistrovali na ${domainText}.
    <a href="${unsubscribeUrl}" style="color: #999 !important; text-decoration: underline !important;">Odhl\u00e1sit se z odb\u011bru</a>
  </p>
</div>` + emailTail
    : `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <div style="margin-bottom: 32px;">
    ${logoHtml}
  </div>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    Thanks for signing up! I'm Samuel, the founder of Landomo.
  </p>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
    I'm building something I wish existed when I was searching for property myself, so I'm curious: <strong>what's your biggest frustration with real estate today?</strong>
  </p>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 32px; font-weight: 500;">
    Just hit reply, even one word helps. I read every response personally.
  </p>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 4px;">
    Samuel<br/><span style="color: #6B7280; font-size: 14px;">Founder, Landomo</span>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;" />
  <p style="font-size: 12px; color: #999; margin: 0;">
    You received this because you signed up at ${domainText}.
    <a href="${unsubscribeUrl}" style="color: #999 !important; text-decoration: underline !important;">Unsubscribe</a>
  </p>
</div>` + emailTail;

  resend.emails
    .send({ from, to: email, replyTo, subject, html })
    .then(() => {
      markEmailSent.run(email.toLowerCase().trim());
      console.log(`Feedback email sent to ${email}`);
    })
    .catch((err) => console.error(`Failed to send feedback email to ${email}:`, err));
}

// ─── CORS helper ───
function getCorsOrigin(req) {
  if (!ALLOWED_ORIGINS) return "*";
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0]; // fallback to first allowed origin
}

function json(res, status, data, req) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.socket.remoteAddress;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": getCorsOrigin(req),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    });
    return res.end();
  }

  // Health check (no rate limit)
  if (req.url === "/health") {
    return json(res, 200, { status: "ok" }, req);
  }

  // Rate limit check
  if (isRateLimited(ip, req.method)) {
    return json(res, 429, { error: "Too many requests. Please try again later." }, req);
  }

  // POST /api/waitlist
  if (req.method === "POST" && req.url === "/api/waitlist") {
    let body = "";
    let bodySize = 0;

    req.on("data", (chunk) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_BYTES) {
        return json(res, 413, { error: "Request too large" }, req);
      }
      body += chunk;
    });

    req.on("end", () => {
      if (bodySize > MAX_BODY_BYTES) return; // already responded
      try {
        const { email, ref, locale, referrer, utm_source, utm_medium, utm_campaign, segment } = JSON.parse(body);
        if (!email || typeof email !== "string" || !email.includes("@")) {
          return json(res, 400, { error: "Invalid email address" }, req);
        }

        const userAgent = req.headers["user-agent"];
        const result = addEmail(email, ip, userAgent, ref, locale, referrer, utm_source, utm_medium, utm_campaign, segment);

        if (!result.success && result.error === "already_subscribed") {
          return json(res, 200, { message: "You're already on the list!" }, req);
        }

        sendFeedbackEmail(email, locale);
        const count = getCount();
        return json(res, 201, { message: "Success", count }, req);
      } catch {
        return json(res, 500, { error: "Something went wrong" }, req);
      }
    });
    return;
  }

  // GET /api/unsubscribe
  if (req.method === "GET" && req.url?.startsWith("/api/unsubscribe")) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = url.searchParams.get("email");
    const token = url.searchParams.get("token");
    const locale = url.searchParams.get("locale") || "en";
    const isCz = locale === "cs";

    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>${isCz ? "Neplatn\u00fd odkaz" : "Invalid link"}</h2></body></html>`);
    }

    unsubscribeStmt.run(email.toLowerCase().trim());

    const heading = isCz ? "Odhl\u00e1\u0161eni z odb\u011bru" : "Unsubscribed";
    const message = isCz
      ? "Byli jste \u00fasp\u011b\u0161n\u011b odhl\u00e1\u0161eni. \u017d\u00e1dn\u00e9 dal\u0161\u00ed emaily v\u00e1m nebudou zasl\u00e1ny."
      : "You have been successfully unsubscribed. You will not receive any more emails from us.";

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:60px 20px;color:#1a1a1a;">
  <div style="margin:0 0 16px;"><span style="font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#111827;">landomo</span><span style="font-size:24px;font-weight:700;color:#84CC16;">.</span><span style="font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#111827;">${isCz ? "cz" : "com"}</span></div>
  <h2 style="font-size:20px;font-weight:500;margin:0 0 12px;">${heading}</h2>
  <p style="font-size:16px;color:#666;line-height:1.6;">${message}</p>
</body>
</html>`);
  }

  // GET /api/subscribers (admin only)
  if (req.method === "GET" && req.url === "/api/subscribers") {
    if (!ADMIN_API_KEY) {
      return json(res, 403, { error: "Admin API not configured" }, req);
    }
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${ADMIN_API_KEY}`) {
      return json(res, 401, { error: "Unauthorized" }, req);
    }
    try {
      const subscribers = subscribersStmt.all();
      return json(res, 200, { subscribers, count: subscribers.length }, req);
    } catch {
      return json(res, 500, { error: "Something went wrong" }, req);
    }
  }

  // GET /api/waitlist
  if (req.method === "GET" && req.url === "/api/waitlist") {
    try {
      const count = getCount();
      return json(res, 200, { count }, req);
    } catch {
      return json(res, 500, { error: "Something went wrong" }, req);
    }
  }

  json(res, 404, { error: "Not found" }, req);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Waitlist API listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing...");
  db.close();
  server.close(() => process.exit(0));
});
