require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// ENV
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(express.json());
app.use(express.static("public"));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Connect MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log(" MongoDB connected"))
  .catch(err => console.log(" MongoDB error:", err));

// Schema for Scores
const scoreSchema = new mongoose.Schema({
  difficulty: String,
  attempts: Number,
  date: { type: Date, default: Date.now }
});

const Score = mongoose.model("Score", scoreSchema);

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Start Game
app.post("/start", (req, res) => {
  const levels = { easy: 10, medium: 5, hard: 3 };
  const { difficulty } = req.body;

  if (!levels[difficulty]) return res.json({ message: "Invalid difficulty" });

  req.session.secretNumber = Math.floor(Math.random() * 100) + 1;
  req.session.attemptsLeft = levels[difficulty];
  req.session.totalAttempts = 0;
  req.session.difficulty = difficulty;

  res.json({ message: `Game started (${difficulty})`, attemptsLeft: levels[difficulty] });
});

// Guess
app.post("/guess", async (req, res) => {
  const { guess } = req.body;

  if (!req.session.secretNumber) return res.json({ message: "Start game first!" });

  req.session.attemptsLeft--;
  req.session.totalAttempts++;

  if (guess == req.session.secretNumber) {
    // Save score to MongoDB
    const newScore = new Score({
      difficulty: req.session.difficulty,
      attempts: req.session.totalAttempts
    });
    await newScore.save();

    req.session.destroy(() => {});
    return res.json({ message: ` You Win in ${req.session?.totalAttempts} attempts!` });
  }

  if (req.session.attemptsLeft <= 0) {
    const number = req.session.secretNumber;
    req.session.destroy(() => {});
    return res.json({ message: ` Game Over! Number was ${number}` });
  }

  res.json({ message: guess > req.session.secretNumber ? "⬇ Too High" : "⬆ Too Low", attemptsLeft: req.session.attemptsLeft });
});

// Get High Scores
app.get("/scores", async (req, res) => {
  const scores = await Score.find().sort({ attempts: 1 }).limit(10);
  res.json(scores);
});

app.listen(PORT, () => console.log(` Server running on http://localhost:${PORT}`));
