const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const usersController = require("../controllers/users.controller");

router.get("/search", auth, usersController.searchUsers);

module.exports = router;
