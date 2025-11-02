let dotenvLoaded = false;
try {
  require('dotenv').config();
  dotenvLoaded = true;
} catch (e) {
  console.warn('Warning: dotenv not loaded. If you rely on a .env file, install dotenv: npm install dotenv');
}

console.log('Node version:', process.version);
console.log('Running file:', __filename);
console.log('Running directory:', __dirname);
console.log('dotenv loaded:', dotenvLoaded);

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason && reason.stack ? reason.stack : reason);
  process.exit(1);
});

const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../Front end')));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "babraichoa@gmail.com",
    pass: process.env.EMAIL_PASS || "Babra@03.com.com",
  },
});

transporter.verify((err, success) => {
  if (err) console.error("Nodemailer verify failed:", err.message || err);
  else console.log("Nodemailer is ready to send messages");
});

// request logger
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.path} content-type=${req.headers['content-type']}`);
  next();
});

// Ensure email credentials are configured before attempting to send
function ensureEmailConfigured(req, res, next) {
  if (!process.env.EMAIL_PASS) {
    console.error('EMAIL_PASS missing. Set EMAIL_PASS in .env or environment variables (use a Gmail app password).');
    return res.status(500).json({
      success: false,
      error: 'Email not configured. Set EMAIL_PASS in .env or environment variables.'
    });
  }
  next();
}

// Diagnosis endpoint (multipart/form-data with files)
app.post("/send-diagnosis", ensureEmailConfigured, upload.array("file_photo", 5), async (req, res) => {
  const {
    Farmer_Name,
    Farmer_Email,
    Phone,
    Farm_Location,
    Crop_Type,
    Problem_Description,
  } = req.body;

  const mailOptions = {
    from: `"Elgro Diagnosis Form" <${process.env.EMAIL_USER || "babraichoa@gmail.com"}>`,
    to: process.env.EMAIL_TO || "babraichoa@gmail.com",
    subject: `🧪 New Crop Diagnosis Request from ${Farmer_Name || "Unknown"}`,
    html: `
      <h2>🌾 Crop Diagnosis Request</h2>
      <p><b>Name:</b> ${Farmer_Name || ""}</p>
      <p><b>Email:</b> ${Farmer_Email || ""}</p>
      <p><b>Phone:</b> ${Phone || ""}</p>
      <p><b>Farm Location:</b> ${Farm_Location || ""}</p>
      <p><b>Crop Type:</b> ${Crop_Type || ""}</p>
      <p><b>Problem Description:</b><br>${Problem_Description || ""}</p>
    `,
    attachments: Array.isArray(req.files)
      ? req.files.map((file) => ({
          filename: file.originalname || path.basename(file.path),
          path: file.path,
        }))
      : [],
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Diagnosis email sent successfully!" });
  } catch (error) {
    console.error("Email error (send-diagnosis):", error && (error.stack || error));
    res.status(500).json({
      success: false,
      error: error && error.message ? error.message : "Failed to send email.",
      // include stack only when developing locally
      details: process.env.NODE_ENV === 'development' ? (error && (error.stack || error)) : undefined
    });
  } finally {
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        fs.unlink(file.path, (err) => {
          if (err) console.error("Failed to delete file:", file.path, err);
        });
      });
    }
  }
});

// Contact endpoint — accept JSON or form-data
app.post("/send-contact", ensureEmailConfigured, upload.none(), async (req, res) => {
  const { Name, Email, Subject, Message } = req.body;

  const mailOptions = {
    from: `"Elgro Contact Form" <${process.env.EMAIL_USER || "babraichoa@gmail.com"}>`,
    to: process.env.EMAIL_TO || "babraichoa@gmail.com",
    subject: `📬 New Contact Message: ${Subject || ""}`,
    html: `
      <h2>📞 Contact Form Submission</h2>
      <p><b>Name:</b> ${Name || ""}</p>
      <p><b>Email:</b> ${Email || ""}</p>
      <p><b>Subject:</b> ${Subject || ""}</p>
      <p><b>Message:</b><br>${Message || ""}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Contact email sent successfully!" });
  } catch (error) {
    console.error("Email error (send-contact):", error && (error.stack || error));
    res.status(500).json({
      success: false,
      error: error && error.message ? error.message : "Failed to send message.",
      details: process.env.NODE_ENV === 'development' ? (error && (error.stack || error)) : undefined
    });
  }
});

// Health and root endpoints
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Server is running', pid: process.pid });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    pid: process.pid,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    method: req.method,
    path: req.path,
  });
});

// error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({ success: false, error: "Server error occurred." });
});

const START_PORT = parseInt(process.env.PORT, 10) || 5000;
const MAX_RETRIES = 10; // try START_PORT .. START_PORT + MAX_RETRIES

function logPortUsage(port, cb) {
  // Windows netstat command; safe no-op on non-windows (will just call callback with no output)
  const cmd = process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port} || ss -ltnp | grep :${port}`;
  exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
    if (stdout && stdout.trim()) {
      console.log(`Port ${port} usage:\n${stdout.trim()}`);
    } else if (stderr && stderr.trim()) {
      console.warn(`Port check stderr: ${stderr.trim()}`);
    } else {
      console.log(`No process found listening on port ${port} (or port check command not available).`);
    }
    if (typeof cb === 'function') cb();
  });
}

function attemptListen(port, retriesLeft) {
  const server = app.listen(port, () => {
    const actualPort = server.address().port;
    console.log(`✅ Server running on http://localhost:${actualPort} (PID ${process.pid})`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is in use (EADDRINUSE). Checking usage...`);
      logPortUsage(port, () => {
        server.close?.();
        if (retriesLeft > 0) {
          const nextPort = port + 1;
          console.log(`Trying port ${nextPort}... (${retriesLeft - 1} retries left)`);
          setTimeout(() => attemptListen(nextPort, retriesLeft - 1), 200);
        } else {
          console.warn(`No available ports in range ${START_PORT}..${port}. Falling back to an OS-assigned port (0).`);
          // Try OS-assigned port 0
          const fallback = app.listen(0, () => {
            console.log(`✅ Server running on OS-assigned port http://localhost:${fallback.address().port} (PID ${process.pid})`);
          });
          fallback.on('error', (e) => {
            console.error('Failed to bind fallback port 0:', e);
            console.error('Manual options:');
            console.error(` - Find & kill process using port ${START_PORT}: netstat -ano | findstr :${START_PORT}`);
            console.error(' - Start on a different port: set PORT=5001 && node "Front end\\Back end\\server.js" (cmd) or $env:PORT=5001; node server.js (PowerShell)');
            process.exit(1);
          });
        }
      });
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

console.log('Server starting with PID:', process.pid);
console.log(`Configured starting PORT: ${START_PORT}`);
attemptListen(START_PORT, MAX_RETRIES);