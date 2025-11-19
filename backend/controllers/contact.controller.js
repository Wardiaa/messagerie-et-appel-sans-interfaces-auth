const contactService = require("../services/contact.service");

exports.sendRequest = async (req, res) => {
  try {
    const result = await contactService.sendRequest(req.user._id, req.body.contactId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.respondRequest = async (req, res) => {
  try {
    const result = await contactService.respondRequest(
      req.body.requesterId,
      req.user._id,
      req.body.action
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getAcceptedContacts = async (req, res) => {
  try {
    const contacts = await contactService.getAcceptedContacts(req.user._id);
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPendingRequests = async (req, res) => {
  try {
    const pending = await contactService.getPendingRequests(req.user._id);
    res.json(pending);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
