import type { BoardColumn, Project, Task } from "../lib/types";
import { getPriorityMeta } from "../lib/priorities";

interface TaskInspectorProps {
  task: Task | null;
  project: Project | null;
  columns: BoardColumn[];
}

function formatDate(value: string | null) {
  if (!value) {
    return "Da definire";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

export function TaskInspector({
  task,
  project,
  columns,
}: TaskInspectorProps) {
  if (!task || !project) {
    return (
      <aside className="inspector empty-inspector">
        <p className="eyebrow">Dettaglio</p>
        <h3>Seleziona un task</h3>
        <p>
          Clicca una card nella board o nella timeline per vedere contesto,
          finestra temporale e posizione del lavoro.
        </p>
      </aside>
    );
  }

  const column = columns.find((item) => item.id === task.columnId);
  const priority = getPriorityMeta(task.effort);

  return (
    <aside className="inspector">
      <div className="inspector__accent" style={{ background: project.accent }} />
      <p className="eyebrow">Task selezionato</p>
      <h3>{task.title}</h3>
      <p className="inspector__project">{project.name}</p>
      <p className="inspector__notes">{task.notes || "Nessuna nota aggiuntiva."}</p>

      <dl className="inspector__facts">
        <div>
          <dt>Stato</dt>
          <dd>{column?.name ?? "Senza colonna"}</dd>
        </div>
        <div>
          <dt>Priorita</dt>
          <dd className={`priority-badge priority-badge--${priority.tone}`}>
            <span className="priority-badge__dot" />
            {priority.label}
          </dd>
        </div>
        <div>
          <dt>Lane</dt>
          <dd>{task.lane}</dd>
        </div>
        <div>
          <dt>Inizio</dt>
          <dd>{formatDate(task.startDate)}</dd>
        </div>
        <div>
          <dt>Fine</dt>
          <dd>{formatDate(task.dueDate)}</dd>
        </div>
      </dl>
    </aside>
  );
}
