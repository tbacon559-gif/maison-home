import { useEffect, useState } from 'react';

function computeAge(birthdayISO) {
  if (!birthdayISO) return '';
  const b = new Date(birthdayISO);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years >= 2) return `${years} years`;
  if (years === 1) return months > 0 ? `1 year · ${months} mo` : '1 year';
  return `${Math.max(0, months + years * 12)} mo`;
}

export default function SitterShareView({ token }) {
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/share/sitter/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        if (!active) return;
        if (res.status === 404) {
          setState({ kind: 'ended' });
          return;
        }
        if (!res.ok) {
          setState({ kind: 'error' });
          return;
        }
        const data = await res.json();
        setState({ kind: 'ok', data });
      } catch {
        if (active) setState({ kind: 'error' });
      }
    })();
    return () => { active = false; };
  }, [token]);

  if (state.kind === 'loading') {
    return (
      <div className="cream-bg min-h-screen flex items-center justify-center">
        <div className="muted font-body italic text-[14px]">Loading…</div>
      </div>
    );
  }

  if (state.kind === 'ended') {
    return (
      <div className="cream-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="font-display ink mb-3" style={{ fontWeight: 400, fontSize: '24px' }}>
          This link has ended.
        </div>
        <p className="muted font-body italic">Ask the parent for a new one.</p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="cream-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="font-display ink mb-3" style={{ fontWeight: 400, fontSize: '24px' }}>
          Something went wrong.
        </div>
        <p className="muted font-body italic">Try refreshing.</p>
      </div>
    );
  }

  const { data } = state;
  const header = data.owner_name
    ? `${data.owner_name}'s home — tonight`
    : 'Tonight';
  const endsAt = new Date(data.expires_at).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <div className="cream-bg min-h-screen px-4 py-8 max-w-[560px] mx-auto">
      <h1 className="font-display ink text-center mb-6"
        style={{ fontWeight: 400, fontSize: '24px' }}>
        {header}
      </h1>

      {data.tonight_plan && (
        <section className="cream-card rounded-2xl p-6 border-soft mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3"
            style={{ fontWeight: 500 }}>
            Tonight
          </div>
          <p className="ink text-[14px] leading-relaxed font-body"
            style={{ whiteSpace: 'pre-wrap' }}>
            {data.tonight_plan}
          </p>
        </section>
      )}

      {data.kids?.length > 0 && (
        <section className="mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3 text-center"
            style={{ fontWeight: 500 }}>
            The Girls
          </div>
          <div className="space-y-4">
            {data.kids.map((kid, idx) => {
              const age = computeAge(kid.birthday);
              const rows = [
                kid.clothes_size && ['Clothes', kid.clothes_size],
                kid.shoe_size && ['Shoes', kid.shoe_size],
                kid.diaper_size && ['Diapers', kid.diaper_size],
                kid.allergies && ['Allergies', kid.allergies],
              ].filter(Boolean);
              return (
                <div key={idx} className="cream-card rounded-2xl p-6 border-soft">
                  <div className="font-display ink mb-3"
                    style={{ fontWeight: 400, fontSize: '18px' }}>
                    {kid.name}{age && <span className="muted font-body text-[13px]"> · {age}</span>}
                  </div>
                  <dl className="space-y-1">
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex justify-between text-[13px] font-body">
                        <dt className="muted">{label}</dt>
                        <dd className="ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.household?.length > 0 && (
        <section className="cream-card rounded-2xl p-6 border-soft mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3"
            style={{ fontWeight: 500 }}>
            The House
          </div>
          <dl className="space-y-2">
            {data.household.map((row, idx) => (
              <div key={idx} className="flex justify-between text-[13px] font-body">
                <dt className="muted">{row.label}</dt>
                <dd className="ink text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.sitter_notes && (
        <section className="cream-card rounded-2xl p-6 border-soft mb-5">
          <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-3"
            style={{ fontWeight: 500 }}>
            Notes
          </div>
          <p className="ink text-[14px] leading-relaxed font-display"
            style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
            {data.sitter_notes}
          </p>
        </section>
      )}

      <p className="muted text-center text-[12px] font-body italic mt-6">
        Live until {endsAt}.
      </p>
    </div>
  );
}
