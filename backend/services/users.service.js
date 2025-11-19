const { User } = require("../models");

exports.searchUsers = async (query = "") => {
  const regex = new RegExp(query, "i");

  return await User.find({
    $or: [
      { username: regex },
      { firstname: regex },
      { lastname: regex },
      { email: regex }
    ]
  }).select("_id username firstname lastname email photoProfil status");
};
