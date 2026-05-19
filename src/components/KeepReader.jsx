import { useState } from 'react';
import KeepList from './KeepList.jsx';

export default function KeepReader({ open, essay, onClose }) {
  const [showList, setShowList] = useState(false);
  const [activeEssay, setActiveEssay] = useState(essay);

  if (!open) return null;

  if (showList) {
    return (
      <KeepList
        open={true}
        onSelect={(picked) => { setActiveEssay(picked); setShowList(false); }}
        onClose={() => setShowList(false)}
      />
    );
  }

  const current = activeEssay || essay;
  if (!current) return null;

  const paragraphs = current.body.split(/\n\n+/);

  return (
    <div className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #FBF3EC 0%, #F4E0D2 60%, #E5C9B5 100%)' }}>
      <div className="flex items-center justify-between px-7 pt-5 pb-3">
        <button onClick={onClose} className="muted text-[14px] nav-btn" aria-label="Close">×</button>
        <span className="font-display rose text-[10px] tracking-[0.32em] uppercase" style={{ fontWeight: 500 }}>THE KEEP</span>
        <div style={{ width: '14px' }} />
      </div>

      <div className="mx-8 border-t hairline" />

      <div className="overflow-y-auto flex-1 px-7 pt-8 pb-10">
        <h1 className="font-display ink leading-tight mb-6"
          style={{ fontWeight: 400, fontSize: '28px', fontStyle: 'italic' }}>
          {current.title}
        </h1>
        {paragraphs.map((p, i) => (
          <p key={i} className="font-display ink text-[17px] leading-relaxed mb-5"
            style={{ fontWeight: 400 }}>
            {p}
          </p>
        ))}
        <div className="pt-8 border-t hairline mt-8">
          <button onClick={() => setShowList(true)}
            className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Read more from The Keep →
          </button>
        </div>
      </div>
    </div>
  );
}
