import { type FormEvent, useEffect, useRef, useState } from "react";
import { PRIORITY_OPTIONS } from "../lib/priorities";
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
    timelineColor: string | null;
  }) => void;
  onAdvance: (taskId: string) => void;
  onAddChecklistItem: (taskId: string, label: string) => void;
  onToggleChecklistItem: (itemId: string, completed: boolean) => void;
  onDeleteChecklistItem: (itemId: string) => void;
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
  onDeleteChecklistItem,
}: TaskDetailModalProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [editorBlock, setEditorBlock] = useState<"p" | "h1" | "h2" | "h3" | "ul">("p");
  const [editorMarks, setEditorMarks] = useState({
    bold: false,
    underline: false,
  });
  const [draft, setDraft] = useState({
    title: "",
    notes: "",
    effort: "Normale",
    startDate: "",
    dueDate: "",
    timelineColor: "",
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
      timelineColor: task.timelineColor ?? "",
    });
    setChecklistLabel("");
  }, [task]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== draft.notes) {
      editorRef.current.innerHTML = draft.notes;
    }
  }, [draft.notes]);

  useEffect(() => {
    function syncEditorState() {
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;
      const element =
        anchorNode instanceof Element
          ? anchorNode
          : anchorNode?.parentElement ?? null;
      const container = element?.closest(".task-editor__surface");

      if (!container || container !== editorRef.current) {
        return;
      }

      const blockElement = element?.closest("h1, h2, h3, p, li");

      if (blockElement?.tagName === "H1") {
        setEditorBlock("h1");
      } else if (blockElement?.tagName === "H2") {
        setEditorBlock("h2");
      } else if (blockElement?.tagName === "H3") {
        setEditorBlock("h3");
      } else if (blockElement?.tagName === "LI") {
        setEditorBlock("ul");
      } else {
        setEditorBlock("p");
      }

      setEditorMarks({
        bold: document.queryCommandState("bold"),
        underline: document.queryCommandState("underline"),
      });
    }

    document.addEventListener("selectionchange", syncEditorState);
    return () => document.removeEventListener("selectionchange", syncEditorState);
  }, []);

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
      timelineColor: draft.timelineColor || null,
    });
  }

  function handleAddChecklistItem() {
    if (!checklistLabel.trim()) {
      return;
    }

    onAddChecklistItem(currentTask.id, checklistLabel);
    setChecklistLabel("");
  }

  function syncNotesFromEditor() {
    const value = editorRef.current?.innerHTML ?? "";

    setDraft((current) => ({
      ...current,
      notes: value,
    }));
  }

  function applyEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncNotesFromEditor();
    const selection = window.getSelection();

    if (selection?.anchorNode) {
      const anchorElement =
        selection.anchorNode instanceof Element
          ? selection.anchorNode
          : selection.anchorNode.parentElement ?? null;

      if (anchorElement?.closest("h1")) {
        setEditorBlock("h1");
      } else if (anchorElement?.closest("h2")) {
        setEditorBlock("h2");
      } else if (anchorElement?.closest("h3")) {
        setEditorBlock("h3");
      } else if (anchorElement?.closest("li")) {
        setEditorBlock("ul");
      } else {
        setEditorBlock("p");
      }
    }

    setEditorMarks({
      bold: document.queryCommandState("bold"),
      underline: document.queryCommandState("underline"),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--detail"
        role="dialog"
        aria-modal="true"
        aria-label="Dettaglio evento"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header modal-card__header--detail">
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

          <div className="task-detail__fact">
            <span>Finestra</span>
            <strong>
              {formatDate(draft.startDate || null)} - {formatDate(draft.dueDate || null)}
            </strong>
          </div>

          <div className="task-detail__fact task-detail__fact--timeline-color">
            <span>Colore evento timeline</span>
            <div className="task-detail__timeline-color-controls">
              <input
                type="color"
                className="task-detail__timeline-color-input"
                value={draft.timelineColor || project.accent || "#5e6bff"}
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setDraft((current) => ({
                    ...current,
                    timelineColor: value,
                  }));
                }}
                aria-label="Scegli colore personalizzato per evento timeline"
              />
              <button
                type="button"
                className="task-detail__timeline-color-reset"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    timelineColor: "",
                  }))
                }
              >
                Usa colore workspace
              </button>
            </div>
          </div>

          <label className="task-detail__description">
            <span>Descrizione</span>
            <div className="task-editor">
              <div className="task-editor__toolbar" role="toolbar" aria-label="Formato descrizione">
                <div className="task-editor__toolbar-group">
                  <button
                    type="button"
                    className={editorBlock === "p" ? "is-active" : ""}
                    onClick={() => applyEditorCommand("formatBlock", "<p>")}
                  >
                    Paragrafo
                  </button>
                  <button
                    type="button"
                    className={editorBlock === "h1" ? "is-active" : ""}
                    onClick={() => applyEditorCommand("formatBlock", "<h1>")}
                  >
                    Titolo 1
                  </button>
                  <button
                    type="button"
                    className={editorBlock === "h2" ? "is-active" : ""}
                    onClick={() => applyEditorCommand("formatBlock", "<h2>")}
                  >
                    Titolo 2
                  </button>
                  <button
                    type="button"
                    className={editorBlock === "h3" ? "is-active" : ""}
                    onClick={() => applyEditorCommand("formatBlock", "<h3>")}
                  >
                    Titolo 3
                  </button>
                </div>
                <div className="task-editor__toolbar-group">
                  <button
                    type="button"
                    className={editorMarks.bold ? "is-active" : ""}
                    onClick={() => applyEditorCommand("bold")}
                  >
                    Grassetto
                  </button>
                  <button
                    type="button"
                    className={editorMarks.underline ? "is-active" : ""}
                    onClick={() => applyEditorCommand("underline")}
                  >
                    Sottolineato
                  </button>
                  <button
                    type="button"
                    className={editorBlock === "ul" ? "is-active" : ""}
                    onClick={() => applyEditorCommand("insertUnorderedList")}
                  >
                    Elenco puntato
                  </button>
                </div>
              </div>
              <p className="task-editor__hint">
                Usa Paragrafo per il testo normale. I titoli servono solo per dare struttura.
              </p>
              <div
                ref={editorRef}
                className="task-editor__surface"
                contentEditable
                suppressContentEditableWarning
                onInput={syncNotesFromEditor}
                data-placeholder="Scrivi una descrizione piu ricca, con titoli, enfasi ed elenchi."
              />
            </div>
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
                  <div
                    key={item.id}
                    className={`task-checklist__item ${item.completed ? "is-complete" : ""}`}
                  >
                    <label className="task-checklist__toggle">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(event) =>
                          onToggleChecklistItem(item.id, event.currentTarget.checked)
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                    <button
                      type="button"
                      className="task-checklist__remove"
                      onClick={() => onDeleteChecklistItem(item.id)}
                      aria-label={`Elimina voce checklist ${item.label}`}
                    >
                      Elimina
                    </button>
                  </div>
                ))
              ) : (
                <p className="task-checklist__empty">Nessun punto ancora nella checklist.</p>
              )}
            </div>

            <div className="task-checklist__form">
              <input
                value={checklistLabel}
                onChange={(event) => setChecklistLabel(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                placeholder="Aggiungi un task alla checklist"
              />
              <button type="button" className="task-checklist__add" onClick={handleAddChecklistItem}>
                Aggiungi
              </button>
            </div>
          </section>

          <div className="modal-actions">
            <button type="button" className="modal-button modal-button--ghost" onClick={onClose}>
              Annulla
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
