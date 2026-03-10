// ─────────────────────────────────────────────────────────────
//  messageHelpers.js  –  Pure utility / formatting functions
// ─────────────────────────────────────────────────────────────

export const BG_COLORS = [
  "#1e3a8a","#0369a1","#065f46",
  "#7c3aed","#be123c","#c2410c","#b45309",
];

export function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  if (value instanceof Date) return value;
  return null;
}

export function formatTime(date) {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export function formatDateLabel(date) {
  if (!date) return "Today";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return "Today";
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch { return "Today"; }
}

export function formatLastTime(date) {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return "";
    const diff = Date.now() - d.getTime();
    if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

/**
 * ✅ FIX: Added "messageText" — this is what the mobile app writes.
 * Order matters: check messageText and text first (most common).
 */
export function parseMessage(docSnap) {
  const data = docSnap.data();

  const text =
    (typeof data.messageText === "string" && data.messageText.trim() ? data.messageText : null) ||
    (typeof data.text        === "string" && data.text.trim()        ? data.text        : null) ||
    (typeof data.message     === "string" && data.message.trim()     ? data.message     : null) ||
    (typeof data.content     === "string" && data.content.trim()     ? data.content     : null) ||
    (typeof data.body        === "string" && data.body.trim()        ? data.body        : null) ||
    "";

  // ✅ FIX: also support role:"user" as the scholar indicator
  let sender;
  if (typeof data.isAdmin === "boolean") {
    sender = data.isAdmin ? "admin" : "scholar";
  } else if (data.sender === "admin" || data.role === "admin") {
    sender = "admin";
  } else {
    sender = "scholar";
  }

  const createdAt =
    toDate(data.timestamp) ||
    toDate(data.createdAt) ||
    toDate(data.time)      ||
    toDate(data.sentAt)    ||
    new Date(0);

  return { id: docSnap.id, text, sender, createdAt };
}

export function groupByDate(messages) {
  return messages.reduce((acc, msg) => {
    const label = formatDateLabel(msg.createdAt);
    if (!acc.length || acc[acc.length - 1].label !== label)
      acc.push({ label, msgs: [msg] });
    else
      acc[acc.length - 1].msgs.push(msg);
    return acc;
  }, []);
}