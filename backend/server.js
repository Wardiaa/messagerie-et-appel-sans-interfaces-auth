require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { User, Contact, Conversation, Message, Call } = require("./models");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users.routes");
const contactsRoutes = require("./routes/contacts.routes");
const convRoutes = require("./routes/conversations.routes");

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/conversations", convRoutes);

const PORT = process.env.PORT || 5000;

// connect DB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("mongo connected"))
  .catch(err => console.error("mongo err", err));

// socket.io real-time
const onlineUsers = new Map(); // userId -> socketId

io.on("connection", socket => {
  console.log("socket connected", socket.id);

  socket.on("user:online", userId => {
    onlineUsers.set(userId, socket.id);
    // notify others user is online
    socket.broadcast.emit("user:presence", { userId, status: "online" });
  });

  socket.on("disconnect", () => {
    // find disconnected user
    for (const [userId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user:presence", { userId, status: "offline" });
        break;
      }
    }
  });

  // friend request
  socket.on("friend:request", async ({ fromUser, toUser }) => {
    // save contact pending server-side
    try {
      const existing = await Contact.findOne({ id_user: fromUser, contactId: toUser });
      if (!existing) {
        const c = new Contact({ id_user: fromUser, contactId: toUser, status: "pending" });
        await c.save();
      }
    } catch (err) { console.error(err); }

    const toSocket = onlineUsers.get(toUser);
    if (toSocket) io.to(toSocket).emit("friend:request", { fromUser, toUser });
  });

  // friend response
  socket.on("friend:response", async ({ requesterId, responderId, action }) => {
    // action: accept|decline
    try {
      if (action === "accept") {
        const contact = await Contact.findOne({ id_user: requesterId, contactId: responderId });
        if (contact) {
          contact.status = "accepted";
          await contact.save();
        }
        const reciprocal = await Contact.findOne({ id_user: responderId, contactId: requesterId });
        if (!reciprocal) await new Contact({ id_user: responderId, contactId: requesterId, status: "accepted" }).save();
        else {
          reciprocal.status = "accepted";
          await reciprocal.save();
        }
      } else {
        await Contact.findOneAndDelete({ id_user: requesterId, contactId: responderId });
      }
    } catch (err) { console.error(err); }

    const reqSocket = onlineUsers.get(requesterId);
    if (reqSocket) {
      io.to(reqSocket).emit("friend:response", { requesterId, responderId, action });
    }
  });

  // messaging - FIXED VERSION
  socket.on("message:send", async ({ conversationId, senderId, content }) => {
    try {
      // Save message to database
      const msg = new Message({ 
        id_conversation: conversationId, 
        id_sender: senderId, 
        content,
        typeMessage: "text"
      });
      await msg.save();
      
      // Populate sender info
      await msg.populate("id_sender", "_id username firstname lastname photoProfil");
      
      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, { 
        lastMessage: msg._id, 
        lastActivity: Date.now() 
      });

      // Get conversation to find all participants
      const conv = await Conversation.findById(conversationId);
      
      // Send message to ALL participants including sender
      conv.participants.forEach(pid => {
        const sId = onlineUsers.get(pid.toString());
        if (sId) {
          io.to(sId).emit("message:receive", { 
            message: msg, 
            conversationId 
          });
        }
      });

    } catch (err) { 
      console.error("Error sending message:", err); 
    }
  });

 
// --- WEBRTC signaling for calls ---
  socket.on("call:offer", async ({ from, to, offer, typeCall, conversationId }) => {
    // create Call doc
    try {
      const call = new Call({ 
        id_conversation: conversationId, 
        id_caller: from, 
        id_receiver: to, 
        typeCall, 
        status: "ongoing" 
      });
      await call.save();
      
      const toSocket = onlineUsers.get(to);
      if (toSocket) {
        io.to(toSocket).emit("call:incoming", { 
          from, 
          to, 
          offer, 
          callId: call._id, 
          typeCall 
        });
      }
      
      // Send callId back to caller
      socket.emit("call:created", { callId: call._id });
    } catch (err) { 
      console.error(err); 
    }
  });

  socket.on("call:answer", async ({ to, answer, callId }) => {
    console.log("🔥 Received answer, routing to:", to);
    try {
      const call = await Call.findById(callId);
      if (!call) {
        console.log("❌ Call not found:", callId);
        return;
      }
      
      // Route answer to the caller (not receiver)
      const callerSocket = onlineUsers.get(to); // 'to' here is the caller's ID
      if (callerSocket) {
        console.log("✅ Forwarding answer to caller socket:", callerSocket);
        io.to(callerSocket).emit("call:answered", { callId, answer });
      } else {
        console.log("❌ Caller not online:", to);
      }
    } catch (err) { 
      console.error("❌ Error in call:answer:", err); 
    }
  });

  socket.on("call:ice", ({ to, candidate }) => {
    const sId = onlineUsers.get(to);
    if (sId) {
      io.to(sId).emit("call:ice", { candidate });
    }
  });

  socket.on("call:end", async ({ callId }) => {
    if (!callId) return;

    try {
      const call = await Call.findById(callId);
      if (!call) return;

      await Call.findByIdAndUpdate(callId, { 
        status: "completed", 
        endTime: new Date() 
      });

      const toSocket = onlineUsers.get(call.id_caller.toString());
      const recSocket = onlineUsers.get(call.id_receiver.toString());
      
      if (toSocket) io.to(toSocket).emit("call:ended", { callId });
      if (recSocket) io.to(recSocket).emit("call:ended", { callId });
    } catch (err) {
      console.error(err);
    }
  });

});

server.listen(PORT, () => console.log("server running on", PORT));