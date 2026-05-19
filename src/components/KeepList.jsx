import { allEssays } from '../data/keep.js';

export default function KeepList({ open, onSelect, onClose }) {
  if (!open) return null;

  const essays = allEssays();

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
        <p className="muted text-[12px] font-body italic font-display mb-6">
          A small library of readings. One a week is enough.
        </p>
        <div className="space-y-5">
          {essays.map((essay) => (
            <button key={essay.slug} onClick={() => onSelect(essay)}
              className="w-full text-left nav-btn pb-4 border-b hairline">
              <h2 className="font-display ink text-[20px] leading-snug" style={{ fontWeight: 400, fontStyle: 'italic' }}>
                {essay.title}
              </h2>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
