import { useState, useEffect, useRef, useCallback } from 'react';

import {
  INITIAL_DAILY, INITIAL_WEEKLY,
  INITIAL_MEALS, INITIAL_GROCERIES, INITIAL_TOBUY, INITIAL_NOTES,
  INITIAL_GIRLS, INITIAL_HOUSEHOLD, INITIAL_SITTER_NOTES,
  INITIAL_MOMENTS, INITIAL_SETTINGS,
} from './data/initial.js';

import {
  calcAge, nextBirthday, shortDate, todayLabel,
  relativeLabel, timeLabel,
} from './lib/dates.js';

import { lsGet, lsSet, photoSave, photoGet, photoDelete } from './lib/storage.js';
import { upcomingEvents } from './lib/ics.js';
import { buildMomentSVG, getImageDims, shareOrDownload } from './lib/svg.js';
import {
  resetDaily, resetWeekly, shouldResetDaily, shouldResetWeekly,
} from './lib/rollover.js';

import { essayOfWeek } from './data/keep.js';
import { Checkbox, EditToggle, SectionHead, Styles } from './components/Components.jsx';
import WelcomeOverlay from './components/WelcomeOverlay.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import SitterCardModal from './components/SitterCardModal.jsx';
import TidyTab from './components/TidyTab.jsx';
import KitchenTab from './components/KitchenTab.jsx';
import KeepCallout from './components/KeepCallout.jsx';
import KeepReader from './components/KeepReader.jsx';

function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => lsGet(key, initial));
  useEffect(() => {
    lsSet(key, value);
  }, [key, value]);
  return [value, setValue];
}

function todaysWorkLine(hour = new Date().getHours()) {
  if (hour < 11) return 'A morning to begin gently.';
  if (hour < 14) return 'The middle of a day, held.';
  if (hour < 18) return 'An afternoon, kept as it is.';
  if (hour < 21) return 'An evening softening down.';
  return 'A late hour. Be kind to it.';
}

export default function App() {
  // Persisted state
  const [daily, setDaily] = usePersistedState('daily', INITIAL_DAILY);
  const [weekly, setWeekly] = usePersistedState('weekly', INITIAL_WEEKLY);
  const [lastDailyResetDate, setLastDailyResetDate] = usePersistedState('lastDailyResetDate', null);
  const [lastWeeklyResetDate, setLastWeeklyResetDate] = usePersistedState('lastWeeklyResetDate', null);
  const [meals, setMeals] = usePersistedState('meals', INITIAL_MEALS);
  const [groceries, setGroceries] = usePersistedState('groceries', INITIAL_GROCERIES);
  const [toBuy, setToBuy] = usePersistedState('toBuy', INITIAL_TOBUY);
  const [notes, setNotes] = usePersistedState('notes', INITIAL_NOTES);
  const [girls, setGirls] = usePersistedState('girls', INITIAL_GIRLS);
  const [household, setHousehold] = usePersistedState('household', INITIAL_HOUSEHOLD);
  const [sitterNotes, setSitterNotes] = usePersistedState('sitterNotes', INITIAL_SITTER_NOTES);
  const [moments, setMoments] = usePersistedState('moments', INITIAL_MOMENTS);
  const [settings, setSettings] = usePersistedState('settings', INITIAL_SETTINGS);

  // Volatile UI state
  const [activeNav, setActiveNav] = useState('Today');
  const [greeting, setGreeting] = useState('Good morning');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSitterCard, setShowSitterCard] = useState(false);
  const [keepReaderOpen, setKeepReaderOpen] = useState(false);
  const currentEssay = essayOfWeek();

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState('idle');

  const [newNote, setNewNote] = useState('');
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [editingGroceries, setEditingGroceries] = useState(false);
  const [editingToBuy, setEditingToBuy] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingGirl, setEditingGirl] = useState(null);
  const [editingHousehold, setEditingHousehold] = useState(false);
  const [editingSitter, setEditingSitter] = useState(false);

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [shareMomentStatus, setShareMomentStatus] = useState({});
  const [photoCache, setPhotoCache] = useState({});

  const notesActive = notes.filter((n) => !n.done).length;

  // Greeting
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // ─── Day-rollover logic: reset daily on a new day, reset weekly on Sunday crossing ──
  // Run once per app open.
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Daily reset
    if (!lastDailyResetDate) {
      setLastDailyResetDate(todayStr);
    } else if (shouldResetDaily(lastDailyResetDate, today)) {
      setDaily(resetDaily(daily));
      setLastDailyResetDate(todayStr);
    }

    // Weekly reset
    if (!lastWeeklyResetDate) {
      setLastWeeklyResetDate(todayStr);
    } else if (shouldResetWeekly(lastWeeklyResetDate, today)) {
      setWeekly(resetWeekly(weekly));
      setLastWeeklyResetDate(todayStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calendar fetch
  const fetchCalendar = useCallback(async () => {
    if (!settings.calendarUrl) {
      setCalendarStatus('unset');
      setCalendarEvents([]);
      return;
    }
    setCalendarStatus('loading');
    try {
      const res = await fetch(`/api/calendar?url=${encodeURIComponent(settings.calendarUrl)}`);
      if (!res.ok) throw new Error('Calendar fetch failed: ' + res.status);
      const text = await res.text();
      const events = upcomingEvents(text, { limit: 5 });
      setCalendarEvents(events);
      setCalendarStatus('ok');
    } catch (err) {
      console.error('Calendar error:', err);
      setCalendarStatus('error');
    }
  }, [settings.calendarUrl]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Photo loading
  useEffect(() => {
    const idsNeeded = moments.filter((m) => m.photoId && !photoCache[m.photoId]).map((m) => m.photoId);
    if (idsNeeded.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const id of idsNeeded) {
        try {
          const data = await photoGet(id);
          if (data) updates[id] = data;
        } catch (err) {
          console.error('photoGet failed', id, err);
        }
      }
      if (!cancelled && Object.keys(updates).length) {
        setPhotoCache((p) => ({ ...p, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [moments, photoCache]);

  // Quick Notes ops
  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes((p) => [...p, { id: Date.now(), text: newNote.trim(), done: false }]);
    setNewNote('');
  };
  const toggleNote = (id) => setNotes((p) => p.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  const editNote = (id, text) => setNotes((p) => p.map((n) => (n.id === id ? { ...n, text } : n)));
  const deleteNote = (id) => setNotes((p) => p.filter((n) => n.id !== id));

  // Girls / household
  const editGirl = (id, field, val) => setGirls((p) => p.map((g) => (g.id === id ? { ...g, [field]: val } : g)));
  const editHousehold = (i, field, val) => setHousehold((p) => p.map((h, idx) => (idx === i ? { ...h, [field]: val } : h)));
  const deleteHousehold = (i) => setHousehold((p) => p.filter((_, idx) => idx !== i));
  const addHousehold = () => setHousehold((p) => [...p, { key: '', value: '' }]);

  // Photo flow
  const onPhotoPick = async (e) => {
    const files = Array.from(e.target.files || []);
    const staged = await Promise.all(
      files.map((f) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          id: Date.now() + Math.random(),
          dataUrl: reader.result,
          date: shortDate(new Date(f.lastModified)),
          caption: '',
        });
        reader.readAsDataURL(f);
      }))
    );
    setPendingPhotos((p) => [...p, ...staged]);
    e.target.value = '';
  };
  const updatePending = (id, field, val) =>
    setPendingPhotos((p) => p.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
  const cancelPending = (id) => setPendingPhotos((p) => p.filter((x) => x.id !== id));

  const saveAllPending = async () => {
    const newMoments = [];
    const newCache = {};
    for (const p of pendingPhotos) {
      const photoId = `photo_${p.id}`;
      try {
        await photoSave(photoId, p.dataUrl);
        newCache[photoId] = p.dataUrl;
        newMoments.push({ id: p.id, date: p.date, text: p.caption, photoId });
      } catch (err) {
        console.error('photoSave failed', err);
      }
    }
    if (newMoments.length) {
      setMoments((m) => [...newMoments, ...m]);
      setPhotoCache((p) => ({ ...p, ...newCache }));
    }
    setPendingPhotos([]);
  };

  const deleteMoment = async (m) => {
    if (!confirm('Delete this moment?')) return;
    if (m.photoId) {
      try { await photoDelete(m.photoId); } catch {}
    }
    setMoments((all) => all.filter((x) => x.id !== m.id));
  };

  const shareMoment = async (moment) => {
    setShareMomentStatus((p) => ({ ...p, [moment.id]: 'sharing' }));
    try {
      const photoData = moment.photoId ? photoCache[moment.photoId] : null;
      const dims = await getImageDims(photoData);
      const svg = buildMomentSVG(moment, photoData, dims);
      const result = await shareOrDownload(svg, `moment-${moment.id}.png`, 'A moment from Maison');
      setShareMomentStatus((p) => ({ ...p, [moment.id]: result === 'cancelled' ? '' : 'done' }));
      setTimeout(() => setShareMomentStatus((p) => ({ ...p, [moment.id]: '' })), 1500);
    } catch (err) {
      console.error(err);
      setShareMomentStatus((p) => ({ ...p, [moment.id]: 'error' }));
      setTimeout(() => setShareMomentStatus((p) => ({ ...p, [moment.id]: '' })), 2000);
    }
  };

  const clearAllData = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('maison.')) localStorage.removeItem(k);
    });
    indexedDB.deleteDatabase('maison');
    location.reload();
  };

  return (
    <div
      className="min-h-screen w-full flex items-start justify-center py-6 px-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #F4E0D2 0%, #E5C9B5 55%, #D2A88F 100%)',
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      <Styles />

      <div className="relative cream-bg rounded-[36px] app-shadow overflow-hidden w-full flex flex-col"
        style={{ maxWidth: '420px', minHeight: '780px' }}>

        {showWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSave={setSettings}
          onClearAll={clearAllData}
        />
        <SitterCardModal
          open={showSitterCard}
          onClose={() => setShowSitterCard(false)}
          girls={girls}
          household={household}
          sitterNotes={sitterNotes}
        />
        <KeepReader
          open={keepReaderOpen}
          essay={currentEssay}
          onClose={() => setKeepReaderOpen(false)}
        />

        {/* HEADER */}
        {activeNav === 'Today' ? (
          <div key="t-header" className="pt-5 pb-4 fade-in flex items-center justify-between px-7">
            <button onClick={() => setShowSettings(true)} className="muted text-[14px] nav-btn" aria-label="Settings">⚙</button>
            <div className="text-center">
              <div className="font-display rose text-[22px]" style={{ fontWeight: 400, letterSpacing: '0.32em' }}>MAISON</div>
              <div className="muted text-[10px] tracking-[0.3em] uppercase mt-1.5">{todayLabel()}</div>
            </div>
            <div style={{ width: '14px' }} />
          </div>
        ) : (
          <div key={`h-${activeNav}`} className="pt-5 pb-4 px-7 fade-in flex items-baseline justify-between">
            <h2 className="font-display ink" style={{ fontWeight: 400, fontSize: '24px' }}>
              {activeNav === 'Girls' ? 'The Girls' :
               activeNav === 'Tidy'  ? 'The Keeping' : activeNav}
            </h2>
            <span className="font-display rose text-[10px] tracking-[0.32em]" style={{ fontWeight: 400 }}>MAISON</span>
          </div>
        )}

        <div className="mx-8 border-t hairline" />

        <div className="scroll-area overflow-y-auto flex-1 pb-2" key={activeNav}>

          {/* TODAY */}
          {activeNav === 'Today' && (
            <>
              <div className="px-7 pt-7 pb-5 fade-in">
                <h1 className="font-display ink" style={{ fontWeight: 400, fontSize: '34px', lineHeight: 1.1 }}>
                  {greeting},<br />
                  <span className="font-display rose-deep" style={{ fontStyle: 'italic', fontWeight: 300 }}>Tiff</span>
                </h1>
              </div>

              {/* Calendar */}
              <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in">
                <div className="flex items-baseline justify-between">
                  <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">On the Calendar</span>
                  <button onClick={fetchCalendar} className="font-display rose text-[10px] tracking-[0.18em] uppercase nav-btn" style={{ fontWeight: 500 }}>
                    {calendarStatus === 'loading' ? '…' : '↻'}
                  </button>
                </div>
                <div className="space-y-3.5 mt-4">
                  {calendarStatus === 'unset' && (
                    <button onClick={() => setShowSettings(true)} className="text-left w-full">
                      <p className="muted text-[13px] font-body italic font-display">
                        Connect a calendar in settings to see what's coming.
                      </p>
                    </button>
                  )}
                  {calendarStatus === 'error' && (
                    <p className="muted text-[12px] font-body italic">
                      Couldn't reach the calendar. Try again, or check settings.
                    </p>
                  )}
                  {calendarStatus === 'loading' && calendarEvents.length === 0 && (
                    <p className="muted text-[12px] font-body italic">Loading…</p>
                  )}
                  {calendarStatus === 'ok' && calendarEvents.length === 0 && (
                    <p className="muted text-[12px] font-body italic">Nothing on the calendar.</p>
                  )}
                  {calendarEvents.map((e, i) => {
                    const when = relativeLabel(e.start);
                    const time = e.allDay ? '' : timeLabel(e.start);
                    return (
                      <div key={i} className="flex items-baseline gap-3">
                        <span className="font-display rose uppercase tracking-[0.16em] text-[10px]" style={{ fontWeight: 500, width: '78px' }}>{when}</span>
                        <span className="muted text-[11px] font-body" style={{ width: '52px' }}>{time}</span>
                        <span className="ink text-[14px] font-body flex-1">{e.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Notes — persistent list */}
              <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Quick Notes</span>
                  <EditToggle editing={editingNotes} onClick={() => setEditingNotes((v) => !v)} />
                </div>

                <div className="flex items-center gap-2 mb-4 pb-4 border-b hairline">
                  <input
                    type="text"
                    placeholder="Hold this for me."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNote()}
                    className="flex-1 bg-transparent outline-none ink text-[14px] font-body"
                  />
                  <button onClick={addNote} disabled={!newNote.trim()}
                    className="font-display rose-deep text-[11px] tracking-[0.18em] uppercase nav-btn"
                    style={{ fontWeight: 500, opacity: newNote.trim() ? 1 : 0.3 }}>
                    Add
                  </button>
                </div>

                <div className="space-y-3">
                  {notes.length === 0 && (
                    <p className="muted text-[12px] font-body italic font-display text-center py-2">
                      Nothing pending. A quiet head.
                    </p>
                  )}
                  {notes.map((n) => (
                    <div key={n.id} className="flex items-center gap-3">
                      <button onClick={() => !editingNotes && toggleNote(n.id)}>
                        <Checkbox done={n.done} />
                      </button>
                      {editingNotes ? (
                        <>
                          <input className="edit-input ink text-[14px] font-body flex-1"
                            value={n.text}
                            onChange={(e) => editNote(n.id, e.target.value)} />
                          <button onClick={() => deleteNote(n.id)} className="muted text-base">×</button>
                        </>
                      ) : (
                        <span className={`text-[14px] font-body flex-1 ${n.done ? 'muted line-through' : 'ink'}`}>{n.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <KeepCallout essay={currentEssay} onOpen={() => setKeepReaderOpen(true)} />

              {/* Today's Work */}
              <div className="mx-7 mb-8 mt-2 pt-5 border-t hairline fade-in">
                <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2">Today's Work</div>
                <p className="font-display ink text-[15px] leading-snug" style={{ fontStyle: 'italic', fontWeight: 400 }}>
                  {todaysWorkLine()}
                </p>
              </div>
            </>
          )}

          {/* TIDY */}
          {activeNav === 'Tidy' && (
            <TidyTab
              daily={daily} setDaily={setDaily}
              weekly={weekly} setWeekly={setWeekly}
              editingDaily={editingDaily} setEditingDaily={setEditingDaily}
              editingWeekly={editingWeekly} setEditingWeekly={setEditingWeekly}
            />
          )}

          {/* KITCHEN (was Meals) */}
          {activeNav === 'Kitchen' && (
            <KitchenTab
              meals={meals} setMeals={setMeals}
              groceries={groceries} setGroceries={setGroceries}
              toBuy={toBuy} setToBuy={setToBuy}
              editingDay={editingDay} setEditingDay={setEditingDay}
              editingGroceries={editingGroceries} setEditingGroceries={setEditingGroceries}
              editingToBuy={editingToBuy} setEditingToBuy={setEditingToBuy}
            />
          )}

          {/* GIRLS */}
          {activeNav === 'Girls' && (
            <div className="pt-6 px-5 pb-8">
              <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">
                The particulars. What a sitter or a grandparent might want to know.
              </p>
              <div className="space-y-4">
                {girls.map((g, i) => {
                  const isEditing = editingGirl === g.id;
                  const age = calcAge(g.birthday);
                  const next = nextBirthday(g.birthday);
                  return (
                    <div key={g.id} className="cream-card rounded-2xl p-6 border-soft fade-in" style={{ animationDelay: `${0.05 + i * 0.08}s` }}>
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center font-display rose-deep"
                            style={{ background: 'rgba(184, 133, 123, 0.18)', fontWeight: 400, fontSize: '24px', fontStyle: 'italic' }}>
                            {(g.name || '?').charAt(0)}
                          </div>
                          <div>
                            {isEditing ? (
                              <input className="edit-input font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}
                                value={g.name} onChange={(e) => editGirl(g.id, 'name', e.target.value)} />
                            ) : (
                              <div className="font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}>{g.name}</div>
                            )}
                            <div className="muted text-[11px] tracking-[0.16em] uppercase font-body mt-0.5">{age}</div>
                          </div>
                        </div>
                        <EditToggle editing={isEditing} onClick={() => setEditingGirl(isEditing ? null : g.id)} />
                      </div>

                      {next && next.days <= 90 && !isEditing && (
                        <div className="mb-4 -mt-2 px-1">
                          <span className="font-display rose-deep text-[12px]" style={{ fontStyle: 'italic' }}>
                            ✦ turns {next.turning} on {next.dateStr} — {next.days} {next.days === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      )}

                      <div className="space-y-2.5 pt-4 border-t hairline">
                        {[['Birthday', 'birthday'], ['Clothes', 'clothes'], ['Shoe', 'shoe'], ['Diaper', 'diaper'], ['Allergies', 'allergies']].map(([label, field]) => (
                          <div key={field} className="flex items-baseline gap-3">
                            <span className="font-display rose uppercase tracking-[0.18em] text-[9px]" style={{ fontWeight: 500, width: '78px' }}>{label}</span>
                            {isEditing ? (
                              <input
                                type={field === 'birthday' ? 'date' : 'text'}
                                className="edit-input ink text-[13px] font-body flex-1"
                                value={g[field] || ''} onChange={(e) => editGirl(g.id, field, e.target.value)} />
                            ) : (
                              <span className="ink text-[13px] font-body">
                                {field === 'birthday' && g.birthday
                                  ? new Date(g.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                  : g[field]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="cream-card rounded-2xl p-6 border-soft">
                  <SectionHead label="If You Need It" editing={editingHousehold} onToggle={() => setEditingHousehold((v) => !v)} />
                  <div className="space-y-2.5 mt-4">
                    {household.map((h, i) => (
                      <div key={i} className="flex items-baseline gap-3">
                        {editingHousehold ? (
                          <>
                            <input className="edit-input font-display rose uppercase tracking-[0.18em] text-[9px]"
                              style={{ fontWeight: 500, width: '90px' }}
                              value={h.key} placeholder="Label" onChange={(e) => editHousehold(i, 'key', e.target.value)} />
                            <input className="edit-input ink text-[13px] font-body flex-1"
                              value={h.value} placeholder="Info" onChange={(e) => editHousehold(i, 'value', e.target.value)} />
                            <button onClick={() => deleteHousehold(i)} className="muted text-base">×</button>
                          </>
                        ) : (
                          <>
                            <span className="font-display rose uppercase tracking-[0.18em] text-[9px]" style={{ fontWeight: 500, width: '88px' }}>{h.key}</span>
                            <span className="ink text-[13px] font-body">{h.value || <span className="muted italic">—</span>}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {editingHousehold && (
                    <button onClick={addHousehold} className="mt-4 font-display rose-deep text-[11px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
                      + Add detail
                    </button>
                  )}
                </div>

                <div className="cream-card rounded-2xl p-6 border-soft">
                  <SectionHead label="Sitter Notes" editing={editingSitter} onToggle={() => setEditingSitter((v) => !v)} />
                  <div className="mt-3">
                    {editingSitter ? (
                      <textarea rows="6" value={sitterNotes} onChange={(e) => setSitterNotes(e.target.value)}
                        className="edit-input ink text-[14px] font-body w-full" style={{ fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', minHeight: '120px', resize: 'vertical' }}
                        placeholder="Naps, routines, anything they should know." />
                    ) : (
                      <p className="ink text-[14px] leading-relaxed font-display whitespace-pre-line" style={{ fontStyle: 'italic' }}>
                        {sitterNotes || <span className="muted">No notes yet.</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="cream-card rounded-2xl p-6 border-soft text-center">
                  <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-2" style={{ fontWeight: 500 }}>✦ Sitter Card</div>
                  <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '20px' }}>The Handoff</div>
                  <p className="muted text-[12px] font-body mb-5 leading-relaxed">
                    Share the particulars as one image. AirDrop, text, however.
                  </p>
                  <button onClick={() => setShowSitterCard(true)}
                    className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                    style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
                    Preview &amp; Share →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MOMENTS */}
          {activeNav === 'Moments' && (
            <div className="pt-6 px-5 pb-8">
              <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed italic font-display">
                The ordinary, before it goes.
              </p>

              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPhotoPick} />

              <div className="flex gap-3 mb-6">
                <button onClick={() => fileInputRef.current?.click()}
                  className="cream-card rounded-2xl px-5 py-4 border-soft flex-1 text-left flex items-center justify-between nav-btn">
                  <span className="font-display ink" style={{ fontSize: '14px' }}>Today's Photos</span>
                  <span className="rose text-[16px]">＋</span>
                </button>
              </div>

              {pendingPhotos.length > 0 && (
                <div className="cream-card rounded-2xl p-5 border-soft mb-6 fade-in">
                  <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-4">A few words for each.</div>
                  <div className="space-y-5">
                    {pendingPhotos.map((p) => (
                      <div key={p.id} className="flex gap-3">
                        <img src={p.dataUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" style={{ border: '1px solid rgba(184,133,123,0.18)' }} />
                        <div className="flex-1">
                          <div className="font-display rose uppercase tracking-[0.2em] text-[9px] mb-1" style={{ fontWeight: 500 }}>{p.date}</div>
                          <input className="edit-input ink text-[13px] font-body w-full"
                            placeholder="What was this." value={p.caption}
                            onChange={(e) => updatePending(p.id, 'caption', e.target.value)} />
                        </div>
                        <button onClick={() => cancelPending(p.id)} className="muted text-base self-start">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-5">
                    <button onClick={saveAllPending}
                      className="font-display rose-deep text-[12px] tracking-[0.18em] uppercase nav-btn" style={{ fontWeight: 500 }}>
                      Save all →
                    </button>
                  </div>
                </div>
              )}

              {moments.length === 0 && pendingPhotos.length === 0 && (
                <p className="muted text-[12px] font-body italic font-display text-center mt-12">
                  When something matters today, keep it here.
                </p>
              )}

              <div className="space-y-6">
                {moments.map((m, i) => {
                  const shareState = shareMomentStatus[m.id] || '';
                  const photoData = m.photoId ? photoCache[m.photoId] : null;
                  return (
                    <div key={m.id} className="px-2 fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="font-display rose uppercase tracking-[0.2em] text-[9px]" style={{ fontWeight: 500 }}>{m.date}</span>
                        <div className="flex-1 border-t hairline" />
                        <button onClick={() => deleteMoment(m)} className="muted text-[10px] nav-btn" aria-label="Delete">×</button>
                        <button onClick={() => shareMoment(m)} disabled={shareState === 'sharing'}
                          className="font-display rose tracking-[0.2em] uppercase text-[9px] nav-btn"
                          style={{ fontWeight: 500, opacity: shareState === 'sharing' ? 0.5 : 1 }}>
                          {shareState === 'done' ? '✓ Shared' :
                           shareState === 'sharing' ? '...' :
                           shareState === 'error' ? 'Try again' :
                           '↗ Share'}
                        </button>
                      </div>
                      {photoData && (
                        <img src={photoData} alt="" className="w-full rounded-xl mb-3 object-cover" style={{ maxHeight: '280px', border: '1px solid rgba(184,133,123,0.18)' }} />
                      )}
                      {m.text && (
                        <p className="font-display ink leading-snug" style={{ fontWeight: 400, fontSize: '17px' }}>
                          {m.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        <div className="cream-card border-t hairline px-2 pt-3 pb-5">
          <div className="flex justify-around items-center">
            {[
              { id: 'Today', label: 'Today' },
              { id: 'Tidy', label: 'The Keeping' },
              { id: 'Kitchen', label: 'Kitchen' },
              { id: 'Girls', label: 'Girls' },
              { id: 'Moments', label: 'Moments' },
            ].map(({ id, label }) => {
              const active = id === activeNav;
              return (
                <button key={id} onClick={() => setActiveNav(id)} className="nav-btn flex flex-col items-center py-1 px-3">
                  <div className="nav-dot mb-2" style={{ background: active ? '#B8857B' : 'transparent' }} />
                  <span className="text-[9px] tracking-[0.18em] uppercase font-body"
                    style={{ color: active ? '#8B5A4F' : '#8E7B6E', fontWeight: active ? 600 : 400 }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
