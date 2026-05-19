import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function HardshipRequestModal({ open, onClose }) {
  const { requestHardship } = useAuth();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await requestHardship(email, reason);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not submit. Try again.');
    }
    setBusy(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #FBF3EC 0%, #F4E0D2 60%, #E5C9B5 100%)' }}>
      <div className="flex items-center justify-between px-7 pt-5 pb-3">
        <button onClick={onClose} className="muted text-[14px] nav-btn" aria-label="Close">×</button>
        <span className="font-display rose text-[10px] tracking-[0.32em] uppercase" style={{ fontWeight: 500 }}>REQUEST ACCESS</span>
        <div style={{ width: '14px' }} />
      </div>
      <div className="mx-8 border-t hairline" />
      <div className="overflow-y-auto flex-1 px-7 pt-8 pb-10">
        {submitted ? (
          <div>
            <h1 className="font-display ink leading-tight mb-4" style={{ fontWeight: 400, fontSize: '24px', fontStyle: 'italic' }}>
              Thank you.
            </h1>
            <p className="font-display ink text-[15px] leading-relaxed mb-8">
              We read each request personally. Most replies come within a few days.
            </p>
            <button onClick={onClose} className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500 }}>Close →</button>
          </div>
        ) : (
          <>
            <p className="font-display ink text-[15px] leading-relaxed mb-6">
              Maison is free for anyone in genuine crisis. No proof, no shame. Tell us where to reach you.
            </p>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="edit-input ink text-[14px] font-body w-full" />
              </div>
              <div>
                <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Anything you'd like us to know (optional)</label>
                <textarea rows="4" value={reason} onChange={(e) => setReason(e.target.value)}
                  className="edit-input ink text-[14px] font-body w-full" />
              </div>
              {error && (
                <p className="font-display rose-deep text-[12px] italic">{error}</p>
              )}
              <button type="submit" disabled={busy}
                className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
                {busy ? '…' : 'Submit →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
