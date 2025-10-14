const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const { exec } = require("child_process");
const User = require("./models/User"); // ✅ Import your User model
const mongoose = require("mongoose");




const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = 3000;
const API_KEY = ""; // 👉 Replace with your AssemblyAI API key

// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/voiceapp");

// 🔧 Middleware
const session = require("express-session");
const bodyParser = require("body-parser");

app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: "yourSecretKey", // Change this to something strong
  resave: false,
  saveUninitialized: false,
}));

// Body parser (already mostly covered by express.json and urlencoded, but included for clarity)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🔐 Authentication Middleware
function authMiddleware(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
}

// 🔽 Place your login & register routes RIGHT HERE

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const user = new User({ username, password });
  await user.save();
  res.redirect("/login");
});
// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) {
    req.session.userId = user._id;
    res.redirect("/");
  } else {
    res.send("Invalid login");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Serve pages
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get("/", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html")); // your voice-to-text page
});

// Start the server
app.listen(3001, () => {
  console.log("Server started on http://localhost:3001");
});


// 🎙️ Audio Transcription Route
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  const webmPath = req.file.path;
  const mp3Path = `${webmPath}.mp3`;

  console.log("📥 Received audio file at:", webmPath);

  // Convert webm to mp3 using FFmpeg
  exec(`ffmpeg -y -i ${webmPath} -ar 16000 -ac 1 -b:a 128k ${mp3Path}`, async (err) => {
    if (err) {
      console.error("❌ FFmpeg conversion error:", err);
      return res.status(500).send("FFmpeg conversion failed.");
    }

    try {
      const audioData = fs.readFileSync(mp3Path);

      // Upload to AssemblyAI
      const uploadRes = await axios.post("https://api.assemblyai.com/v2/upload", audioData, {
        headers: {
          authorization: API_KEY,
          "content-type": "application/octet-stream",
        },
      });

      const audioUrl = uploadRes.data.upload_url;
      console.log("✅ Uploaded to AssemblyAI:", audioUrl);

      // Request transcription
      const transcriptRes = await axios.post("https://api.assemblyai.com/v2/transcript", {
        audio_url: audioUrl,
      }, {
        headers: { authorization: API_KEY },
      });

      const transcriptId = transcriptRes.data.id;

      // Poll until transcription is complete
      let polling;
      while (true) {
        polling = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { authorization: API_KEY },
        });

        console.log("⏳ Polling status:", polling.data.status);

        if (polling.data.status === "completed") {
          const transcriptText = polling.data.text || "No speech detected.";
          console.log("📝 Transcript:", transcriptText);
          return res.json({ transcript: transcriptText });
        }

        if (polling.data.status === "error") {
          throw new Error(polling.data.error);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (e) {
      console.error("❌ Transcription failed:", e.message);
      return res.status(500).send("Transcription failed.");
    } finally {
      // Cleanup
      try {
        fs.unlinkSync(webmPath);
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
      } catch (cleanupErr) {
        console.warn("⚠️ File cleanup error:", cleanupErr);
      }
    }
  });
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
