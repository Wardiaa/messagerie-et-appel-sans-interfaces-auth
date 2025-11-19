const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const contactController = require("../controllers/contact.controller");

router.post("/request", auth, contactController.sendRequest);
router.patch("/response", auth, contactController.respondRequest);
router.get("/", auth, contactController.getAcceptedContacts);
router.get("/pending", auth, contactController.getPendingRequests);

module.exports = router;
