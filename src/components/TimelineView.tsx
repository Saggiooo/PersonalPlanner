import { useState } from "react";
import type { Project, Task } from "../lib/types";

type TimelineScale = "day" | "three-days" | "week" | "month" | "year";

interface TimelineBucket {
  key: string;
  start: Date;
  end: Date;
  label: string;
}

const TIMELINE_SCALES: Array<{ id: TimelineScale; label: string }> = [
  { id: "day", label: "1 giorno" },
  { id: "three-days", label: "3 giorni" },
  { id: "week", label: "1 settimana" },
  { id: "month", label: "1 mese" },
  { id: "year", label: "1 anno" },
];

interface TimelineViewProps {
  project: Project | null;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
}

function toDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

function formatLabel(value: string | null) {
  if (!value) {
    return "Data libera";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  next.setMilliseconds(-1);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function buildBuckets(startBoundary: Date, endBoundary: Date, scale: TimelineScale) {
  const buckets: TimelineBucket[] = [];

  if (scale === "month") {
    let cursor = startOfMonth(startBoundary);

    while (cursor <= endBoundary) {
      buckets.push({
        key: cursor.toISOString(),
        start: new Date(cursor),
        end: endOfMonth(cursor),
        label: new Intl.DateTimeFormat("it-IT", {
          month: "short",
          year: "numeric",
        }).format(cursor),
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return buckets;
  }

  if (scale === "year") {
    let cursor = startOfYear(startBoundary);

    while (cursor <= endBoundary) {
      buckets.push({
        key: cursor.toISOString(),
        start: new Date(cursor),
        end: endOfYear(cursor),
        label: new Intl.DateTimeFormat("it-IT", {
          year: "numeric",
        }).format(cursor),
      });

      cursor = new Date(cursor.getFullYear() + 1, 0, 1);
    }

    return buckets;
  }

  const step = scale === "day" ? 1 : scale === "three-days" ? 3 : 7;
  let cursor = startOfDay(startBoundary);

  while (cursor <= endBoundary) {
    const bucketEnd = endOfDay(addDays(cursor, step - 1));
    const label =
      scale === "week"
        ? `${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(cursor)}`
        : new Intl.DateTimeFormat("it-IT", {
            day: "2-digit",
            month: "short",
          }).format(cursor);

    buckets.push({
      key: cursor.toISOString(),
      start: new Date(cursor),
      end: bucketEnd,
      label,
    });

    cursor = addDays(cursor, step);
  }

  return buckets;
}

function findBucketRange(start: Date, end: Date, buckets: TimelineBucket[]) {
  const startIndex = buckets.findIndex(
    (bucket) => bucket.end.getTime() >= start.getTime(),
  );
  let endIndex = -1;

  for (let index = buckets.length - 1; index >= 0; index -= 1) {
    if (buckets[index].start.getTime() <= end.getTime()) {
      endIndex = index;
      break;
    }
  }

  const safeStartIndex = Math.max(0, startIndex);

  return {
    startIndex: safeStartIndex,
    endIndex: Math.max(safeStartIndex, endIndex),
  };
}

export function TimelineView({
  project,
  tasks,
  onSelectTask,
  selectedTaskId,
}: TimelineViewProps) {
  const [scale, setScale] = useState<TimelineScale>("day");

  if (!project) {
    return (
      <section className="empty-panel">
        <h3>Nessun progetto selezionato</h3>
        <p>Seleziona un progetto per vedere la sua sequenza temporale.</p>
      </section>
    );
  }

  const datedTasks = tasks.filter((task) => task.startDate || task.dueDate);

  if (!datedTasks.length) {
    return (
      <section className="empty-panel">
        <h3>Timeline vuota</h3>
        <p>Aggiungi date ai task per ottenere una vista temporale del progetto.</p>
      </section>
    );
  }

  const normalizedRanges = datedTasks.map((task) => {
    const start = startOfDay(toDateValue(task.startDate) ?? toDateValue(task.dueDate)!);
    const end = endOfDay(toDateValue(task.dueDate) ?? toDateValue(task.startDate)!);
    return { task, start, end };
  });

  const startBoundary = new Date(
    Math.min(...normalizedRanges.map((range) => range.start.getTime())),
  );
  const endBoundary = new Date(
    Math.max(...normalizedRanges.map((range) => range.end.getTime())),
  );
  const buckets = buildBuckets(startBoundary, endBoundary, scale);
  const columnCount = Math.max(1, buckets.length);

  return (
    <section className="timeline-shell">
      <header className="timeline-shell__header">
        <div>
          <p className="eyebrow">Sequenza</p>
          <h2>{project.name}</h2>
        </div>
        <div className="timeline-shell__actions">
          <p>{project.description}</p>
          <div className="timeline-scale-switcher" aria-label="Scala timeline">
            {TIMELINE_SCALES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={scale === option.id ? "is-active" : ""}
                onClick={() => setScale(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="timeline-grid">
        <div
          className="timeline-grid__days"
          style={{ gridTemplateColumns: `220px repeat(${columnCount}, minmax(58px, 1fr))` }}
        >
          <span />
          {buckets.map((bucket) => (
            <span key={bucket.key}>
              {bucket.label}
            </span>
          ))}
        </div>

        <div className="timeline-grid__rows">
          {normalizedRanges.map(({ task, start, end }) => {
            const { startIndex, endIndex } = findBucketRange(start, end, buckets);

            return (
              <button
                key={task.id}
                type="button"
                className={`timeline-row ${selectedTaskId === task.id ? "is-selected" : ""}`}
                style={{
                  gridTemplateColumns: `220px repeat(${columnCount}, minmax(58px, 1fr))`,
                }}
                onClick={() => onSelectTask(task.id)}
              >
                <div className="timeline-row__meta">
                  <strong>{task.title}</strong>
                  <span>
                    {formatLabel(task.startDate)} - {formatLabel(task.dueDate)}
                  </span>
                </div>

                <div
                  className="timeline-row__track"
                  style={{
                    gridColumn: `${startIndex + 2} / ${endIndex + 3}`,
                  }}
                >
                  <span>{task.effort}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
