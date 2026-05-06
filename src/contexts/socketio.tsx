"use client";
import React, {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@/components/ui/use-toast";
import { usePathname } from "next/navigation";

export type User = {
  id: string;
  socketId: string;
  name: string;
  avatar: string;
  color: string;
  isOnline: boolean;
  location: string;
  flag: string;
  lastSeen: string;
  createdAt: string;
  isAdmin?: boolean;
};
export type Message = {
  id: string;
  sessionId: string;
  flag: string;
  country: string;
  username: string;
  avatar: string;
  color?: string;
  content: string;
  createdAt: string | Date;
  editedAt?: string | Date;
  replyTo?: { id: string; username: string; content: string };
};

export type SystemMessage = {
  id: string;
  type: "system";
  subtype: "join";
  sessionId: string;
  username: string;
  flag: string;
  createdAt: string | Date;
};

export type ChatItem = Message | SystemMessage;

export type Reaction = { emoji: string; sessionIds: string[] };

export type UserProfile = { name: string; avatar: string; color: string; isAdmin?: boolean };

export type CursorPosition = { x: number; y: number };

type SocketContextType = {
  socket: Socket | null;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  msgs: ChatItem[];
  reactions: Map<string, Reaction[]>;
  profileMap: Map<string, UserProfile>;
  cursorPositions: Map<string, CursorPosition>;
  focusedCursorId: string | null;
  setFocusedCursorId: Dispatch<SetStateAction<string | null>>;
  hasMoreMessages: boolean;
  loadingHistory: boolean;
  fetchOlderMessages: () => void;
};

const INITIAL_STATE: SocketContextType = {
  socket: null,
  users: [],
  setUsers: () => { },
  msgs: [],
  reactions: new Map(),
  profileMap: new Map(),
  cursorPositions: new Map(),
  focusedCursorId: null,
  setFocusedCursorId: () => { },
  hasMoreMessages: true,
  loadingHistory: false,
  fetchOlderMessages: () => { },
};

export const SocketContext = createContext<SocketContextType>(INITIAL_STATE);

const SESSION_ID_KEY = "portfolio-site-session-id";

const SocketContextProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [msgs, setMsgs] = useState<ChatItem[]>([]);
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());
  const [profileMap, setProfileMap] = useState<Map<string, UserProfile>>(new Map());
  const [cursorPositions, setCursorPositions] = useState<Map<string, CursorPosition>>(new Map());
  const [focusedCursorId, setFocusedCursorId] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchOlderMessages = useCallback(() => {
    const s = socketRef.current;
    if (!s || loadingHistory || !hasMoreMessages) return;
    setMsgs(current => {
      if (current.length === 0) return current;
      const oldestId = Number(current[0].id);
      if (!oldestId) return current;
      setLoadingHistory(true);
      s.emit("msgs-fetch-history", { before: oldestId });
      return current;
    });
  }, [loadingHistory, hasMoreMessages]);

  // Keep profileMap in sync — only adds/updates, never removes
  useEffect(() => {
    if (users.length === 0) return;
    setProfileMap(prev => {
      const next = new Map(prev);
      for (const u of users) {
        next.set(u.id, { name: u.name, avatar: u.avatar, color: u.color, isAdmin: u.isAdmin });
      }
      return next;
    });
  }, [users]);
  const { toast } = useToast();

  // SETUP SOCKET.IO
  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    let active = true;

    async function connectSocket() {
      let websocketUrl = process.env.NEXT_PUBLIC_WS_URL || "";
      try {
        const response = await fetch("/api/public-settings", { cache: "no-store" });
        if (response.ok) {
          const settings = (await response.json()) as { websocketUrl?: string };
          websocketUrl = settings.websocketUrl || websocketUrl;
        }
      } catch {
        // Keep the environment fallback when runtime settings are unavailable.
      }

      if (!active || !websocketUrl) return;

      const newSocket = io(websocketUrl, {
        auth: {
          sessionId: localStorage.getItem(SESSION_ID_KEY),
        },
      });
      setSocket(newSocket);
      socketRef.current = newSocket;
      newSocket.on("connect", () => { });
      newSocket.on("connect_error", (err) => {
        console.warn("Socket connection unavailable:", err.message);
      });
      newSocket.on("disconnect", (reason) => {
        // Reconnect on server-initiated disconnect and network drops.
        // "io client disconnect" means the user explicitly called .disconnect(), so skip that.
        if (reason !== "io client disconnect") {
          newSocket.connect();
        }
      });
      newSocket.on("users-updated", (data: User[]) => {
        setUsers(data);
      });
      newSocket.on("cursor-changed", (data: { pos: { x: number; y: number }; socketId: string }) => {
        setCursorPositions(prev => {
          const next = new Map(prev);
          next.set(data.socketId, data.pos);
          return next;
        });
      });
      newSocket.on("msgs-receive-init", (msgs) => {
        setMsgs(msgs);
        setHasMoreMessages(true);
      });
      newSocket.on("msgs-receive-history", (data: { messages: ChatItem[]; hasMore: boolean; reactions: Record<string, Reaction[]> }) => {
        setMsgs(prev => [...data.messages, ...prev]);
        setHasMoreMessages(data.hasMore);
        setLoadingHistory(false);
        if (data.reactions) {
          setReactions(prev => {
            const next = new Map(prev);
            for (const [msgId, rxns] of Object.entries(data.reactions)) {
              if (rxns.length === 0) next.delete(msgId);
              else next.set(msgId, rxns);
            }
            return next;
          });
        }
      });
      newSocket.on("session", ({ sessionId }) => {
        localStorage.setItem(SESSION_ID_KEY, (sessionId));
      });

      newSocket.on("msg-receive", (msgs) => {
        setMsgs((p) => [...p, msgs]);
      });

      newSocket.on("warning", (data: { message: string }) => {
        toast({
          variant: "destructive",
          title: "System Warning",
          description: data.message,
        });
      });

      newSocket.on("msg-delete", (data: { id: string | number }) => {
        setMsgs((prev) => prev.filter((m) => String(m.id) !== String(data.id)));
      });

      newSocket.on("msg-update", (data: { id: string; content: string; editedAt: string }) => {
        setMsgs((prev) => prev.map((m) =>
          String(m.id) === String(data.id) && (!("type" in m) || !m.type)
            ? { ...m, content: data.content, editedAt: data.editedAt }
            : m
        ));
      });

      newSocket.on("reactions-init", (data: Record<string, Reaction[]>) => {
        setReactions(new Map(Object.entries(data)));
      });
      newSocket.on("reaction-update", (data: { messageId: string; reactions: Reaction[] }) => {
        setReactions(prev => {
          const next = new Map(prev);
          if (data.reactions.length === 0) next.delete(data.messageId);
          else next.set(data.messageId, data.reactions);
          return next;
        });
      });
    }

    connectSocket();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <SocketContext.Provider value={{ socket, users, setUsers, msgs, reactions, profileMap, cursorPositions, focusedCursorId, setFocusedCursorId, hasMoreMessages, loadingHistory, fetchOlderMessages }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContextProvider;
