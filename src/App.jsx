import { useState, useEffect, useRef, useCallback } from 'react';

import {
  ZONE_ORDER, INITIAL_TASKS, WEEK, FULL_DAY, INITIAL_MEALS,
  INITIAL_GROCERIES, INITIAL_GIRLS, INITIAL_HOUSEHOLD,
  INITIAL_SITTER_NOTES, INITIAL_MOMENTS, INITIAL_SETTINGS,
} from './data/initial.js';

import {
  calcAge, nextBirthday, shortDate, todayLabel,
  todayZone, tomorrowZone, relativeLabel, timeLabel,
} from './lib/dates.js';

import { lsGet, lsSet, photoSave, photoGet, photoDelete } from './lib/storage.js';
import { upcomingEvents } from './lib/ics.js';
import { buildMomentSVG, getImageDims, shareOrDownload } from './lib/svg.js';

import { Checkbox, EditToggle, SectionHead, Styles } from './components/Components.jsx';
import WelcomeOverlay from './components/WelcomeOverlay.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import SitterCardModal from './components/SitterCardModal.jsx';

// ─── Hook: persisted state ──────────────────────────────────────
function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => lsGet(key, initial));
  useEffect(() => {
    lsSet(key, value);
  }, [key, value]);
  return [value, setValue];
}

// ─── App ────────────────────────────────────────────────────────
export default function App() {
  // Persisted state
  const [tasksByZone, setTasksByZone] = usePersistedState('tasks', INITIAL_TASKS);
  const [meals, setMeals] = usePersistedState('meals', INITIAL_MEALS);
  const [groceries, setGroceries] = usePersistedState('groceries', INITIAL_GROCERIES);
  const [girls, setGirls] = usePersistedState('girls', INITIAL_GIRLS);
  const [household, setHousehold] = usePersistedState('household', INITIAL_HOUSEHOLD);
  const [sitterNotes, setSitterNotes] = usePersistedState('sitterNotes', INITIAL_SITTER_NOTES);
  const [moments, setMoments] = usePersistedState('moments', INITIAL_MOMENTS);
  const [settings, setSettings] = usePersistedState('settings', INITIAL_SETTINGS);
  const [winsBaseline] = useState(0);

  // Volatile UI state
  const [activeNav, setActiveNav] = useState('Today');
  const [greeting, setGreeting] = useState('Good morning');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSitterCard, setShowSitterCard] = useState(false);

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState('idle'); // idle | loading | ok | error | unset

  const [note, setNote] = useState('');
  const [expandedZone, setExpandedZone] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  const [editingZone, setEditingZone] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [editingGroceries, setEditingGroceries] = useState(false);
  const [editingGirl, setEditingGirl] = useState(null);
  const [editingHousehold, setEditingHousehold] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [shareMomentStatus, setShareMomentStatus] = useState({});
  const [photoCache, setPhotoCache] = useState({}); // momentId -> dataUrl

  // Compute today's zone
  const tZone = todayZone(ZONE_ORDER) || ZONE_ORDER[0];
  const todayTasks = tasksByZone[tZone] || [];
  const completedToday = todayTasks.filter((t) => t.done).length;
  const tmrwZone = tomorrowZone(ZONE_ORDER);

  // Greeting based on time of day
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Open default expanded zone/day to today
  useEffect(() => {
    setExpandedZone(tZone);
    const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
    setExpandedDay(today);
  }, [tZone]);

  // Fetch calendar
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

  // Load photos referenced by moments from IndexedDB
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

  // ─── Mutations ────────────────────────────────────────────────
  const toggleTask = (zone, id) =>
    setTasksByZone((p) => ({ ...p, [zone]: p[zone].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  const editTaskLabel = (zone, id, label) =>
    setTasksByZone((p) => ({ ...p, [zone]: p[zone].map((t) => (t.id === id ? { ...t, label } : t)) }));
  const deleteTask = (zone, id) =>
    setTasksByZone((p) => ({ ...p, [zone]: p[zone].filter((t) => t.id !== id) }));
  const addTask = (zone) =>
    setTasksByZone((p) => ({ ...p, [zone]: [...p[zone], { id: Date.now(), label: '', done: false }] }));

  const editMeal = (day, slot, val) =>
    setMeals((p) => ({ ...p, [day]: { ...p[day], [slot]: val } }));

  const toggleGrocery = (id) => setGroceries((p) => p.map((g) => (g.id === id ? { ...g, got: !g.got } : g)));
  const editGrocery = (id, item) => setGroceries((p) => p.map((g) => (g.id === id ? { ...g, item } : g)));
  const deleteGrocery = (id) => setGroceries((p) => p.filter((g) => g.id !== id));
  const addGrocery = () => setGroceries((p) => [...p, { id: Date.now(), item: '', got: false }]);

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
        newMoments.push({
          id: p.id,
          date: p.date,
          text: p.caption,
          photoId,
        });
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

  // Share a moment
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

  // ─── Render ───────────────────────────────────────────────────
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
              {activeNav === 'Girls' ? 'The Girls' : activeNav}
            </h2>
            <span className="font-display rose text-[10px] tracking-[0.32em]" style={{ fontWeight: 400 }}>MAISON</span>
          </div>
        )}

        <div className="mx-8 border-t hairline" />

        <div className="scroll-area overflow-y-auto flex-1 pb-2" key={activeNav}>

          {/* TODAY */}
          {activeNav === 'Today' && (
            <>
              <div className="px-7 pt-7 pb-5 fade-in" style={{ animationDelay: '0.05s' }}>
                <h1 className="font-display ink" style={{ fontWeight: 400, fontSize: '34px', lineHeight: 1.1 }}>
                  {greeting},<br />
                  <span className="font-display rose-deep" style={{ fontStyle: 'italic', fontWeight: 300 }}>Tiff</span>
                </h1>
              </div>

              {/* On the Calendar */}
              <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in" style={{ animationDelay: '0.12s' }}>
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
                        Connect your Google Calendar in settings to see what's coming up.
                      </p>
                    </button>
                  )}
                  {calendarStatus === 'error' && (
                    <p className="muted text-[12px] font-body italic">
                      Couldn't load events. Check the URL in settings.
                    </p>
                  )}
                  {calendarStatus === 'loading' && calendarEvents.length === 0 && (
                    <p className="muted text-[12px] font-body italic">Loading…</p>
                  )}
                  {(calendarStatus === 'ok' || calendarEvents.length > 0) && calendarEvents.length === 0 && (
                    <p className="muted text-[12px] font-body italic">Nothing coming up.</p>
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

              {/* Today's Focus */}
              <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Today's Focus</span>
                </div>
                <div className="font-display ink mb-5" style={{ fontWeight: 400, fontSize: '26px' }}>{tZone}</div>
                <div className="space-y-3.5">
                  {todayTasks.map((t) => (
                    <button key={t.id} onClick={() => toggleTask(tZone, t.id)} className="flex items-center gap-3 w-full text-left">
                      <Checkbox done={t.done} />
                      <span className={`text-[14px] font-body ${t.done ? 'muted line-through' : 'ink'}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
                {tmrwZone && (
                  <div className="mt-5 pt-4 border-t hairline flex items-center justify-between">
                    <span className="muted text-[11px] font-body">Tomorrow · {tmrwZone}</span>
                    <button onClick={() => setActiveNav('Tidy')} className="rose text-[14px]">→</button>
                  </div>
                )}
                {!tmrwZone && (
                  <div className="mt-5 pt-4 border-t hairline">
                    <span className="muted text-[11px] font-body italic font-display">Tomorrow's yours.</span>
                  </div>
                )}
              </div>

              {/* On the Table */}
              <div className="mx-5 mb-4 cream-card rounded-2xl p-6 border-soft fade-in" style={{ animationDelay: '0.28s' }}>
                <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-4">On the Table</div>
                <TodayMeals meals={meals} />
                <div className="mt-5 pt-4 border-t hairline">
                  <button onClick={() => setActiveNav('Meals')} className="muted text-[11px] font-body flex items-center justify-between w-full">
                    <span>Plan the week</span>
                    <span className="rose">→</span>
                  </button>
                </div>
              </div>

              {/* Quick Note */}
              <div className="mx-5 mb-5 fade-in" style={{ animationDelay: '0.36s' }}>
                <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2.5 px-1">Quick Note</div>
                <div className="cream-card rounded-2xl px-5 py-4 border-soft">
                  <input type="text" placeholder="Don't forget…" value={note} onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-transparent outline-none ink text-[14px] font-body" />
                </div>
              </div>

              {/* Wins */}
              <div className="mx-7 mb-8 pt-5 border-t hairline fade-in" style={{ animationDelay: '0.42s' }}>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="muted text-[10px] tracking-[0.28em] uppercase font-body">Today's Wins</div>
                    <div className="muted text-[12px] font-body mt-2 leading-relaxed" style={{ maxWidth: '230px' }}>
                      {completedToday > 0 ? `${completedToday} task${completedToday > 1 ? 's' : ''} done · keep going.` : 'Every small thing counts.'}
                    </div>
                  </div>
                  <div className="font-display rose-deep" style={{ fontWeight: 400, fontSize: '36px', lineHeight: 1 }}>
                    {winsBaseline + completedToday}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TIDY */}
          {activeNav === 'Tidy' && (
            <div className="pt-6 px-5 pb-8">
              <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">
                One zone a day, Mon–Fri. Three small tasks. Weekends are yours.
              </p>
              <div className="space-y-3">
                {ZONE_ORDER.map((zone, i) => {
                  const isToday = zone === tZone;
                  const isOpen = expandedZone === zone;
                  const isEditing = editingZone === zone;
                  const t = tasksByZone[zone] || [];
                  const done = t.filter((x) => x.done).length;
                  const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i];
                  return (
                    <div key={zone} className="cream-card rounded-2xl border-soft overflow-hidden fade-in" style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
                      <button onClick={() => setExpandedZone(isOpen ? null : zone)} className="w-full flex items-center justify-between px-6 py-5 text-left">
                        <div>
                          <div className="flex items-baseline gap-3">
                            <span className="font-display rose uppercase tracking-[0.18em] text-[10px]" style={{ fontWeight: 500 }}>{dayName}</span>
                            {isToday && <span className="rose-deep text-[10px] tracking-[0.16em] uppercase font-body" style={{ fontWeight: 600 }}>· today</span>}
                          </div>
                          <div className="font-display ink mt-1" style={{ fontWeight: 400, fontSize: '20px' }}>{zone}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="muted text-[11px] font-body">{done}/{t.length}</span>
                          <span className="rose text-[12px]" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.25s', display: 'inline-block' }}>→</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 pt-4 border-t hairline">
                          <div className="flex justify-end mb-2">
                            <EditToggle editing={isEditing} onClick={() => setEditingZone(isEditing ? null : zone)} />
                          </div>
                          <div className="space-y-3">
                            {t.map((task) => (
                              <div key={task.id} className="flex items-center gap-3">
                                <button onClick={() => !isEditing && toggleTask(zone, task.id)}>
                                  <Checkbox done={task.done} />
                                </button>
                                {isEditing ? (
                                  <>
                                    <input className="edit-input ink text-[14px] font-body flex-1"
                                      value={task.label} placeholder="Task…" onChange={(e) => editTaskLabel(zone, task.id, e.target.value)} />
                                    <button onClick={() => deleteTask(zone, task.id)} className="muted text-base">×</button>
                                  </>
                                ) : (
                                  <span className={`text-[14px] font-body flex-1 ${task.done ? 'muted line-through' : 'ink'}`}>{task.label}</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {isEditing && (
                            <button onClick={() => addTask(zone)} className="mt-4 font-display rose-deep text-[11px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
                              + Add task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="muted text-[11px] mt-6 text-center italic font-display">Sat &amp; Sun — your call.</p>
            </div>
          )}

          {/* MEALS */}
          {activeNav === 'Meals' && (
            <div className="pt-6 px-5 pb-8">
              <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">The week's plan. Tap a day to edit meals.</p>
              <div className="space-y-2 mb-7">
                {WEEK.map((d, i) => {
                  const isOpen = expandedDay === d;
                  const isEditing = editingDay === d;
                  const m = meals[d];
                  return (
                    <div key={d} className="cream-card rounded-2xl border-soft overflow-hidden fade-in" style={{ animationDelay: `${0.04 + i * 0.04}s` }}>
                      <button onClick={() => setExpandedDay(isOpen ? null : d)} className="w-full flex items-center justify-between px-6 py-4 text-left">
                        <span className="font-display ink" style={{ fontWeight: 400, fontSize: '16px' }}>{FULL_DAY[d]}</span>
                        <span className="rose text-[12px]" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.25s', display: 'inline-block' }}>→</span>
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 pt-3 border-t hairline">
                          <div className="flex justify-end mb-2">
                            <EditToggle editing={isEditing} onClick={() => setEditingDay(isEditing ? null : d)} />
                          </div>
                          <div className="space-y-2.5">
                            {[['Bkfst', 'B'], ['Lunch', 'L'], ['Dinner', 'D']].map(([k, slot]) => (
                              <div key={slot} className="flex items-baseline gap-4">
                                <span className="font-display rose uppercase tracking-[0.18em] w-[48px] text-[10px]" style={{ fontWeight: 500 }}>{k}</span>
                                {isEditing ? (
                                  <input className="edit-input ink text-[13px] font-body flex-1"
                                    value={m[slot] || ''} onChange={(e) => editMeal(d, slot, e.target.value)} />
                                ) : (
                                  <span className="ink text-[13px] font-body">{m[slot]}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="cream-card rounded-2xl p-6 border-soft">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Grocery List</span>
                  <div className="flex items-center gap-3">
                    <span className="font-display rose text-[11px]" style={{ fontStyle: 'italic' }}>{groceries.filter((g) => !g.got).length} left</span>
                    <EditToggle editing={editingGroceries} onClick={() => setEditingGroceries((v) => !v)} />
                  </div>
                </div>
                <div className="space-y-3 mt-4">
                  {groceries.map((g) => (
                    <div key={g.id} className="flex items-center gap-3">
                      <button onClick={() => !editingGroceries && toggleGrocery(g.id)}>
                        <Checkbox done={g.got} />
                      </button>
                      {editingGroceries ? (
                        <>
                          <input className="edit-input ink text-[14px] font-body flex-1"
                            value={g.item} placeholder="Item…" onChange={(e) => editGrocery(g.id, e.target.value)} />
                          <button onClick={() => deleteGrocery(g.id)} className="muted text-base">×</button>
                        </>
                      ) : (
                        <span className={`text-[14px] font-body flex-1 ${g.got ? 'muted line-through' : 'ink'}`}>{g.item}</span>
                      )}
                    </div>
                  ))}
                </div>
                {editingGroceries && (
                  <button onClick={addGrocery} className="mt-4 font-display rose-deep text-[11px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
                    + Add item
                  </button>
                )}
              </div>
            </div>
          )}

          {/* GIRLS */}
          {activeNav === 'Girls' && (
            <div className="pt-6 px-5 pb-8">
              <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">
                Sizes, allergies, the essentials. Everything a sitter or grandma might need.
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
                  <SectionHead label="Sitter Notes" editing={editingNotes} onToggle={() => setEditingNotes((v) => !v)} />
                  <div className="mt-3">
                    {editingNotes ? (
                      <textarea rows="6" value={sitterNotes} onChange={(e) => setSitterNotes(e.target.value)}
                        className="edit-input ink text-[14px] font-body w-full" style={{ fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', minHeight: '120px', resize: 'vertical' }}
                        placeholder="Naps, routines, snack rules, anything they should know…" />
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
                    Share everything above as one beautiful image. AirDrop to grandma, text to a sitter.
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
                The good stuff. Capture it before you forget.
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
                  <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-4">A few words for each…</div>
                  <div className="space-y-5">
                    {pendingPhotos.map((p) => (
                      <div key={p.id} className="flex gap-3">
                        <img src={p.dataUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" style={{ border: '1px solid rgba(184,133,123,0.18)' }} />
                        <div className="flex-1">
                          <div className="font-display rose uppercase tracking-[0.2em] text-[9px] mb-1" style={{ fontWeight: 500 }}>{p.date}</div>
                          <input className="edit-input ink text-[13px] font-body w-full"
                            placeholder="What was this?" value={p.caption}
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
                  Tap "Today's Photos" to start your journal.
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
            {['Today', 'Tidy', 'Meals', 'Girls', 'Moments'].map((label) => {
              const active = label === activeNav;
              return (
                <button key={label} onClick={() => setActiveNav(label)} className="nav-btn flex flex-col items-center py-1 px-3">
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

// ─── Helper component ─────────────────────────────────────────────
function TodayMeals({ meals }) {
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  const m = meals[day] || { B: '', L: '', D: '' };
  return (
    <div className="space-y-3.5">
      {[['Bkfst', m.B], ['Lunch', m.L], ['Dinner', m.D]].map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-4">
          <span className="font-display rose uppercase tracking-[0.18em] w-[52px] text-[10px]" style={{ fontWeight: 500 }}>{k}</span>
          <span className="ink text-[14px] font-body">{v || <span className="muted italic">—</span>}</span>
        </div>
      ))}
    </div>
  );
}
