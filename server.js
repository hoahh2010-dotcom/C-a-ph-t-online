require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const crypto = require("crypto");
const path = require("path");

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 30
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 120 }));

const cleanText = (v, max = 160) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

app.get("/api/config", (req, res) => {
  res.json({
    bankLabel: process.env.BANK_LABEL || "Ngân hàng",
    bankId: process.env.BANK_ID || "",
    bankAccount: process.env.BANK_ACCOUNT || "",
    bankAccountName: process.env.BANK_ACCOUNT_NAME || "",
    paymentReady: Boolean(process.env.BANK_ID && process.env.BANK_ACCOUNT)
  });
});

app.get("/api/stats", async (req, res) => {
  try {
    const [donations, attendees] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(amount),0)::text AS total, COUNT(*) FILTER (WHERE status='confirmed')::int AS count FROM donations WHERE status='confirmed'"),
      pool.query("SELECT COUNT(DISTINCT session_hash)::int AS count FROM attendance_events WHERE created_at > NOW() - INTERVAL '30 minutes'")
    ]);
    res.json({
      totalConfirmed: donations.rows[0].total,
      confirmedCount: donations.rows[0].count,
      activeParticipantsApprox: attendees.rows[0].count
    });
  } catch {
    res.status(503).json({ error: "Dữ liệu tạm thời chưa sẵn sàng." });
  }
});

app.post("/api/attend", async (req, res) => {
  try {
    // A hashed, rotating client identifier limits storage of personal data.
    const raw = cleanText(req.body.sessionId, 100);
    if (!raw) return res.status(400).json({ error: "Thiếu mã phiên." });
    const hash = crypto.createHash("sha256")
      .update(raw + (process.env.ADMIN_TOKEN || "local"))
      .digest("hex");
    await pool.query("INSERT INTO attendance_events(session_hash) VALUES($1)", [hash]);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: "Chưa ghi nhận được lượt tham dự." });
  }
});

app.post("/api/donations", async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 100000000) {
    return res.status(400).json({ error: "Số tiền không hợp lệ (từ 1.000đ đến 100.000.000đ)." });
  }
  const donorName = cleanText(req.body.donorName, 80);
  const message = cleanText(req.body.message, 300);
  const anonymous = Boolean(req.body.anonymous);
  try {
    const result = await pool.query(
      `INSERT INTO donations(donor_name, amount, message, anonymous)
       VALUES($1,$2,$3,$4) RETURNING id, amount, status, created_at`,
      [donorName || null, amount, message || null, anonymous]
    );
    res.status(201).json({
      donation: result.rows[0],
      payment: {
        ready: Boolean(process.env.BANK_ID && process.env.BANK_ACCOUNT),
        instruction: "Thông tin chuyển khoản sẽ hiển thị sau khi chủ tài khoản xác nhận và cấu hình."
      }
    });
  } catch {
    res.status(503).json({ error: "Không thể tạo yêu cầu lúc này." });
  }
});

// IMPORTANT: Connect this endpoint to a real payment provider's signed webhook.
// Do not mark transfers as paid based on a screenshot or the donor's own claim.
// Adapt signature verification to the selected provider's official documentation.
app.post("/api/payment-webhook", async (req, res) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || "";
  const signature = req.header("x-provider-signature") || "";
  const rawBody = JSON.stringify(req.body);
  if (!secret || !signature) return res.status(401).json({ error: "Webhook chưa được cấu hình." });

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Chữ ký không hợp lệ." });
  }

  const reference = cleanText(req.body.reference, 120);
  const amount = Number(req.body.amount);
  if (!reference || !Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "Dữ liệu giao dịch không hợp lệ." });
  }
  try {
    const updated = await pool.query(
      `UPDATE donations SET status='confirmed', provider_reference=$1, confirmed_at=NOW()
       WHERE id=$2 AND amount=$3 AND status='pending' RETURNING id`,
      [reference, Number(req.body.donationId), amount]
    );
    res.json({ ok: true, matched: updated.rowCount === 1 });
  } catch {
    res.status(503).json({ error: "Không xử lý được webhook." });
  }
});

app.get("/api/admin/donations", async (req, res) => {
  const token = req.header("x-admin-token") || "";
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Không được phép." });
  }
  try {
    const result = await pool.query(
      `SELECT id, donor_name, amount, message, anonymous, status, created_at, confirmed_at
       FROM donations ORDER BY created_at DESC LIMIT 500`
    );
    res.json(result.rows);
  } catch {
    res.status(503).json({ error: "Không tải được dữ liệu." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Cua Phat Online listening on ${port}`));
