import { useState } from 'react';
import { Checkbox, EditToggle } from './Components.jsx';
import { useThoughtItems } from '../hooks/useThoughtItems.js';

export default function ThoughtsTab({ listsHook }) {
  const [newTitleOpen, setNewTitleOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState(null);

  const handleCreate = async () => {
    const t = newTitle.trim();
    setNewTitle('');
    setNewTitleOpen(false);
    const row = await listsHook.create(t);
    if (row?.id) setJustCreatedId(row.id);
  };

  const cancelNew = () => {
    setNewTitle('');
    setNewTitleOpen(false);
  };

  return (
    <div className="pt-6 px-5 pb-8">
      <p className="muted text-[12px] font-body italic font-display px-2 mb-5 leading-relaxed">
        Lists for what you're holding.
      </p>

      {/* New-list entry */}
      <div className="cream-card rounded-2xl border-soft px-5 py-4 mb-5">
        {newTitleOpen ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="edit-input ink text-[14px] font-body flex-1"
              placeholder="What is this?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') cancelNew();
              }}
            />
            <button
              onClick={cancelNew}
              className="font-display muted text-[10px] tracking-[0.22em] uppercase">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="font-display rose-deep text-[11px] tracking-[0.22em] uppercase nav-btn"
              style={{ fontWeight: 500 }}>
              Done
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNewTitleOpen(true)}
            className="w-full text-left font-display rose-deep text-[12px] tracking-[0.22em] uppercase"
            style={{ fontWeight: 500 }}>
            + New list
          </button>
        )}
      </div>

      {/* Active lists */}
      {listsHook.active.length === 0 ? (
        <p className="muted text-[12px] font-body italic font-display text-center mt-12">
          Nothing here yet. Start one.
        </p>
      ) : (
        <div className="space-y-4">
          {listsHook.active.map((list) => (
            <ThoughtListCard
              key={list.id}
              list={list}
              mode="active"
              autoEdit={list.id === justCreatedId}
              onRename={(t) => listsHook.rename(list.id, t)}
              onArchive={() => listsHook.archive(list.id)}
              onRestore={() => listsHook.restore(list.id)}
              onDeleteList={() => listsHook.removeList(list.id)}
            />
          ))}
        </div>
      )}

      {/* Show archived */}
      {listsHook.archived.length > 0 && !showArchived && (
        <div className="text-center mt-10">
          <button
            onClick={() => setShowArchived(true)}
            className="font-display rose text-[11px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Show archived ({listsHook.archived.length})
          </button>
        </div>
      )}

      {showArchived && (
        <>
          <div className="mt-10 border-t hairline" />
          <p className="muted text-[10px] tracking-[0.28em] uppercase font-body text-center mt-6 mb-4">
            Archived
          </p>
          <div className="space-y-4">
            {listsHook.archived.map((list) => (
              <ThoughtListCard
                key={list.id}
                list={list}
                mode="archived"
                onRename={(t) => listsHook.rename(list.id, t)}
                onArchive={() => listsHook.archive(list.id)}
                onRestore={() => listsHook.restore(list.id)}
                onDeleteList={() => listsHook.removeList(list.id)}
              />
            ))}
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => setShowArchived(false)}
              className="font-display muted text-[10px] tracking-[0.22em] uppercase">
              Hide archived
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ThoughtListCard({ list, mode, autoEdit, onRename, onArchive, onRestore, onDeleteList }) {
  const itemsHook = useThoughtItems(list.id);
  const [editing, setEditing] = useState(!!autoEdit);
  const [draftTitle, setDraftTitle] = useState(list.title);
  const [newItemText, setNewItemText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isArchived = mode === 'archived';
  const titleClasses = isArchived
    ? 'font-display muted italic'
    : 'font-display ink';

  const commitTitle = () => {
    if (draftTitle !== list.title) onRename(draftTitle);
  };

  const addItem = async () => {
    const t = newItemText.trim();
    if (!t) return;
    setNewItemText('');
    await itemsHook.add(t);
  };

  const handleItemBlur = (item) => {
    if (item.text.trim() === '') itemsHook.remove(item.id);
  };

  return (
    <div className="cream-card rounded-2xl border-soft px-5 py-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        {editing && !isArchived ? (
          <input
            className="edit-input ink text-[18px] font-display flex-1"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            placeholder="Untitled"
            style={{ fontWeight: 400 }}
          />
        ) : (
          <div className={titleClasses} style={{ fontWeight: 400, fontSize: '18px' }}>
            {list.title || 'Untitled'}
          </div>
        )}
        {!isArchived && (
          <EditToggle editing={editing} onClick={() => {
            if (editing) commitTitle();
            setEditing((v) => !v);
          }} />
        )}
      </div>

      <div className="space-y-2">
        {itemsHook.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <button
              onClick={() => !isArchived && itemsHook.toggle(it.id)}
              disabled={isArchived}>
              <Checkbox done={it.done} />
            </button>
            {editing && !isArchived ? (
              <>
                <input
                  className="edit-input ink text-[14px] font-body flex-1"
                  value={it.text}
                  onChange={(e) => itemsHook.edit(it.id, e.target.value)}
                  onBlur={() => handleItemBlur(it)}
                />
                <button
                  onClick={() => itemsHook.remove(it.id)}
                  aria-label="Delete item"
                  className="muted text-base">×</button>
              </>
            ) : (
              <span className={`text-[14px] font-body flex-1 ${(it.done || isArchived) ? 'muted line-through' : 'ink'}`}>
                {it.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {!isArchived && (
        <div className="mt-3 flex items-center gap-2 pt-3 border-t hairline">
          <input
            autoFocus={!!autoEdit}
            className="bg-transparent outline-none ink text-[13px] font-body flex-1"
            placeholder="Add an item"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
          />
          <button
            onClick={addItem}
            disabled={!newItemText.trim()}
            className="font-display rose-deep text-[10px] tracking-[0.22em] uppercase"
            style={{ fontWeight: 500, opacity: newItemText.trim() ? 1 : 0.3 }}>
            Add
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {editing && !isArchived ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="muted text-[11px] font-body italic">Delete this list? It can't be brought back.</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="font-display muted text-[10px] tracking-[0.22em] uppercase">
                No
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setEditing(false);
                  onDeleteList();
                }}
                className="font-display rose-deep text-[10px] tracking-[0.22em] uppercase"
                style={{ fontWeight: 500 }}>
                Delete list
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="font-display rose-deep text-[10px] tracking-[0.22em] uppercase"
              style={{ fontWeight: 500 }}>
              Delete list
            </button>
          )
        ) : (
          <span />
        )}
        {isArchived ? (
          <button
            onClick={onRestore}
            className="font-display rose text-[10px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Restore
          </button>
        ) : (
          <button
            onClick={onArchive}
            className="font-display rose text-[10px] tracking-[0.22em] uppercase nav-btn"
            style={{ fontWeight: 500 }}>
            Mark complete →
          </button>
        )}
      </div>
    </div>
  );
}
