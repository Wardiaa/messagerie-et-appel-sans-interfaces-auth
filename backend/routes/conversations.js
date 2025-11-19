const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { Conversation, Message } = require("../models");

// get all conversations for current user
router.get("/", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate("participants", "_id username firstname lastname photoProfil status")
    .populate("lastMessage")
    .sort({ lastActivity: -1 });
    
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// create or get conversation between two users (one-to-one)
router.post("/get-or-create", auth, async (req, res) => {
  const { otherUserId } = req.body;
  try {
    let conv = await Conversation.findOne({ 
      isGroup: false, 
      participants: { $all: [req.user._id, otherUserId], $size: 2 } 
    }).populate("participants", "_id username firstname lastname photoProfil status");
    
    if (!conv) {
      conv = new Conversation({ 
        isGroup: false, 
        participants: [req.user._id, otherUserId], 
        createdBy: req.user._id 
      });
      await conv.save();
      await conv.populate("participants", "_id username firstname lastname photoProfil status");
    }
    res.json(conv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// get messages for a conversation
router.get("/:conversationId/messages", auth, async (req, res) => {
  const { conversationId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const skip = parseInt(req.query.skip) || 0;
  
  try {
    const messages = await Message.find({ id_conversation: conversationId })
      .sort({ time: -1 })
      .limit(limit)
      .skip(skip)
      .populate("id_sender", "_id username firstname lastname photoProfil");
    
    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// post message
router.post("/:conversationId/message", auth, async (req, res) => {
  const { conversationId } = req.params;
  const { content, typeMessage } = req.body;
  try {
    const msg = new Message({ 
      id_conversation: conversationId, 
      id_sender: req.user._id, 
      content, 
      typeMessage: typeMessage || "text" 
    });
    await msg.save();
    await msg.populate("id_sender", "_id username firstname lastname photoProfil");
    
    await Conversation.findByIdAndUpdate(conversationId, { 
      lastMessage: msg._id, 
      lastActivity: Date.now() 
    });
    
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;