const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const snarkjs = require("snarkjs");
const Vote = require("./models/Vote");
const Nullifier = require("./models/Nullifier");

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/evoting";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => console.error("MongoDB connection error:", err));

async function verifyProof(proof, publicSignals) {
  const verificationKeyPath = path.join(__dirname, "../verification_key.json");
  const vKey = JSON.parse(await fs.readFile(verificationKeyPath));

  console.time("Vrijeme verifikacije glasa (backend)");
  const result = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.timeEnd("Vrijeme verifikacije glasa (backend)");

  return result;
}

app.post("/vote", async (req, res) => {
  try {
    const { proof, publicSignals, trackerCode, voteVector } = req.body;

    if (!proof || !publicSignals || !trackerCode || !voteVector) {
      return res.status(400).json({ message: "Missing required vote data." });
    }

    const nullifierHash = publicSignals[3];

    // 1.PROVJERA PONIŠTIVAČA U BAZI PODATAKA
    const existingNullifier = await Nullifier.findOne({ hash: nullifierHash });
    if (existingNullifier) {
      console.log(
        "❌ Double vote attempt detected with nullifier:",
        nullifierHash
      );
      return res
        .status(400)
        .json({ message: "Ovaj glasač je već glasao u ovom krugu." });
    }

    // 2.VERIFIKACIJA DOKAZA
    const isVerified = await verifyProof(proof, publicSignals);

    if (isVerified) {
      console.log("✅ Proof is valid.");

      // 3.POHRANA (spremamo i glas i poništivač u bazu)
      await new Nullifier({ hash: nullifierHash }).save();
      const newVote = new Vote({
        proof,
        publicSignals,
        trackerCode,
        voteVector,
      });
      await newVote.save();

      res
        .status(200)
        .json({ message: "Glas je uspješno zaprimljen i verificiran." });
    } else {
      console.log("❌ Proof is invalid.");
      res.status(400).json({ message: "Neispravan ZKP dokaz." });
    }
  } catch (error) {
    // Greška se može dogoditi ako dva ista glasa stignu u isto vrijeme
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Ovaj glasač je upravo glasao (double vote attempt).",
      });
    }
    console.error("Error during vote verification:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/results", async (req, res) => {
  try {
    const voteCount = await Vote.countDocuments();
    res.status(200).json({ totalValidVotes: voteCount });
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});
app.get("/bulletin-board", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const votes = await Vote.find({})
      .select("trackerCode publicSignals proof voteVector createdAt -_id")
      .sort({ createdAt: "desc" });
    res.status(200).json(votes);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

app.post("/reset", async (req, res) => {
  try {
    console.log("--- RESETTING ELECTION DATA ---");
    await Vote.deleteMany({});
    await Nullifier.deleteMany({});
    console.log("All votes and nullifiers have been cleared.");
    res.status(200).json({
      message: "Glasovanje je uspješno resetirano. Možete započeti novi krug.",
    });
  } catch (error) {
    console.error("Error during election reset:", error);
    res
      .status(500)
      .json({ message: "Greška prilikom resetiranja glasovanja." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
