// ─────────────────────────────────────────────────────────────
//  useConversations.js  –  Real-time chat list from Firestore
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import {
  collection, onSnapshot,
  doc, getDoc, query, orderBy,
} from "firebase/firestore";
import { toDate } from "./messageHelpers";

/**
 * Returns { conversations, loading }
 *  conversations – array sorted newest-first
 *  loading       – true on first load
 */
export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    // ✅ FIX: Don't use orderBy on a mixed-type field (Timestamp vs number).
    //    We fetch all chats and sort in JS instead.
    const q = query(collection(db, "chats"));

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const chats = await Promise.all(
            snapshot.docs.map(async (chatDoc) => {
              const data = chatDoc.data();
              let scholarName = "Unknown Scholar";
              let photoURL    = null;
              let online      = false;

              if (data.userId) {
                try {
                  const snap = await getDoc(doc(db, "users", data.userId));
                  if (snap.exists()) {
                    const u = snap.data();
                    scholarName = u.displayName || u.name || u.email || scholarName;
                    photoURL    = u.photoURL || null;
                    online      = u.online   || false;
                  }
                } catch (_) { /* user fetch failed – keep defaults */ }
              }

              const lastMessageAt =
                toDate(data.lastMessageTime) ||
                toDate(data.createdAt)       ||
                new Date(0);

              return {
                id:          chatDoc.id,
                scholarId:   data.userId || null,
                scholarName,
                photoURL,
                online,
                lastMessage:    data.lastMessage || "",
                lastMessageAt,
                unreadCount:    data.unreadCount || 0,
              };
            })
          );

          // Sort newest-first in JS (safe for mixed Timestamp / number types)
          chats.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
          setConversations(chats);
        } catch (err) {
          console.error("useConversations error:", err.message);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Conversations snapshot error:", err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { conversations, loading };
}