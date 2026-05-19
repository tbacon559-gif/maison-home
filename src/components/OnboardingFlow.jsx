import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useProfile } from '../hooks/useProfile.js';
import { useKids } from '../hooks/useKids.js';

export default function OnboardingFlow() {
  const { finishOnboarding } = useAuth();
  const [step, setStep] = useState(1);

  return (
    <div className="px-7 pt-12 pb-10 flex-1 flex flex-col">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] text-center mb-12"
        style={{ fontWeight: 400 }}>MAISON</h1>
      {step === 1 && <NameStep onNext={() => setStep(2)} />}
      {step === 2 && <KidsStep onDone={finishOnboarding} />}
    </div>
  );
}

function NameStep({ onNext }) {
  const { update } = useProfile();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (name.trim()) await update({ greeting_name: name.trim() });
      onNext();
    } catch {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col">
      <p className="font-display ink text-[18px] leading-snug mb-8 italic">
        What should we call you?
      </p>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="edit-input ink text-[16px] font-body mb-8 w-full" autoFocus />
      <div className="flex gap-3 items-center">
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          Continue →
        </button>
      </div>
    </form>
  );
}

function KidsStep({ onDone }) {
  const { add } = useKids();
  const [draft, setDraft] = useState([{ name: '', birthday: '' }]);
  const [busy, setBusy] = useState(false);

  const updateDraft = (i, field, val) => {
    setDraft((p) => p.map((d, idx) => (idx === i ? { ...d, [field]: val } : d)));
  };
  const addRow = () => setDraft((p) => [...p, { name: '', birthday: '' }]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const valid = draft.filter((d) => d.name.trim());
      for (let i = 0; i < valid.length; i++) {
        await add({ name: valid[i].name.trim(), birthday: valid[i].birthday || null, position: i });
      }
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col">
      <p className="font-display ink text-[18px] leading-snug mb-2 italic">
        Who do you tend to?
      </p>
      <p className="muted text-[12px] font-body italic font-display mb-8">
        Add as many as you'd like. You can come back to this later.
      </p>
      <div className="space-y-5 mb-6">
        {draft.map((d, i) => (
          <div key={i} className="space-y-2">
            <input type="text" placeholder="Name"
              value={d.name} onChange={(e) => updateDraft(i, 'name', e.target.value)}
              className="edit-input ink text-[15px] font-body w-full" />
            <input type="date" placeholder="Birthday"
              value={d.birthday} onChange={(e) => updateDraft(i, 'birthday', e.target.value)}
              className="edit-input ink text-[13px] font-body w-full" />
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow}
        className="muted text-[11px] tracking-[0.18em] uppercase font-display rose-deep nav-btn self-start mb-8"
        style={{ fontWeight: 500 }}>
        + Add another
      </button>
      <div className="flex gap-3 items-center">
        <button type="submit" disabled={busy}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500, padding: '12px 24px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : 'Finish →'}
        </button>
        <button type="button" onClick={onDone}
          className="muted text-[12px] font-body italic font-display nav-btn">
          Skip
        </button>
      </div>
    </form>
  );
}
