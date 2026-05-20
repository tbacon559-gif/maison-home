import { useState } from 'react';

export default function SitterShareModal({
  open, mode, editing, onCreate, onSave, onClose,
}) {
  const initialPlan = editing?.tonight_plan ?? '';
  const [plan, setPlan] = useState(initialPlan);
  const [stage, setStage] = useState(mode === 'edit' ? 'edit' : 'create');
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    setBusy(true);
    try {
      const row = await onCreate(plan);
      setCreated(row);
      setStage('ready');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(editing.token, plan);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const url = created
    ? `${window.location.origin}/share/sitter/${created.token}`
    : '';

  const handleCopy = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'A Live Link', url });
      } catch { /* user cancelled — no-op */ }
    }
  };

  const expiresLabel = created
    ? new Date(created.expires_at).toLocaleTimeString([], {
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <div onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 fade-in"
      style={{ background: 'rgba(60, 40, 30, 0.55)', backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px]">
        <div className="cream-bg rounded-2xl overflow-hidden flex flex-col app-shadow">
          <div className="px-6 py-5 border-b hairline">
            <div className="font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}>
              {stage === 'ready' ? 'Ready' : 'A Live Link'}
            </div>
            {stage !== 'ready' && (
              <p className="muted text-[12px] font-body mt-2 leading-relaxed">
                A page the sitter can pull up tonight. Closes itself in 12 hours.
              </p>
            )}
          </div>

          {stage !== 'ready' && (
            <div className="px-6 py-5">
              <label className="font-display rose-deep text-[10px] tracking-[0.28em] uppercase block mb-2">
                Tonight
              </label>
              <textarea
                aria-label="Tonight"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                rows={6}
                className="edit-input ink text-[14px] font-body w-full"
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  minHeight: '120px', resize: 'vertical',
                }}
                placeholder="Bath, books, lights. Anything they should know."
              />
            </div>
          )}

          {stage === 'ready' && (
            <div className="px-6 py-5 space-y-4">
              <div className="break-all text-[13px] font-body ink rounded-lg p-3 border-soft">
                {url}
              </div>
              <p className="muted text-[12px] font-body italic">
                Ends {expiresLabel}.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t hairline">
            {stage === 'create' && (
              <>
                <button onClick={onClose}
                  className="font-display muted text-[11px] tracking-[0.22em] uppercase">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={busy}
                  className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                  style={{
                    fontWeight: 500, padding: '10px 20px',
                    border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px',
                    opacity: busy ? 0.5 : 1,
                  }}>
                  Create link →
                </button>
              </>
            )}
            {stage === 'edit' && (
              <>
                <button onClick={onClose}
                  className="font-display muted text-[11px] tracking-[0.22em] uppercase">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={busy}
                  className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                  style={{
                    fontWeight: 500, padding: '10px 20px',
                    border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px',
                    opacity: busy ? 0.5 : 1,
                  }}>
                  Save
                </button>
              </>
            )}
            {stage === 'ready' && (
              <>
                <button onClick={handleCopy}
                  className="font-display ink text-[11px] tracking-[0.22em] uppercase">
                  Copy link
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={handleShare}
                    className="font-display ink text-[11px] tracking-[0.22em] uppercase">
                    Share
                  </button>
                )}
                <button onClick={onClose}
                  className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                  style={{
                    fontWeight: 500, padding: '10px 20px',
                    border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px',
                  }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
