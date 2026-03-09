import Database from "@tauri-apps/plugin-sql";
import type {
  BoardColumn,
  ChecklistItem,
  MeasurementEntry,
  NewColumnInput,
  NewProjectInput,
  NewTaskInput,
  Project,
  ReadingItem,
  SubscriptionItem,
  TrackerHabitKey,
  TrackerHabitPreference,
  TrackerEntry,
  Task,
  UpsertReadingInput,
  UpsertSubscriptionInput,
  UpsertMeasurementEntryInput,
  UpsertTrackerEntryInput,
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
const DEFAULT_TRACKER_WORKOUT_ACTIVITIES = [
  "Camminata",
  "Corsa",
  "Palestra",
  "Bici",
  "Yoga",
  "Nuoto",
  "Mobilita",
  "Altro",
];
const DEFAULT_TRACKER_HABIT_PREFERENCES: Array<{
  key: TrackerHabitKey;
  label: string;
  color: string;
}> = [
  { key: "readBook", label: "Lettura", color: "#4784ff" },
  { key: "skincare", label: "Skincare", color: "#ae5dff" },
  { key: "meditation", label: "Meditazione", color: "#00b69e" },
  { key: "creatine", label: "Creatina", color: "#4fd3c4" },
  { key: "supplements", label: "Integratori", color: "#e9992a" },
  { key: "avoidedReels", label: "No reel", color: "#e6546e" },
];

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
type TrackerEntryRow = {
  date: string;
  weightKg: number | null;
  didWorkout: number;
  workoutType: string | null;
  workoutMinutes: number | null;
  stepsOver8000: number;
  readBook: number;
  skincare: number;
  meditation: number;
  creatine: number;
  supplements: number;
  avoidedReels: number;
  kcalTotal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fatsG: number | null;
  notes: string;
  updatedAt: string;
};
type TrackerWorkoutActivityRow = {
  id: string;
  name: string;
  position: number;
};
type TrackerHabitPreferenceRow = {
  habitKey: TrackerHabitKey;
  label: string;
  color: string;
  hidden: number;
  position: number;
};
type MeasurementEntryRow = {
  date: string;
  bicepLeft: number | null;
  bicepRight: number | null;
  forearmLeft: number | null;
  forearmRight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  quadricepsLeft: number | null;
  quadricepsRight: number | null;
  calfLeft: number | null;
  calfRight: number | null;
  updatedAt: string;
};
type SubscriptionItemRow = {
  id: string;
  status: string;
  name: string;
  totalPrice: number;
  mySharePrice: number;
  frequency: string;
  platform: string;
  billingSource: string;
  renewalDate: string;
  category: string;
  sharing: string;
  sharedPeople: string;
  createdAt: string;
  updatedAt: string;
};
type ReadingItemRow = {
  id: string;
  status: string;
  title: string;
  readingYear: number | null;
  rating: string | null;
  category: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

async function ensureTrackerHabitPreferencesSeeded(db: Database) {
  for (const [position, habit] of DEFAULT_TRACKER_HABIT_PREFERENCES.entries()) {
    await db.execute(
      `INSERT OR IGNORE INTO tracker_habit_preferences (
        habit_key,
        label,
        color,
        hidden,
        position
      ) VALUES ($1, $2, $3, 0, $4)`,
      [habit.key, habit.label, habit.color, position],
    );

    await db.execute(
      `UPDATE tracker_habit_preferences
       SET label = $1,
           position = $2
       WHERE habit_key = $3`,
      [habit.label, position, habit.key],
    );
  }
}

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
        start_date, due_date, timeline_color, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        null,
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
          timeline_color AS timelineColor,
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
      start_date, due_date, timeline_color, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
      input.timelineColor?.trim() || null,
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
         due_date = $5,
         timeline_color = $6
     WHERE id = $7`,
    [
      input.title.trim(),
      input.notes.trim(),
      input.effort.trim() || "Nessuna",
      input.startDate,
      input.dueDate,
      input.timelineColor?.trim() || null,
      input.taskId,
    ],
  );
}

export async function updateTaskPriority(taskId: string, effort: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE tasks
     SET effort = $1
     WHERE id = $2`,
    [effort.trim() || "Nessuna", taskId],
  );
}

export async function loadTrackerEntries(year: number, month: number | null) {
  const db = await getDatabase();
  await ensureSchema(db);
  const isWholeYear = month === null || month < 1 || month > 12;
  const fromDate = isWholeYear
    ? `${year}-01-01`
    : `${year}-${String(month).padStart(2, "0")}-01`;
  const untilDate = isWholeYear
    ? `${year}-12-31`
    : `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const rows = await db.select<TrackerEntryRow[]>(
    `SELECT
        date,
        weight_kg AS weightKg,
        did_workout AS didWorkout,
        workout_type AS workoutType,
        workout_minutes AS workoutMinutes,
        steps_over_8000 AS stepsOver8000,
        read_book AS readBook,
        skincare,
        meditation,
        creatine,
        supplements,
        avoided_reels AS avoidedReels,
        kcal_total AS kcalTotal,
        protein_g AS proteinG,
        carbs_g AS carbsG,
        sugars_g AS sugarsG,
        fats_g AS fatsG,
        notes,
        updated_at AS updatedAt
     FROM tracker_entries
     WHERE date BETWEEN $1 AND $2
     ORDER BY date`,
    [fromDate, untilDate],
  );

  return rows.map<TrackerEntry>((row) => ({
    date: row.date,
    weightKg: row.weightKg,
    didWorkout: Boolean(row.didWorkout),
    workoutType: row.workoutType,
    workoutMinutes: row.workoutMinutes,
    stepsOver8000: Boolean(row.stepsOver8000),
    readBook: Boolean(row.readBook),
    skincare: Boolean(row.skincare),
    meditation: Boolean(row.meditation),
    creatine: Boolean(row.creatine),
    supplements: Boolean(row.supplements),
    avoidedReels: Boolean(row.avoidedReels),
    kcalTotal: row.kcalTotal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    sugarsG: row.sugarsG,
    fatsG: row.fatsG,
    notes: row.notes,
    updatedAt: row.updatedAt,
  }));
}

export async function upsertTrackerEntry(input: UpsertTrackerEntryInput) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `INSERT INTO tracker_entries (
      date,
      weight_kg,
      did_workout,
      workout_type,
      workout_minutes,
      steps_over_8000,
      read_book,
      skincare,
      meditation,
      creatine,
      supplements,
      avoided_reels,
      kcal_total,
      protein_g,
      carbs_g,
      sugars_g,
      fats_g,
      notes,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    ON CONFLICT(date) DO UPDATE SET
      weight_kg = excluded.weight_kg,
      did_workout = excluded.did_workout,
      workout_type = excluded.workout_type,
      workout_minutes = excluded.workout_minutes,
      steps_over_8000 = excluded.steps_over_8000,
      read_book = excluded.read_book,
      skincare = excluded.skincare,
      meditation = excluded.meditation,
      creatine = excluded.creatine,
      supplements = excluded.supplements,
      avoided_reels = excluded.avoided_reels,
      kcal_total = excluded.kcal_total,
      protein_g = excluded.protein_g,
      carbs_g = excluded.carbs_g,
      sugars_g = excluded.sugars_g,
      fats_g = excluded.fats_g,
      notes = excluded.notes,
      updated_at = excluded.updated_at`,
    [
      input.date,
      input.weightKg,
      input.didWorkout ? 1 : 0,
      input.workoutType?.trim() || null,
      input.workoutMinutes,
      input.stepsOver8000 ? 1 : 0,
      input.readBook ? 1 : 0,
      input.skincare ? 1 : 0,
      input.meditation ? 1 : 0,
      input.creatine ? 1 : 0,
      input.supplements ? 1 : 0,
      input.avoidedReels ? 1 : 0,
      input.kcalTotal,
      input.proteinG,
      input.carbsG,
      input.sugarsG,
      input.fatsG,
      input.notes.trim(),
      isoNow(),
    ],
  );
}

export async function loadTrackerWorkoutActivities() {
  const db = await getDatabase();
  await ensureSchema(db);
  const rows = await db.select<TrackerWorkoutActivityRow[]>(
    `SELECT id, name, position
     FROM tracker_workout_activities
     ORDER BY position, created_at`,
  );

  return rows.map((row) => row.name);
}

export async function createTrackerWorkoutActivity(name: string) {
  const db = await getDatabase();
  await ensureSchema(db);
  const trimmedName = name.trim();

  if (!trimmedName) {
    return;
  }

  await db.execute(
    `INSERT OR IGNORE INTO tracker_workout_activities (id, name, position, created_at)
     VALUES (
       $1,
       $2,
       (SELECT COALESCE(MAX(position), -1) + 1 FROM tracker_workout_activities),
       $3
     )`,
    [crypto.randomUUID(), trimmedName, isoNow()],
  );
}

export async function deleteTrackerWorkoutActivity(name: string) {
  const db = await getDatabase();
  await ensureSchema(db);
  const trimmedName = name.trim();

  if (!trimmedName) {
    return;
  }

  await db.execute(
    `DELETE FROM tracker_workout_activities
     WHERE name = $1`,
    [trimmedName],
  );

  const rows = await db.select<IdRow[]>(
    `SELECT id
     FROM tracker_workout_activities
     ORDER BY position, created_at`,
  );

  for (const [position, row] of rows.entries()) {
    await db.execute(
      `UPDATE tracker_workout_activities
       SET position = $1
       WHERE id = $2`,
      [position, row.id],
    );
  }
}

export async function loadTrackerHabitPreferences() {
  const db = await getDatabase();
  await ensureSchema(db);
  await ensureTrackerHabitPreferencesSeeded(db);
  const rows = await db.select<TrackerHabitPreferenceRow[]>(
    `SELECT
        habit_key AS habitKey,
        label,
        color,
        hidden,
        position
     FROM tracker_habit_preferences
     ORDER BY position`,
  );

  return rows.map<TrackerHabitPreference>((row) => ({
    key: row.habitKey,
    label: row.label,
    color: row.color,
    hidden: Boolean(row.hidden),
    position: row.position,
  }));
}

export async function updateTrackerHabitPreference(input: {
  habitKey: TrackerHabitKey;
  color: string;
  hidden: boolean;
}) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE tracker_habit_preferences
     SET color = $1,
         hidden = $2
     WHERE habit_key = $3`,
    [input.color.trim() || "#5f72ff", input.hidden ? 1 : 0, input.habitKey],
  );
}

export async function loadMeasurementEntries() {
  const db = await getDatabase();
  await ensureSchema(db);
  const rows = await db.select<MeasurementEntryRow[]>(
    `SELECT
        date,
        bicep_left AS bicepLeft,
        bicep_right AS bicepRight,
        forearm_left AS forearmLeft,
        forearm_right AS forearmRight,
        chest,
        waist,
        hips,
        quadriceps_left AS quadricepsLeft,
        quadriceps_right AS quadricepsRight,
        calf_left AS calfLeft,
        calf_right AS calfRight,
        updated_at AS updatedAt
     FROM measurement_entries
     ORDER BY date DESC`,
  );

  return rows.map<MeasurementEntry>((row) => ({
    date: row.date,
    bicepLeft: row.bicepLeft,
    bicepRight: row.bicepRight,
    forearmLeft: row.forearmLeft,
    forearmRight: row.forearmRight,
    chest: row.chest,
    waist: row.waist,
    hips: row.hips,
    quadricepsLeft: row.quadricepsLeft,
    quadricepsRight: row.quadricepsRight,
    calfLeft: row.calfLeft,
    calfRight: row.calfRight,
    updatedAt: row.updatedAt,
  }));
}

export async function upsertMeasurementEntry(input: UpsertMeasurementEntryInput) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `INSERT INTO measurement_entries (
      date,
      bicep_left,
      bicep_right,
      forearm_left,
      forearm_right,
      chest,
      waist,
      hips,
      quadriceps_left,
      quadriceps_right,
      calf_left,
      calf_right,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    ON CONFLICT(date) DO UPDATE SET
      bicep_left = excluded.bicep_left,
      bicep_right = excluded.bicep_right,
      forearm_left = excluded.forearm_left,
      forearm_right = excluded.forearm_right,
      chest = excluded.chest,
      waist = excluded.waist,
      hips = excluded.hips,
      quadriceps_left = excluded.quadriceps_left,
      quadriceps_right = excluded.quadriceps_right,
      calf_left = excluded.calf_left,
      calf_right = excluded.calf_right,
      updated_at = excluded.updated_at`,
    [
      input.date,
      input.bicepLeft,
      input.bicepRight,
      input.forearmLeft,
      input.forearmRight,
      input.chest,
      input.waist,
      input.hips,
      input.quadricepsLeft,
      input.quadricepsRight,
      input.calfLeft,
      input.calfRight,
      isoNow(),
    ],
  );
}

export async function deleteMeasurementEntry(date: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `DELETE FROM measurement_entries
     WHERE date = $1`,
    [date],
  );
}

export async function loadSubscriptions() {
  const db = await getDatabase();
  await ensureSchema(db);
  const rows = await db.select<SubscriptionItemRow[]>(
    `SELECT
        id,
        status,
        name,
        total_price AS totalPrice,
        my_share_price AS mySharePrice,
        frequency,
        platform,
        billing_source AS billingSource,
        renewal_date AS renewalDate,
        category,
        sharing,
        shared_people AS sharedPeople,
        created_at AS createdAt,
        updated_at AS updatedAt
     FROM subscriptions
     ORDER BY created_at DESC, name COLLATE NOCASE`,
  );

  return rows.map<SubscriptionItem>((row) => ({
    id: row.id,
    status: row.status as SubscriptionItem["status"],
    name: row.name,
    totalPrice: row.totalPrice,
    mySharePrice: row.mySharePrice,
    frequency: row.frequency as SubscriptionItem["frequency"],
    platform: row.platform,
    billingSource: row.billingSource,
    renewalDate: row.renewalDate,
    category: row.category as SubscriptionItem["category"],
    sharing: row.sharing as SubscriptionItem["sharing"],
    sharedPeople: (() => {
      try {
        const parsed = JSON.parse(row.sharedPeople || "[]");
        return Array.isArray(parsed)
          ? parsed.filter((person): person is string => typeof person === "string")
          : [];
      } catch (error) {
        console.error(error);
        return [];
      }
    })(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function upsertSubscription(input: UpsertSubscriptionInput) {
  const db = await getDatabase();
  await ensureSchema(db);
  const id = input.id?.trim() || crypto.randomUUID();
  const now = isoNow();

  await db.execute(
    `INSERT INTO subscriptions (
      id,
      status,
      name,
      total_price,
      my_share_price,
      frequency,
      platform,
      billing_source,
      renewal_date,
      category,
      sharing,
      shared_people,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE((SELECT created_at FROM subscriptions WHERE id = $1), $13), $14
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      name = excluded.name,
      total_price = excluded.total_price,
      my_share_price = excluded.my_share_price,
      frequency = excluded.frequency,
      platform = excluded.platform,
      billing_source = excluded.billing_source,
      renewal_date = excluded.renewal_date,
      category = excluded.category,
      sharing = excluded.sharing,
      shared_people = excluded.shared_people,
      updated_at = excluded.updated_at`,
    [
      id,
      input.status,
      input.name.trim(),
      input.totalPrice,
      input.mySharePrice,
      input.frequency,
      input.platform.trim(),
      input.billingSource.trim(),
      input.renewalDate,
      input.category,
      input.sharing,
      JSON.stringify(input.sharedPeople),
      now,
      now,
    ],
  );

  return id;
}

export async function deleteSubscription(id: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `DELETE FROM subscriptions
     WHERE id = $1`,
    [id],
  );
}

export async function loadReadingItems() {
  const db = await getDatabase();
  await ensureSchema(db);
  const rows = await db.select<ReadingItemRow[]>(
    `SELECT
        id,
        status,
        title,
        reading_year AS readingYear,
        rating,
        category,
        summary,
        created_at AS createdAt,
        updated_at AS updatedAt
     FROM reading_items
     ORDER BY updated_at DESC, title COLLATE NOCASE`,
  );

  return rows.map<ReadingItem>((row) => ({
    id: row.id,
    status: row.status as ReadingItem["status"],
    title: row.title,
    readingYear: row.readingYear,
    rating: row.rating as ReadingItem["rating"],
    category: row.category as ReadingItem["category"],
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function upsertReadingItem(input: UpsertReadingInput) {
  const db = await getDatabase();
  await ensureSchema(db);
  const id = input.id?.trim() || crypto.randomUUID();
  const now = isoNow();

  await db.execute(
    `INSERT INTO reading_items (
      id,
      status,
      title,
      reading_year,
      rating,
      category,
      summary,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT created_at FROM reading_items WHERE id = $1), $8), $9
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      title = excluded.title,
      reading_year = excluded.reading_year,
      rating = excluded.rating,
      category = excluded.category,
      summary = excluded.summary,
      updated_at = excluded.updated_at`,
    [
      id,
      input.status,
      input.title.trim(),
      input.readingYear,
      input.rating,
      input.category,
      input.summary.trim(),
      now,
      now,
    ],
  );

  return id;
}

export async function deleteReadingItem(id: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `DELETE FROM reading_items
     WHERE id = $1`,
    [id],
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

export async function deleteChecklistItem(itemId: string) {
  const db = await getDatabase();
  await ensureSchema(db);
  const [item] = await db.select<{ taskId: string }[]>(
    `SELECT task_id AS taskId
     FROM task_checklist_items
     WHERE id = $1`,
    [itemId],
  );

  if (!item) {
    return;
  }

  await db.execute(
    `DELETE FROM task_checklist_items
     WHERE id = $1`,
    [itemId],
  );

  const remainingItems = await db.select<IdRow[]>(
    `SELECT id
     FROM task_checklist_items
     WHERE task_id = $1
     ORDER BY position, created_at`,
    [item.taskId],
  );

  for (const [position, checklistItem] of remainingItems.entries()) {
    await db.execute(
      `UPDATE task_checklist_items
       SET position = $1
       WHERE id = $2`,
      [position, checklistItem.id],
    );
  }
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

export async function updateProjectAccent(projectId: string, accent: string) {
  const db = await getDatabase();
  await ensureSchema(db);

  await db.execute(
    `UPDATE projects
     SET accent = $1
     WHERE id = $2`,
    [accent.trim() || PROJECT_ACCENTS[0], projectId],
  );
}

async function ensureSchema(db: Database) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      accent TEXT NOT NULL DEFAULT '#6d7d63',
      icon TEXT NOT NULL DEFAULT '🗂️',
      status TEXT NOT NULL DEFAULT 'active',
      parent_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    )`,
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS board_columns (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#5450ff',
      icon TEXT NOT NULL DEFAULT 'circle-solid',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      effort TEXT NOT NULL DEFAULT 'Nessuna',
      lane TEXT NOT NULL DEFAULT 'general',
      position INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      timeline_color TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
    )`,
  );

  const columnRows = await db.select<TableInfoRow[]>(
    "PRAGMA table_info(board_columns)",
  );
  const hasColor = columnRows.some((column) => column.name === "color");
  const hasColumnIcon = columnRows.some((column) => column.name === "icon");
  const projectRows = await db.select<TableInfoRow[]>(
    "PRAGMA table_info(projects)",
  );
  const taskRows = await db.select<TableInfoRow[]>(
    "PRAGMA table_info(tasks)",
  );
  const hasAccent = projectRows.some((column) => column.name === "accent");
  const hasIcon = projectRows.some((column) => column.name === "icon");
  const hasParentProject = projectRows.some((column) => column.name === "parent_project_id");
  const hasTaskTimelineColor = taskRows.some((column) => column.name === "timeline_color");

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

  if (!hasAccent) {
    await db.execute(
      `ALTER TABLE projects
       ADD COLUMN accent TEXT NOT NULL DEFAULT '#6d7d63'`,
    );
  }

  if (!hasParentProject) {
    await db.execute(
      "ALTER TABLE projects ADD COLUMN parent_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
    );
  }

  if (!hasTaskTimelineColor) {
    await db.execute(
      "ALTER TABLE tasks ADD COLUMN timeline_color TEXT DEFAULT NULL",
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

  await db.execute(
    `CREATE TABLE IF NOT EXISTS tracker_entries (
      date TEXT PRIMARY KEY NOT NULL,
      weight_kg REAL,
      did_workout INTEGER NOT NULL DEFAULT 0,
      workout_type TEXT,
      workout_minutes INTEGER,
      steps_over_8000 INTEGER NOT NULL DEFAULT 0,
      read_book INTEGER NOT NULL DEFAULT 0,
      skincare INTEGER NOT NULL DEFAULT 0,
      meditation INTEGER NOT NULL DEFAULT 0,
      creatine INTEGER NOT NULL DEFAULT 0,
      supplements INTEGER NOT NULL DEFAULT 0,
      avoided_reels INTEGER NOT NULL DEFAULT 0,
      kcal_total INTEGER,
      protein_g REAL,
      carbs_g REAL,
      sugars_g REAL,
      fats_g REAL,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`,
  );

  const trackerEntryRows = await db.select<TableInfoRow[]>(
    "PRAGMA table_info(tracker_entries)",
  );
  const trackerHasCreatine = trackerEntryRows.some((column) => column.name === "creatine");

  if (!trackerHasCreatine) {
    await db.execute(
      "ALTER TABLE tracker_entries ADD COLUMN creatine INTEGER NOT NULL DEFAULT 0",
    );
  }

  await db.execute(
    `CREATE TABLE IF NOT EXISTS measurement_entries (
      date TEXT PRIMARY KEY NOT NULL,
      bicep_left REAL,
      bicep_right REAL,
      forearm_left REAL,
      forearm_right REAL,
      chest REAL,
      waist REAL,
      hips REAL,
      quadriceps_left REAL,
      quadriceps_right REAL,
      calf_left REAL,
      calf_right REAL,
      updated_at TEXT NOT NULL
    )`,
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS tracker_workout_activities (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );

  const trackerWorkoutActivityCount = await db.select<CountRow[]>(
    "SELECT COUNT(*) AS total FROM tracker_workout_activities",
  );

  if (!trackerWorkoutActivityCount[0]?.total) {
    for (const [position, activity] of DEFAULT_TRACKER_WORKOUT_ACTIVITIES.entries()) {
      await db.execute(
        `INSERT INTO tracker_workout_activities (id, name, position, created_at)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), activity, position, isoNow()],
      );
    }
  }

  await db.execute(
    `CREATE TABLE IF NOT EXISTS tracker_habit_preferences (
      habit_key TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#5f72ff',
      hidden INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL
    )`,
  );
  await ensureTrackerHabitPreferencesSeeded(db);

  await db.execute(
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      total_price REAL NOT NULL,
      my_share_price REAL NOT NULL,
      frequency TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      billing_source TEXT NOT NULL DEFAULT '',
      renewal_date TEXT NOT NULL,
      category TEXT NOT NULL,
      sharing TEXT NOT NULL DEFAULT 'individuale',
      shared_people TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS reading_items (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      reading_year INTEGER,
      rating TEXT,
      category TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
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
