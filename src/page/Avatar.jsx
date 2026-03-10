// ─────────────────────────────────────────────────────────────
//  Avatar.jsx  –  Shared avatar component
// ─────────────────────────────────────────────────────────────
import React from "react";
import { BG_COLORS, getInitials } from "../services/Messagehelpers.js";

export default function Avatar({ name = "", photoURL = null, size = 48 }) {
  const bg = BG_COLORS[(name.charCodeAt(0) ?? 0) % BG_COLORS.length];

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className="msg-avatar-img"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      className="msg-avatar-placeholder"
      style={{
        width: size, height: size,
        backgroundColor: bg,
        fontSize: size * 0.35,
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}