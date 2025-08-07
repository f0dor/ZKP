const mongoose = require("mongoose");

const VoteSchema = new mongoose.Schema({
  proof: {
    type: Object,
    required: true,
  },
  publicSignals: {
    type: [String],
    required: true,
  },
  trackerCode: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Vote", VoteSchema);
