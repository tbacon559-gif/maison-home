import { Checkbox, EditToggle } from './Components.jsx';

export default function TidyTab({
  daily, setDaily,
  weekly, setWeekly,
  editingDaily, setEditingDaily,
  editingWeekly, setEditingWeekly,
}) {
  const weeklyDone = weekly.filter((t) => t.done).length;
  const weeklyTotal = weekly.length;

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

  return (
    <div className="pt-6 px-5 pb-8">
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
