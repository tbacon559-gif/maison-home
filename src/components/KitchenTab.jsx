import { useState } from 'react';
import { Checkbox, EditToggle } from './Components.jsx';
import { WEEK, FULL_DAY } from '../data/initial.js';

export default function KitchenTab({
  mealsHook,
  groceriesHook,
  toBuyHook,
  editingMeals, setEditingMeals,
  editingGroceries, setEditingGroceries,
  editingToBuy, setEditingToBuy,
}) {
  const [openList, setOpenList] = useState(null);

  const meals = mealsHook.meals;
  const groceries = groceriesHook.items;
  const toBuy = toBuyHook.items;

  return (
    <div className="pt-6 px-5 pb-8">
      <p className="muted text-[12px] font-body px-2 mb-5 leading-relaxed">
        Feeding people. Lists for the week.
      </p>

      {/* Meals — all seven days at once */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between px-2 mb-3">
          <div>
            <div className="font-display ink" style={{ fontWeight: 400, fontSize: '20px' }}>Meals</div>
            <div className="muted text-[10px] tracking-[0.18em] uppercase font-body mt-1">the week ahead</div>
          </div>
          <EditToggle editing={!!editingMeals} onClick={() => setEditingMeals(!editingMeals)} />
        </div>
        <div className="space-y-2">
          {WEEK.map((d) => {
            const m = meals[d] || { L: '', D: '' };
            return (
              <div key={d} className="cream-card rounded-2xl border-soft px-5 py-4">
                <div className="font-display rose text-[10px] tracking-[0.22em] uppercase mb-2" style={{ fontWeight: 500 }}>
                  {FULL_DAY[d]}
                </div>
                <div className="space-y-1.5">
                  {[['Lunch', 'L'], ['Dinner', 'D']].map(([k, slot]) => (
                    <div key={slot} className="flex items-baseline gap-3">
                      <span className="muted text-[10px] tracking-[0.16em] uppercase font-body w-[44px] shrink-0">{k}</span>
                      {editingMeals ? (
                        <input className="edit-input ink text-[13px] font-body flex-1"
                          value={m[slot] || ''}
                          onChange={(e) => mealsHook.setMeal(d, slot, e.target.value)}
                          placeholder="—" />
                      ) : (
                        <span className="ink text-[13px] font-body">
                          {m[slot] || <span className="muted">—</span>}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {/* Grocery */}
        <Dropdown
          open={openList === 'grocery'}
          onToggle={() => setOpenList(openList === 'grocery' ? null : 'grocery')}
          label="Grocery List"
          hint={`${groceries.filter((g) => !g.got).length} left`}>
          <ListEditor
            items={groceries}
            editing={editingGroceries}
            onEditToggle={() => setEditingGroceries((v) => !v)}
            onCheck={(id) => groceriesHook.toggle(id)}
            onEdit={(id, val) => groceriesHook.edit(id, val)}
            onDelete={(id) => groceriesHook.remove(id)}
            onAdd={() => groceriesHook.add()}
            addLabel="+ Add to the list"
            field="item"
            doneField="got" />
        </Dropdown>

        {/* To-Buy */}
        <Dropdown
          open={openList === 'tobuy'}
          onToggle={() => setOpenList(openList === 'tobuy' ? null : 'tobuy')}
          label="To-Buy"
          hint={`${toBuy.filter((g) => !g.got).length} left`}>
          <p className="muted text-[11px] font-body italic font-display mb-3 px-1">
            Household supplies. Gifts. Things to pick up.
          </p>
          <ListEditor
            items={toBuy}
            editing={editingToBuy}
            onEditToggle={() => setEditingToBuy((v) => !v)}
            onCheck={(id) => toBuyHook.toggle(id)}
            onEdit={(id, val) => toBuyHook.edit(id, val)}
            onDelete={(id) => toBuyHook.remove(id)}
            onAdd={() => toBuyHook.add()}
            addLabel="+ Add to the list"
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
                  value={it[field]} placeholder="Item."
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
