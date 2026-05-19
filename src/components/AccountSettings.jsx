import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function AccountSettings() {
  const { profile, signOut, deleteAccount } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const onDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true); setError('');
    try {
      await deleteAccount();
      // signs out + redirects
    } catch (err) {
      setError(err.message || 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Account</span>
        {profile?.is_founding_member && (
          <span className="font-display rose-deep text-[10px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
            ✦ Founding member
          </span>
        )}
      </div>
      <div className="space-y-2">
        <button onClick={signOut} className="font-display rose-deep text-[11px] tracking-[0.18em] uppercase nav-btn">
          Sign out
        </button>
      </div>
      <div className="border-t hairline pt-4 mt-2">
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)}
            className="muted text-[11px] font-body italic font-display nav-btn">
            Delete account…
          </button>
        ) : (
          <div className="space-y-3">
            <p className="font-display ink text-[13px] italic leading-snug">
              This removes your account and all of your data. There is no undo.
            </p>
            <p className="muted text-[11px] font-body italic font-display">
              Type DELETE to confirm:
            </p>
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              className="edit-input ink text-[14px] font-body w-full" />
            {error && (
              <p className="font-display rose-deep text-[11px] italic">{error}</p>
            )}
            <div className="flex gap-3">
              <button onClick={onDelete} disabled={confirmText !== 'DELETE' || deleting}
                className="font-display rose-deep text-[10px] tracking-[0.18em] uppercase nav-btn"
                style={{ fontWeight: 500, opacity: confirmText !== 'DELETE' ? 0.3 : 1 }}>
                {deleting ? '…' : 'Permanently delete'}
              </button>
              <button onClick={() => { setShowDelete(false); setConfirmText(''); }}
                className="muted text-[10px] font-body italic font-display nav-btn">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
