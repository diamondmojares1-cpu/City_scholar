import React, { useState, useRef, useEffect } from "react";
import SidebarSuper from "../../components/SidebarSuper";
import {
  FaEllipsisV, FaPaperPlane, FaComments, FaReply, FaTrash,
  FaThumbtack, FaSmile, FaTimes, FaSearch, FaPhone, FaVideo,
  FaInfoCircle, FaUserCircle, FaEnvelope, FaMapMarkerAlt,
  FaGraduationCap, FaIdCard, FaChevronDown, FaExclamationTriangle,
} from "react-icons/fa";
import "../../css/MessagesInquiries.css";
import { db } from "../../firebase/firebaseConfig";
import { doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { formatTime, formatLastTime, groupByDate } from "../../services/Messagehelpers.js";
import { useConversations } from "../../services/Useconversations.js";
import { useMessages } from "../../services/Usemessages.js";
import Avatar from "../../page/Avatar.jsx";

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="msg-delete-overlay" onClick={onCancel}>
      <div className="msg-delete-modal" onClick={e => e.stopPropagation()}>
        <div className="msg-delete-icon-wrap">
          <FaTrash className="msg-delete-icon" />
        </div>
        <h3 className="msg-delete-title">Delete Message?</h3>
        <p className="msg-delete-msg">
          This message will be permanently deleted and cannot be recovered.
        </p>
        <div className="msg-delete-btns">
          <button className="msg-delete-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="msg-delete-confirm" onClick={onConfirm}>
            <FaTrash /> Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile Popup ─────────────────────────────────────────────
function ProfilePopup({ scholar, onClose }) {
  if (!scholar) return null;
  return (
    <div className="msg-profile-overlay" onClick={onClose}>
      <div className="msg-profile-popup" onClick={e => e.stopPropagation()}>
        <button className="msg-profile-close" onClick={onClose}><FaTimes /></button>
        <div className="msg-profile-header">
          <div className="msg-profile-avatar-wrap">
            <Avatar name={scholar.scholarName} photoURL={scholar.photoURL} size={72} />
            <span className={`msg-profile-status-dot ${scholar.online ? "" : "offline"}`} />
          </div>
          <h3 className="msg-profile-name">{scholar.scholarName || "—"}</h3>
          <span className={`msg-profile-badge ${scholar.online ? "online" : "offline"}`}>
            {scholar.online ? "Online" : "Offline"}
          </span>
        </div>
        <div className="msg-profile-details">
          <div className="msg-profile-row">
            <FaEnvelope className="msg-profile-icon" />
            <div>
              <span className="msg-profile-label">Email</span>
              <span className="msg-profile-value">{scholar.email || "—"}</span>
            </div>
          </div>
          <div className="msg-profile-row">
            <FaGraduationCap className="msg-profile-icon" />
            <div>
              <span className="msg-profile-label">Course</span>
              <span className="msg-profile-value">{scholar.course || "—"}</span>
            </div>
          </div>
          <div className="msg-profile-row">
            <FaIdCard className="msg-profile-icon" />
            <div>
              <span className="msg-profile-label">Year Level</span>
              <span className="msg-profile-value">{scholar.yearLevel || "—"}</span>
            </div>
          </div>
          <div className="msg-profile-row">
            <FaMapMarkerAlt className="msg-profile-icon" />
            <div>
              <span className="msg-profile-label">Barangay</span>
              <span className="msg-profile-value">{scholar.barangay || "—"}</span>
            </div>
          </div>
          <div className="msg-profile-row">
            <FaUserCircle className="msg-profile-icon" />
            <div>
              <span className="msg-profile-label">Status</span>
              <span className="msg-profile-value">{scholar.scholarshipStatus || scholar.applicationStatus || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function MessagesinquiriesSuper() {
  const [selected,       setSelected]       = useState(null);
  const [inputText,      setInputText]      = useState("");
  const [search,         setSearch]         = useState("");
  const [replyTo,        setReplyTo]        = useState(null);
  const [contextMenu,    setContextMenu]    = useState(null);
  const [pinnedMsgs,     setPinnedMsgs]     = useState([]);
  const [showPinned,     setShowPinned]     = useState(false);
  const [showProfile,    setShowProfile]    = useState(false);
  const [showEmojiPick,  setShowEmojiPick]  = useState(false);
  // ✅ NEW: delete confirm state
  const [deleteTarget,   setDeleteTarget]   = useState(null); // msg to delete

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const { conversations, loading } = useConversations();
  const { messages, sending, sendMessage } = useMessages(selected);

  const EMOJIS = ["😊","😂","❤️","👍","🔥","😢","😮","🎉","👏","🙏","😎","💯"];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const handleSelect = async (conv) => {
    setSelected(conv);
    setReplyTo(null);
    if (conv.unreadCount > 0) {
      try { await updateDoc(doc(db, "chats", conv.id), { unreadCount: 0 }); } catch (_) {}
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    setReplyTo(null);
    await sendMessage(text, replyTo ? { id: replyTo.id, text: replyTo.text, sender: replyTo.sender } : null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") { setReplyTo(null); }
  };

  const handleRightClick = (e, msg) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

  // ✅ Instead of deleting directly, show confirm modal
  const requestDelete = (msg) => {
    setDeleteTarget(msg);
    setContextMenu(null);
  };

  // ✅ Actual delete — called after user confirms
  const confirmDelete = async () => {
    if (!selected || !deleteTarget) return;
    try {
      await deleteDoc(doc(db, "chats", selected.id, "messages", deleteTarget.id));
    } catch (err) {
      console.error("Delete msg error:", err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePin = (msg) => {
    setPinnedMsgs(prev =>
      prev.find(p => p.id === msg.id)
        ? prev.filter(p => p.id !== msg.id)
        : [{ ...msg, pinned: true }, ...prev]
    );
  };

  const handleEmojiClick = (emoji) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPick(false);
    inputRef.current?.focus();
  };

  const filtered      = conversations.filter(c =>
    c.scholarName.toLowerCase().includes(search.toLowerCase())
  );
  const grouped       = groupByDate(messages);
  const pinnedInConv  = pinnedMsgs.filter(p => messages.find(m => m.id === p.id));

  return (
    <div className="msg-wrapper" onClick={() => setContextMenu(null)}>
      <SidebarSuper activePage="messages-inquiries" />

      <div className="msg-main">
        <div className="msg-body">

          {/* ── LEFT PANEL ── */}
          <div className="msg-left-panel">
            <div className="msg-left-header">
              <h2 className="msg-left-title">Messages</h2>
            </div>

            <div className="msg-search-wrap">
              <FaSearch className="msg-search-ico" />
              <input
                className="msg-search-input"
                placeholder="Search conversations…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="msg-recent-avatars">
              {filtered.slice(0, 8).map(conv => (
                <div
                  key={conv.id}
                  className={`msg-avatar-wrap ${selected?.id === conv.id ? "active" : ""}`}
                  onClick={() => handleSelect(conv)}
                  title={conv.scholarName}
                >
                  <Avatar name={conv.scholarName} photoURL={conv.photoURL} size={44} />
                  <span className={`msg-online-dot ${conv.online ? "" : "offline"}`} />
                </div>
              ))}
            </div>

            <div className="msg-list-label">All Conversations</div>

            <div className="msg-chat-list-card">
              {loading
                ? <div className="msg-chat-empty">Loading…</div>
                : filtered.length === 0
                  ? <div className="msg-chat-empty">No conversations found.</div>
                  : filtered.map(conv => (
                    <div
                      key={conv.id}
                      className={`msg-chat-item ${selected?.id === conv.id ? "active" : ""}`}
                      onClick={() => handleSelect(conv)}
                    >
                      <div className="msg-chat-item-avatar">
                        <Avatar name={conv.scholarName} photoURL={conv.photoURL} size={42} />
                        <span className={`msg-online-dot ${conv.online ? "" : "offline"}`} />
                      </div>
                      <div className="msg-chat-item-info">
                        <div className="msg-chat-item-name">{conv.scholarName}</div>
                        <div className="msg-chat-item-preview">{conv.lastMessage || "No messages yet"}</div>
                      </div>
                      <div className="msg-chat-item-meta">
                        <span className="msg-chat-item-time">{formatLastTime(conv.lastMessageAt)}</span>
                        {conv.unreadCount > 0 && (
                          <span className="msg-unread-badge">{conv.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="msg-right-panel">
            {!selected ? (
              <div className="msg-no-chat">
                <FaComments className="msg-no-chat-icon" />
                <p>Select a conversation to start chatting</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="msg-chat-header">
                  <div
                    className="msg-chat-header-avatar"
                    onClick={() => setShowProfile(true)}
                    title="View profile"
                    style={{ cursor: "pointer" }}
                  >
                    <Avatar name={selected.scholarName} photoURL={selected.photoURL} size={40} />
                    <span className={`msg-online-dot ${selected.online ? "" : "offline"}`} />
                  </div>
                  <div className="msg-chat-header-info" onClick={() => setShowProfile(true)} style={{ cursor: "pointer" }}>
                    <div className="msg-chat-header-name">{selected.scholarName}</div>
                    <div className={`msg-chat-header-status ${selected.online ? "" : "offline"}`}>
                      {selected.online ? "● Online" : "○ Offline"}
                    </div>
                  </div>
                  <div className="msg-chat-header-actions">
                    {pinnedInConv.length > 0 && (
                      <button
                        className="msg-header-btn"
                        onClick={() => setShowPinned(p => !p)}
                        title="Pinned messages"
                      >
                        <FaThumbtack />
                        <span className="msg-pin-count">{pinnedInConv.length}</span>
                      </button>
                    )}
                    <button className="msg-header-btn" onClick={() => setShowProfile(true)} title="Profile">
                      <FaInfoCircle />
                    </button>
                  </div>
                </div>

                {/* Pinned Bar */}
                {showPinned && pinnedInConv.length > 0 && (
                  <div className="msg-pinned-bar">
                    <FaThumbtack className="msg-pinned-icon" />
                    <div className="msg-pinned-list">
                      {pinnedInConv.map(p => (
                        <div key={p.id} className="msg-pinned-item">
                          <span className="msg-pinned-sender">{p.sender === "admin" ? "You" : selected.scholarName}:</span>
                          <span className="msg-pinned-text">{p.text}</span>
                        </div>
                      ))}
                    </div>
                    <button className="msg-pinned-close" onClick={() => setShowPinned(false)}><FaTimes /></button>
                  </div>
                )}

                {/* Messages */}
                <div className="msg-chat-messages">
                  {messages.length === 0
                    ? <div className="msg-no-messages">No messages yet. Say hello! 👋</div>
                    : grouped.map((group, gi) => (
                      <React.Fragment key={gi}>
                        <div className="msg-date-divider"><span>{group.label}</span></div>
                        {group.msgs.map(msg => {
                          const isOut    = msg.sender === "admin";
                          const isPinned = pinnedMsgs.find(p => p.id === msg.id);
                          return (
                            <div
                              key={msg.id}
                              className={`msg-bubble-row ${isOut ? "outgoing" : ""} ${isPinned ? "msg-bubble-pinned" : ""}`}
                              onContextMenu={(e) => handleRightClick(e, msg)}
                            >
                              {!isOut && (
                                <Avatar name={selected.scholarName} photoURL={selected.photoURL} size={28} />
                              )}
                              <div className="msg-bubble-wrap">
                                {msg.replyTo && (
                                  <div className="msg-reply-preview">
                                    <span className="msg-reply-preview-name">
                                      {msg.replyTo.sender === "admin" ? "You" : selected.scholarName}
                                    </span>
                                    <span className="msg-reply-preview-text">{msg.replyTo.text}</span>
                                  </div>
                                )}
                                <div className={`msg-bubble ${isOut ? "outgoing" : "incoming"}`}>
                                  {isPinned && <FaThumbtack className="msg-pin-indicator" />}
                                  {msg.text}
                                  <span className="msg-bubble-time">{formatTime(msg.createdAt)}</span>
                                </div>
                                {/* Hover actions */}
                                <div className={`msg-bubble-actions ${isOut ? "left" : "right"}`}>
                                  <button onClick={() => setReplyTo(msg)} title="Reply"><FaReply /></button>
                                  <button onClick={() => handlePin(msg)} title="Pin"><FaThumbtack /></button>
                                  {isOut && (
                                    <button
                                      onClick={() => requestDelete(msg)}
                                      title="Delete"
                                      className="msg-act-delete"
                                    >
                                      <FaTrash />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))
                  }
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Bar */}
                {replyTo && (
                  <div className="msg-reply-bar">
                    <div className="msg-reply-bar-content">
                      <FaReply className="msg-reply-bar-icon" />
                      <div>
                        <span className="msg-reply-bar-name">
                          Replying to {replyTo.sender === "admin" ? "yourself" : selected.scholarName}
                        </span>
                        <span className="msg-reply-bar-text">{replyTo.text}</span>
                      </div>
                    </div>
                    <button className="msg-reply-bar-close" onClick={() => setReplyTo(null)}><FaTimes /></button>
                  </div>
                )}

                {/* Input Row */}
                <div className="msg-input-row">
                  <div className="msg-input-wrap">
                    <button
                      className="msg-emoji-btn"
                      onClick={() => setShowEmojiPick(p => !p)}
                      title="Emoji"
                    >
                      <FaSmile />
                    </button>
                    {showEmojiPick && (
                      <div className="msg-emoji-picker">
                        {EMOJIS.map(e => (
                          <button key={e} className="msg-emoji-item" onClick={() => handleEmojiClick(e)}>{e}</button>
                        ))}
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      className="msg-input-box"
                      placeholder="Type a message…"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      className="msg-send-btn"
                      onClick={handleSend}
                      disabled={!inputText.trim() || sending}
                      title="Send"
                    >
                      <FaPaperPlane />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Context Menu (right-click) ── */}
      {contextMenu && (
        <div
          className="msg-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); }}>
            <FaReply /> Reply
          </button>
          <button onClick={() => { handlePin(contextMenu.msg); setContextMenu(null); }}>
            <FaThumbtack /> {pinnedMsgs.find(p => p.id === contextMenu.msg.id) ? "Unpin" : "Pin"}
          </button>
          {contextMenu.msg.sender === "admin" && (
            <button className="msg-menu-delete" onClick={() => requestDelete(contextMenu.msg)}>
              <FaTrash /> Delete
            </button>
          )}
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Profile Popup ── */}
      {showProfile && (
        <ProfilePopup scholar={selected} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}