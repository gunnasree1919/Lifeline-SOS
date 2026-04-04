// server.js

const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const fs = require("fs");
const path = require("path");

function loadEnvFromFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnvFromFile();

const app = express();

app.use(cors());
app.use(express.json());


// ===============================
// 📁 SERVE FRONTEND FILES (FIXED)
// ===============================

const publicPath = path.resolve(__dirname);

console.log("Serving frontend from:", publicPath);

app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});


// ===============================
// 🔑 TWILIO CONFIGURATION
// ===============================

const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
const twilioNumber =
  (process.env.TWILIO_FROM_NUMBER ||
   process.env.TWILIO_FROM ||
   "").trim();

const port = Number(process.env.PORT) || 3000;

const twilioConfigured =
  Boolean(accountSid && authToken && twilioNumber);

const client = twilioConfigured
  ? twilio(accountSid, authToken)
  : null;

if (!twilioConfigured) {
  console.warn("⚠️ Twilio config missing");
}


// ===============================
// ❤️ HEALTH CHECK ROUTE
// ===============================

app.get("/health", (_, res) => {
  res.json({
    ok: true,
    twilioConfigured
  });
});


// ===============================
// 📩 SEND SMS ROUTE
// ===============================

app.post("/send-sms", async (req, res) => {

  console.log("📥 Incoming request:", req.body);

  if (!twilioConfigured) {
    return res.status(503).json({
      error: "Twilio not configured"
    });
  }

  const { to, body } = req.body;

  if (!to) {
    return res.status(400).json({
      error: "Phone number missing"
    });
  }

  try {

    const message = await client.messages.create({

      body:
        body ||
        "🚨 Emergency Alert! Patient needs attention immediately.",

      from: twilioNumber,

      to: to

    });

    console.log("✅ SMS sent:", message.sid);

    res.json({
      sid: message.sid,
      status: message.status
    });

  }

  catch (error) {

    console.log("❌ Twilio error:", error.message);

    res.status(500).json({
      error: error.message
    });

  }

});


// ===============================
// 🚀 START SERVER
// ===============================

app.listen(port, () => {

  console.log("");
  console.log("🚑 LifeLine Alert Server Running");
  console.log("🌍 Server running on port:", port);
  console.log("");

});
