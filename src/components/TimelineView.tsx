import type { CSSProperties } from "react";
import type { Project, Task } from "../lib/types";

interface TimelineViewProps {
  project: Project | null;
  tasks: Task[];
  projectAccentsById: Map<string, string>;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
}

const DAY_WIDTH = 76;
const LANE_HEIGHT = 98;
const EDGE_PADDING_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_NUMBER_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "2-digit" });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("it-IT", { weekday: "short" });
const MONTH_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "short" });
const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function diffDays(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  return startOfDay(new Date(`${value}T00:00:00`));
}

function normalizeTaskDates(task: Task) {
  const startValue = parseDate(task.startDate) ?? parseDate(task.dueDate);

  if (!startValue) {
    return null;
  }

  const endValue = parseDate(task.dueDate) ?? startValue;

  if (startValue.getTime() <= endValue.getTime()) {
    return { start: startValue, end: endValue };
  }

  return { start: endValue, end: startValue };
}

function formatRangeLabel(startDate: string | null, dueDate: string | null) {
  const startValue = parseDate(startDate);
  const endValue = parseDate(dueDate);

  if (startValue && endValue) {
    if (startValue.getTime() === endValue.getTime()) {
      return DATE_FORMAT.format(startValue);
    }

    return `${DATE_FORMAT.format(startValue)} - ${DATE_FORMAT.format(endValue)}`;
  }

  if (startValue) {
    return `Dal ${DATE_FORMAT.format(startValue)}`;
  }

  if (endValue) {
    return `Entro ${DATE_FORMAT.format(endValue)}`;
  }

  return "Data libera";
}

function normalizeHexColor(color: string | undefined) {
  const fallback = "#5e6bff";

  if (!color) {
    return fallback;
  }

  const normalized = color.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return fallback;
}

function hexToRgba(color: string, alpha: number) {
  const normalized = normalizeHexColor(color);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function assignLanes(tasks: Array<{ task: Task; start: Date; end: Date }>) {
  const orderedTasks = [...tasks].sort((left, right) => {
    const byStart = left.start.getTime() - right.start.getTime();

    if (byStart !== 0) {
      return byStart;
    }

    const leftDuration = diffDays(left.start, left.end);
    const rightDuration = diffDays(right.start, right.end);

    if (leftDuration !== rightDuration) {
      return rightDuration - leftDuration;
    }

    return left.task.createdAt.localeCompare(right.task.createdAt);
  });

  const laneEndByIndex: Date[] = [];

  return orderedTasks.map(({ task, start, end }) => {
    let laneIndex = laneEndByIndex.findIndex((laneEnd) => start.getTime() > laneEnd.getTime());

    if (laneIndex === -1) {
      laneIndex = laneEndByIndex.length;
      laneEndByIndex.push(end);
    } else {
      laneEndByIndex[laneIndex] = end;
    }

    return {
      task,
      start,
      end,
      lane: laneIndex,
    };
  });
}

export function TimelineView({
  project,
  tasks,
  projectAccentsById,
  onSelectTask,
  selectedTaskId,
}: TimelineViewProps) {
  const normalizedTasks = tasks
    .map((task) => {
      const normalized = normalizeTaskDates(task);

      if (!normalized) {
        return null;
      }

      return {
        task,
        start: normalized.start,
        end: normalized.end,
      };
    })
    .filter((task): task is { task: Task; start: Date; end: Date } => task !== null);

  if (!normalizedTasks.length) {
    return (
      <section className="empty-panel">
        <h3>Timeline vuota</h3>
        <p>Aggiungi date agli eventi per costruire la vista giorno per giorno.</p>
      </section>
    );
  }

  const timelineTasks = assignLanes(normalizedTasks);
  const today = startOfDay(new Date());
  const earliestTask = new Date(
    Math.min(...timelineTasks.map((entry) => entry.start.getTime())),
  );
  const latestTask = new Date(
    Math.max(...timelineTasks.map((entry) => entry.end.getTime())),
  );
  const minDate = earliestTask.getTime() < today.getTime() ? earliestTask : today;
  const maxDate = latestTask.getTime() > today.getTime() ? latestTask : today;
  const rangeStart = addDays(minDate, -EDGE_PADDING_DAYS);
  const rangeEnd = addDays(maxDate, EDGE_PADDING_DAYS);
  const dayCount = diffDays(rangeStart, rangeEnd) + 1;
  const laneCount = Math.max(1, timelineTasks.reduce((maxLane, entry) => Math.max(maxLane, entry.lane), 0) + 1);
  const boardHeight = laneCount * LANE_HEIGHT;
  const boardWidth = dayCount * DAY_WIDTH;
  const todayIndex = diffDays(rangeStart, today);
  const hasTodayLine = todayIndex >= 0 && todayIndex < dayCount;

  const dayColumns = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(rangeStart, index);
    const isMonthStart = index === 0 || date.getDate() === 1;
    return {
      index,
      date,
      dayLabel: DAY_NUMBER_FORMAT.format(date),
      weekdayLabel: WEEKDAY_FORMAT.format(date).replace(".", ""),
      monthLabel: isMonthStart ? MONTH_FORMAT.format(date) : "",
    };
  });

  return (
    <section className="timeline-shell timeline-shell--daily">
      <header className="timeline-shell__header">
        <div>
          <p className="eyebrow">Timeline giornaliera</p>
          <h2>{project?.name ?? "Tutti i workspace"}</h2>
          <p>{DATE_FORMAT.format(rangeStart)} - {DATE_FORMAT.format(rangeEnd)}</p>
        </div>
        <div className="timeline-shell__meta">
          <span className="timeline-shell__today-badge">
            <span aria-hidden="true" />
            Oggi
          </span>
        </div>
      </header>

      <div className="timeline-daily">
        <div className="timeline-daily__scroller">
          <div
            className="timeline-daily__board"
            style={
              {
                "--timeline-day-width": `${DAY_WIDTH}px`,
                "--timeline-board-width": `${boardWidth}px`,
                "--timeline-board-height": `${boardHeight}px`,
                "--timeline-day-count": String(dayCount),
              } as CSSProperties
            }
          >
            {hasTodayLine ? (
              <div
                className="timeline-daily__today-line"
                style={{ left: `${todayIndex * DAY_WIDTH + DAY_WIDTH / 2}px` }}
                aria-hidden="true"
              />
            ) : null}

            <div className="timeline-daily__header-row">
              {dayColumns.map((column) => (
                <div key={column.index} className="timeline-daily__day-cell">
                  <span className="timeline-daily__month">
                    {column.monthLabel}
                  </span>
                  <strong>{column.dayLabel}</strong>
                  <small>{column.weekdayLabel}</small>
                </div>
              ))}
            </div>

            <div className="timeline-daily__lane-area">
              {Array.from({ length: laneCount }).map((_, laneIndex) => (
                <div
                  key={laneIndex}
                  className="timeline-daily__lane"
                  style={{ top: `${laneIndex * LANE_HEIGHT}px` }}
                  aria-hidden="true"
                />
              ))}

              {timelineTasks.map((entry) => {
                const startOffset = diffDays(rangeStart, entry.start);
                const spanDays = diffDays(entry.start, entry.end) + 1;
                const eventColor = normalizeHexColor(
                  entry.task.timelineColor || projectAccentsById.get(entry.task.projectId),
                );
                const eventStyle: CSSProperties = {
                  left: `${startOffset * DAY_WIDTH + 8}px`,
                  top: `${entry.lane * LANE_HEIGHT + 22}px`,
                  width: `${Math.max(spanDays * DAY_WIDTH - 16, DAY_WIDTH - 16)}px`,
                  background: `linear-gradient(135deg, ${hexToRgba(eventColor, 0.96)}, ${hexToRgba(eventColor, 0.68)})`,
                  borderColor: hexToRgba(eventColor, 0.42),
                  boxShadow: `0 10px 24px ${hexToRgba(eventColor, 0.28)}`,
                };

                return (
                  <button
                    key={entry.task.id}
                    type="button"
                    className={[
                      "timeline-event",
                      selectedTaskId === entry.task.id ? "is-selected" : "",
                    ].join(" ")}
                    style={eventStyle}
                    onClick={() => onSelectTask(entry.task.id)}
                  >
                    <strong className="timeline-event__title">{entry.task.title}</strong>
                    <span className="timeline-event__meta">
                      {formatRangeLabel(entry.task.startDate, entry.task.dueDate)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
