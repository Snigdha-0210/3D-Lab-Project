import { useState } from "react";
import "./Sidebar.css";

export default function Sidebar({ position = "left", title = "Panel", children }) {
  const [isClosed, setIsClosed] = useState(false);

  const handleClose = () => setIsClosed(true);
  const handleReopen = () => setIsClosed(false);

  if (isClosed) {
    return (
      <div className={`sidebar-toggle sidebar-toggle-${position}`} onClick={handleReopen}>
        <div className="sidebar-toggle-icon">{position === "left" ? "→" : "←"}</div>
        <div className="sidebar-toggle-text">{title}</div>
      </div>
    );
  }

  return (
    <div className={`sidebar sidebar-${position}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="sidebar-icon">🧪</span>
          {title}
        </div>
        <div className="sidebar-controls">
          <button className="control-btn close-btn" onClick={handleClose} title="Close">
            ×
          </button>
        </div>
      </div>
      <div className="sidebar-content">{children}</div>
    </div>
  );
}
