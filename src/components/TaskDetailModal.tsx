import { type FormEvent, useEffect, useState } from "react";
import { PRIORITY_OPTIONS, getPriorityMeta } from "../lib/priorities";
import type { BoardColumn, ChecklistItem, Project, Task } from "../lib/types";

interface TaskDetailModalProps {
  task: Task | null;
  project: Project | null;
  columns: BoardColumn[];
  checklistItems: ChecklistItem[];
  onClose: () => void;
  onSave: (input: {
    taskId: string;
    title: string;
    notes: string;
    effort: string;
    startDate: string | null;
    dueDate: string | null;
  }) => void;
  onAdvance: (taskId: string) => void;
  onAddChecklistItem: (taskId: string, label: string) => void;
  onToggleChecklistItem: (itemId: string, completed: boolean) => void;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Da definire";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

export function TaskDetailModal({
  task,
  project,
  columns,
  checklistItems,
  onClose,
  onSave,
  onAdvance,
  onAddChecklistItem,
  onToggleChecklistItem,
}: TaskDetailModalProps) {
  const [draft, setDraft] = useState({
    title: "",
    notes: "",
    effort: "Normale",
    startDate: "",
    dueDate: "",
  });
  const [checklistLabel, setChecklistLabel] = useState("");

  useEffect(() => {
    if (!task) {
      return;
    }

    setDraft({
      title: task.title,
      notes: task.notes,
      effort: task.effort,
      startDate: task.startDate ?? "",
      dueDate: task.dueDate ?? "",
    });
    setChecklistLabel("");
  }, [task]);

  if (!task || !project) {
    return null;
  }

  const currentTask = task;
  const taskColumns = columns
    .filter((column) => column.projectId === currentTask.projectId)
    .sort((left, right) => left.position - right.position);
  const currentColumn =
    taskColumns.find((column) => column.id === currentTask.columnId) ?? null;
  const currentIndex = taskColumns.findIndex((column) => column.id === currentTask.columnId);
  const nextColumn = currentIndex >= 0 ? taskColumns[currentIndex + 1] ?? null : null;
  const priority = getPriorityMeta(draft.effort);
  const taskChecklist = checklistItems.filter((item) => item.taskId === currentTask.id);
  const completedItems = taskChecklist.filter((item) => item.completed).length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSave({
      taskId: currentTask.id,
      title: draft.title,
      notes: draft.notes,
      effort: draft.effort,
      startDate: draft.startDate || null,
      dueDate: draft.dueDate || null,
    });
  }

  function handleAddChecklistItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!checklistLabel.trim()) {
      return;
    }

    onAddChecklistItem(currentTask.id, checklistLabel);
    setChecklistLabel("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header modal-card__header--detail">
          <div>
            <p className="eyebrow">Evento</p>
            <h3 id="task-detail-title">{draft.title || "Nuovo titolo"}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            x
          </button>
        </div>

        <form className="task-detail" onSubmit={handleSubmit}>
          <label className="task-detail__title">
            <span>Titolo evento</span>
            <input
              value={draft.title}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((current) => ({
                  ...current,
                  title: value,
                }));
              }}
            />
          </label>

          <div className="task-detail__status">
            <div className="task-detail__status-row">
              <span className="task-detail__status-icon" style={{ color: currentColumn?.color ?? "#6f6f76" }}>
                ●
              </span>
              <span className="task-detail__label">Stato:</span>
              <strong>{currentColumn?.name ?? "Senza fase"}</strong>
            </div>
            {nextColumn ? (
              <button
                type="button"
                className="task-detail__advance"
                onClick={() => onAdvance(currentTask.id)}
                aria-label={`Sposta ${currentTask.title} alla fase ${nextColumn.name}`}
              >
                ✓
              </button>
            ) : null}
          </div>

          <div className="task-detail__grid">
            <label>
              <span>Data inizio</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setDraft((current) => ({
                    ...current,
                    startDate: value,
                  }));
                }}
              />
            </label>
            <label>
              <span>Data fine</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setDraft((current) => ({
                    ...current,
                    dueDate: value,
                  }));
                }}
              />
            </label>
            <label>
              <span>Priorita</span>
              <select
                value={draft.effort}
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setDraft((current) => ({
                    ...current,
                    effort: value,
                  }));
                }}
              >
                {PRIORITY_OPTIONS.map((priorityOption) => (
                  <option key={priorityOption}>{priorityOption}</option>
                ))}
              </select>
            </label>
            <div className="task-detail__fact">
              <span>Workspace</span>
              <strong>{project.name}</strong>
            </div>
          </div>

          <div className="task-detail__fact task-detail__fact--priority">
            <span>Priorita attuale</span>
            <strong className={`priority-badge priority-badge--${priority.tone}`}>
              <span className="priority-badge__dot" />
              {priority.label}
            </strong>
          </div>

          <div className="task-detail__fact">
            <span>Finestra</span>
            <strong>
              {formatDate(draft.startDate || null)} - {formatDate(draft.dueDate || null)}
            </strong>
          </div>

          <label className="task-detail__description">
            <span>Descrizione</span>
            <textarea
              value={draft.notes}
              rows={7}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((current) => ({
                  ...current,
                  notes: value,
                }));
              }}
            />
          </label>

          <section className="task-detail__checklist">
            <div className="task-detail__section-head">
              <div>
                <span>Lista di controllo</span>
                <strong>
                  {completedItems}/{taskChecklist.length || 0}
                </strong>
              </div>
            </div>

            <div className="task-checklist">
              {taskChecklist.length ? (
                taskChecklist.map((item) => (
                  <label
                    key={item.id}
                    className={`task-checklist__item ${item.completed ? "is-complete" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(event) =>
                        onToggleChecklistItem(item.id, event.currentTarget.checked)
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))
              ) : (
                <p className="task-checklist__empty">Nessun punto ancora nella checklist.</p>
              )}
            </div>

            <form className="task-checklist__form" onSubmit={handleAddChecklistItem}>
              <input
                value={checklistLabel}
                onChange={(event) => setChecklistLabel(event.currentTarget.value)}
                placeholder="Aggiungi un task alla checklist"
              />
              <button type="submit">Aggiungi</button>
            </form>
          </section>

          <div className="modal-actions">
            <button type="button" className="modal-button modal-button--ghost" onClick={onClose}>
              Chiudi
            </button>
            <button type="submit" className="modal-button">
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
