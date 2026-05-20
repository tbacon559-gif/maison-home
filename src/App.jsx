import { useState, useEffect, useRef, useCallback } from 'react';

import { useAuth } from './lib/auth.jsx';
import { useProfile } from './hooks/useProfile.js';
import { useKids } from './hooks/useKids.js';
import { useHouseholdItems } from './hooks/useHouseholdItems.js';
import { useDailyTasks } from './hooks/useDailyTasks.js';
import { useWeeklyTasks } from './hooks/useWeeklyTasks.js';
import { useMeals } from './hooks/useMeals.js';
import { useListItems } from './hooks/useListItems.js';
import { useNotes } from './hooks/useNotes.js';
import { useMoments } from './hooks/useMoments.js';

import {
  calcAge, nextBirthday, shortDate, todayLabel,
  relativeLabel, timeLabel,
} from './lib/dates.js';
import { upcomingEvents } from './lib/ics.js';
import { buildMomentSVG, getImageDims, shareOrDownload } from './lib/svg.js';
import { shouldResetDaily, shouldResetWeekly, isSeventhDay } from './lib/rollover.js';
import { essayOfWeek } from './data/keep.js';
import { hasLocalData, importLocalData } from './lib/migrate.js';

import { Checkbox, EditToggle, SectionHead, Styles } from './components/Components.jsx';
import WelcomeOverlay from './components/WelcomeOverlay.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import SitterCardModal from './components/SitterCardModal.jsx';
import SitterShareModal from './components/SitterShareModal.jsx';
import { useShareLinks } from './hooks/useShareLinks.js';
import TidyTab from './components/TidyTab.jsx';
import KitchenTab from './components/KitchenTab.jsx';
import SeventhDay from './components/SeventhDay.jsx';
import KeepCallout from './components/KeepCallout.jsx';
import KeepReader from './components/KeepReader.jsx';
import OnboardingFlow from './components/OnboardingFlow.jsx';
import ReviewPendingScreen from './components/ReviewPendingScreen.jsx';
import TrialEndedBanner from './components/TrialEndedBanner.jsx';

function todaysWorkLine(hour = new Date().getHours()) {
  if (hour < 11) return 'A morning to begin gently.';
  if (hour < 14) return 'The middle of a day, held.';
  if (hour < 18) return 'An afternoon, kept as it is.';
  if (hour < 21) return 'An evening softening down.';
  return 'A late hour. Be kind to it.';
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export default function App() {
  const { status, effectiveStatus } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-start justify-center py-6 px-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #F4E0D2 0%, #E5C9B5 55%, #D2A88F 100%)',
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}>
      <Styles />
      <div className="relative cream-bg rounded-[36px] app-shadow overflow-hidden w-full flex flex-col"
        style={{ maxWidth: '420px', minHeight: '780px' }}>

        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="muted text-[12px] font-body italic font-display">…</p>
          </div>
        )}

        {status === 'signed_out' && (
          <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
            <p className="font-display ink text-[15px] italic mb-4">Something went wrong opening the app.</p>
            <p className="muted text-[12px] font-body italic font-display">Reload to try again.</p>
          </div>
        )}

        {status === 'onboarding' && <PostSignupRouter />}

        {status === 'authenticated' && effectiveStatus === 'hardship_pending' && (
          <ReviewPendingScreen />
        )}

        {status === 'authenticated' && effectiveStatus !== 'hardship_pending' && (
          <MainApp />
        )}
      </div>
    </div>
  );
}

// After signup, decide between auto-import and standard onboarding
function PostSignupRouter() {
  const { userId, encryptionKey, finishOnboarding } = useAuth();
  const [decided, setDecided] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (decided) return;
    if (!userId) return; // encryptionKey is null for anonymous users — that's fine
    if (hasLocalData()) {
      setImporting(true);
      setDecided(true);
      importLocalData(userId, encryptionKey)
        .then(() => { setImporting(false); finishOnboarding(); })
        .catch((err) => { setImporting(false); setImportError(err.message || 'Import failed'); });
    } else {
      setDecided(true);
    }
  }, [decided, userId, encryptionKey, finishOnboarding]);

  if (importing) {
    return (
      <div className="px-7 pt-16 pb-10 flex-1 flex flex-col items-center text-center">
        <p className="font-display ink text-[16px] italic">Bringing your data with you…</p>
      </div>
    );
  }
  if (importError) {
    return (
      <div className="px-7 pt-16 pb-10 flex-1 flex flex-col items-center text-center">
        <p className="font-display ink text-[15px] italic mb-6">Import had a problem: {importError}</p>
        <button onClick={() => { setDecided(false); setImportError(''); }}
          className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
          style={{ fontWeight: 500 }}>Try again</button>
      </div>
    );
  }
  return <OnboardingFlow />;
}

function MainApp() {
  const { effectiveStatus, userId } = useAuth();
  const profileHook = useProfile();
  const { profile } = profileHook;
  const kidsHook = useKids();
  const { kids } = kidsHook;
  const householdHook = useHouseholdItems();
  const { items: household } = householdHook;
  const dailyHook = useDailyTasks();
  const weeklyHook = useWeeklyTasks();
  const mealsHook = useMeals();
  const groceriesHook = useListItems('grocery');
  const toBuyHook = useListItems('tobuy');
  const notesHook = useNotes();
  const momentsHook = useMoments();

  // Volatile UI state
  const [activeNav, setActiveNav] = useState('Today');
  const [greeting, setGreeting] = useState('Good morning');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSitterCard, setShowSitterCard] = useState(false);
  const shareLinks = useShareLinks();
  const [shareModal, setShareModal] = useState({ open: false, mode: 'create', editing: null });
  const [revokingToken, setRevokingToken] = useState(null);
  const [keepReaderOpen, setKeepReaderOpen] = useState(false);
  const currentEssay = essayOfWeek();

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState('idle');

  const [newNote, setNewNote] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [editingMeals, setEditingMeals] = useState(false);
  const [editingGroceries, setEditingGroceries] = useState(false);
  const [editingToBuy, setEditingToBuy] = useState(false);
  const [editingGirl, setEditingGirl] = useState(null);
  const [editingHousehold, setEditingHousehold] = useState(false);
  const [editingSitter, setEditingSitter] = useState(false);

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [shareMomentStatus, setShareMomentStatus] = useState({});
  const [photoUrls, setPhotoUrls] = useState({}); // momentId -> object URL

  // Greeting based on time of day
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Day rollover effect — runs once after profile + hooks are loaded
  const [rolloverChecked, setRolloverChecked] = useState(false);
  useEffect(() => {
    if (!profile || rolloverChecked) return;
    if (dailyHook.loading || weeklyHook.loading) return;
    setRolloverChecked(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    (async () => {
      if (!profile.last_daily_reset_date) {
        await profileHook.update({ last_daily_reset_date: todayStr });
      } else if (shouldResetDaily(profile.last_daily_reset_date, today)) {
        await dailyHook.resetAll();
        await profileHook.update({ last_daily_reset_date: todayStr });
      }
      if (!profile.last_weekly_reset_date) {
        await profileHook.update({ last_weekly_reset_date: todayStr });
      } else if (shouldResetWeekly(profile.last_weekly_reset_date, today)) {
        await weeklyHook.resetAll();
        await profileHook.update({ last_weekly_reset_date: todayStr });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, dailyHook.loading, weeklyHook.loading, rolloverChecked]);

  // Calendar fetch
  const fetchCalendar = useCallback(async () => {
    if (!profile?.calendar_url) {
      setCalendarStatus('unset');
      setCalendarEvents([]);
      return;
    }
    setCalendarStatus('loading');
    try {
      const res = await fetch(`/api/calendar?url=${encodeURIComponent(profile.calendar_url)}`);
      if (!res.ok) throw new Error('Calendar fetch failed: ' + res.status);
      const text = await res.text();
      const events = upcomingEvents(text, { limit: 5 });
      setCalendarEvents(events);
      setCalendarStatus('ok');
    } catch (err) {
      console.error('Calendar error:', err);
      setCalendarStatus('error');
    }
  }, [profile?.calendar_url]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  // Photo loading — fetch + decrypt for any moment with a photo path not yet cached
  useEffect(() => {
    const idsNeeded = momentsHook.moments
      .filter((m) => m.photo_storage_path && !photoUrls[m.id])
      .map((m) => m.id);
    if (idsNeeded.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const id of idsNeeded) {
        try {
          const buf = await momentsHook.getPhoto(id);
          if (buf) {
            const blob = new Blob([buf]);
            updates[id] = URL.createObjectURL(blob);
          }
        } catch (err) { console.error('getPhoto failed', id, err); }
      }
      if (!cancelled && Object.keys(updates).length) {
        setPhotoUrls((p) => ({ ...p, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [momentsHook.moments]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    await notesHook.add(newNote);
    setNewNote('');
  };

  // Photo flow — stage in memory, then save via useMoments.add
  const onPhotoPick = async (e) => {
    const files = Array.from(e.target.files || []);
    const staged = await Promise.all(
      files.map((f) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          tempId: Date.now() + Math.random(),
          file: f,
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
    setPendingPhotos((p) => p.map((x) => (x.tempId === id ? { ...x, [field]: val } : x)));
  const cancelPending = (id) => setPendingPhotos((p) => p.filter((x) => x.tempId !== id));

  const saveAllPending = async () => {
    for (const p of pendingPhotos) {
      try {
        const buf = await p.file.arrayBuffer();
        await momentsHook.add({
          dateLabel: p.date, caption: p.caption, photoArrayBuffer: buf,
        });
      } catch (err) {
        console.error('save moment failed', err);
      }
    }
    setPendingPhotos([]);
  };

  const deleteMomentLocal = async (m) => {
    if (!confirm('Delete this moment?')) return;
    if (photoUrls[m.id]) {
      URL.revokeObjectURL(photoUrls[m.id]);
      setPhotoUrls((p) => { const x = { ...p }; delete x[m.id]; return x; });
    }
    await momentsHook.remove(m.id);
  };

  const shareMoment = async (moment) => {
    setShareMomentStatus((p) => ({ ...p, [moment.id]: 'sharing' }));
    try {
      let photoDataUrl = null;
      if (moment.photo_storage_path) {
        const buf = await momentsHook.getPhoto(moment.id);
        if (buf) {
          photoDataUrl = `data:image/jpeg;base64,${arrayBufferToBase64(buf)}`;
        }
      }
      const dims = await getImageDims(photoDataUrl);
      const svg = buildMomentSVG(
        { ...moment, text: moment.text, date: moment.date_label },
        photoDataUrl,
        dims
      );
      const result = await shareOrDownload(svg, `moment-${moment.id}.png`, 'A moment from Maison');
      setShareMomentStatus((p) => ({ ...p, [moment.id]: result === 'cancelled' ? '' : 'done' }));
      setTimeout(() => setShareMomentStatus((p) => ({ ...p, [moment.id]: '' })), 1500);
    } catch (err) {
      console.error(err);
      setShareMomentStatus((p) => ({ ...p, [moment.id]: 'error' }));
      setTimeout(() => setShareMomentStatus((p) => ({ ...p, [moment.id]: '' })), 2000);
    }
  };

  return (
    <>
      {showWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        profile={profile}
        profileHook={profileHook}
      />
      <SitterCardModal
        open={showSitterCard}
        onClose={() => setShowSitterCard(false)}
        girls={kids}
        household={household.map((h) => ({ key: h.label, value: h.value }))}
        sitterNotes={profile?.sitter_notes || ''}
      />
      <SitterShareModal
        open={shareModal.open}
        mode={shareModal.mode}
        editing={shareModal.editing}
        onCreate={(plan) => shareLinks.create(plan)}
        onSave={(token, plan) => shareLinks.updatePlan(token, plan)}
        onClose={() => setShareModal({ open: false, mode: 'create', editing: null })}
      />
      {revokingToken && (
        <div onClick={() => setRevokingToken(null)}
          className="absolute inset-0 z-50 flex items-center justify-center p-4 fade-in"
          style={{ background: 'rgba(60, 40, 30, 0.55)', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()}
            className="cream-bg rounded-2xl p-6 max-w-[340px] app-shadow text-center">
            <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '18px' }}>
              End this link?
            </div>
            <p className="muted text-[12px] font-body mb-5 leading-relaxed">
              The sitter's page will say it's ended.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setRevokingToken(null)}
                className="font-display muted text-[11px] tracking-[0.22em] uppercase">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await shareLinks.revoke(revokingToken);
                  setRevokingToken(null);
                }}
                className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
                End now
              </button>
            </div>
          </div>
        </div>
      )}
      <KeepReader open={keepReaderOpen} essay={currentEssay} onClose={() => setKeepReaderOpen(false)} />

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

      {(effectiveStatus === 'trial_expired' || effectiveStatus === 'cancelled') && <TrialEndedBanner />}

      <div className="scroll-area overflow-y-auto flex-1 pb-2" key={activeNav}>

        {/* TODAY */}
        {activeNav === 'Today' && (isSeventhDay() ? (
          <SeventhDay
            moments={momentsHook.moments.map((m) => ({ id: m.id, date: m.date_label, text: m.text, photoId: m.id }))}
            photoCache={photoUrls}
          />
        ) : (
          <>
            <div className="px-7 pt-7 pb-5 fade-in">
              <h1 className="font-display ink" style={{ fontWeight: 400, fontSize: '34px', lineHeight: 1.1 }}>
                {greeting},<br />
                <span className="font-display rose-deep" style={{ fontStyle: 'italic', fontWeight: 300 }}>
                  {profile?.greeting_name || 'friend'}
                </span>
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

            {/* Quick Notes */}
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
                {notesHook.notes.length === 0 && (
                  <p className="muted text-[12px] font-body italic font-display text-center py-2">
                    Nothing pending. A quiet head.
                  </p>
                )}
                {notesHook.notes.map((n) => (
                  <div key={n.id} className="flex items-center gap-3">
                    <button onClick={() => !editingNotes && notesHook.toggle(n.id)}>
                      <Checkbox done={n.done} />
                    </button>
                    {editingNotes ? (
                      <>
                        <input className="edit-input ink text-[14px] font-body flex-1"
                          value={n.text}
                          onChange={(e) => notesHook.edit(n.id, e.target.value)} />
                        <button onClick={() => notesHook.remove(n.id)} className="muted text-base">×</button>
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
        ))}

        {/* TIDY */}
        {activeNav === 'Tidy' && (
          <TidyTab
            dailyHook={dailyHook}
            weeklyHook={weeklyHook}
            editingDaily={editingDaily} setEditingDaily={setEditingDaily}
            editingWeekly={editingWeekly} setEditingWeekly={setEditingWeekly}
          />
        )}

        {/* NOURISH */}
        {activeNav === 'Nourish' && (
          <KitchenTab
            mealsHook={mealsHook}
            groceriesHook={groceriesHook}
            toBuyHook={toBuyHook}
            editingMeals={editingMeals} setEditingMeals={setEditingMeals}
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
              {kids.map((g, i) => {
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
                              value={g.name || ''} onChange={(e) => kidsHook.edit(g.id, { name: e.target.value })} />
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
                      {[
                        ['Birthday', 'birthday'],
                        ['Clothes', 'clothes_size'],
                        ['Shoe', 'shoe_size'],
                        ['Diaper', 'diaper_size'],
                        ['Allergies', 'allergies'],
                      ].map(([label, field]) => (
                        <div key={field} className="flex items-baseline gap-3">
                          <span className="font-display rose uppercase tracking-[0.18em] text-[9px]" style={{ fontWeight: 500, width: '78px' }}>{label}</span>
                          {isEditing ? (
                            <input
                              type={field === 'birthday' ? 'date' : 'text'}
                              className="edit-input ink text-[13px] font-body flex-1"
                              value={g[field] || ''} onChange={(e) => kidsHook.edit(g.id, { [field]: e.target.value || null })} />
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
                    <div key={h.id} className="flex items-baseline gap-3">
                      {editingHousehold ? (
                        <>
                          <input className="edit-input font-display rose uppercase tracking-[0.18em] text-[9px]"
                            style={{ fontWeight: 500, width: '90px' }}
                            value={h.label || ''} placeholder="Label"
                            onChange={(e) => householdHook.edit(h.id, { label: e.target.value })} />
                          <input className="edit-input ink text-[13px] font-body flex-1"
                            value={h.value || ''} placeholder="Info"
                            onChange={(e) => householdHook.edit(h.id, { value: e.target.value })} />
                          <button onClick={() => householdHook.remove(h.id)} className="muted text-base">×</button>
                        </>
                      ) : (
                        <>
                          <span className="font-display rose uppercase tracking-[0.18em] text-[9px]" style={{ fontWeight: 500, width: '88px' }}>{h.label}</span>
                          <span className="ink text-[13px] font-body">{h.value || <span className="muted italic">—</span>}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {editingHousehold && (
                  <button onClick={() => householdHook.add('', '')}
                    className="mt-4 font-display rose-deep text-[11px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
                    + Add detail
                  </button>
                )}
              </div>

              <div className="cream-card rounded-2xl p-6 border-soft">
                <SectionHead label="Sitter Notes" editing={editingSitter} onToggle={() => setEditingSitter((v) => !v)} />
                <div className="mt-3">
                  {editingSitter ? (
                    <textarea rows="6" value={profile?.sitter_notes || ''}
                      onChange={(e) => profileHook.update({ sitter_notes: e.target.value })}
                      className="edit-input ink text-[14px] font-body w-full" style={{ fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', minHeight: '120px', resize: 'vertical' }}
                      placeholder="Naps, routines, anything they should know." />
                  ) : (
                    <p className="ink text-[14px] leading-relaxed font-display whitespace-pre-line" style={{ fontStyle: 'italic' }}>
                      {profile?.sitter_notes || <span className="muted">No notes yet.</span>}
                    </p>
                  )}
                </div>
              </div>

              <div className="cream-card rounded-2xl p-6 border-soft text-center">
                <div className="font-display rose text-[10px] tracking-[0.28em] uppercase mb-2" style={{ fontWeight: 500 }}>✦ Sitter Card</div>
                <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '20px' }}>The Handoff</div>
                <p className="muted text-[12px] font-body mb-5 leading-relaxed">
                  Share the particulars — as a screenshot, or as a live page for tonight.
                </p>

                <div className="flex flex-col gap-3 items-center">
                  <button onClick={() => setShowSitterCard(true)}
                    className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                    style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
                    Share as image →
                  </button>
                  <button onClick={() => setShareModal({ open: true, mode: 'create', editing: null })}
                    className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
                    style={{ fontWeight: 500, padding: '10px 20px', border: '1px solid rgba(139,90,79,0.4)', borderRadius: '999px' }}>
                    Send a live link →
                  </button>
                </div>

                {shareLinks.active.length > 0 && (
                  <div className="mt-5 pt-5 border-t hairline space-y-3">
                    {shareLinks.active.map((link) => {
                      const t = new Date(link.expires_at).toLocaleTimeString([], {
                        hour: 'numeric', minute: '2-digit',
                      });
                      return (
                        <div key={link.token}
                          className="flex items-center justify-center gap-3 text-[12px] font-body muted italic">
                          <span>Live until {t}</span>
                          <span>·</span>
                          <button
                            onClick={() => setShareModal({ open: true, mode: 'edit', editing: link })}
                            className="ink underline-offset-2 hover:underline not-italic font-display text-[11px] tracking-[0.22em] uppercase">
                            Edit
                          </button>
                          <span>·</span>
                          <button
                            onClick={() => setRevokingToken(link.token)}
                            className="ink underline-offset-2 hover:underline not-italic font-display text-[11px] tracking-[0.22em] uppercase">
                            End now
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    <div key={p.tempId} className="flex gap-3">
                      <img src={p.dataUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" style={{ border: '1px solid rgba(184,133,123,0.18)' }} />
                      <div className="flex-1">
                        <div className="font-display rose uppercase tracking-[0.2em] text-[9px] mb-1" style={{ fontWeight: 500 }}>{p.date}</div>
                        <input className="edit-input ink text-[13px] font-body w-full"
                          placeholder="What was this." value={p.caption}
                          onChange={(e) => updatePending(p.tempId, 'caption', e.target.value)} />
                      </div>
                      <button onClick={() => cancelPending(p.tempId)} className="muted text-base self-start">×</button>
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

            {momentsHook.moments.length === 0 && pendingPhotos.length === 0 && (
              <p className="muted text-[12px] font-body italic font-display text-center mt-12">
                When something matters today, keep it here.
              </p>
            )}

            <div className="space-y-6">
              {momentsHook.moments.map((m, i) => {
                const shareState = shareMomentStatus[m.id] || '';
                const photoUrl = photoUrls[m.id];
                return (
                  <div key={m.id} className="px-2 fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="font-display rose uppercase tracking-[0.2em] text-[9px]" style={{ fontWeight: 500 }}>{m.date_label}</span>
                      <div className="flex-1 border-t hairline" />
                      <button onClick={() => deleteMomentLocal(m)} className="muted text-[10px] nav-btn" aria-label="Delete">×</button>
                      <button onClick={() => shareMoment(m)} disabled={shareState === 'sharing'}
                        className="font-display rose tracking-[0.2em] uppercase text-[9px] nav-btn"
                        style={{ fontWeight: 500, opacity: shareState === 'sharing' ? 0.5 : 1 }}>
                        {shareState === 'done' ? '✓ Shared' :
                         shareState === 'sharing' ? '...' :
                         shareState === 'error' ? 'Try again' :
                         '↗ Share'}
                      </button>
                    </div>
                    {photoUrl && (
                      <img src={photoUrl} alt="" className="w-full rounded-xl mb-3 object-cover" style={{ maxHeight: '280px', border: '1px solid rgba(184,133,123,0.18)' }} />
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
            { id: 'Tidy', label: 'Tidy' },
            { id: 'Nourish', label: 'Nourish' },
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
    </>
  );
}
