const { Contact } = require("../models");

exports.sendRequest = async (userId, contactId) => {
  if (!contactId) throw { status: 400, message: "contactId missing" };

  const existing = await Contact.findOne({ id_user: userId, contactId });
  if (existing) throw { status: 400, message: "Already requested or contact exists" };

  const contact = new Contact({ id_user: userId, contactId, status: "pending" });
  await contact.save();

  return { ok: true, contact };
};

exports.respondRequest = async (requesterId, myId, action) => {
  const contact = await Contact.findOne({ id_user: requesterId, contactId: myId });
  if (!contact) throw { status: 404, message: "Request not found" };

  if (action === "accept") {
    contact.status = "accepted";
    await contact.save();

    let reciprocal = await Contact.findOne({ id_user: myId, contactId: requesterId });

    if (!reciprocal) {
      reciprocal = await new Contact({ id_user: myId, contactId: requesterId, status: "accepted" }).save();
    } else {
      reciprocal.status = "accepted";
      await reciprocal.save();
    }

    return { ok: true, contact };
  }

  await contact.deleteOne();
  return { ok: true, deleted: true };
};

exports.getAcceptedContacts = async (userId) => {
  return await Contact.find({ id_user: userId, status: "accepted" })
    .populate("contactId", "_id username firstname lastname email photoProfil status");
};

exports.getPendingRequests = async (userId) => {
  return await Contact.find({ contactId: userId, status: "pending" })
    .populate("id_user", "_id username firstname lastname email photoProfil");
};
