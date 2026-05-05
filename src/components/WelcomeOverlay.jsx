import { useEffect, useState } from 'react';
import { pickWelcomeMessage } from '../data/welcome.js';

export default function WelcomeOverlay({ onDismiss }) {
  const [message] = useState(() => pickWelcomeMessage());
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 4500);
    const hideTimer = setTimeout(() => onDismiss(), 5300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  const handleTap = () => {
    setFading(true);
    setTimeout(onDismiss, 600);
  };

  return (
    <div
      onClick={handleTap}
      className={`absolute inset-0 z-[60] flex items-center justify-center px-8 cursor-pointer ${fading ? 'welcome-out' : 'welcome-in'}`}
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #FBF3EC 0%, #F4E0D2 60%, #E5C9B5 100%)',
      }}
    >
      <div className="text-center" style={{ maxWidth: '320px' }}>
        <div className="welcome-icon mb-7 mx-auto inline-block" style={{ animationDelay: '0.1s' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="27" stroke="#B8857B" strokeOpacity="0.4" strokeWidth="1" />
            <text x="28" y="38" textAnchor="middle"
              fontFamily="Fraunces, Georgia, serif" fontStyle="italic"
              fontSize="32" fontWeight="400" fill="#8B5A4F">M</text>
          </svg>
        </div>
        <div className="welcome-eyebrow muted text-[10px] tracking-[0.32em] uppercase font-body mb-5"
          style={{ animationDelay: '0.3s' }}>
          {message.eyebrow}
        </div>
        <p className="welcome-body font-display ink leading-snug"
          style={{ fontWeight: 400, fontSize: '24px', fontStyle: 'italic', animationDelay: '0.5s', lineHeight: 1.35 }}>
          {message.body}
        </p>
        {message.attribution && (
          <div className="welcome-attr muted text-[12px] font-body mt-5"
            style={{ animationDelay: '0.9s', fontStyle: 'italic' }}>
            {message.attribution}
          </div>
        )}
        <div className="welcome-tap muted text-[9px] tracking-[0.3em] uppercase mt-12"
          style={{ animationDelay: '1.5s', opacity: 0.6 }}>
          Tap to continue
        </div>
      </div>
    </div>
  );
}
