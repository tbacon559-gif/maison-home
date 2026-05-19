import { useState } from 'react';

export default function TrialEndedBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  if (dismissed) return null;

  return (
    <>
      <div className="mx-5 mt-3 mb-2 cream-card rounded-2xl p-4 border-soft fade-in flex items-center justify-between gap-3">
        <p className="font-display ink text-[13px] leading-snug italic flex-1" style={{ fontWeight: 400 }}>
          Your trial has quietly ended. Subscribe to keep what you've kept.
        </p>
        <button onClick={() => setShowModal(true)}
          className="font-display rose-deep text-[10px] tracking-[0.2em] uppercase nav-btn whitespace-nowrap"
          style={{ fontWeight: 500 }}>
          Subscribe →
        </button>
        <button onClick={() => setDismissed(true)} className="muted text-[14px] nav-btn" aria-label="Dismiss">×</button>
      </div>
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-7"
          style={{ background: 'rgba(20,20,20,0.4)' }}>
          <div className="cream-card rounded-2xl p-6 border-soft text-center" style={{ maxWidth: '320px' }}>
            <p className="font-display ink text-[15px] leading-relaxed italic mb-6" style={{ fontWeight: 400 }}>
              Subscriptions arrive with the iOS app. Soon.
            </p>
            <button onClick={() => setShowModal(false)}
              className="font-display rose-deep text-[10px] tracking-[0.2em] uppercase nav-btn"
              style={{ fontWeight: 500 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
