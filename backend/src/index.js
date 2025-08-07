const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const snarkjs = require("snarkjs");
const Vote = require("./models/Vote");

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/evoting";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => console.error("MongoDB connection error:", err));

// Memorijska pohrana za iskorištene poništivače.
// U produkcijskom sustavu, ovo bi bilo u perzistentnoj bazi podataka.
const usedNullifiers = new Set();

async function verifyProof(proof, publicSignals) {
  const verificationKeyPath = path.join(__dirname, "../verification_key.json");
  const vKey = JSON.parse(await fs.readFile(verificationKeyPath));
  return snarkjs.groth16.verify(vKey, publicSignals, proof);
}

app.post("/vote", async (req, res) => {
  try {
    const { proof, publicSignals, trackerCode } = req.body;

    if (!proof || !publicSignals || !trackerCode) {
      return res
        .status(400)
        .json({
          message: "Proof, public signals, and tracker code are required.",
        });
    }

    // Ekstrahiraj nullifier iz javnih signala. Prema našem krugu, on je 4. element
    // (nakon 3 elementa za validCandidates).
    const nullifier = publicSignals[3];

    // 1. PROVJERA PONIŠTIVAČA (NOVI KORAK)
    if (usedNullifiers.has(nullifier)) {
      console.log("❌ Double vote attempt detected with nullifier:", nullifier);
      return res
        .status(400)
        .json({
          message: "This vote has already been cast (double vote attempt).",
        });
    }

    // 2. VERIFIKACIJA DOKAZA (kao i prije)
    const isVerified = await verifyProof(proof, publicSignals);

    if (isVerified) {
      console.log("✅ Proof is valid.");

      // 3. POHRANA (kao i prije, uz dodavanje poništivača)
      usedNullifiers.add(nullifier); // Dodaj poništivač u listu iskorištenih
      const newVote = new Vote({ proof, publicSignals, trackerCode });
      await newVote.save();

      res.status(200).json({ message: "Vote successfully cast and verified." });
    } else {
      console.log("❌ Proof is invalid.");
      res.status(400).json({ message: "Invalid proof." });
    }
  } catch (error) {
    console.error("Error during vote verification:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET /results i GET /bulletin-board rute ostaju iste kao prije.
// ... (ostatak koda ostaje isti) ...
app.get("/results", async (req, res) => {
  try {
    const voteCount = await Vote.countDocuments();
    res.status(200).json({ totalValidVotes: voteCount });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/bulletin-board", async (req, res) => {
  try {
    const votes = await Vote.find({})
      .select("trackerCode publicSignals proof createdAt -_id")
      .sort({ createdAt: "desc" });

    res.status(200).json(votes);
  } catch (error) {
    console.error("Error fetching bulletin board:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
