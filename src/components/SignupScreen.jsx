import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function SignupScreen({ onBackToSignin }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true); setError('');
    try {
      await signUp(email, password);
    } catch (err) {
      setError(err.message || 'Sign up failed.');
      setBusy(false);
    }
  };

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-3"
        style={{ fontWeight: 400 }}>MAISON</h1>
      <p className="muted text-[12px] font-body italic font-display text-center mb-10">
        A calm place for the work of the home.
      </p>

      <form onSubmit={submit} className="space-y-5 mb-8">
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
        </div>
        <div>
          <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">Password</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            className="edit-input ink text-[14px] font-body w-full" />
          <p className="muted text-[10px] font-body italic font-display mt-1">At least 8 characters.</p>
        </div>
        {error && (
          <p className="font-display rose-deep text-[12px] italic">{error}</p>
        )}
        <p className="muted text-[10px] font-body italic font-display">
          By signing up you agree to our terms.
        </p>
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : 'Create account →'}
        </button>
      </form>

      <button onClick={onBackToSignin} className="muted text-[12px] font-body italic font-display nav-btn text-center w-full">
        ← Back to sign in
      </button>
    </div>
  );
}
