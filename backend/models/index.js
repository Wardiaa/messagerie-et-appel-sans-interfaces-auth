// models/index.js
// Contient tous les schémas Mongoose proprement structurés
// À placer dans /models/

const mongoose = require("mongoose");

// ==============================
// 1. USER MODEL
// ==============================
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true },
  firstname: String,
  lastname: String,
  email: { type: String, unique: true, required: true, lowercase: true },
  phone: { type: String, unique: true },
  passwordHash: { type: String, required: true },
  photoProfil: { type: String, default: "/uploads/default.jpg" },
  dateOfBirth: Date,
  qrCode: String,
  status: {
    type: String,
    enum: ["Disponible", "Occupé", "Hors ligne"],
    default: "Hors ligne",
  },
  derniereConnexion: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

const User = mongoose.model("User", userSchema);

// ==============================
// 2. USER SETTINGS MODEL
// ==============================
const userSettingsSchema = new mongoose.Schema({
  id_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  theme: { type: String, enum: ["light", "dark"], default: "light" },
  notifications: { type: Boolean, default: true },
  affichageDernierMsg: { type: Boolean, default: true },
  affichagePhotoProfil: { type: Boolean, default: true },
});

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);

// ==============================
// 3. CONTACTS MODEL
// ==============================
const contactSchema = new mongoose.Schema({
  id_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "blocked"],
    default: "pending",
  },
  addedAt: { type: Date, default: Date.now },
});

contactSchema.index({ id_user: 1, contactId: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);

// ==============================
// 4. CONVERSATIONS MODEL
// ==============================
const conversationSchema = new mongoose.Schema({
  isGroup: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  groupName: String,
  groupPic: { type: String, default: "/uploads/groups/default.jpg" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isArchived: { type: Boolean, default: false },
});

conversationSchema.index({ participants: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

// ==============================
// 5. MESSAGES MODEL
// ==============================
const messageSchema = new mongoose.Schema({
  id_conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  id_sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  typeMessage: {
    type: String,
    enum: ["text", "image", "video", "audio", "file", "sticker"],
    default: "text",
  },
  content: String,
  media: String,
  isDeleted: { type: Boolean, default: false },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, enum: ["sent", "delivered", "seen"], default: "sent" },
  time: { type: Date, default: Date.now },
});

messageSchema.index({ id_conversation: 1, time: -1 });

const Message = mongoose.model("Message", messageSchema);

// ==============================
// 6. REACTIONS MODEL
// ==============================
const reactionSchema = new mongoose.Schema({
  id_message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },
  id_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

reactionSchema.index({ id_message: 1 });

const Reaction = mongoose.model("Reaction", reactionSchema);

// ==============================
// 7. MEDIA MODEL
// ==============================
const mediaSchema = new mongoose.Schema({
  id_message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },
  typeMedia: { type: String, enum: ["image", "video", "audio", "file"], required: true },
  url: { type: String, required: true },
  size: Number,
  dateAjout: { type: Date, default: Date.now },
});

const Media = mongoose.model("Media", mediaSchema);

// ==============================
// 8. CALLS MODEL
// ==============================
const callSchema = new mongoose.Schema({
  id_conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: false },
  id_caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  id_receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  typeCall: { type: String, enum: ["audio", "video"], required: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  duration: Number,
  status: {
    type: String,
    enum: ["missed", "rejected", "ongoing", "completed"],
    default: "ongoing",
  },
});

const Call = mongoose.model("Call", callSchema);

// ==============================
// 9. PARTICIPANTS CALL MODEL
// ==============================
const participantsCallSchema = new mongoose.Schema({
  id_call: { type: mongoose.Schema.Types.ObjectId, ref: "Call", required: true },
  id_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["en ligne", "déconnecté"], default: "en ligne" },
  isActive: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
});

const ParticipantsCall = mongoose.model("ParticipantsCall", participantsCallSchema);

// ==============================
// 10. NOTIFICATIONS MODEL
// ==============================
const notificationSchema = new mongoose.Schema({
  id_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["message", "appel", "autre"], required: true },
  id_message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model("Notification", notificationSchema);

// ==============================
// EXPORTS
// ==============================
module.exports = {
  User,
  UserSettings,
  Contact,
  Conversation,
  Message,
  Reaction,
  Media,
  Call,
  ParticipantsCall,
  Notification,
};
