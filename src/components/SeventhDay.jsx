export default function SeventhDay({ moments, photoCache }) {
  // Filter to last 7 days. Moments dates are short-format strings; we
  // compare by created order — moments are unshifted to the array on
  // save, so the first 7 are the most recent.
  const recent = (moments || []).slice(0, 7);

  return (
    <div className="px-7 pt-10 pb-10 fade-in">
      <h1 className="font-display ink leading-tight mb-3"
        style={{ fontWeight: 400, fontSize: '34px' }}>
        The seventh day.
      </h1>
      <p className="font-display ink text-[17px] leading-snug mb-10"
        style={{ fontStyle: 'italic', fontWeight: 400 }}>
        Nothing is asked of you today. What was the week?
      </p>

      {recent.length === 0 ? (
        <p className="muted text-[13px] font-body italic font-display">
          A quiet week. No moments captured.
        </p>
      ) : (
        <div className="space-y-5">
          {recent.map((m) => {
            const photoData = m.photoId ? photoCache[m.photoId] : null;
            return (
              <div key={m.id}>
                <div className="font-display rose uppercase tracking-[0.2em] text-[9px] mb-2" style={{ fontWeight: 500 }}>
                  {m.date}
                </div>
                {photoData && (
                  <img src={photoData} alt="" className="w-full rounded-xl mb-2 object-cover"
                    style={{ maxHeight: '240px', border: '1px solid rgba(184,133,123,0.18)' }} />
                )}
                {m.text && (
                  <p className="font-display ink text-[15px] leading-snug" style={{ fontWeight: 400 }}>
                    {m.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
