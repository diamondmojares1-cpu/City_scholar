// ─────────────────────────────────────────────────────────────
//  useMessages.js  –  Real-time messages for one chat
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/firebaseConfig";
import {
  collection, onSnapshot,
  addDoc, updateDoc, doc,
  serverTimestamp,
} from "firebase/firestore";
import { parseMessage } from "./messageHelpers";

export function useMessages(selectedConv) {
  const [messages, setMessages] = useState([]);
  const [sending,  setSending]  = useState(false);
  const unsubRef                = useRef(null);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setMessages([]);

    if (!selectedConv?.id) return;

    const msgRef = collection(db, "chats", selectedConv.id, "messages");

    const unsub = onSnapshot(
      msgRef,
      (snapshot) => {
        const msgs = snapshot.docs
          .map(parseMessage)
          .filter((m) => m.text !== "")
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        setMessages(msgs);
      },
      (err) => console.error("[useMessages] error:", err.code, err.message)
    );

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    };
  }, [selectedConv?.id]);

  const sendMessage = async (text) => {
    if (!text?.trim() || !selectedConv?.id || sending) return;
    setSending(true);
    const now = Date.now();
    try {
      await addDoc(collection(db, "chats", selectedConv.id, "messages"), {
        messageText: text,   // ✅ matches mobile app's field name
        text,                // legacy admin field
        message:    text,    // extra alias
        sender:     "admin",
        role:       "admin",
        isAdmin:    true,
        senderId:   "admin",
        senderName: "Admin",
        timestamp:  now,
        createdAt:  serverTimestamp(),
      });
      await updateDoc(doc(db, "chats", selectedConv.id), {
        lastMessage:     text,
        lastMessageTime: serverTimestamp(),
      });
    } catch (err) {
      console.error("[useMessages] send error:", err.code, err.message);
    } finally {
      setSending(false);
    }
  };

  return { messages, sending, sendMessage };
}