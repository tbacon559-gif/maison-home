import { Checkbox, EditToggle } from './Components.jsx';
import { takeRestDay, graceRemaining, dailyPercent } from '../lib/streak.js';
import { STREAK_THRESHOLD, GRACE_PER_MONTH } from '../data/initial.js';

export default function TidyTab({
  daily, setDaily,
  weekly, setWeekly,
  streak, setStreak,
  editingDaily, setEditingDaily,
  editingWeekly, setEditingWeekly,
}) {
  const dailyAll = [...daily.day, ...daily.night];
  const dailyDone = dailyAll.filter((t) => t.done).length;
  const dailyTotal = dailyAll.length;
  const pct = dailyPercent(daily);
  const dailyPct = Math.round(pct * 100);
  const meetingThreshold = pct >= STREAK_THRESHOLD;

  const weeklyDone = weekly.filter((t) => t.done).length;
  const weeklyTotal = weekly.length;
  const grace = graceRemaining(streak);

  const toggleDaily = (slot, id) =>
    setDaily((p) => ({ ...p, [slot]: p[slot].map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  const editDaily = (slot, id, label) =>
    setDaily((p) => ({ ...p, [slot]: p[slot].map((t) => (t.id === id ? { ...t, label } : t)) }));
  const deleteDaily = (slot, id) =>
    setDaily((p) => ({ ...p, [slot]: p[slot].filter((t) => t.id !== id) }));
  const addDailyTask = (slot) =>
    setDaily((p) => ({ ...p, [slot]: [...p[slot], { id: Date.now(), label: '', done: false }] }));

  const toggleWeekly = (id) => setWeekly((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const editWeeklyTask = (id, label) => setWeekly((p) => p.map((t) => (t.id === id ? { ...t, label } : t)));
  const deleteWeeklyTask = (id) => setWeekly((p) => p.filter((t) => t.id !== id));
  const addWeeklyTask = () => setWeekly((p) => [...p, { id: Date.now(), label: '', done: false }]);

  const handleRestDay = () => {
    if (grace <= 0) return;
    if (!confirm("Bank today as a rest day? Your streak keeps going. Some days just are what they are.")) return;
    setStreak(takeRestDay(streak));
  };

  return (
    <div className="pt-6 px-5 pb-8">
      {/* Streak card */}
      <div className="cream-card rounded-2xl p-6 border-soft mb-5 fade-in">
        <div className="flex items-start justify-between">
          <div>
            <div className="muted text-[10px] tracking-[0.28em] uppercase font-body mb-2">
              {meetingThreshold ? 'Today is on track' : 'Keep going'}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display rose-deep" style={{ fontWeight: 400, fontSize: '38px', lineHeight: 1 }}>
                {streak.current}
              </span>
              <span className="font-display ink text-[14px]" style={{ fontStyle: 'italic' }}>
                {streak.current === 1 ? 'day strong' : 'days strong'}
              </span>
            </div>
            {streak.best > streak.current && (
              <div className="muted text-[11px] font-body mt-3" style={{ fontStyle: 'italic' }}>
                Best run: {streak.best} {streak.best === 1 ? 'day' : 'days'}
              </div>
            )}
          </div>
          <button
            onClick={handleRestDay}
            disabled={grace <= 0}
            className="font-display rose tracking-[0.18em] uppercase text-[9px] nav-btn flex items-center gap-1.5"
            style={{
              fontWeight: 500,
              padding: '6px 12px',
              border: '1px solid rgba(184,133,123,0.35)',
              borderRadius: '999px',
              opacity: grace <= 0 ? 0.4 : 1,
            }}>
            <span style={{ fontSize: '11px' }}>☾</span>
            Rest day
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="muted text-[10px] tracking-[0.18em] uppercase font-body">Today's list</span>
            <span className="muted text-[10px] font-body">{dailyDone}/{dailyTotal} · {dailyPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(184,133,123,0.15)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${dailyPct}%`,
                background: meetingThreshold ? '#8B5A4F' : '#B8857B',
                transition: 'width 0.4s ease, background 0.3s ease',
              }}
            />
          </div>
          <div className="muted text-[10px] font-body mt-2 italic font-display">
            {meetingThreshold
              ? '80% counts as kept — you can stop here.'
              : `${Math.max(0, 80 - dailyPct)}% to go to keep the streak.`}
          </div>
        </div>

        {grace > 0 && (
          <div className="mt-4 pt-4 border-t hairline">
            <span className="muted text-[10px] font-body italic font-display">
              {grace} rest day{grace === 1 ? '' : 's'} left this month — for the days that just are what they are.
            </span>
          </div>
        )}
      </div>

      {/* Daily — The Rhythm */}
      <div className="cream-card rounded-2xl p-6 border-soft mb-5 fade-in" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Daily</span>
          <EditToggle editing={editingDaily} onClick={() => setEditingDaily((v) => !v)} />
        </div>
        <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '22px' }}>The Rhythm</div>
        <p className="muted text-[11px] font-body italic font-display mb-5">
          Resets every day at midnight. Same list, fresh slate.
        </p>

        <SlotEditable
          title="Daytime" subtitle="quick wins"
          tasks={daily.day} editing={editingDaily}
          onToggle={(id) => toggleDaily('day', id)}
          onEdit={(id, val) => editDaily('day', id, val)}
          onDelete={(id) => deleteDaily('day', id)}
          onAdd={() => addDailyTask('day')} />

        <div className="border-t hairline my-4" />

        <SlotEditable
          title="Tonight" subtitle="after they're down"
          tasks={daily.night} editing={editingDaily}
          onToggle={(id) => toggleDaily('night', id)}
          onEdit={(id, val) => editDaily('night', id, val)}
          onDelete={(id) => deleteDaily('night', id)}
          onAdd={() => addDailyTask('night')} />
      </div>

      {/* Weekly — The Bigger Stuff */}
      <div className="cream-card rounded-2xl p-6 border-soft fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="muted text-[10px] tracking-[0.28em] uppercase font-body">Weekly</span>
          <div className="flex items-center gap-3">
            <span className="font-display rose text-[11px]" style={{ fontStyle: 'italic' }}>
              {weeklyDone}/{weeklyTotal}
            </span>
            <EditToggle editing={editingWeekly} onClick={() => setEditingWeekly((v) => !v)} />
          </div>
        </div>
        <div className="font-display ink mb-2" style={{ fontWeight: 400, fontSize: '22px' }}>The Bigger Stuff</div>
        <p className="muted text-[11px] font-body italic font-display mb-5">
          When there's a window. Resets every Sunday.
        </p>

        <div className="space-y-3">
          {weekly.map((task) => (
            <div key={task.id} className="flex items-center gap-3">
              <button onClick={() => !editingWeekly && toggleWeekly(task.id)}>
                <Checkbox done={task.done} />
              </button>
              {editingWeekly ? (
                <>
                  <input className="edit-input ink text-[14px] font-body flex-1"
                    value={task.label} placeholder="Task…"
                    onChange={(e) => editWeeklyTask(task.id, e.target.value)} />
                  <button onClick={() => deleteWeeklyTask(task.id)} className="muted text-base">×</button>
                </>
              ) : (
                <span className={`text-[14px] font-body flex-1 ${task.done ? 'muted line-through' : 'ink'}`}>{task.label}</span>
              )}
            </div>
          ))}
        </div>
        {editingWeekly && (
          <button onClick={addWeeklyTask} className="mt-3 font-display rose-deep text-[10px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
            + Add weekly task
          </button>
        )}
      </div>
    </div>
  );
}

function SlotEditable({ title, subtitle, tasks, editing, onToggle, onEdit, onDelete, onAdd }) {
  const done = tasks.filter((t) => t.done).length;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display rose-deep" style={{ fontStyle: 'italic', fontWeight: 400, fontSize: '13px' }}>{title}</span>
          <span className="muted text-[9px] font-body uppercase tracking-[0.16em]">{subtitle}</span>
        </div>
        <span className="muted text-[10px] font-body">{done}/{tasks.length}</span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3">
            <button onClick={() => !editing && onToggle(task.id)}>
              <Checkbox done={task.done} />
            </button>
            {editing ? (
              <>
                <input className="edit-input ink text-[14px] font-body flex-1"
                  value={task.label} placeholder="Task…"
                  onChange={(e) => onEdit(task.id, e.target.value)} />
                <button onClick={() => onDelete(task.id)} className="muted text-base">×</button>
              </>
            ) : (
              <span className={`text-[14px] font-body flex-1 ${task.done ? 'muted line-through' : 'ink'}`}>{task.label}</span>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <button onClick={onAdd} className="mt-3 font-display rose-deep text-[10px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
          + Add {title.toLowerCase()} task
        </button>
      )}
    </div>
  );
}
