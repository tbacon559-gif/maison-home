// ─── Small reusable components ────────────────────────────────────

export function Checkbox({ done }) {
  return (
    <div className={`checkbox ${done ? 'done' : ''} flex items-center justify-center`}>
      {done && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#FDF7F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function EditToggle({ editing, onClick }) {
  return (
    <button onClick={onClick} className="font-display rose tracking-[0.2em] uppercase text-[9px] nav-btn" style={{ fontWeight: 500 }}>
      {editing ? 'Done' : '✎ Edit'}
    </button>
  );
}

export function SectionHead({ label, editing, onToggle }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">{label}</span>
      {onToggle && <EditToggle editing={editing} onClick={onToggle} />}
    </div>
  );
}

export function Styles() {
  return (
    <style>{`
      .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
      .font-body { font-family: 'DM Sans', system-ui, sans-serif; }

      .rose       { color: #B8857B; }
      .rose-deep  { color: #8B5A4F; }
      .ink        { color: #2A241D; }
      .muted      { color: #8E7B6E; }
      .cream-bg   { background: #FBF3EC; }
      .cream-card { background: #FDF7F1; }
      .hairline   { border-color: rgba(184, 133, 123, 0.20); }
      .border-soft{ border: 1px solid rgba(184, 133, 123, 0.16); }

      .app-shadow {
        box-shadow:
          0 40px 80px -20px rgba(110, 70, 50, 0.20),
          0 20px 40px -20px rgba(110, 70, 50, 0.12),
          0 0 0 1px rgba(184, 133, 123, 0.10);
      }

      .checkbox {
        width: 22px; height: 22px; border-radius: 50%;
        border: 1.5px solid rgba(184, 133, 123, 0.50);
        transition: all 0.25s ease; flex-shrink: 0; background: transparent;
      }
      .checkbox.done { background: #B8857B; border-color: #B8857B; }

      .nav-dot { width: 5px; height: 5px; border-radius: 50%; transition: all 0.25s; }

      input::placeholder, textarea::placeholder { color: #C4B5A4; }

      .edit-input {
        background: rgba(184, 133, 123, 0.07);
        border: none;
        outline: none;
        padding: 4px 8px;
        border-radius: 6px;
        font-family: inherit;
      }
      .edit-input:focus { background: rgba(184, 133, 123, 0.14); }

      .fade-in { animation: fadeIn 0.5s ease-out both; }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .nav-btn { transition: all 0.2s; }
      .nav-btn:active { transform: scale(0.94); }

      .scroll-area::-webkit-scrollbar { display: none; }
      .scroll-area { scrollbar-width: none; }

      .welcome-in { animation: welcomeFadeIn 0.7s ease-out both; }
      .welcome-out { animation: welcomeFadeOut 0.6s ease-in both; }
      @keyframes welcomeFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes welcomeFadeOut {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(1.04); }
      }
      .welcome-icon, .welcome-eyebrow, .welcome-body, .welcome-attr, .welcome-tap {
        animation: welcomeRise 1s ease-out both;
        opacity: 0;
      }
      @keyframes welcomeRise {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .welcome-tap { animation: welcomeTapPulse 2.5s ease-in-out 1.5s infinite both; }
      @keyframes welcomeTapPulse {
        0%, 100% { opacity: 0.4; }
        50%      { opacity: 0.8; }
      }
    `}</style>
  );
}
