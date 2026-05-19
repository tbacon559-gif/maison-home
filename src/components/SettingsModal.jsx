import { useState, useEffect } from 'react';
import AccountSettings from './AccountSettings.jsx';

export default function SettingsModal({ open, onClose, profile, profileHook }) {
  const [calendarUrl, setCalendarUrl] = useState(profile?.calendar_url || '');
  const [showHelp, setShowHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCalendarUrl(profile?.calendar_url || '');
  }, [profile?.calendar_url, open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileHook.update({ calendar_url: calendarUrl.trim() || null });
      onClose();
    } catch (err) {
      console.error('Settings save failed', err);
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-4 fade-in"
      style={{ background: 'rgba(60, 40, 30, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-[380px] cream-bg rounded-2xl app-shadow overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b hairline">
          <span className="font-display ink" style={{ fontWeight: 400, fontSize: '18px' }}>Settings</span>
          <button onClick={onClose} className="muted text-xl">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 scroll-area">
          <div className="mb-6">
            <label className="muted text-[10px] tracking-[0.28em] uppercase font-body block mb-2">
              Google Calendar
            </label>
            <input
              type="url"
              value={calendarUrl}
              onChange={(e) => setCalendarUrl(e.target.value)}
              placeholder="Paste your Secret iCal URL"
              className="edit-input ink text-[13px] font-body w-full"
              style={{ wordBreak: 'break-all' }}
            />
            <button onClick={() => setShowHelp((v) => !v)}
              className="font-display rose text-[10px] tracking-[0.18em] uppercase mt-3" style={{ fontWeight: 500 }}>
              {showHelp ? '− Hide instructions' : '? How to find this'}
            </button>
            {showHelp && (
              <div className="mt-3 muted text-[12px] font-body leading-relaxed cream-card rounded-xl p-4 border-soft">
                <ol className="space-y-2 list-decimal pl-4">
                  <li>Open Google Calendar on a computer</li>
                  <li>Click the gear icon → <em>Settings</em></li>
                  <li>Under <em>Settings for my calendars</em>, pick your main calendar</li>
                  <li>Scroll to <em>Integrate calendar</em></li>
                  <li>Copy <em>Secret address in iCal format</em></li>
                  <li>Paste it above</li>
                </ol>
                <p className="mt-3 italic font-display">Read-only. Maison can see what's coming, but only Google Calendar can make changes.</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t hairline">
            <AccountSettings />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t hairline">
          <button onClick={onClose} className="muted text-[11px] tracking-[0.2em] uppercase font-display nav-btn" style={{ fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500, padding: '8px 18px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px', opacity: saving ? 0.5 : 1 }}>
            {saving ? '…' : 'Save →'}
          </button>
        </div>
      </div>
    </div>
  );
}
