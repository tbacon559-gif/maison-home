import { useState } from 'react';
import { buildSitterCardSVG, shareOrDownload } from '../lib/svg.js';

export default function SitterCardModal({ open, onClose, girls, household, sitterNotes }) {
  const [status, setStatus] = useState('');

  if (!open) return null;

  const svg = buildSitterCardSVG(girls, household, sitterNotes);

  const handleShare = async () => {
    setStatus('sharing');
    try {
      const result = await shareOrDownload(svg, 'sitter-card.png', 'For the Sitter');
      if (result === 'cancelled') setStatus('');
      else {
        setStatus('done');
        setTimeout(() => setStatus(''), 1500);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus(''), 2000);
    }
  };

  return (
    <div onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 fade-in"
      style={{ background: 'rgba(60, 40, 30, 0.55)', backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] max-h-[90vh] flex flex-col">
        <div className="cream-bg rounded-2xl overflow-hidden flex-1 flex flex-col app-shadow">
          <div className="flex items-center justify-between px-5 py-4 border-b hairline">
            <span className="font-display ink" style={{ fontWeight: 400, fontSize: '16px' }}>Preview</span>
            <button onClick={onClose} className="muted text-xl">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 scroll-area" style={{ background: '#E8D3C5' }}>
            <div className="rounded-lg overflow-hidden"
              style={{ boxShadow: '0 10px 30px -10px rgba(80,60,40,0.3)' }}
              dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t hairline">
            <span className="muted text-[11px] font-body italic">
              {status === 'sharing' ? 'Preparing…' :
               status === 'done' ? '✓ Shared' :
               status === 'error' ? 'Something went wrong' :
               'Tap Share to AirDrop or text'}
            </span>
            <button onClick={handleShare} disabled={status === 'sharing'}
              className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500, padding: '8px 18px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: status === 'sharing' ? 0.5 : 1 }}>
              Share →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
