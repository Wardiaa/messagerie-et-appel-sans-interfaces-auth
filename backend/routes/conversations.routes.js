const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const convController = require("../controllers/conversations.controller");

router.get("/", auth, convController.getUserConversations);
router.post("/get-or-create", auth, convController.getOrCreateConversation);
router.get("/:conversationId/messages", auth, convController.getMessages);
router.post("/:conversationId/message", auth, convController.postMessage);

module.exports = router;
