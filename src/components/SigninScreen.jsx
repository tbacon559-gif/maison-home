import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import HardshipRequestModal from './HardshipRequestModal.jsx';

export default function SigninScreen({ onShowSignup, onShowReset }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHardship, setShowHardship] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Sign in failed.');
      setBusy(false);
    }
  };

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-12"
        style={{ fontWeight: 400 }}>MAISON</h1>

      <form onSubmit={submit} className="space-y-5 mb-8">
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
        </div>
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
        </div>
        {error && (
          <p className="font-display rose-deep text-[12px] italic">{error}</p>
        )}
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : 'Sign in →'}
        </button>
      </form>

      <div className="space-y-3 text-center">
        <button onClick={onShowReset} className="muted text-[12px] font-body italic font-display nav-btn block w-full">
          Forgot password?
        </button>
        <button onClick={onShowSignup} className="font-display ink text-[13px] nav-btn block w-full">
          New here? <span className="rose-deep">Create an account →</span>
        </button>
        <button onClick={() => setShowHardship(true)} className="muted text-[11px] font-body italic font-display nav-btn block w-full">
          Request Access
        </button>
      </div>

      <HardshipRequestModal open={showHardship} onClose={() => setShowHardship(false)} />
    </div>
  );
}
