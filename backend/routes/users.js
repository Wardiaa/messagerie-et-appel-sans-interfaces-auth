const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { User } = require("../models");

// search users
router.get("/search", auth, async (req, res) => {
  try {
    const q = req.query.q || "";
    const regex = new RegExp(q, "i");
    const users = await User.find({
      $or: [{ username: regex }, { firstname: regex }, { lastname: regex }, { email: regex }]
    }).select("_id username firstname lastname email photoProfil status");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
