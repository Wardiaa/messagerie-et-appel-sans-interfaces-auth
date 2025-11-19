const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { Contact, User } = require("../models");

// send request
router.post("/request", auth, async (req, res) => {
  const { contactId } = req.body;
  try {
    if (!contactId) return res.status(400).json({ error: "contactId missing" });

    const existing = await Contact.findOne({ id_user: req.user._id, contactId });
    if (existing) return res.status(400).json({ error: "Already requested or contact exists" });

    const contact = new Contact({ id_user: req.user._id, contactId, status: "pending" });
    await contact.save();
    res.json({ ok: true, contact });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// accept/decline (patch)
router.patch("/response", auth, async (req, res) => {
  const { requesterId, action } = req.body; // action = 'accept'|'decline'
  try {
    const contact = await Contact.findOne({ id_user: requesterId, contactId: req.user._id });
    if (!contact) return res.status(404).json({ error: "Request not found" });

    if (action === "accept") {
      contact.status = "accepted";
      await contact.save();
      // create reciprocal contact
      const reciprocal = await Contact.findOne({ id_user: req.user._id, contactId: requesterId });
      if (!reciprocal) {
        await new Contact({ id_user: req.user._id, contactId: requesterId, status: "accepted" }).save();
      } else {
        reciprocal.status = "accepted";
        await reciprocal.save();
      }
      return res.json({ ok: true, contact });
    } else {
      await contact.deleteOne();
      return res.json({ ok: true, deleted: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// get all accepted contacts for current user
router.get("/", auth, async (req, res) => {
  try {
    const contacts = await Contact.find({ 
      id_user: req.user._id, 
      status: "accepted" 
    }).populate("contactId", "_id username firstname lastname email photoProfil status");
    
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// get pending requests (received by me)
router.get("/pending", auth, async (req, res) => {
  try {
    const pendingRequests = await Contact.find({ 
      contactId: req.user._id, 
      status: "pending" 
    }).populate("id_user", "_id username firstname lastname email photoProfil");
    
    res.json(pendingRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;