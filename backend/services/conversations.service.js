const { Conversation, Message } = require("../models");

exports.getUserConversations = async (userId) => {
  return await Conversation.find({ participants: userId })
    .populate("participants", "_id username firstname lastname photoProfil status")
    .populate("lastMessage")
    .sort({ lastActivity: -1 });
};

exports.getOrCreateConversation = async (userId, otherUserId) => {
  if (!otherUserId) throw { status: 400, message: "otherUserId missing" };

  // Check existing
  let conv = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [userId, otherUserId], $size: 2 }
  }).populate("participants", "_id username firstname lastname photoProfil status");

  if (!conv) {
    conv = new Conversation({
      isGroup: false,
      participants: [userId, otherUserId],
      createdBy: userId
    });

    await conv.save();
    await conv.populate("participants", "_id username firstname lastname photoProfil status");
  }

  return conv;
};

exports.getMessages = async (conversationId, limit = 50, skip = 0) => {
  const msgs = await Message.find({ id_conversation: conversationId })
    .sort({ time: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate("id_sender", "_id username firstname lastname photoProfil");

  return msgs.reverse();
};

exports.postMessage = async (conversationId, senderId, content, typeMessage = "text") => {
  if (!content) throw { status: 400, message: "Message content empty" };

  const msg = new Message({
    id_conversation: conversationId,
    id_sender: senderId,
    content,
    typeMessage,
  });

  await msg.save();
  await msg.populate("id_sender", "_id username firstname lastname photoProfil");

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: msg._id,
    lastActivity: Date.now()
  });

  return msg;
};
