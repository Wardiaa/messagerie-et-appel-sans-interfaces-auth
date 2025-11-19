const convService = require("../services/conversations.service");

exports.getUserConversations = async (req, res) => {
  try {
    const conversations = await convService.getUserConversations(req.user._id);
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getOrCreateConversation = async (req, res) => {
  try {
    const result = await convService.getOrCreateConversation(
      req.user._id,
      req.body.otherUserId
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const msgs = await convService.getMessages(
      req.params.conversationId,
      req.query.limit,
      req.query.skip
    );
    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.postMessage = async (req, res) => {
  try {
    const msg = await convService.postMessage(
      req.params.conversationId,
      req.user._id,
      req.body.content,
      req.body.typeMessage
    );
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};
