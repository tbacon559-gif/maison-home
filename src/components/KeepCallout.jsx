export default function KeepCallout({ essay, onOpen }) {
  if (!essay) return null;
  return (
    <button onClick={onOpen}
      className="mx-7 mb-5 mt-2 pt-5 border-t hairline fade-in w-auto text-left nav-btn block">
      <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2">From The Keep</div>
      <p className="font-display ink text-[15px] leading-snug" style={{ fontWeight: 400 }}>
        This week: <span style={{ fontStyle: 'italic' }}>{essay.title}</span>
      </p>
    </button>
  );
}
