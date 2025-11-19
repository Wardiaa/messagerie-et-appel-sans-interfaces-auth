const usersService = require("../services/users.service");

exports.searchUsers = async (req, res) => {
  try {
    const users = await usersService.searchUsers(req.query.q);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};
