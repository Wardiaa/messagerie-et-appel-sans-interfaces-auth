import React, { useEffect, useState, useRef } from "react";
import API, { setToken } from "../services/api";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function Home({ auth }) {
  const { user, logout, token } = auth;

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  
  // Contacts
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  
  // Conversations
  const [conversations, setConversations] = useState([]);
  const [currentConv, setCurrentConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  
  // Calls
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [currentCallId, setCurrentCallId] = useState(null);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const socketRef = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesBuffer = useRef([]);
  const messagesEndRef = useRef(null);
  const currentConvRef = useRef(null);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  // Auto scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize socket and load data
  useEffect(() => {
    setToken(token);
    loadContacts();
    loadPendingRequests();
    loadConversations();

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      socket.emit("user:online", user._id);
    });

    socket.on("friend:request", async (payload) => {
      loadPendingRequests();
    });

    socket.on("friend:response", async (payload) => {
      if (payload.action === "accept") {
        loadContacts();
      }
    });

    socket.on("message:receive", ({ message, conversationId }) => {
      console.log("📨 Message received:", message, "for conversation:", conversationId);
      
      // Check if the message belongs to the currently open conversation
      if (currentConvRef.current && currentConvRef.current._id === conversationId) {
        console.log("✅ Adding message to current conversation");
        setMessages((prevMessages) => [...prevMessages, message]);
      } else {
        console.log("ℹ️ Message for different conversation");
      }
      
      // Always reload conversations to update sidebar
      loadConversations();
    });

    socket.on("call:created", ({ callId }) => {
      setCurrentCallId(callId);
    });

    socket.on("call:incoming", ({ from, offer, callId, typeCall }) => {
      setIncomingCall({ from, offer, callId, typeCall });
    });

    socket.on("call:answered", async ({ answer }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          for (const candidate of iceCandidatesBuffer.current) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding buffered ICE candidate:", err);
            }
          }
          iceCandidatesBuffer.current = [];
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }
    });

    socket.on("call:ice", async ({ candidate }) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesBuffer.current.push(candidate);
        }
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    });

    socket.on("call:ended", () => {
      cleanupCall();
    });

    return () => socket.disconnect();
  }, [token, user._id]);

  useEffect(() => {
    if (currentConv) {
      currentConvRef.current = currentConv;
      loadMessages(currentConv._id);
    }
  }, [currentConv]);

  // API calls
  const loadContacts = async () => {
    try {
      const { data } = await API.get("/contacts");
      setContacts(data);
    } catch (err) {
      console.error("Error loading contacts", err);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const { data } = await API.get("/contacts/pending");
      setPendingRequests(data);
    } catch (err) {
      console.error("Error loading pending requests", err);
    }
  };

  const loadConversations = async () => {
    try {
      const { data } = await API.get("/conversations");
      setConversations(data);
    } catch (err) {
      console.error("Error loading conversations", err);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const { data } = await API.get(`/conversations/${conversationId}/messages`);
      setMessages(data);
    } catch (err) {
      console.error("Error loading messages", err);
    }
  };

  const doSearch = async () => {
    try {
      const { data } = await API.get(`/users/search?q=${encodeURIComponent(query)}`);
      setResults(data.filter((u) => u._id !== user._id));
    } catch (err) {
      console.error("Search error", err);
    }
  };

  const sendRequest = async (toUser) => {
    try {
      await API.post("/contacts/request", { contactId: toUser._id });
      socketRef.current.emit("friend:request", { fromUser: user._id, toUser: toUser._id });
      alert("Request sent!");
      setShowSearch(false);
      setQuery("");
      setResults([]);
    } catch (err) {
      alert(err.response?.data?.error || "Error sending request");
    }
  };

  const respondRequest = async (request, action) => {
    try {
      await API.patch("/contacts/response", { 
        requesterId: request.id_user._id, 
        action 
      });
      socketRef.current.emit("friend:response", { 
        requesterId: request.id_user._id, 
        responderId: user._id, 
        action 
      });
      loadPendingRequests();
      if (action === "accept") {
        loadContacts();
      }
    } catch (err) {
      alert("Error responding to request");
    }
  };

  const openConversation = async (otherUser) => {
    try {
      const { data } = await API.post("/conversations/get-or-create", { 
        otherUserId: otherUser._id 
      });
      setCurrentConv(data);
      setActiveTab("chats"); // Switch to chats tab when opening conversation
      loadConversations();
    } catch (err) {
      console.error("Error opening conversation", err);
    }
  };

  const sendMessage = () => {
    if (!currentConv || !messageInput.trim()) return;
    
    socketRef.current.emit("message:send", { 
      conversationId: currentConv._id, 
      senderId: user._id, 
      content: messageInput 
    });
    
    // Don't add message locally - wait for socket response
    setMessageInput("");
  };

  // WebRTC calls
  const startCall = async (targetUser, typeCall = "video") => {
    setIsCalling(true);
    setRemoteUserId(targetUser._id);
    iceCandidatesBuffer.current = [];
    
    try {
      const constraints = typeCall === "video" 
        ? { video: { width: 640, height: 480 }, audio: true } 
        : { video: false, audio: true };
      
      const localStream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = localStream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      const configuration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      };
      
      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit("call:ice", { 
            to: targetUser._id, 
            candidate: e.candidate 
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit("call:offer", {
        from: user._id,
        to: targetUser._id,
        offer: pc.localDescription,
        typeCall,
        conversationId: null
      });
    } catch (err) {
      console.error("Error starting call:", err);
      alert("Could not start media: " + err.message);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    
    const { from, offer, typeCall, callId } = incomingCall;
    
    setCurrentCallId(callId);
    setIsCalling(true);
    setRemoteUserId(from);
    
    try {
      const constraints = typeCall === "video" 
        ? { video: { width: 640, height: 480 }, audio: true } 
        : { video: false, audio: true };
      
      const localStream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = localStream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      const configuration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      };
      
      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("call:ice", { 
            to: from, 
            candidate: event.candidate 
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      for (const candidate of iceCandidatesBuffer.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding buffered ICE candidate:", err);
        }
      }
      iceCandidatesBuffer.current = [];
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit("call:answer", { 
        to: from, 
        answer: pc.localDescription,
        callId 
      });
      
      setIncomingCall(null);
    } catch (err) {
      console.error("Error accepting call:", err);
      alert("Could not accept call: " + err.message);
      cleanupCall();
    }
  };

  const endCall = () => {
    if (currentCallId) {
      socketRef.current.emit("call:end", { callId: currentCallId });
    }
    cleanupCall();
  };

  const declineCall = () => {
    if (incomingCall?.callId) {
      socketRef.current.emit("call:end", { callId: incomingCall.callId });
    }
    setIncomingCall(null);
    iceCandidatesBuffer.current = [];
  };

  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    
    iceCandidatesBuffer.current = [];
    setIsCalling(false);
    setIncomingCall(null);
    setCurrentCallId(null);
    setRemoteUserId(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const getOtherUser = (conv) => {
    return conv.participants.find(p => p._id !== user._id);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column",
      background: "#FAE5E0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: "#FF8A80",
        padding: "12px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#FF6E67",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            fontSize: "16px"
          }}>
            {getInitials(user.username)}
          </div>
          <h3 style={{ margin: 0, color: "white", fontSize: "18px" }}>{user.username}</h3>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button 
            onClick={() => setShowSearch(!showSearch)}
            style={{
              background: "white",
              border: "none",
              borderRadius: "20px",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: "500",
              color: "#FF8A80"
            }}
          >
            🔍 Search
          </button>
          <button 
            onClick={() => { logout(); window.location.href = "/login"; }}
            style={{
              background: "#FF6E67",
              border: "none",
              borderRadius: "20px",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: "500",
              color: "white"
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar - Chats & Contacts */}
        <div style={{
          width: "380px",
          background: "white",
          borderRight: "1px solid #FFD1CC",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* Search Section */}
          {showSearch && (
            <div style={{
              padding: "16px",
              background: "#FFF5F3",
              borderBottom: "1px solid #FFD1CC"
            }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                  onKeyPress={(e) => e.key === "Enter" && doSearch()}
                  placeholder="Search users..." 
                  style={{ 
                    flex: 1, 
                    padding: "10px 16px", 
                    borderRadius: "20px", 
                    border: "1px solid #FFD1CC",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
                <button 
                  onClick={doSearch}
                  style={{
                    background: "#FF8A80",
                    color: "white",
                    border: "none",
                    borderRadius: "20px",
                    padding: "10px 20px",
                    cursor: "pointer",
                    fontWeight: "500"
                  }}
                >
                  Search
                </button>
              </div>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {results.map((u) => (
                  <div key={u._id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px",
                    borderRadius: "8px",
                    marginBottom: "6px",
                    background: "white"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "#FFB3AE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold"
                      }}>
                        {getInitials(u.username)}
                      </div>
                      <span style={{ fontWeight: "500" }}>{u.username}</span>
                    </div>
                    <button 
                      onClick={() => sendRequest(u)}
                      style={{
                        background: "#FF8A80",
                        color: "white",
                        border: "none",
                        borderRadius: "16px",
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontSize: "13px"
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div style={{
              padding: "16px",
              background: "#FFF5F3",
              borderBottom: "1px solid #FFD1CC"
            }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#FF6E67" }}>
                Friend Requests ({pendingRequests.length})
              </h4>
              {pendingRequests.map((req) => (
                <div key={req._id} style={{
                  padding: "12px",
                  background: "white",
                  borderRadius: "12px",
                  marginBottom: "8px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#FFB3AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "14px"
                    }}>
                      {getInitials(req.id_user.username)}
                    </div>
                    <strong style={{ fontSize: "14px" }}>{req.id_user.username}</strong>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      onClick={() => respondRequest(req, "accept")}
                      style={{
                        flex: 1,
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "500"
                      }}
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => respondRequest(req, "decline")}
                      style={{
                        flex: 1,
                        background: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "500"
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{
            display: "flex",
            borderBottom: "2px solid #FFD1CC",
            background: "white"
          }}>
            <div 
              onClick={() => setActiveTab("chats")}
              style={{
                flex: 1,
                padding: "12px",
                textAlign: "center",
                fontWeight: activeTab === "chats" ? "600" : "500",
                color: activeTab === "chats" ? "#FF8A80" : "#999",
                borderBottom: activeTab === "chats" ? "3px solid #FF8A80" : "none",
                cursor: "pointer"
              }}>
              Chats
            </div>
            <div 
              onClick={() => setActiveTab("contacts")}
              style={{
                flex: 1,
                padding: "12px",
                textAlign: "center",
                fontWeight: activeTab === "contacts" ? "600" : "500",
                color: activeTab === "contacts" ? "#FF8A80" : "#999",
                borderBottom: activeTab === "contacts" ? "3px solid #FF8A80" : "none",
                cursor: "pointer"
              }}>
              Contacts ({contacts.length})
            </div>
          </div>

          {/* Chat/Contact List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {activeTab === "chats" && (
              <>
                {/* Recent Conversations */}
                {conversations.map((conv) => {
                  const other = getOtherUser(conv);
                  return (
                    <div 
                      key={conv._id}
                      onClick={() => setCurrentConv(conv)}
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #FFD1CC",
                        cursor: "pointer",
                        background: currentConv?._id === conv._id ? "#FFF5F3" : "white",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <div style={{
                          width: "50px",
                          height: "50px",
                          borderRadius: "50%",
                          background: "#FFB3AE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: "bold",
                          fontSize: "18px"
                        }}>
                          {getInitials(other?.username)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: "600", 
                            fontSize: "15px",
                            marginBottom: "4px"
                          }}>
                            {other?.username || "Unknown"}
                          </div>
                          {conv.lastMessage && (
                            <div style={{ 
                              fontSize: "13px", 
                              color: "#666",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}>
                              {conv.lastMessage.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {conversations.length === 0 && (
                  <div style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#999"
                  }}>
                    <div style={{ fontSize: "50px", marginBottom: "10px" }}>💬</div>
                    <div>No conversations yet</div>
                    <div style={{ fontSize: "13px", marginTop: "5px" }}>
                      Start chatting with your contacts
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "contacts" && (
              <>
                {/* Contacts List */}
                {contacts.map((contact) => (
                  <div 
                    key={contact._id}
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid #FFD1CC",
                      background: "white"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "50px",
                          height: "50px",
                          borderRadius: "50%",
                          background: "#FFB3AE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: "bold",
                          fontSize: "18px"
                        }}>
                          {getInitials(contact.contactId.username)}
                        </div>
                        <div>
                          <div style={{ fontWeight: "600", fontSize: "15px" }}>
                            {contact.contactId.username}
                          </div>
                          <div style={{ fontSize: "12px", color: "#4CAF50" }}>
                            {contact.contactId.status || "Online"}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button 
                          onClick={() => openConversation(contact.contactId)}
                          style={{
                            background: "#FF8A80",
                            border: "none",
                            borderRadius: "50%",
                            width: "36px",
                            height: "36px",
                            cursor: "pointer",
                            fontSize: "16px"
                          }}
                        >
                          💬
                        </button>
                        <button 
                          onClick={() => startCall(contact.contactId, "audio")}
                          style={{
                            background: "#4CAF50",
                            border: "none",
                            borderRadius: "50%",
                            width: "36px",
                            height: "36px",
                            cursor: "pointer",
                            fontSize: "16px"
                          }}
                        >
                          📞
                        </button>
                        <button 
                          onClick={() => startCall(contact.contactId, "video")}
                          style={{
                            background: "#2196F3",
                            border: "none",
                            borderRadius: "50%",
                            width: "36px",
                            height: "36px",
                            cursor: "pointer",
                            fontSize: "16px"
                          }}
                        >
                          📹
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#999"
                  }}>
                    <div style={{ fontSize: "50px", marginBottom: "10px" }}>👥</div>
                    <div>No contacts yet</div>
                    <div style={{ fontSize: "13px", marginTop: "5px" }}>
                      Search and add friends to get started
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column",
          background: "#FAE5E0"
        }}>
          {currentConv ? (
            <>
              {/* Chat Header */}
              <div style={{
                padding: "16px 20px",
                background: "white",
                borderBottom: "1px solid #FFD1CC",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                <div style={{
                  width: "45px",
                  height: "45px",
                  borderRadius: "50%",
                  background: "#FFB3AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "18px"
                }}>
                  {getInitials(getOtherUser(currentConv)?.username)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>
                    {getOtherUser(currentConv)?.username || "Unknown"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#4CAF50" }}>Online</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    onClick={() => startCall(getOtherUser(currentConv), "audio")}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "24px"
                    }}
                  >
                    📞
                  </button>
                  <button 
                    onClick={() => startCall(getOtherUser(currentConv), "video")}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "24px"
                    }}
                  >
                    📹
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {messages.map((m, i) => {
                  const isMe = m.id_sender._id === user._id || m.id_sender === user._id;
                  return (
                    <div 
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start"
                      }}
                    >
                      <div style={{
                        maxWidth: "60%",
                        padding: "10px 14px",
                        borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: isMe ? "#FF8A80" : "white",
                        color: isMe ? "white" : "#333",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        wordBreak: "break-word"
                      }}>
                        <div style={{ fontSize: "15px", lineHeight: "1.4" }}>
                          {m.content}
                        </div>
                        <div style={{ 
                          fontSize: "11px", 
                          marginTop: "4px",
                          opacity: 0.7,
                          textAlign: "right"
                        }}>
                          {formatTime(m.time)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div style={{
                padding: "16px 20px",
                background: "white",
                borderTop: "1px solid #FFD1CC",
                display: "flex",
                gap: "12px",
                alignItems: "center"
              }}>
                <input 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: "24px",
                    border: "1px solid #FFD1CC",
                    outline: "none",
                    fontSize: "15px",
                    background: "#FFF5F3"
                  }}
                />
                <button 
                  onClick={sendMessage}
                  style={{
                    background: "#FF8A80",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "48px",
                    height: "48px",
                    cursor: "pointer",
                    fontSize: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  ➤
                </button>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#FF8A80",
              fontSize: "18px"
            }}>
              <div style={{ fontSize: "80px", marginBottom: "20px" }}>💬</div>
              <div style={{ fontWeight: "500" }}>Select a chat to start messaging</div>
              <div style={{ fontSize: "14px", color: "#999", marginTop: "8px" }}>
                Choose from your contacts or recent conversations
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && !isCalling && (
        <div style={{ 
          position: "fixed", 
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            padding: "40px",
            borderRadius: "24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            textAlign: "center",
            minWidth: "320px"
          }}>
            <div style={{ fontSize: "60px", marginBottom: "20px" }}>📞</div>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "22px", color: "#333" }}>
              Incoming Call
            </h3>
            <p style={{ margin: "0 0 30px 0", fontSize: "16px", color: "#666" }}>
              {incomingCall.typeCall === "video" ? "📹 Video" : "🎙️ Audio"} call from user {incomingCall.from}
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button 
                onClick={acceptCall}
                style={{
                  padding: "14px 32px",
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "30px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "600",
                  boxShadow: "0 4px 12px rgba(76, 175, 80, 0.3)"
                }}
              >
                ✅ Accept
              </button>
              <button 
                onClick={declineCall}
                style={{
                  padding: "14px 32px",
                  background: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "30px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "600",
                  boxShadow: "0 4px 12px rgba(244, 67, 54, 0.3)"
                }}
              >
                ❌ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Modal */}
      {isCalling && (
        <div style={{ 
          position: "fixed", 
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(135deg, #FF6E67 0%, #FF8A80 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <h3 style={{ color: "white", marginBottom: "30px", fontSize: "24px" }}>
            📞 Active Call
          </h3>
          
          <div style={{ 
            display: "flex", 
            gap: "30px", 
            marginBottom: "30px",
            flexWrap: "wrap",
            justifyContent: "center"
          }}>
            {/* Local Video */}
            <div style={{ position: "relative" }}>
              <div style={{
                background: "rgba(255,255,255,0.1)",
                padding: "8px 16px",
                borderRadius: "12px 12px 0 0",
                color: "white",
                fontSize: "14px",
                fontWeight: "500",
                textAlign: "center"
              }}>
                You
              </div>
              <div style={{ position: "relative" }}>
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ 
                    width: "360px", 
                    height: "270px", 
                    background: "#000",
                    borderRadius: "0 0 16px 16px",
                    objectFit: "cover",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                  }} 
                />
                {isVideoOff && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "60px",
                    borderRadius: "0 0 16px 16px"
                  }}>
                    📷
                  </div>
                )}
              </div>
            </div>

            {/* Remote Video */}
            <div>
              <div style={{
                background: "rgba(255,255,255,0.1)",
                padding: "8px 16px",
                borderRadius: "12px 12px 0 0",
                color: "white",
                fontSize: "14px",
                fontWeight: "500",
                textAlign: "center"
              }}>
                Remote User
              </div>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                style={{ 
                  width: "360px", 
                  height: "270px", 
                  background: "#000",
                  borderRadius: "0 0 16px 16px",
                  objectFit: "cover",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                }} 
              />
            </div>
          </div>
          
          {/* Call Controls */}
          <div style={{ 
            display: "flex", 
            gap: "16px",
            background: "rgba(0,0,0,0.3)",
            padding: "20px 30px",
            borderRadius: "50px",
            backdropFilter: "blur(10px)"
          }}>
            <button 
              onClick={toggleMute}
              style={{ 
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: "none",
                background: isMuted ? "#f44336" : "rgba(255,255,255,0.9)",
                color: isMuted ? "white" : "#333",
                cursor: "pointer",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                transition: "all 0.3s"
              }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🎤"}
            </button>
            
            <button 
              onClick={toggleVideo}
              style={{ 
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: "none",
                background: isVideoOff ? "#f44336" : "rgba(255,255,255,0.9)",
                color: isVideoOff ? "white" : "#333",
                cursor: "pointer",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                transition: "all 0.3s"
              }}
              title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
            >
              {isVideoOff ? "📷" : "📹"}
            </button>

            <button 
              onClick={endCall}
              style={{ 
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                border: "none",
                background: "#f44336",
                color: "white",
                cursor: "pointer",
                fontSize: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(244, 67, 54, 0.4)",
                transition: "all 0.3s"
              }}
              title="End Call"
            >
              📞
            </button>
          </div>
        </div>
      )}
    </div>
  );
}