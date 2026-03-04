import { useRef } from "react";
import { ARCHIVED_COLUMN_NAME } from "../lib/database";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ColumnIcon } from "../lib/columnIcons";
import { getPriorityMeta } from "../lib/priorities";
import type { BoardColumn, Task } from "../lib/types";

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

interface KanbanBoardProps {
  columns: BoardColumn[];
  tasks: Task[];
  selectedTaskId: string | null;
  projectNamesById: Map<string, string>;
  canCreateTask: boolean;
  onSelectTask: (taskId: string) => void;
  onMoveTask: (taskId: string, targetColumnId: string, targetIndex: number) => void;
  onCreateTask: (columnId: string) => void;
  onAdvanceTask: (taskId: string) => void;
  onOpenArchive: () => void;
}

interface BoardColumnCardProps {
  column: BoardColumn;
  tasks: Task[];
  selectedTaskId: string | null;
  projectNamesById: Map<string, string>;
  canCreateTask: boolean;
  onSelectTask: (taskId: string) => void;
  shouldSuppressClick: () => boolean;
  onCreateTask: (columnId: string) => void;
  onAdvanceTask: (taskId: string) => void;
  onOpenArchive: () => void;
}

function buildTaskId(taskId: string) {
  return `task:${taskId}`;
}

function buildColumnId(columnId: string) {
  return `column:${columnId}`;
}

function parseId(rawId: string) {
  const [kind, value] = rawId.split(":");
  return { kind, value };
}

function SortableTaskCard({
  task,
  selectedTaskId,
  projectNamesById,
  onSelectTask,
  shouldSuppressClick,
  onAdvanceTask,
}: {
  task: Task;
  selectedTaskId: string | null;
  projectNamesById: Map<string, string>;
  onSelectTask: (taskId: string) => void;
  shouldSuppressClick: () => boolean;
  onAdvanceTask: (taskId: string) => void;
}) {
  const priority = getPriorityMeta(task.effort);
  const previewNotes = stripHtml(task.notes);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: buildTaskId(task.id),
    data: {
      type: "task",
      taskId: task.id,
      columnId: task.columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`task-card task-card--board ${selectedTaskId === task.id ? "is-selected" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={style}
      onClick={() => {
        if (shouldSuppressClick()) {
          return;
        }

        onSelectTask(task.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();

          if (shouldSuppressClick()) {
            return;
          }

          onSelectTask(task.id);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <strong>{task.title}</strong>
      <p>{previewNotes || "Nessuna nota aggiuntiva."}</p>
      <div className="task-card__meta">
        <span className={`task-pill task-pill--priority task-pill--${priority.tone}`}>
          <span className="task-pill__dot" />
          {priority.label}
        </span>
        <div className="task-card__workspace">
          <span className="task-pill">{projectNamesById.get(task.projectId) ?? task.lane}</span>
          <button
            type="button"
            className="task-card__advance"
            aria-label={`Sposta ${task.title} alla fase successiva`}
            onClick={(event) => {
              event.stopPropagation();
              onAdvanceTask(task.id);
            }}
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardColumnCard({
  column,
  tasks,
  selectedTaskId,
  projectNamesById,
  canCreateTask,
  onSelectTask,
  shouldSuppressClick,
  onCreateTask,
  onAdvanceTask,
  onOpenArchive,
}: BoardColumnCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: buildColumnId(column.id),
    data: {
      type: "column",
      columnId: column.id,
    },
  });
  const isArchivedColumn = column.name === ARCHIVED_COLUMN_NAME;

  return (
    <section
      ref={setNodeRef}
      className={`board-column board-column--black ${isOver ? "is-over" : ""} ${isArchivedColumn ? "board-column--archived" : ""}`}
      aria-label={column.name}
      style={{ ["--column-accent" as string]: column.color }}
    >
      <header className="board-column__header board-column__header--black">
        <div className="board-column__headline">
          <span className="board-column__badge">
            <ColumnIcon icon={column.icon} className="board-column__badge-icon" />
            {column.name}
          </span>
          <span className="board-column__count">{tasks.length}</span>
        </div>
        {canCreateTask && !isArchivedColumn ? (
          <button
            type="button"
            className="board-column__delete"
            onClick={(event) => {
              event.stopPropagation();
              onCreateTask(column.id);
            }}
            aria-label={`Aggiungi evento nella fase ${column.name}`}
          >
            +
          </button>
        ) : null}
      </header>

      {isArchivedColumn ? (
        <button
          type="button"
          className="board-column__archive-trigger"
          onClick={onOpenArchive}
          aria-label="Apri archivio"
        >
          Mostra elenco
        </button>
      ) : (
        <SortableContext
          items={tasks.map((task) => buildTaskId(task.id))}
          strategy={verticalListSortingStrategy}
        >
          <div className="board-column__list">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                selectedTaskId={selectedTaskId}
                projectNamesById={projectNamesById}
                onSelectTask={onSelectTask}
                shouldSuppressClick={shouldSuppressClick}
                onAdvanceTask={onAdvanceTask}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {canCreateTask && !isArchivedColumn ? (
        <button
          type="button"
          className="board-column__footer board-column__footer--button"
          onClick={() => onCreateTask(column.id)}
        >
          + Aggiungi Attivita
        </button>
      ) : null}
    </section>
  );
}

export function KanbanBoard({
  columns,
  tasks,
  selectedTaskId,
  projectNamesById,
  canCreateTask,
  onSelectTask,
  onMoveTask,
  onCreateTask,
  onAdvanceTask,
  onOpenArchive,
}: KanbanBoardProps) {
  const suppressClickUntilRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  function shouldSuppressClick() {
    return Date.now() < suppressClickUntilRef.current;
  }

  function armClickSuppression() {
    suppressClickUntilRef.current = Date.now() + 180;
  }

  function handleDragStart(_event: DragStartEvent) {
    armClickSuppression();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    armClickSuppression();

    if (!over || active.id === over.id) {
      return;
    }

    const activeMeta = parseId(String(active.id));
    const overMeta = parseId(String(over.id));

    if (activeMeta.kind !== "task") {
      return;
    }

    const movingTask = tasks.find((task) => task.id === activeMeta.value);

    if (!movingTask) {
      return;
    }

    if (overMeta.kind === "column") {
      const destinationTasks = tasks.filter(
        (task) => task.columnId === overMeta.value && task.id !== movingTask.id,
      );

      onMoveTask(movingTask.id, overMeta.value, destinationTasks.length);
      return;
    }

    if (overMeta.kind !== "task") {
      return;
    }

    const targetTask = tasks.find((task) => task.id === overMeta.value);

    if (!targetTask) {
      return;
    }

    const destinationTasks = tasks.filter(
      (task) => task.columnId === targetTask.columnId && task.id !== movingTask.id,
    );
    const targetIndex = destinationTasks.findIndex((task) => task.id === targetTask.id);

    onMoveTask(movingTask.id, targetTask.columnId, Math.max(0, targetIndex));
  }

  function handleDragCancel(_event: DragCancelEvent) {
    armClickSuppression();
  }

  return (
    <section className="board-stage">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="board-grid board-grid--black">
          {columns.map((column) => (
            <BoardColumnCard
              key={column.id}
              column={column}
              tasks={tasks.filter((task) => task.columnId === column.id)}
              selectedTaskId={selectedTaskId}
              projectNamesById={projectNamesById}
              canCreateTask={canCreateTask}
              onSelectTask={onSelectTask}
              shouldSuppressClick={shouldSuppressClick}
              onCreateTask={onCreateTask}
              onAdvanceTask={onAdvanceTask}
              onOpenArchive={onOpenArchive}
            />
          ))}
        </div>
      </DndContext>
    </section>
  );
}
