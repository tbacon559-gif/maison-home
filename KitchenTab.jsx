import { useState } from 'react';
import { Checkbox, EditToggle } from './Components.jsx';
import { WEEK, FULL_DAY } from '../data/initial.js';

export default function KitchenTab({
  meals, setMeals,
  groceries, setGroceries,
  toBuy, setToBuy,
  editingDay, setEditingDay,
  editingGroceries, setEditingGroceries,
  editingToBuy, setEditingToBuy,
}) {
  const [openList, setOpenList] = useState('meals');
  const [expandedDay, setExpandedDay] = useState(null);

  const editMeal = (day, slot, val) =>
    setMeals((p) => ({ ...p, [day]: { ...p[day], [slot]: val } }));

  return (
    <div className="pt-6 px-5 pb-8">
      <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">
        Meals, groceries, and what else needs grabbing. Tap a section to open.
      </p>

      <div className="space-y-3">
        {/* Meals */}
        <Dropdown
          open={openList === 'meals'}
          onToggle={() => setOpenList(openList === 'meals' ? null : 'meals')}
          label="Meals"
          hint="this week's plan">
          <div>
            {WEEK.map((d, i) => {
              const isOpen = expandedDay === d;
              const isEditing = editingDay === d;
              const m = meals[d] || { B: '', L: '', D: '' };
              return (
                <div key={d} className={i === 0 ? '' : 'border-t hairline'}>
                  <button onClick={() => setExpandedDay(isOpen ? null : d)}
                    className="w-full flex items-center justify-between py-3 text-left">
                    <span className="font-display ink" style={{ fontWeight: 400, fontSize: '14px' }}>{FULL_DAY[d]}</span>
                    <span className="rose text-[12px]" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.25s', display: 'inline-block' }}>→</span>
                  </button>
                  {isOpen && (
                    <div className="pb-3 pt-1">
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
        </Dropdown>

        {/* Grocery */}
        <Dropdown
          open={openList === 'grocery'}
          onToggle={() => setOpenList(openList === 'grocery' ? null : 'grocery')}
          label="Grocery List"
          hint={`${groceries.filter((g) => !g.got).length} left · this week`}>
          <ListEditor
            items={groceries}
            editing={editingGroceries}
            onEditToggle={() => setEditingGroceries((v) => !v)}
            onCheck={(id) => setGroceries((p) => p.map((x) => x.id === id ? { ...x, got: !x.got } : x))}
            onEdit={(id, val) => setGroceries((p) => p.map((x) => x.id === id ? { ...x, item: val } : x))}
            onDelete={(id) => setGroceries((p) => p.filter((x) => x.id !== id))}
            onAdd={() => setGroceries((p) => [...p, { id: Date.now(), item: '', got: false }])}
            addLabel="+ Add grocery item"
            field="item"
            doneField="got" />
        </Dropdown>

        {/* To-Buy */}
        <Dropdown
          open={openList === 'tobuy'}
          onToggle={() => setOpenList(openList === 'tobuy' ? null : 'tobuy')}
          label="To-Buy"
          hint={`${toBuy.filter((g) => !g.got).length} left · everything else`}>
          <p className="muted text-[11px] font-body italic font-display mb-3 px-1">
            Household supplies, gifts, things she'll grab when she's at Target.
          </p>
          <ListEditor
            items={toBuy}
            editing={editingToBuy}
            onEditToggle={() => setEditingToBuy((v) => !v)}
            onCheck={(id) => setToBuy((p) => p.map((x) => x.id === id ? { ...x, got: !x.got } : x))}
            onEdit={(id, val) => setToBuy((p) => p.map((x) => x.id === id ? { ...x, item: val } : x))}
            onDelete={(id) => setToBuy((p) => p.filter((x) => x.id !== id))}
            onAdd={() => setToBuy((p) => [...p, { id: Date.now(), item: '', got: false }])}
            addLabel="+ Add to-buy item"
            field="item"
            doneField="got" />
        </Dropdown>
      </div>
    </div>
  );
}

function Dropdown({ open, onToggle, label, hint, children }) {
  return (
    <div className="cream-card rounded-2xl border-soft overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-5 text-left">
        <div>
          <div className="font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}>{label}</div>
          <div className="muted text-[10px] tracking-[0.18em] uppercase font-body mt-1">{hint}</div>
        </div>
        <span className="rose text-[12px]" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.25s', display: 'inline-block' }}>→</span>
      </button>
      {open && (
        <div className="px-6 pb-5 pt-2 border-t hairline">
          {children}
        </div>
      )}
    </div>
  );
}

function ListEditor({ items, editing, onEditToggle, onCheck, onEdit, onDelete, onAdd, addLabel, field, doneField }) {
  return (
    <>
      <div className="flex justify-end mb-3">
        <EditToggle editing={editing} onClick={onEditToggle} />
      </div>
      <div className="space-y-3">
        {items.length === 0 && (
          <p className="muted text-[12px] font-body italic font-display text-center py-2">Nothing yet.</p>
        )}
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <button onClick={() => !editing && onCheck(it.id)}>
              <Checkbox done={it[doneField]} />
            </button>
            {editing ? (
              <>
                <input className="edit-input ink text-[14px] font-body flex-1"
                  value={it[field]} placeholder="Item…"
                  onChange={(e) => onEdit(it.id, e.target.value)} />
                <button onClick={() => onDelete(it.id)} className="muted text-base">×</button>
              </>
            ) : (
              <span className={`text-[14px] font-body flex-1 ${it[doneField] ? 'muted line-through' : 'ink'}`}>{it[field]}</span>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <button onClick={onAdd} className="mt-3 font-display rose-deep text-[10px] tracking-[0.18em] uppercase" style={{ fontWeight: 500 }}>
          {addLabel}
        </button>
      )}
    </>
  );
}
