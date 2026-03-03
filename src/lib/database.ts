import Database from "@tauri-apps/plugin-sql";
import type {
  BoardColumn,
  ChecklistItem,
  NewColumnInput,
  NewProjectInput,
  NewTaskInput,
  Project,
  Task,
  UpdateColumnInput,
  UpdateProjectInput,
  UpdateTaskInput,
  WorkspaceSnapshot,
} from "./types";

const DB_URL = "sqlite:organizer.db";
const DEFAULT_COLUMNS = [
  { name: "Da fare", color: "#6f6f76", icon: "circle-dashed" },
  { name: "In corso", color: "#5450ff", icon: "circle-solid" },
  { name: "In revisione", color: "#1f8fff", icon: "circle-outline" },
  { name: "Completato", color: "#00b886", icon: "diamond-solid" },
  { name: "Archiviato", color: "#4f5665", icon: "ring" },
];
const PROJECT_ACCENTS = ["#80614d", "#6d7d63", "#a1644c", "#6c5f86"];
const PROJECT_ICONS = ["💼", "📚", "🏠", "🧠", "💻", "🗂️", "🎯", "✍️"];
const DEFAULT_COLUMN_COLOR = "#5450ff";
export const ARCHIVED_COLUMN_NAME = "Archiviato";

let databasePromise: Promise<Database> | null = null;

type CountRow = { total: number };
type IdRow = { id: string };
type TaskLocationRow = { columnId: string };
type TaskProjectRow = { projectId: string; columnId: string };
type PositionedColumnRow = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  icon: string;
  position: number;
};
type TableInfoRow = { name: string };

function getDatabase() {
  if (!databasePromise) {
    databasePromise = Database.load(DB_URL);
  }

  return databasePromise;
}

function isoNow() {
  return new Date().toISOString();
}

function daysFromToday(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function getDefaultColumnColor(name: string, position: number) {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName === "backlog" || normalizedName === "da fare") {
    return "#6f6f76";
  }

  if (normalizedName === "in corso") {
    return "#5450ff";
  }

  if (normalizedName === "in revisione") {
    return "#1f8fff";
  }

  if (normalizedName === "completato") {
    return "#00b886";
  }

  if (normalizedName === "archiviato") {
    return "#4f5665";
  }

  return DEFAULT_COLUMNS[position % DEFAULT_COLUMNS.length]?.color ?? DEFAULT_COLUMN_COLOR;
}

function getDefaultColumnIcon(name: string, position: number) {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName === "backlog" || normalizedName === "da fare") {
    return "circle-dashed";
  }

  if (normalizedName === "in corso") {
    return "circle-solid";
  }

  if (normalizedName === "in revisione") {
    return "circle-outline";
  }

  if (normalizedName === "completato") {
    return "diamond-solid";
  }

  if (normalizedName === "archiviato") {
    return "ring";
  }

  return DEFAULT_COLUMNS[position % DEFAULT_COLUMNS.length]?.icon ?? "circle-solid";
}

function getDefaultProjectIcon(name: string, index = 0) {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.includes("lavor")) {
    return "💼";
  }

  if (normalizedName.includes("studio")) {
    return "📚";
  }

  if (normalizedName.includes("personal")) {
    return "🏠";
  }

  return PROJECT_ICONS[index % PROJECT_ICONS.length] ?? "🗂️";
}

async function seedWorkspace() {
  const db = await getDatabase();
  await ensureSchema(db);
  const rows = await db.select<CountRow[]>(
    "SELECT COUNT(*) AS total FROM projects",
  );

  if (rows[0]?.total) {
    return;
  }

  const now = isoNow();

  const projects = [
    {
      id: crypto.randomUUID(),
      name: "Lavoro",
      description:
        "Attivita, consegne e passaggi da tenere sotto controllo nel flusso di lavoro.",
      accent: PROJECT_ACCENTS[0],
      icon: "💼",
    },
    {
      id: crypto.randomUUID(),
      name: "Studio",
      description:
        "Tracciare sessioni di studio e output concreti con scadenze leggere ma visibili.",
      accent: PROJECT_ACCENTS[1],
      icon: "📚",
    },
    {
      id: crypto.randomUUID(),
      name: "Personale",
      description:
        "Commissioni, idee personali e impegni di casa organizzati in modo leggero.",
      accent: PROJECT_ACCENTS[2],
      icon: "🏠",
    },
  ];

  for (const project of projects) {
    await db.execute(
      `INSERT INTO projects (id, name, description, accent, icon, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
      [project.id, project.name, project.description, project.accent, project.icon, now],
    );

    for (const [position, column] of DEFAULT_COLUMNS.entries()) {
      await db.execute(
        `INSERT INTO board_columns (id, project_id, name, color, icon, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), project.id, column.name, column.color, column.icon, position],
      );
    }
  }

  const seededColumns = await db.select<BoardColumn[]>(
    `SELECT id, project_id AS projectId, name, color, icon, position
     FROM board_columns
     ORDER BY project_id, position`,
  );

  const firstProjectColumns = seededColumns.filter(
    (column) => column.projectId === projects[0].id,
  );
  const secondProjectColumns = seededColumns.filter(
    (column) => column.projectId === projects[1].id,
  );
  const thirdProjectColumns = seededColumns.filter(
    (column) => column.projectId === projects[2].id,
  );

  const tasks = [
    {
      projectId: projects[0].id,
      columnId: firstProjectColumns[0]?.id,
      title: "Mappare le viste principali",
      notes: "Overview, board per progetto, timeline e panorama aggregato.",
      effort: "Normale",
      lane: "product",
      position: 0,
      startDate: daysFromToday(0),
      dueDate: daysFromToday(2),
    },
    {
      projectId: projects[0].id,
      columnId: firstProjectColumns[1]?.id,
      title: "Definire il modello dati locale",
      notes: "Progetti, colonne, task e finestre temporali minimali.",
      effort: "Alta",
      lane: "system",
      position: 0,
      startDate: daysFromToday(0),
      dueDate: daysFromToday(4),
    },
    {
      projectId: projects[1].id,
      columnId: secondProjectColumns[1]?.id,
      title: "Sessione JavaScript avanzato",
      notes: "Due ore di pratica su stato, render e flussi dati.",
      effort: "Normale",
      lane: "learning",
      position: 0,
      startDate: daysFromToday(1),
      dueDate: daysFromToday(3),
    },
    {
      projectId: projects[1].id,
      columnId: secondProjectColumns[3]?.id,
      title: "Raccolta appunti settimana",
      notes: "Riordinare gli appunti e segnare i punti da ripassare.",
      effort: "Bassa",
      lane: "review",
      position: 0,
      startDate: daysFromToday(-3),
      dueDate: daysFromToday(-1),
    },
    {
      projectId: projects[2].id,
      columnId: thirdProjectColumns[0]?.id,
      title: "Organizzare documenti personali",
      notes: "Riordinare file e note importanti in cartelle stabili.",
      effort: "Bassa",
      lane: "home",
      position: 0,
      startDate: daysFromToday(2),
      dueDate: daysFromToday(5),
    },
  ];

  for (const task of tasks) {
    if (!task.columnId) {
      continue;
    }

    await db.execute(
      `INSERT INTO tasks (
        id, project_id, column_id, title, notes, effort, lane, position,
        start_date, due_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        crypto.randomUUID(),
        task.projectId,
        task.columnId,
        task.title,
        task.notes,
        task.effort,
        task.lane,
        task.position,
        task.startDate,
        task.dueDate,
        now,
      ],
    );
  }
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  await seedWorkspace();
  const db = await getDatabase();
  await ensureSchema(db);
  await ensureArchivedColumns(db);

  const [projects, columns, tasks, checklistItems] = await Promise.all([
    db.select<Project[]>(
      `SELECT id, name, description, parent_project_id AS parentProjectId, accent, icon, status, created_at AS createdAt
       FROM projects
       ORDER BY created_at DESC`,
    ),
    db.select<BoardColumn[]>(
      `SELECT id, project_id AS projectId, name, color, icon, position
       FROM board_columns
       ORDER BY project_id, position`,
    ),
    db.select<Task[]>(
      `SELECT
          id,
          project_id AS projectId,
          column_id AS columnId,
          title,
          notes,
          effort,
          lane,
          position,
          start_date AS startDate,
          due_date AS dueDate,
          created_at AS createdAt
       FROM tasks
       ORDER BY project_id, column_id, position`,
    ),
    db.select<ChecklistItem[]>(
      `SELECT
          id,
          task_id AS taskId,
          label,
          completed,
          position,
          created_at AS createdAt
       FROM task_checklist_items
       ORDER BY task_id, position`,
    ),
  ]);

  return { projects, columns, tasks, checklistItems };
}

export async function createProject(input: NewProjectInput) {
  const db = await getDatabase();
  await ensureSchema(db);
  const createdAt = isoNow();
  const id = crypto.randomUUID();
  const accent = PROJECT_ACCENTS[Math.floor(Math.random() * PROJECT_ACCENTS.length)];
  const icon = getDefaultProjectIcon(input.name, Math.floor(Math.random() * PROJECT_ICONS.length));

  await db.execute(
    `INSERT INTO projects (id, name, description, parent_project_id, accent, icon, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)`,
    [
      id,
      input.name.trim(),
      input.description.trim(),
      input.parentProjectId,
      accent,
      icon,
      createdAt,
    ],
  );

  if (!input.parentProjectId) {
    for (const [position, column] of DEFAULT_COLUMNS.entries()) {
      await db.execute(
        `INSERT INTO board_columns (id, project_id, name, color, icon, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), id, column.name, column.color, column.icon, position],
      );
    }
  }

  return id;
}

export async function createTask(input: NewTaskInput) {
  const db = await getDatabase();
  await ensureSchema(db);
  const nextRows = await db.select<{ nextPosition: number }[]>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
     FROM tasks
     WHERE column_id = $1`,
    [input.columnId],
  );

  await db.execute(
    `INSERT INTO tasks (
      id, project_id, column_id, title, notes, effort, lane, position,
      start_date, due_date, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      crypto.randomUUID(),
      input.projectId,
      input.columnId,
      input.title.trim(),
      input.notes.trim(),
      input.effort.trim() || "Nessuna",
      input.lane.trim() || "general",
      nextRows[0]?.nextPosition ?? 0,
      input.startDate,
      input.dueDate,
      isoNow(),
    ],
  );
}

export async function updateProject(input: UpdateProjectInput) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE projects
     SET name = $1,
         description = $2
     WHERE id = $3`,
    [input.name.trim(), input.description.trim(), input.projectId],
  );
}

export async function updateTask(input: UpdateTaskInput) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE tasks
     SET title = $1,
         notes = $2,
         effort = $3,
         start_date = $4,
         due_date = $5
     WHERE id = $6`,
    [
      input.title.trim(),
      input.notes.trim(),
      input.effort.trim() || "Nessuna",
      input.startDate,
      input.dueDate,
      input.taskId,
    ],
  );
}

async function reindexColumn(db: Database, taskIds: string[]) {
  for (const [position, id] of taskIds.entries()) {
    await db.execute(
      "UPDATE tasks SET position = $1 WHERE id = $2",
      [position, id],
    );
  }
}

async function reindexBoardColumns(
  db: Database,
  projectId: string,
  columnIds: string[],
) {
  for (const [position, id] of columnIds.entries()) {
    await db.execute(
      "UPDATE board_columns SET position = $1 WHERE id = $2 AND project_id = $3",
      [position, id, projectId],
    );
  }
}

export async function moveTask(
  taskId: string,
  targetColumnId: string,
  targetPosition: number,
) {
  const db = await getDatabase();
  await ensureSchema(db);
  const [task] = await db.select<TaskLocationRow[]>(
    `SELECT column_id AS columnId
     FROM tasks
     WHERE id = $1`,
    [taskId],
  );

  if (!task) {
    return;
  }

  const sourceColumnId = task.columnId;

  const sourceRows = await db.select<IdRow[]>(
    `SELECT id
     FROM tasks
     WHERE column_id = $1 AND id != $2
     ORDER BY position`,
    [sourceColumnId, taskId],
  );

  const destinationRows =
    sourceColumnId === targetColumnId
      ? sourceRows
      : await db.select<IdRow[]>(
          `SELECT id
           FROM tasks
           WHERE column_id = $1
           ORDER BY position`,
          [targetColumnId],
        );

  const orderedDestinationIds = destinationRows.map((row) => row.id);
  const insertionIndex = Math.max(
    0,
    Math.min(targetPosition, orderedDestinationIds.length),
  );

  orderedDestinationIds.splice(insertionIndex, 0, taskId);

  if (sourceColumnId !== targetColumnId) {
    await db.execute(
      "UPDATE tasks SET column_id = $1 WHERE id = $2",
      [targetColumnId, taskId],
    );
    await reindexColumn(
      db,
      sourceRows.map((row) => row.id),
    );
  }

  await reindexColumn(db, orderedDestinationIds);
}

export async function advanceTask(taskId: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  const [task] = await db.select<TaskProjectRow[]>(
    `SELECT project_id AS projectId, column_id AS columnId
     FROM tasks
     WHERE id = $1`,
    [taskId],
  );

  if (!task) {
    return false;
  }

  const [currentColumn] = await db.select<{ projectId: string }[]>(
    `SELECT project_id AS projectId
     FROM board_columns
     WHERE id = $1`,
    [task.columnId],
  );

  const columnOwnerId = currentColumn?.projectId ?? task.projectId;

  const projectColumns = await db.select<BoardColumn[]>(
    `SELECT id, project_id AS projectId, name, color, icon, position
     FROM board_columns
     WHERE project_id = $1
     ORDER BY position`,
    [columnOwnerId],
  );

  const currentIndex = projectColumns.findIndex((column) => column.id === task.columnId);
  const nextColumn = projectColumns[currentIndex + 1];

  if (!nextColumn) {
    return false;
  }

  const nextRows = await db.select<{ nextPosition: number }[]>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
     FROM tasks
     WHERE column_id = $1`,
    [nextColumn.id],
  );

  await moveTask(taskId, nextColumn.id, nextRows[0]?.nextPosition ?? 0);
  return true;
}

export async function createColumn(input: NewColumnInput) {
  const db = await getDatabase();
  await ensureSchema(db);
  const archivedColumn = await db.select<PositionedColumnRow[]>(
    `SELECT id, project_id AS projectId, name, color, icon, position
     FROM board_columns
     WHERE project_id = $1 AND name = $2
     LIMIT 1`,
    [input.projectId, ARCHIVED_COLUMN_NAME],
  );
  const rows = await db.select<{ nextPosition: number }[]>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
     FROM board_columns
     WHERE project_id = $1 AND name != $2`,
    [input.projectId, ARCHIVED_COLUMN_NAME],
  );
  const insertionPosition = archivedColumn[0]?.position ?? (rows[0]?.nextPosition ?? 0);

  await db.execute(
    `INSERT INTO board_columns (id, project_id, name, color, icon, position)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      crypto.randomUUID(),
      input.projectId,
      input.name.trim(),
      input.color?.trim() || DEFAULT_COLUMN_COLOR,
      input.icon?.trim() || "circle-solid",
      insertionPosition,
    ],
  );

  if (archivedColumn[0]) {
    const siblingColumns = await db.select<IdRow[]>(
      `SELECT id
       FROM board_columns
       WHERE project_id = $1
       ORDER BY CASE WHEN name = $2 THEN 1 ELSE 0 END, position, id`,
      [input.projectId, ARCHIVED_COLUMN_NAME],
    );

    await reindexBoardColumns(
      db,
      input.projectId,
      siblingColumns.map((column) => column.id),
    );
  }
}

export async function updateColumn(input: UpdateColumnInput) {
  const db = await getDatabase();
  await ensureSchema(db);
  const [column] = await db.select<PositionedColumnRow[]>(
    `SELECT id, project_id AS projectId, name, color, icon, position
     FROM board_columns
     WHERE id = $1`,
    [input.columnId],
  );

  if (!column || column.name === ARCHIVED_COLUMN_NAME) {
    return;
  }

  await db.execute(
    `UPDATE board_columns
     SET name = $1, color = $2, icon = $3
     WHERE id = $4`,
    [
      input.name.trim(),
      input.color.trim() || DEFAULT_COLUMN_COLOR,
      input.icon.trim() || "circle-solid",
      input.columnId,
    ],
  );
}

export async function reorderColumns(projectId: string, orderedColumnIds: string[]) {
  const db = await getDatabase();
  await ensureSchema(db);
  const archivedColumn = await db.select<IdRow[]>(
    `SELECT id
     FROM board_columns
     WHERE project_id = $1 AND name = $2
     LIMIT 1`,
    [projectId, ARCHIVED_COLUMN_NAME],
  );
  const nextOrder = archivedColumn[0]
    ? [...orderedColumnIds.filter((id) => id !== archivedColumn[0].id), archivedColumn[0].id]
    : orderedColumnIds;

  await reindexBoardColumns(db, projectId, nextOrder);
}

export async function deleteColumn(columnId: string) {
  const db = await getDatabase();
  await ensureSchema(db);
  const [column] = await db.select<PositionedColumnRow[]>(
    `SELECT id, project_id AS projectId, name, color, icon, position
     FROM board_columns
     WHERE id = $1`,
    [columnId],
  );

  if (!column) {
    return false;
  }

  if (column.name === ARCHIVED_COLUMN_NAME) {
    return false;
  }

  const siblingColumns = await db.select<PositionedColumnRow[]>(
    `SELECT id, project_id AS projectId, name, color, icon, position
     FROM board_columns
     WHERE project_id = $1
     ORDER BY position`,
    [column.projectId],
  );

  if (siblingColumns.length <= 1) {
    return false;
  }

  const fallbackColumn =
    siblingColumns.find((item) => item.position === column.position - 1) ??
    siblingColumns.find((item) => item.id !== column.id);

  if (!fallbackColumn) {
    return false;
  }

  const movingTasks = await db.select<IdRow[]>(
    `SELECT id
     FROM tasks
     WHERE column_id = $1
     ORDER BY position`,
    [column.id],
  );
  const fallbackTasks = await db.select<IdRow[]>(
    `SELECT id
     FROM tasks
     WHERE column_id = $1
     ORDER BY position`,
    [fallbackColumn.id],
  );

  for (const task of movingTasks) {
    await db.execute(
      "UPDATE tasks SET column_id = $1 WHERE id = $2",
      [fallbackColumn.id, task.id],
    );
  }

  await reindexColumn(db, [
    ...fallbackTasks.map((task) => task.id),
    ...movingTasks.map((task) => task.id),
  ]);

  await db.execute(
    "DELETE FROM board_columns WHERE id = $1",
    [column.id],
  );

  await reindexBoardColumns(
    db,
    column.projectId,
    siblingColumns.filter((item) => item.id !== column.id).map((item) => item.id),
  );

  return true;
}

export async function deleteProject(projectId: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    "DELETE FROM tasks WHERE project_id = $1",
    [projectId],
  );
  await db.execute(
    "DELETE FROM board_columns WHERE project_id = $1",
    [projectId],
  );
  await db.execute(
    "DELETE FROM projects WHERE id = $1",
    [projectId],
  );
}

export async function createChecklistItem(taskId: string, label: string) {
  const db = await getDatabase();
  await ensureSchema(db);
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    return;
  }

  const nextRows = await db.select<{ nextPosition: number }[]>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
     FROM task_checklist_items
     WHERE task_id = $1`,
    [taskId],
  );

  await db.execute(
    `INSERT INTO task_checklist_items (id, task_id, label, completed, position, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      crypto.randomUUID(),
      taskId,
      trimmedLabel,
      0,
      nextRows[0]?.nextPosition ?? 0,
      isoNow(),
    ],
  );
}

export async function toggleChecklistItem(itemId: string, completed: boolean) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE task_checklist_items
     SET completed = $1
     WHERE id = $2`,
    [completed ? 1 : 0, itemId],
  );
}

export async function updateProjectIcon(projectId: string, icon: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE projects
     SET icon = $1
     WHERE id = $2`,
    [icon, projectId],
  );
}

async function ensureSchema(db: Database) {
  const columnRows = await db.select<TableInfoRow[]>(
    "PRAGMA table_info(board_columns)",
  );
  const hasColor = columnRows.some((column) => column.name === "color");
  const hasColumnIcon = columnRows.some((column) => column.name === "icon");
  const projectRows = await db.select<TableInfoRow[]>(
    "PRAGMA table_info(projects)",
  );
  const hasIcon = projectRows.some((column) => column.name === "icon");
  const hasParentProject = projectRows.some((column) => column.name === "parent_project_id");

  if (!hasColor) {
    await db.execute(
      "ALTER TABLE board_columns ADD COLUMN color TEXT NOT NULL DEFAULT '#5450ff'",
    );

    const legacyColumns = await db.select<BoardColumn[]>(
      `SELECT id, project_id AS projectId, name, color, 'circle-solid' AS icon, position
       FROM board_columns
       ORDER BY project_id, position`,
    );

    for (const column of legacyColumns) {
      await db.execute(
        "UPDATE board_columns SET color = $1 WHERE id = $2",
        [getDefaultColumnColor(column.name, column.position), column.id],
      );
    }
  }

  if (!hasColumnIcon) {
    await db.execute(
      "ALTER TABLE board_columns ADD COLUMN icon TEXT NOT NULL DEFAULT 'circle-solid'",
    );

    const legacyColumns = await db.select<BoardColumn[]>(
      `SELECT id, project_id AS projectId, name, color, icon, position
       FROM board_columns
       ORDER BY project_id, position`,
    );

    for (const column of legacyColumns) {
      await db.execute(
        "UPDATE board_columns SET icon = $1 WHERE id = $2",
        [getDefaultColumnIcon(column.name, column.position), column.id],
      );
    }
  }

  if (!hasIcon) {
    await db.execute(
      "ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT '🗂️'",
    );

    const legacyProjects = await db.select<Project[]>(
      `SELECT id, name, description, NULL AS parentProjectId, accent, icon, status, created_at AS createdAt
       FROM projects
       ORDER BY created_at DESC`,
    );

    for (const [index, project] of legacyProjects.entries()) {
      await db.execute(
        "UPDATE projects SET icon = $1 WHERE id = $2",
        [getDefaultProjectIcon(project.name, index), project.id],
      );
    }
  }

  if (!hasParentProject) {
    await db.execute(
      "ALTER TABLE projects ADD COLUMN parent_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
    );
  }

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_projects_parent
     ON projects(parent_project_id, created_at)`,
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS task_checklist_items (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      label TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`,
  );

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_checklist_task
     ON task_checklist_items(task_id, position)`,
  );
}

async function ensureArchivedColumns(db: Database) {
  const projects = await db.select<Project[]>(
    `SELECT id, name, description, parent_project_id AS parentProjectId, accent, icon, status, created_at AS createdAt
     FROM projects`,
  );

  for (const project of projects) {
    if (project.parentProjectId) {
      continue;
    }

    const existingArchived = await db.select<PositionedColumnRow[]>(
      `SELECT id, project_id AS projectId, name, color, icon, position
       FROM board_columns
       WHERE project_id = $1 AND name = $2
       LIMIT 1`,
      [project.id, ARCHIVED_COLUMN_NAME],
    );

    if (!existingArchived[0]) {
      const nextPosition = await db.select<{ nextPosition: number }[]>(
        `SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
         FROM board_columns
         WHERE project_id = $1`,
        [project.id],
      );

      await db.execute(
        `INSERT INTO board_columns (id, project_id, name, color, icon, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          project.id,
          ARCHIVED_COLUMN_NAME,
          getDefaultColumnColor(ARCHIVED_COLUMN_NAME, nextPosition[0]?.nextPosition ?? 0),
          getDefaultColumnIcon(ARCHIVED_COLUMN_NAME, nextPosition[0]?.nextPosition ?? 0),
          nextPosition[0]?.nextPosition ?? 0,
        ],
      );
    }
  }
}
