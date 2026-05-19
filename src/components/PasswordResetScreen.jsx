import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function PasswordResetScreen({ onBack }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    }
    setBusy(false);
  };

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-10"
        style={{ fontWeight: 400 }}>MAISON</h1>

      {sent ? (
        <div className="text-center">
          <p className="font-display ink text-[15px] leading-relaxed mb-8">
            We sent a reset link to <strong>{email}</strong>.
          </p>
          <p className="muted text-[12px] font-body italic font-display mb-8 leading-relaxed">
            Resetting your password will make your existing Moments and Quick Notes unreadable. They use a key that only your old password could unlock. You'll be able to start fresh after reset.
          </p>
          <button onClick={onBack} className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn">
            ← Back to sign in
          </button>
        </div>
      ) : (
        <>
          <p className="muted text-[12px] font-body italic font-display mb-8 text-center">
            We'll send a reset link to your email.
          </p>
          <form onSubmit={submit} className="space-y-5 mb-6">
            <div>
              <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="edit-input ink text-[14px] font-body w-full" />
            </div>
            {error && (
              <p className="font-display rose-deep text-[12px] italic">{error}</p>
            )}
            <button type="submit" disabled={busy}
              className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
              {busy ? '…' : 'Send reset link →'}
            </button>
          </form>
          <button onClick={onBack} className="muted text-[12px] font-body italic font-display nav-btn text-center w-full">
            ← Back to sign in
          </button>
        </>
      )}
    </div>
  );
}
