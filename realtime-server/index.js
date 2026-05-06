/**
 * Mahdhi Portfolio — Realtime Server (Socket.IO)
 * Matches the exact event protocol in src/contexts/socketio.tsx
 */

const { Server } = require("socket.io");
const express = require("express");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── Config ───────────────────────────────────────────────────────────────────
function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional local env file.
  }
}

loadEnvFile(path.join(__dirname, "..", ".env.local"));
loadEnvFile(path.join(__dirname, ".env.local"));

const ADMIN_SECRET      = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
const MAX_MESSAGES      = 500;
const HISTORY_PAGE_SIZE = 50;

const COLORS = [
  "#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7",
  "#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9",
  "#F0A500","#00CED1","#FF8C69","#7EC8E3",
];
const ADJECTIVES = ["Cool","Fast","Smart","Bright","Swift","Calm","Bold","Keen","Sharp","Slick"];
const NOUNS      = ["Coder","Dev","Hacker","Builder","Creator","Maker","Ninja","Wizard","Crafter","Geek"];

// ─── In-Memory Store ──────────────────────────────────────────────────────────
const sessions    = new Map(); // sessionId  → sessionData
const socketToSid = new Map(); // socket.id  → sessionId
const messages    = [];        // ChatItem[]
const reactions   = new Map(); // messageId  → Reaction[]
let   msgCounter  = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomColor    = () => rnd(COLORS);
const randomUsername = () => `${rnd(ADJECTIVES)}${rnd(NOUNS)}${Math.floor(Math.random() * 99)}`;
const randomAvatar   = () => uuidv4().slice(0, 8);

function getFlagEmoji(code) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function getGeoLocation(ip) {
  return new Promise((resolve) => {
    const clean = (ip || "").replace("::ffff:", "").replace("::1", "").trim();
    if (!clean || clean === "127.0.0.1") {
      return resolve({ country: "Unknown", flag: "🌍", location: "Localhost" });
    }
    https.get(`https://ipapi.co/${clean}/json/`, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          const g = JSON.parse(raw);
          if (g.error) throw new Error(g.reason);
          resolve({
            country:  g.country_name || "Unknown",
            flag:     getFlagEmoji(g.country_code),
            location: g.city ? `${g.city}, ${g.country_name}` : g.country_name || "Unknown",
          });
        } catch {
          resolve({ country: "Unknown", flag: "🌍", location: "Unknown" });
        }
      });
    }).on("error", () => resolve({ country: "Unknown", flag: "🌍", location: "Unknown" }));
  });
}

function buildUserList() {
  const list = [];
  for (const [socketId, sessionId] of socketToSid) {
    const s = sessions.get(sessionId);
    if (!s) continue;
    list.push({
      id: sessionId, socketId,
      name: s.name, avatar: s.avatar, color: s.color,
      isOnline: true, location: s.location, flag: s.flag,
      lastSeen: new Date().toISOString(),
      createdAt: s.createdAt, isAdmin: s.isAdmin || false,
    });
  }
  return list;
}

function broadcastUsers() { io.emit("users-updated", buildUserList()); }

function reactionsRecord(msgIds) {
  const obj = {};
  for (const id of msgIds) { if (reactions.has(id)) obj[id] = reactions.get(id); }
  return obj;
}

// ─── Connection ───────────────────────────────────────────────────────────────
io.on("connection", async (socket) => {
  const { sessionId: existingSid } = socket.handshake.auth || {};
  const ip = (socket.handshake.headers["x-forwarded-for"] || "")
    .split(",")[0].trim() || socket.handshake.address;

  let sessionId, sessionData;
  if (existingSid && sessions.has(existingSid)) {
    sessionId   = existingSid;
    sessionData = sessions.get(sessionId);
  } else {
    sessionId   = uuidv4();
    const geo   = await getGeoLocation(ip);
    sessionData = {
      name: randomUsername(), avatar: randomAvatar(), color: randomColor(),
      location: geo.location, flag: geo.flag, country: geo.country,
      createdAt: new Date().toISOString(), isAdmin: false,
    };
    sessions.set(sessionId, sessionData);
  }

  socketToSid.set(socket.id, sessionId);
  console.log(`[+] ${socket.id} | session:${sessionId} | total:${socketToSid.size}`);

  // Bootstrap
  socket.emit("session", { sessionId });
  const recent = messages.slice(-HISTORY_PAGE_SIZE);
  socket.emit("msgs-receive-init", recent);
  socket.emit("reactions-init", reactionsRecord(recent.map((m) => m.id)));
  broadcastUsers();

  // System join message
  const joinMsg = {
    id: String(msgCounter++), type: "system", subtype: "join",
    sessionId, username: sessionData.name, flag: sessionData.flag,
    createdAt: new Date().toISOString(),
  };
  messages.push(joinMsg);
  if (messages.length > MAX_MESSAGES) messages.shift();
  io.emit("msg-receive", joinMsg);

  // cursor-change  →  cursor-changed
  socket.on("cursor-change", (data) => {
    socket.broadcast.emit("cursor-changed", { pos: data.pos, socketId: socket.id });
  });

  // typing-send  →  typing-receive
  socket.on("typing-send", (data) => {
    clearTimeout(socket._typingTimer);
    socket.broadcast.emit("typing-receive", {
      socketId: socket.id, username: data.username || sessionData.name, isTyping: true,
    });
    socket._typingTimer = setTimeout(() => {
      socket.broadcast.emit("typing-receive", {
        socketId: socket.id, username: sessionData.name, isTyping: false,
      });
    }, 3500);
  });

  // msg-send  →  msg-receive
  socket.on("msg-send", (data) => {
    const sid = socketToSid.get(socket.id);
    const s   = sessions.get(sid);
    if (!s) return;
    const now = Date.now();
    if (s._lastMsgAt && now - s._lastMsgAt < 800) {
      socket.emit("warning", { message: "Slow down! You're sending messages too fast." });
      return;
    }
    s._lastMsgAt = now;
    const content = String(data.content || "").slice(0, 500).trim();
    if (!content) return;
    const msg = {
      id: String(msgCounter++), sessionId: sid,
      flag: s.flag, country: s.country, username: s.name,
      avatar: s.avatar, color: s.color, content,
      createdAt: new Date().toISOString(),
      ...(data.replyTo ? { replyTo: data.replyTo } : {}),
    };
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    io.emit("msg-receive", msg);
  });

  // msg-edit  →  msg-update
  socket.on("msg-edit", (data) => {
    const sid = socketToSid.get(socket.id);
    const msg = messages.find(
      (m) => String(m.id) === String(data.id) && m.sessionId === sid && !("type" in m)
    );
    if (!msg) return;
    const content = String(data.content || "").slice(0, 500).trim();
    if (!content) return;
    msg.content = content;
    msg.editedAt = new Date().toISOString();
    io.emit("msg-update", { id: msg.id, content: msg.content, editedAt: msg.editedAt });
  });

  // msg-delete  →  msg-delete
  socket.on("msg-delete", (data) => {
    const sid = socketToSid.get(socket.id);
    const s   = sessions.get(sid);
    const idx = messages.findIndex(
      (m) => String(m.id) === String(data.id) && (m.sessionId === sid || s?.isAdmin)
    );
    if (idx === -1) return;
    messages.splice(idx, 1);
    io.emit("msg-delete", { id: data.id });
  });

  // msgs-fetch-history  →  msgs-receive-history
  socket.on("msgs-fetch-history", (data) => {
    const before = Number(data.before);
    const idx    = messages.findIndex((m) => Number(m.id) >= before);
    const start  = Math.max(0, idx - HISTORY_PAGE_SIZE);
    const slice  = idx > 0 ? messages.slice(start, idx) : [];
    socket.emit("msgs-receive-history", {
      messages: slice, hasMore: start > 0,
      reactions: reactionsRecord(slice.map((m) => m.id)),
    });
  });

  // reaction-toggle  →  reaction-update
  socket.on("reaction-toggle", (data) => {
    const sid   = socketToSid.get(socket.id);
    const msgId = String(data.messageId);
    const emoji = data.emoji;
    if (!reactions.has(msgId)) reactions.set(msgId, []);
    const rxns = reactions.get(msgId);
    const existing = rxns.find((r) => r.emoji === emoji);
    if (existing) {
      const i = existing.sessionIds.indexOf(sid);
      if (i > -1) {
        existing.sessionIds.splice(i, 1);
        if (existing.sessionIds.length === 0) rxns.splice(rxns.indexOf(existing), 1);
      } else {
        existing.sessionIds.push(sid);
      }
    } else {
      rxns.push({ emoji, sessionIds: [sid] });
    }
    if (rxns.length === 0) reactions.delete(msgId);
    io.emit("reaction-update", { messageId: msgId, reactions: reactions.get(msgId) || [] });
  });

  // admin-auth
  socket.on("admin-auth", (data) => {
    const submittedSecret = data?.secret || data?.password;
    if (ADMIN_SECRET && submittedSecret === ADMIN_SECRET) {
      const s = sessions.get(socketToSid.get(socket.id));
      if (s) { s.isAdmin = true; broadcastUsers(); }
    }
  });

  // disconnect
  socket.on("disconnect", () => {
    clearTimeout(socket._typingTimer);
    socket.broadcast.emit("typing-receive", {
      socketId: socket.id,
      username: sessions.get(socketToSid.get(socket.id))?.name || "Someone",
      isTyping: false,
    });
    socketToSid.delete(socket.id);
    console.log(`[-] ${socket.id} | total:${socketToSid.size}`);
    broadcastUsers();
  });
});

app.get("/health", (_, res) =>
  res.json({ status: "ok", connections: socketToSid.size, messages: messages.length })
);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Socket.IO server ready on port ${PORT}`));
