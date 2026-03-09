import { type FormEvent, useEffect, useState } from "react";
import "./App.css";
import { KanbanBoard } from "./components/KanbanBoard";
import { MeasurementsView } from "./components/MeasurementsView";
import { ReadingView } from "./components/ReadingView";
import { SubscriptionsView } from "./components/SubscriptionsView";
import { TaskDetailModal } from "./components/TaskDetailModal";
import { TimelineView } from "./components/TimelineView";
import { TrackerView } from "./components/TrackerView";
import { COLUMN_ICON_OPTIONS, ColumnIcon } from "./lib/columnIcons";
import {
  ARCHIVED_COLUMN_NAME,
  advanceTask,
  createTrackerWorkoutActivity,
  createChecklistItem,
  createColumn,
  createProject,
  createTask,
  deleteReadingItem,
  deleteSubscription,
  deleteTrackerWorkoutActivity,
  deleteChecklistItem,
  deleteColumn,
  deleteMeasurementEntry,
  deleteProject,
  loadMeasurementEntries,
  loadReadingItems,
  loadSubscriptions,
  loadTrackerWorkoutActivities,
  loadTrackerHabitPreferences,
  loadWorkspace,
  loadTrackerEntries,
  moveTask,
  reorderColumns,
  toggleChecklistItem,
  upsertMeasurementEntry,
  upsertReadingItem,
  upsertSubscription,
  upsertTrackerEntry,
  updateColumn,
  updateProject,
  updateProjectAccent,
  updateTrackerHabitPreference,
  updateTaskPriority,
  updateTask,
} from "./lib/database";
import { PRIORITY_OPTIONS } from "./lib/priorities";
import type {
  BoardColumn,
  MeasurementEntry,
  ReadingItem,
  SubscriptionItem,
  TrackerHabitKey,
  TrackerHabitPreference,
  TrackerEntry,
  TrackerSectionKey,
  UpsertReadingInput,
  UpsertSubscriptionInput,
  UpsertMeasurementEntryInput,
  UpsertTrackerEntryInput,
  ViewMode,
  WorkspaceSnapshot,
} from "./lib/types";

const ALL_WORKSPACES_ID = "__all__";
const AGGREGATE_COLUMN_PREFIX = "all:";
const DEFAULT_NEW_COLUMN_COLOR = "#5450ff";
const TRACKER_MIN_YEAR = 2026;
const WORKSPACE_COLOR_OPTIONS = [
  "#5e6bff",
  "#2f84f6",
  "#00a884",
  "#42a55b",
  "#d7923e",
  "#cc5c3a",
  "#be4f5e",
  "#8d5dd0",
  "#596477",
  "#7f6a56",
];
const GOOGLE_CALENDAR_CLIENT_ID =
  "109644726881-j16a7f4ulc6vgv22b3s1djvrbkpt0pj3.apps.googleusercontent.com";
const AGGREGATE_COLUMN_ORDER_STORAGE_KEY = "organizer.aggregate-column-order";
const TRACKER_YEARS_STORAGE_KEY = "organizer.tracker-years";
const TRACKER_SECTION_VISIBILITY_STORAGE_KEY = "organizer.tracker-section-visibility";
const LEGACY_SUBSCRIPTIONS_STORAGE_KEY = "organizer.subscriptions";
const DEFAULT_TRACKER_SECTION_VISIBILITY: Record<TrackerSectionKey, boolean> = {
  weight: true,
  sport: true,
  habits: true,
  nutrition: true,
  notes: true,
};
const TRACKER_SECTION_LABELS: Record<TrackerSectionKey, string> = {
  weight: "Peso",
  sport: "Sport",
  habits: "Abitudini",
  nutrition: "Alimentazione",
  notes: "Note giornata",
};
const APP_VERSION = "0.1.0";

interface ColumnDraft {
  name: string;
  color: string;
  icon: string;
}

function renderHeaderMenuIcon(sectionId: string) {
  switch (sectionId) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5V20h-5.2v-4.8H9.2V20H4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.8v3M16 3.8v3M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "tracker":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <path d="M3.8 14.2h3.6l2.2-4.6 3.1 7 2.4-5.2h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "measurements":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <path d="M5 7.2 8.2 4l11.8 11.8-3.2 3.2L5 7.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m9.6 5.4 1.5 1.5m1.8.2 1.5 1.5m1.8.2 1.5 1.5m-7.4 1.4 1.5 1.5m1.8.2 1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "workout":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <path d="M3.5 10.2h2.3v3.6H3.5zM18.2 10.2h2.3v3.6h-2.3zM7.1 9h1.9v6H7.1zM15 9h1.9v6H15zM9.8 10.9h4.4v2.2H9.8z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "reading":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <path d="M4.5 5.2h6.3a3 3 0 0 1 3 3v10.6H7.6a3.1 3.1 0 0 0-3.1 0Zm15 0h-6.3a3 3 0 0 0-3 3v10.6h6.2a3.1 3.1 0 0 1 3.1 0Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "goals":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
    case "subscriptions":
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <rect x="3.8" y="6.2" width="16.4" height="11.6" rx="2.3" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.8 10h16.4M8.2 14.1h3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="top-header__nav-icon-svg" aria-hidden="true">
          <rect x="4" y="4.5" width="6.3" height="6.3" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13.7" y="4.5" width="6.3" height="6.3" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="4" y="13.2" width="6.3" height="6.3" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13.7" y="13.2" width="6.3" height="6.3" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
  }
}

function moveTaskLocally(
  currentTasks: WorkspaceSnapshot["tasks"],
  taskId: string,
  targetColumnId: string,
  targetPosition: number,
) {
  const movingTask = currentTasks.find((task) => task.id === taskId);

  if (!movingTask) {
    return currentTasks;
  }

  const sourceColumnId = movingTask.columnId;
  const nextTasks = currentTasks.map((task) => ({ ...task }));
  const sourceTasks = nextTasks
    .filter((task) => task.columnId === sourceColumnId && task.id !== taskId)
    .sort((left, right) => left.position - right.position);
  const destinationTasks =
    sourceColumnId === targetColumnId
      ? sourceTasks
      : nextTasks
          .filter((task) => task.columnId === targetColumnId)
          .sort((left, right) => left.position - right.position);

  const insertionIndex = Math.max(0, Math.min(targetPosition, destinationTasks.length));
  const updatedTask = nextTasks.find((task) => task.id === taskId);

  if (!updatedTask) {
    return currentTasks;
  }

  updatedTask.columnId = targetColumnId;
  destinationTasks.splice(insertionIndex, 0, updatedTask);

  sourceTasks.forEach((task, index) => {
    task.position = index;
  });

  destinationTasks.forEach((task, index) => {
    task.position = index;
  });

  return nextTasks.sort((left, right) => {
    if (left.projectId !== right.projectId) {
      return left.projectId.localeCompare(right.projectId);
    }

    if (left.columnId !== right.columnId) {
      return left.columnId.localeCompare(right.columnId);
    }

    return left.position - right.position;
  });
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("home");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    parentProjectId: "",
  });
  const [workspaceEditForm, setWorkspaceEditForm] = useState({
    projectId: "",
    name: "",
    description: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    notes: "",
    effort: "Normale",
    startDate: "",
    dueDate: "",
    columnId: "",
  });
  const [columnForm, setColumnForm] = useState({
    name: "",
    color: DEFAULT_NEW_COLUMN_COLOR,
    icon: "circle-solid",
  });
  const [columnDrafts, setColumnDrafts] = useState<Record<string, ColumnDraft>>({});
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isWorkspaceEditModalOpen, setIsWorkspaceEditModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKanbanPhasesModalOpen, setIsKanbanPhasesModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState("google-calendar");
  const [colorPickerProjectId, setColorPickerProjectId] = useState<string | null>(null);
  const [aggregateColumnOrder, setAggregateColumnOrder] = useState<string[]>([]);
  const [trackerYears, setTrackerYears] = useState<number[]>([TRACKER_MIN_YEAR]);
  const [trackerYear, setTrackerYear] = useState(TRACKER_MIN_YEAR);
  const [trackerMonth, setTrackerMonth] = useState(1);
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([]);
  const [measurementEntries, setMeasurementEntries] = useState<MeasurementEntry[]>([]);
  const [readingItems, setReadingItems] = useState<ReadingItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [trackerWorkoutActivities, setTrackerWorkoutActivities] = useState<string[]>([]);
  const [trackerHabitPreferences, setTrackerHabitPreferences] = useState<TrackerHabitPreference[]>([]);
  const [trackerSectionVisibility, setTrackerSectionVisibility] = useState<Record<TrackerSectionKey, boolean>>(
    DEFAULT_TRACKER_SECTION_VISIBILITY,
  );
  const [isTrackerActivitiesModalOpen, setIsTrackerActivitiesModalOpen] = useState(false);
  const [isTrackerHabitsModalOpen, setIsTrackerHabitsModalOpen] = useState(false);
  const [isTrackerSectionsModalOpen, setIsTrackerSectionsModalOpen] = useState(false);
  const [trackerActivityName, setTrackerActivityName] = useState("");

  useEffect(() => {
    void refreshWorkspace();
    void refreshTrackerWorkoutActivities();
    void refreshTrackerHabitPreferences();
    void refreshMeasurementEntries();
    void refreshReadingItems();
    void refreshSubscriptions();
  }, []);

  useEffect(() => {
    async function migrateLegacySubscriptions() {
      const stored = window.localStorage.getItem(LEGACY_SUBSCRIPTIONS_STORAGE_KEY);

      if (!stored || subscriptions.length) {
        return;
      }

      try {
        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
          return;
        }

        for (const rawItem of parsed) {
          if (!rawItem || typeof rawItem !== "object") {
            continue;
          }

          const item = rawItem as Partial<SubscriptionItem> & { price?: number };
          const totalPrice =
            typeof item.totalPrice === "number"
              ? item.totalPrice
              : typeof item.price === "number"
                ? item.price
                : 0;
          const mySharePrice =
            typeof item.mySharePrice === "number" ? item.mySharePrice : totalPrice;

          if (!item.name || !Number.isFinite(totalPrice)) {
            continue;
          }

          await upsertSubscription({
            id: item.id,
            status: item.status ?? "attivo",
            name: item.name,
            totalPrice,
            mySharePrice,
            frequency: item.frequency ?? "mensile",
            platform: item.platform ?? "",
            billingSource: item.billingSource ?? "",
            renewalDate: item.renewalDate ?? new Date().toISOString().slice(0, 10),
            category: item.category ?? "personale",
            sharing: item.sharing ?? "individuale",
            sharedPeople: Array.isArray(item.sharedPeople)
              ? item.sharedPeople.filter((person): person is string => typeof person === "string")
              : [],
          });
        }

        window.localStorage.removeItem(LEGACY_SUBSCRIPTIONS_STORAGE_KEY);
        await refreshSubscriptions();
      } catch (migrationError) {
        console.error(migrationError);
      }
    }

    void migrateLegacySubscriptions();
  }, [subscriptions.length]);

  useEffect(() => {
    const storedYears = window.localStorage.getItem(TRACKER_YEARS_STORAGE_KEY);

    if (!storedYears) {
      return;
    }

    try {
      const parsedYears = JSON.parse(storedYears);

      if (!Array.isArray(parsedYears)) {
        return;
      }

      const normalizedYears = parsedYears
        .filter((value): value is number => Number.isInteger(value))
        .filter((year) => year >= TRACKER_MIN_YEAR)
        .sort((left, right) => left - right)
        .filter((year, index, items) => items.indexOf(year) === index);

      if (normalizedYears.length) {
        setTrackerYears(normalizedYears);
      }
    } catch (storageError) {
      console.error(storageError);
    }
  }, []);

  useEffect(() => {
    const storedSections = window.localStorage.getItem(TRACKER_SECTION_VISIBILITY_STORAGE_KEY);

    if (!storedSections) {
      return;
    }

    try {
      const parsedSections = JSON.parse(storedSections);

      if (!parsedSections || typeof parsedSections !== "object") {
        return;
      }

      setTrackerSectionVisibility({
        ...DEFAULT_TRACKER_SECTION_VISIBILITY,
        weight: parsedSections.weight !== false,
        sport: parsedSections.sport !== false,
        habits: parsedSections.habits !== false,
        nutrition: parsedSections.nutrition !== false,
        notes: parsedSections.notes !== false,
      });
    } catch (storageError) {
      console.error(storageError);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    setTrackerMonth(now.getMonth() + 1);
  }, []);

  useEffect(() => {
    const currentYear = new Date().getFullYear();

    setTrackerYear((current) => {
      if (trackerYears.includes(current)) {
        return current;
      }

      if (trackerYears.includes(currentYear)) {
        return currentYear;
      }

      return trackerYears[trackerYears.length - 1] ?? TRACKER_MIN_YEAR;
    });
  }, [trackerYears]);

  useEffect(() => {
    const storedOrder = window.localStorage.getItem(AGGREGATE_COLUMN_ORDER_STORAGE_KEY);

    if (!storedOrder) {
      return;
    }

    try {
      const parsedOrder = JSON.parse(storedOrder);

      if (Array.isArray(parsedOrder)) {
        setAggregateColumnOrder(parsedOrder.filter((value): value is string => typeof value === "string"));
      }
    } catch (storageError) {
      console.error(storageError);
    }
  }, []);

  useEffect(() => {
    if (activeView !== "tracker") {
      return;
    }

    void refreshTrackerEntries();
  }, [activeView, trackerYear, trackerMonth]);

  useEffect(() => {
    if (!workspace?.projects.length) {
      return;
    }

    if (!selectedProjectId) {
      setSelectedProjectId(workspace.projects[0].id);
    }
  }, [workspace, selectedProjectId]);

  useEffect(() => {
    if (!workspace || !selectedProjectId || selectedProjectId === ALL_WORKSPACES_ID) {
      return;
    }

    const selectedProjectRecord = workspace.projects.find(
      (project) => project.id === selectedProjectId,
    );
    const columnOwnerId = selectedProjectRecord?.parentProjectId ?? selectedProjectId;
    const firstColumn = workspace.columns.find((column) => column.projectId === columnOwnerId);

    if (firstColumn && !taskForm.columnId) {
      setTaskForm((current) => ({
        ...current,
        columnId: firstColumn.id,
      }));
    }
  }, [workspace, selectedProjectId, taskForm.columnId]);

  async function refreshWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await loadWorkspace();
      setWorkspace(snapshot);
      return snapshot;
    } catch (loadError) {
      setError("Non sono riuscito a caricare il database locale.");
      console.error(loadError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshTrackerEntries() {
    try {
      const rows = await loadTrackerEntries(trackerYear, trackerMonth);
      setTrackerEntries(rows);
    } catch (loadError) {
      setError("Non sono riuscito a caricare i dati del tracker.");
      console.error(loadError);
    }
  }

  async function refreshMeasurementEntries() {
    try {
      const rows = await loadMeasurementEntries();
      setMeasurementEntries(rows);
    } catch (loadError) {
      setError("Non sono riuscito a caricare le misurazioni corporee.");
      console.error(loadError);
    }
  }

  async function refreshReadingItems() {
    try {
      const rows = await loadReadingItems();
      setReadingItems(rows);
    } catch (loadError) {
      setError("Non sono riuscito a caricare i libri.");
      console.error(loadError);
    }
  }

  async function refreshSubscriptions() {
    try {
      const rows = await loadSubscriptions();
      setSubscriptions(rows);
    } catch (loadError) {
      setError("Non sono riuscito a caricare gli abbonamenti.");
      console.error(loadError);
    }
  }

  async function refreshTrackerWorkoutActivities() {
    try {
      const rows = await loadTrackerWorkoutActivities();
      setTrackerWorkoutActivities(rows);
    } catch (loadError) {
      setError("Non sono riuscito a caricare la lista attivita sportive.");
      console.error(loadError);
    }
  }

  async function refreshTrackerHabitPreferences() {
    try {
      const rows = await loadTrackerHabitPreferences();
      setTrackerHabitPreferences(rows);
    } catch (loadError) {
      setError("Non sono riuscito a caricare le preferenze abitudini.");
      console.error(loadError);
    }
  }

  async function handleSaveTrackerEntry(input: UpsertTrackerEntryInput) {
    try {
      await upsertTrackerEntry(input);
      const updatedAt = new Date().toISOString();

      setTrackerEntries((current) => {
        const otherEntries = current.filter((entry) => entry.date !== input.date);

        return [
          ...otherEntries,
          {
            ...input,
            updatedAt,
          },
        ].sort((left, right) => left.date.localeCompare(right.date));
      });
    } catch (saveError) {
      setError("Non sono riuscito a salvare il giorno del tracker.");
      console.error(saveError);
    }
  }

  async function handleSaveMeasurementEntry(input: UpsertMeasurementEntryInput) {
    try {
      await upsertMeasurementEntry(input);
      const updatedAt = new Date().toISOString();

      setMeasurementEntries((current) => {
        const otherEntries = current.filter((entry) => entry.date !== input.date);

        return [
          ...otherEntries,
          {
            ...input,
            updatedAt,
          },
        ].sort((left, right) => right.date.localeCompare(left.date));
      });
    } catch (saveError) {
      setError("Non sono riuscito a salvare le misurazioni corporee.");
      console.error(saveError);
      throw saveError;
    }
  }

  async function handleSaveReadingItem(input: UpsertReadingInput) {
    try {
      await upsertReadingItem(input);
      await refreshReadingItems();
    } catch (saveError) {
      setError("Non sono riuscito a salvare il libro.");
      console.error(saveError);
      throw saveError;
    }
  }

  async function handleDeleteReadingItem(id: string) {
    try {
      await deleteReadingItem(id);
      setReadingItems((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError("Non sono riuscito a eliminare il libro.");
      console.error(deleteError);
      throw deleteError;
    }
  }

  async function handleSaveSubscription(input: UpsertSubscriptionInput) {
    try {
      const id = await upsertSubscription(input);
      const rows = await loadSubscriptions();
      setSubscriptions(rows);

      window.localStorage.removeItem(LEGACY_SUBSCRIPTIONS_STORAGE_KEY);
      return id;
    } catch (saveError) {
      setError("Non sono riuscito a salvare l'abbonamento.");
      console.error(saveError);
      throw saveError;
    }
  }

  async function handleDeleteSubscription(id: string) {
    try {
      await deleteSubscription(id);
      setSubscriptions((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError("Non sono riuscito a eliminare l'abbonamento.");
      console.error(deleteError);
      throw deleteError;
    }
  }

  async function handleDeleteMeasurementEntry(date: string) {
    try {
      await deleteMeasurementEntry(date);
      setMeasurementEntries((current) => current.filter((entry) => entry.date !== date));
    } catch (deleteError) {
      setError("Non sono riuscito a eliminare la misurazione.");
      console.error(deleteError);
      throw deleteError;
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectForm.name.trim()) {
      return;
    }

    try {
      const projectId = await createProject({
        name: projectForm.name,
        description: projectForm.description,
        parentProjectId: projectForm.parentProjectId || null,
      });
      setProjectForm({ name: "", description: "", parentProjectId: "" });
      const snapshot = await refreshWorkspace();
      const firstColumnOwnerId = projectForm.parentProjectId || projectId;
      const firstColumn = snapshot?.columns.find(
        (column) => column.projectId === firstColumnOwnerId,
      );

      setIsProjectModalOpen(false);
      setSelectedProjectId(projectId);
      setTaskForm((current) => ({
        ...current,
        columnId: firstColumn?.id ?? "",
      }));
      setActiveView("board");
    } catch (createError) {
      setError("Non sono riuscito a creare il progetto.");
      console.error(createError);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !selectedProjectId ||
      selectedProjectId === ALL_WORKSPACES_ID ||
      !taskForm.title.trim() ||
      !taskForm.columnId
    ) {
      return;
    }

    try {
      await createTask({
        projectId: selectedProjectId,
        columnId: taskForm.columnId,
        title: taskForm.title,
        notes: taskForm.notes,
        effort: taskForm.effort,
        lane: "general",
        startDate: taskForm.startDate || null,
        dueDate: taskForm.dueDate || null,
        timelineColor: null,
      });

      setTaskForm((current) => ({
        ...current,
        title: "",
        notes: "",
        startDate: "",
        dueDate: "",
      }));

      await refreshWorkspace();
      setIsTaskModalOpen(false);
      setActiveView("board");
    } catch (createError) {
      setError("Non sono riuscito a creare il task.");
      console.error(createError);
    }
  }

  async function handleCreateColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !selectedProjectId ||
      selectedProjectId === ALL_WORKSPACES_ID ||
      !columnForm.name.trim()
    ) {
      return;
    }

    try {
      await createColumn({
        projectId: effectiveColumnOwnerId,
        name: columnForm.name,
        color: columnForm.color,
        icon: columnForm.icon,
      });
      setColumnForm({ name: "", color: DEFAULT_NEW_COLUMN_COLOR, icon: "circle-solid" });
      await refreshWorkspace();
    } catch (createError) {
      setError("Non sono riuscito a creare la fase della kanban.");
      console.error(createError);
    }
  }

  const projects = workspace?.projects ?? [];
  const columns = workspace?.columns ?? [];
  const tasks = workspace?.tasks ?? [];
  const checklistItems = workspace?.checklistItems ?? [];
  const isAllWorkspaces = selectedProjectId === ALL_WORKSPACES_ID;
  const childProjectsByParentId = new Map<string, typeof projects>();
  const projectDepthById = new Map<string, number>();

  for (const project of projects) {
    if (!project.parentProjectId) {
      continue;
    }

    const siblings = childProjectsByParentId.get(project.parentProjectId) ?? [];
    siblings.push(project);
    childProjectsByParentId.set(project.parentProjectId, siblings);
  }

  const orderedProjects: typeof projects = [];

  function appendProjectBranch(project: (typeof projects)[number], depth = 0) {
    orderedProjects.push(project);
    projectDepthById.set(project.id, depth);
    const children = [...(childProjectsByParentId.get(project.id) ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    for (const child of children) {
      appendProjectBranch(child, depth + 1);
    }
  }

  const rootProjects = [...projects]
    .filter((project) => !project.parentProjectId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const project of rootProjects) {
    appendProjectBranch(project);
  }

  const allColumnsById = new Map(columns.map((column) => [column.id, column]));
  const projectNamesById = new Map(projects.map((project) => [project.id, project.name]));
  const projectAccentById = new Map(projects.map((project) => [project.id, project.accent]));

  function collectProjectTreeIds(projectId: string) {
    const collected = new Set<string>([projectId]);
    const queue = [projectId];

    while (queue.length) {
      const currentId = queue.shift();

      if (!currentId) {
        continue;
      }

      for (const child of childProjectsByParentId.get(currentId) ?? []) {
        if (!collected.has(child.id)) {
          collected.add(child.id);
          queue.push(child.id);
        }
      }
    }

    return collected;
  }

  const selectedProjectTreeIds = !selectedProjectId || isAllWorkspaces
    ? new Set<string>()
    : collectProjectTreeIds(selectedProjectId);
  const selectedProject =
    isAllWorkspaces
      ? null
      : projects.find((project) => project.id === selectedProjectId) ?? null;
  const effectiveColumnOwnerId = selectedProject?.parentProjectId ?? selectedProject?.id ?? "";
  const effectiveProjectColumns = columns
    .filter((column) => column.projectId === effectiveColumnOwnerId)
    .sort((left, right) => left.position - right.position);
  const aggregateBaseColumns = Array.from(
    new Map(
      [...columns]
        .sort((left, right) => left.position - right.position)
        .map((column) => [column.name, column]),
    ).values(),
  );
  const aggregateColumnPositionByName = new Map(
    aggregateBaseColumns.map((column, index) => [column.name, index]),
  );
  const orderedAggregateColumns = [...aggregateBaseColumns].sort((left, right) => {
    const leftIndex = aggregateColumnOrder.indexOf(left.name);
    const rightIndex = aggregateColumnOrder.indexOf(right.name);

    if (leftIndex === -1 && rightIndex === -1) {
      return (aggregateColumnPositionByName.get(left.name) ?? 0) - (aggregateColumnPositionByName.get(right.name) ?? 0);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
  const selectedProjectColumns = isAllWorkspaces
    ? orderedAggregateColumns.map((column, position) => ({
        id: `${AGGREGATE_COLUMN_PREFIX}${column.name}`,
        projectId: ALL_WORKSPACES_ID,
        name: column.name,
        color: column.color,
        icon: column.icon,
        position,
      }))
    : effectiveProjectColumns;
  const editableProjectColumns = (isAllWorkspaces ? selectedProjectColumns : effectiveProjectColumns).filter(
    (column) => column.name !== ARCHIVED_COLUMN_NAME,
  );
  const selectedProjectTasks = (isAllWorkspaces
    ? tasks.map((task) => ({
        ...task,
        columnId: `${AGGREGATE_COLUMN_PREFIX}${allColumnsById.get(task.columnId)?.name ?? "Backlog"}`,
      }))
    : tasks.filter((task) => selectedProjectTreeIds.has(task.projectId))
  ).sort((left, right) => left.position - right.position);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskProject =
    projects.find((project) => project.id === selectedTask?.projectId) ?? null;
  const selectedTaskChecklist = checklistItems.filter(
    (item) => item.taskId === selectedTaskId,
  );
  const archivedTasks = (isAllWorkspaces
    ? tasks
    : tasks.filter((task) => selectedProjectTreeIds.has(task.projectId))
  )
    .filter((task) => allColumnsById.get(task.columnId)?.name === ARCHIVED_COLUMN_NAME)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const canCreateTask = Boolean(selectedProjectId) && !isAllWorkspaces;
  const canManageColumns = Boolean(selectedProjectId) && !isAllWorkspaces;

  useEffect(() => {
    if (!canManageColumns) {
      setColumnDrafts({});
      return;
    }

    setColumnDrafts((current) => {
      const nextDrafts: Record<string, ColumnDraft> = {};

      for (const column of editableProjectColumns) {
        nextDrafts[column.id] = current[column.id]
          ? current[column.id]
          : { name: column.name, color: column.color, icon: column.icon };
      }

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextDrafts);
      const unchanged =
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => {
          const currentDraft = current[key];
          const nextDraft = nextDrafts[key];

          return (
            currentDraft?.name === nextDraft?.name &&
            currentDraft?.color === nextDraft?.color &&
            currentDraft?.icon === nextDraft?.icon
          );
        });

      return unchanged ? current : nextDrafts;
    });
  }, [canManageColumns, selectedProjectId, workspace]);

  function switchProject(projectId: string, nextView: ViewMode, taskId?: string) {
    setSelectedProjectId(projectId);
    setColorPickerProjectId(null);
    if (taskId) {
      setSelectedTaskId(taskId);
    }
    setTaskForm((current) => ({ ...current, columnId: "" }));
    setActiveView(nextView);
  }

  function openProjectModal() {
    setProjectForm({ name: "", description: "", parentProjectId: "" });
    setIsProjectModalOpen(true);
  }

  function closeProjectModal() {
    setIsProjectModalOpen(false);
  }

  function openWorkspaceEditModal(project: { id: string; name: string; description: string }) {
    setColorPickerProjectId(null);
    setWorkspaceEditForm({
      projectId: project.id,
      name: project.name,
      description: project.description,
    });
    setIsWorkspaceEditModalOpen(true);
  }

  function closeWorkspaceEditModal() {
    setIsWorkspaceEditModalOpen(false);
  }

  function openTaskModal(columnId?: string) {
    if (!canCreateTask) {
      return;
    }

    const nextColumnId =
      columnId ??
      taskForm.columnId ??
      editableProjectColumns[0]?.id ??
      "";

    setTaskForm((current) => ({
      ...current,
      title: "",
      notes: "",
      effort: current.effort || "Normale",
      startDate: "",
      dueDate: "",
      columnId: nextColumnId,
    }));
    setIsTaskModalOpen(true);
  }

  function closeTaskModal() {
    setIsTaskModalOpen(false);
  }

  function openKanbanPhasesModal() {
    setIsKanbanPhasesModalOpen(true);
  }

  function closeKanbanPhasesModal() {
    setIsKanbanPhasesModalOpen(false);
  }

  function closeTaskDetailModal() {
    setSelectedTaskId(null);
  }

  function openSettings() {
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
    setIsTrackerActivitiesModalOpen(false);
    setIsTrackerHabitsModalOpen(false);
    setIsTrackerSectionsModalOpen(false);
    setTrackerActivityName("");
  }

  function openTrackerActivitiesModal() {
    setTrackerActivityName("");
    setIsTrackerActivitiesModalOpen(true);
  }

  function closeTrackerActivitiesModal() {
    setIsTrackerActivitiesModalOpen(false);
    setTrackerActivityName("");
  }

  function openTrackerHabitsModal() {
    setIsTrackerHabitsModalOpen(true);
  }

  function closeTrackerHabitsModal() {
    setIsTrackerHabitsModalOpen(false);
  }

  function openTrackerSectionsModal() {
    setIsTrackerSectionsModalOpen(true);
  }

  function closeTrackerSectionsModal() {
    setIsTrackerSectionsModalOpen(false);
  }

  function handleToggleTrackerSection(sectionKey: TrackerSectionKey, visible: boolean) {
    setTrackerSectionVisibility((current) => {
      const next = {
        ...current,
        [sectionKey]: visible,
      };

      window.localStorage.setItem(
        TRACKER_SECTION_VISIBILITY_STORAGE_KEY,
        JSON.stringify(next),
      );

      return next;
    });
  }

  function toggleColorPicker(projectId: string) {
    setColorPickerProjectId((current) => (current === projectId ? null : projectId));
  }

  function openArchiveModal() {
    setIsArchiveModalOpen(true);
  }

  function closeArchiveModal() {
    setIsArchiveModalOpen(false);
  }

  async function handleMoveTask(
    taskId: string,
    targetColumnId: string,
    targetIndex: number,
  ) {
    const previousWorkspace = workspace;

    try {
      let resolvedTargetColumnId = targetColumnId;

      if (targetColumnId.startsWith(AGGREGATE_COLUMN_PREFIX)) {
        const targetName = targetColumnId.replace(AGGREGATE_COLUMN_PREFIX, "");
        const task = tasks.find((item) => item.id === taskId);
        const currentColumnOwnerId = task ? allColumnsById.get(task.columnId)?.projectId : null;
        const targetColumn =
          columns.find(
          (column) => column.projectId === currentColumnOwnerId && column.name === targetName,
          ) ??
          columns.find((column) => column.name === targetName);

        if (!targetColumn) {
          throw new Error(`Target column not found for ${targetName}`);
        }

        resolvedTargetColumnId = targetColumn.id;
      }

      setWorkspace((current) =>
        current
          ? {
              ...current,
              tasks: moveTaskLocally(current.tasks, taskId, resolvedTargetColumnId, targetIndex),
            }
          : current,
      );

      await moveTask(taskId, resolvedTargetColumnId, targetIndex);

      await refreshWorkspace();
    } catch (moveError) {
      if (previousWorkspace) {
        setWorkspace(previousWorkspace);
      }
      setError("Lo spostamento del task non è andato a buon fine.");
      console.error(moveError);
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (isAllWorkspaces) {
      return;
    }

    try {
      const deleted = await deleteColumn(columnId);

      if (!deleted) {
        setError("Ogni progetto deve mantenere almeno una fase.");
        return;
      }

      await refreshWorkspace();
    } catch (deleteError) {
      setError("Non sono riuscito a rimuovere la fase selezionata.");
      console.error(deleteError);
    }
  }

  async function handleUpdateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceEditForm.projectId || !workspaceEditForm.name.trim()) {
      return;
    }

    try {
      await updateProject({
        projectId: workspaceEditForm.projectId,
        name: workspaceEditForm.name,
        description: workspaceEditForm.description,
      });
      await refreshWorkspace();
      setIsWorkspaceEditModalOpen(false);
    } catch (updateError) {
      setError("Non sono riuscito ad aggiornare il workspace.");
      console.error(updateError);
    }
  }

  async function handleDeleteWorkspace(projectId: string) {
    try {
      await deleteProject(projectId);
      const snapshot = await refreshWorkspace();

      setSelectedTaskId((current) => {
        const task = snapshot?.tasks.find((item) => item.id === current);
        return task && task.projectId === projectId ? null : current;
      });

      if (selectedProjectId === projectId) {
        const remainingProjects = snapshot?.projects ?? [];
        setSelectedProjectId(remainingProjects[0]?.id ?? ALL_WORKSPACES_ID);
        setActiveView("board");
      }

      setIsWorkspaceEditModalOpen(false);
    } catch (deleteError) {
      setError("Non sono riuscito a eliminare il workspace.");
      console.error(deleteError);
    }
  }

  async function handleUpdateTask(input: {
    taskId: string;
    title: string;
    notes: string;
    effort: string;
    startDate: string | null;
    dueDate: string | null;
    timelineColor: string | null;
  }) {
    try {
      await updateTask(input);
      await refreshWorkspace();
      setSelectedTaskId(null);
    } catch (updateError) {
      setError("Non sono riuscito a salvare l'evento.");
      console.error(updateError);
    }
  }

  async function handleQuickSetTaskPriority(taskId: string, effort: string) {
    try {
      await updateTaskPriority(taskId, effort);
      await refreshWorkspace();
    } catch (updateError) {
      setError("Non sono riuscito ad aggiornare la priorita.");
      console.error(updateError);
    }
  }

  async function handleAdvanceTask(taskId: string) {
    try {
      await advanceTask(taskId);
      await refreshWorkspace();
    } catch (advanceError) {
      setError("Non sono riuscito a spostare l'evento alla fase successiva.");
      console.error(advanceError);
    }
  }

  async function handleAddChecklistItem(taskId: string, label: string) {
    try {
      await createChecklistItem(taskId, label);
      await refreshWorkspace();
    } catch (createError) {
      setError("Non sono riuscito ad aggiungere il punto alla checklist.");
      console.error(createError);
    }
  }

  async function handleToggleChecklistItem(itemId: string, completed: boolean) {
    try {
      await toggleChecklistItem(itemId, completed);
      await refreshWorkspace();
    } catch (toggleError) {
      setError("Non sono riuscito ad aggiornare la checklist.");
      console.error(toggleError);
    }
  }

  async function handleDeleteChecklistItem(itemId: string) {
    try {
      await deleteChecklistItem(itemId);
      await refreshWorkspace();
    } catch (deleteError) {
      setError("Non sono riuscito a eliminare il punto dalla checklist.");
      console.error(deleteError);
    }
  }

  async function handleUpdateProjectColor(projectId: string, accent: string) {
    try {
      await updateProjectAccent(projectId, accent);
      setColorPickerProjectId(null);
      await refreshWorkspace();
    } catch (updateError) {
      setError("Non sono riuscito ad aggiornare il colore del workspace.");
      console.error(updateError);
    }
  }

  function handleConnectGoogleCalendar() {
    setError(
      "Collegamento Google Calendar non ancora attivato: per completarlo serve configurare OAuth Desktop/PKCE senza salvare il client secret nell'app.",
    );
  }

  async function handleCreateTrackerActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = trackerActivityName.trim();

    if (!nextName) {
      return;
    }

    try {
      await createTrackerWorkoutActivity(nextName);
      setTrackerActivityName("");
      await refreshTrackerWorkoutActivities();
    } catch (createError) {
      setError("Non sono riuscito ad aggiungere l'attivita sportiva.");
      console.error(createError);
    }
  }

  async function handleDeleteTrackerActivity(name: string) {
    try {
      await deleteTrackerWorkoutActivity(name);
      await refreshTrackerWorkoutActivities();
    } catch (deleteError) {
      setError("Non sono riuscito a rimuovere l'attivita sportiva.");
      console.error(deleteError);
    }
  }

  async function handleUpdateTrackerHabit(
    habitKey: TrackerHabitKey,
    patch: Partial<Pick<TrackerHabitPreference, "color" | "hidden">>,
  ) {
    const current = trackerHabitPreferences.find((habit) => habit.key === habitKey);

    if (!current) {
      return;
    }

    const nextHabit: TrackerHabitPreference = {
      ...current,
      ...patch,
      color: patch.color ?? current.color,
      hidden: patch.hidden ?? current.hidden,
    };

    setTrackerHabitPreferences((items) =>
      items.map((habit) => (habit.key === habitKey ? nextHabit : habit)),
    );

    try {
      await updateTrackerHabitPreference({
        habitKey,
        color: nextHabit.color,
        hidden: nextHabit.hidden,
      });
    } catch (updateError) {
      setError("Non sono riuscito ad aggiornare le preferenze dell'abitudine.");
      console.error(updateError);
      await refreshTrackerHabitPreferences();
    }
  }

  function handleAddTrackerYear() {
    setTrackerYears((current) => {
      const maxYear = current.length
        ? Math.max(...current)
        : TRACKER_MIN_YEAR - 1;
      const nextYear = maxYear + 1;
      const nextYears = [...current, nextYear];
      window.localStorage.setItem(
        TRACKER_YEARS_STORAGE_KEY,
        JSON.stringify(nextYears),
      );
      setTrackerYear(nextYear);
      return nextYears;
    });
  }

  async function handleUpdateColumn(columnId: string) {
    const draft = columnDrafts[columnId];

    if (!draft || !draft.name.trim()) {
      setError("Ogni fase deve avere un nome.");
      return;
    }

    try {
      await updateColumn({
        columnId,
        name: draft.name,
        color: draft.color,
        icon: draft.icon,
      });
      await refreshWorkspace();
    } catch (updateError) {
      setError("Non sono riuscito ad aggiornare la fase.");
      console.error(updateError);
    }
  }

  async function handleMoveColumn(columnId: string, direction: -1 | 1) {
    if (isAllWorkspaces) {
      const currentIndex = editableProjectColumns.findIndex((column) => column.id === columnId);

      if (currentIndex === -1) {
        return;
      }

      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= editableProjectColumns.length) {
        return;
      }

      const reorderedColumns = [...editableProjectColumns];
      const [movingColumn] = reorderedColumns.splice(currentIndex, 1);

      reorderedColumns.splice(nextIndex, 0, movingColumn);

      const nextOrder = reorderedColumns.map((column) => column.name);
      setAggregateColumnOrder(nextOrder);
      window.localStorage.setItem(
        AGGREGATE_COLUMN_ORDER_STORAGE_KEY,
        JSON.stringify(nextOrder),
      );
      return;
    }

    if (!selectedProject) {
      return;
    }

    const currentIndex = editableProjectColumns.findIndex((column) => column.id === columnId);

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = currentIndex + direction;

    if (nextIndex < 0 || nextIndex >= editableProjectColumns.length) {
      return;
    }

    const orderedColumns = [...editableProjectColumns];
    const [movingColumn] = orderedColumns.splice(currentIndex, 1);

    orderedColumns.splice(nextIndex, 0, movingColumn);

    try {
      await reorderColumns(
        effectiveColumnOwnerId,
        orderedColumns.map((column) => column.id),
      );
      await refreshWorkspace();
    } catch (moveError) {
      setError("Non sono riuscito a riordinare le fasi.");
      console.error(moveError);
    }
  }

  function updateColumnDraft(column: BoardColumn, patch: Partial<ColumnDraft>) {
    setColumnDrafts((current) => ({
      ...current,
      [column.id]: {
        name: current[column.id]?.name ?? column.name,
        color: current[column.id]?.color ?? column.color,
        icon: current[column.id]?.icon ?? column.icon,
        ...patch,
      },
    }));
  }

  function renderHome() {
    return (
      <section className="home-empty">
        <div className="home-empty__card">
          <p className="eyebrow">Home</p>
          <h2>Pagina iniziale</h2>
          <p>
            Questo spazio resta vuoto per ora e fungerà da ingresso alle sezioni
            che implementeremo progressivamente.
          </p>
        </div>
      </section>
    );
  }

  return (
    <main className="page-shell">
      <header className="top-header">
        <div className="top-header__brand">Organizer</div>
        <nav className="top-header__nav" aria-label="Sezioni principali">
          {[
            { id: "home", label: "Home" },
            { id: "calendar", label: "Calendario" },
            { id: "tracker", label: "Tracker" },
            { id: "measurements", label: "Misurazioni" },
            { id: "subscriptions", label: "Abbonamenti" },
            { id: "workout", label: "Workout" },
            { id: "reading", label: "Lettura" },
            { id: "goals", label: "Obiettivi" },
            { id: "board", label: "Organizer" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                (item.id === "home" && activeView === "home") ||
                (item.id === "tracker" && activeView === "tracker") ||
                (item.id === "measurements" && activeView === "measurements") ||
                (item.id === "subscriptions" && activeView === "subscriptions") ||
                (item.id === "reading" && activeView === "reading") ||
                (item.id === "board" && (activeView === "board" || activeView === "timeline"))
                  ? "is-active"
                  : ""
              }
              onClick={() => {
                if (item.id === "home") {
                  setActiveView("home");
                }

                if (item.id === "tracker") {
                  setActiveView("tracker");
                }

                if (item.id === "measurements") {
                  setActiveView("measurements");
                }

                if (item.id === "subscriptions") {
                  setActiveView("subscriptions");
                }

                if (item.id === "reading") {
                  setActiveView("reading");
                }

                if (item.id === "board") {
                  setActiveView("board");
                }
              }}
            >
              <span className="top-header__nav-item">
                <span className="top-header__nav-icon">
                  {renderHeaderMenuIcon(item.id)}
                </span>
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="settings-trigger"
          aria-label="Apri impostazioni"
          onClick={openSettings}
        >
          ⚙
        </button>
      </header>

      <section className="content-shell">
        {activeView === "home" ? renderHome() : null}

        {activeView === "tracker" ? (
          <TrackerView
            year={trackerYear}
            month={trackerMonth}
            years={trackerYears}
            entries={trackerEntries}
            workoutActivities={trackerWorkoutActivities}
            habitPreferences={trackerHabitPreferences}
            sectionVisibility={trackerSectionVisibility}
            onAddYear={handleAddTrackerYear}
            onChangeYear={setTrackerYear}
            onChangeMonth={setTrackerMonth}
            onSaveEntry={(input) => void handleSaveTrackerEntry(input)}
          />
        ) : null}

        {activeView === "measurements" ? (
          <MeasurementsView
            entries={measurementEntries}
            onSaveEntry={(input) => handleSaveMeasurementEntry(input)}
            onDeleteEntry={(date) => handleDeleteMeasurementEntry(date)}
          />
        ) : null}

        {activeView === "subscriptions" ? (
          <SubscriptionsView
            items={subscriptions}
            onSave={(input) => handleSaveSubscription(input)}
            onDelete={(id) => handleDeleteSubscription(id)}
          />
        ) : null}

        {activeView === "reading" ? (
          <ReadingView
            items={readingItems}
            onSave={(input) => handleSaveReadingItem(input)}
            onDelete={(id) => handleDeleteReadingItem(id)}
          />
        ) : null}

        {activeView === "board" || activeView === "timeline" ? (
          <div className="app-shell">
            <aside className="sidebar">
              <nav className="view-switcher" aria-label="Viste principali">
                {[
                  { id: "board", label: "Board" },
                  { id: "timeline", label: "Timeline" },
                ].map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    className={activeView === view.id ? "is-active" : ""}
                    onClick={() => setActiveView(view.id as ViewMode)}
                  >
                    <span className="view-switcher__item">
                      <span className="view-switcher__icon" aria-hidden="true">
                        {view.id === "board" ? (
                          <svg viewBox="0 0 24 24" className="view-switcher__icon-svg">
                            <rect x="3" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                            <rect x="14" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                            <rect x="3" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                            <rect x="14" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="view-switcher__icon-svg">
                            <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="9" cy="6" r="1.8" fill="currentColor" />
                            <circle cx="15" cy="12" r="1.8" fill="currentColor" />
                            <circle cx="12" cy="18" r="1.8" fill="currentColor" />
                          </svg>
                        )}
                      </span>
                      <span className="view-switcher__label">{view.label}</span>
                    </span>
                  </button>
                ))}
              </nav>

              <section className="panel-block">
                <div className="section-heading">
                  <div>
                    <h2>Workspace</h2>
                  </div>
                </div>

                <div className="project-list">
                  <button
                    type="button"
                    className={`project-chip project-chip--all ${isAllWorkspaces ? "is-selected" : ""}`}
                    onClick={() => switchProject(ALL_WORKSPACES_ID, "board")}
                  >
                    <span className="project-chip__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="project-chip__icon-svg">
                        <path
                          d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <span className="project-chip__content">
                      <strong>Vedi tutti</strong>
                      <small>Board aggregata di tutti i workspace</small>
                    </span>
                  </button>
                  {orderedProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`project-chip ${selectedProjectId === project.id ? "is-selected" : ""} ${project.parentProjectId ? "project-chip--child" : ""}`}
                      style={{ ["--project-depth" as string]: String(projectDepthById.get(project.id) ?? 0) }}
                    >
                      <button
                        type="button"
                        className="project-chip__color-button"
                        aria-label={`Scegli colore workspace ${project.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleColorPicker(project.id);
                        }}
                      >
                        <span
                          className="project-chip__color-dot"
                          aria-hidden="true"
                          style={{ backgroundColor: project.accent }}
                        />
                      </button>
                      <button
                        type="button"
                        className="project-chip__main"
                        onClick={() => switchProject(project.id, "board")}
                      >
                        <strong>{project.name}</strong>
                      </button>
                      <button
                        type="button"
                        className="project-chip__edit"
                        aria-label={`Modifica workspace ${project.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openWorkspaceEditModal(project);
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="project-chip__action-icon" aria-hidden="true">
                          <path
                            d="M4 20h4l10-10-4-4L4 16v4Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12.5 7.5l4 4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                      {colorPickerProjectId === project.id ? (
                        <div className="project-chip__color-picker" onClick={(event) => event.stopPropagation()}>
                          {WORKSPACE_COLOR_OPTIONS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`project-chip__color-option ${project.accent === color ? "is-selected" : ""}`}
                              style={{ ["--workspace-color" as string]: color }}
                              onClick={() => void handleUpdateProjectColor(project.id, color)}
                              aria-label={`Imposta colore ${color} per ${project.name}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel-block">
                <button
                  type="button"
                  className="sidebar-action sidebar-action--primary"
                  onClick={openProjectModal}
                >
                  <span className="sidebar-action__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="sidebar-action__icon-svg">
                      <path
                        d="M12 5v14M5 12h14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="sidebar-action__content">
                    <strong>Crea nuovo Workspace</strong>
                    <small>Nuovo spazio di lavoro separato</small>
                  </span>
                </button>
              </section>

              <section className="panel-block">
                {isAllWorkspaces ? (
                  <button
                    type="button"
                    className="sidebar-action sidebar-action--secondary"
                    onClick={openKanbanPhasesModal}
                  >
                    <span className="sidebar-action__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="sidebar-action__icon-svg">
                        <path
                          d="M7 6h10M5 12h14M9 18h6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="sidebar-action__content">
                      <strong>Riordina Fasi</strong>
                      <small>Cambia l'ordine delle colonne in Vedi tutti</small>
                    </span>
                  </button>
                ) : canManageColumns ? (
                  <button
                    type="button"
                    className="sidebar-action sidebar-action--secondary"
                    onClick={openKanbanPhasesModal}
                  >
                    <span className="sidebar-action__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="sidebar-action__icon-svg">
                        <path
                          d="M4 6h16M4 12h16M4 18h16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                        <circle cx="9" cy="6" r="1.8" fill="currentColor" />
                        <circle cx="15" cy="12" r="1.8" fill="currentColor" />
                        <circle cx="11" cy="18" r="1.8" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="sidebar-action__content">
                      <strong>Modifica Fasi Kanban</strong>
                      <small>Ordina, rinomina e colora le fasi</small>
                    </span>
                  </button>
                ) : (
                  <p className="panel-note">
                    Seleziona un singolo workspace per personalizzare le sue fasi.
                  </p>
                )}
              </section>
            </aside>

            <div>
              <header className="content-header">
                <div>
                  <h2>{isAllWorkspaces ? "Tutti i workspace" : selectedProject?.name ?? "Workspace personale"}</h2>
                  <p>
                    {isAllWorkspaces
                      ? "Kanban aggregata con tutti gli eventi di Lavoro, Studio e Personale."
                      : selectedProject?.description ??
                        "Una base locale per organizzare lavori, idee e scadenze."}
                  </p>
                </div>
                {error ? <div className="error-banner">{error}</div> : null}
              </header>

              <div className="content-grid content-grid--board">
                <section className={`main-panel ${activeView === "board" ? "main-panel--board" : ""}`}>
                  {isLoading ? (
                    <div className="empty-panel">
                      <h3>Caricamento</h3>
                      <p>Sto preparando il database locale e il primo workspace.</p>
                    </div>
                  ) : null}

                  {!isLoading && activeView === "board" ? (
                    <KanbanBoard
                      columns={selectedProjectColumns}
                      tasks={selectedProjectTasks}
                      selectedTaskId={selectedTaskId}
                      projectNamesById={projectNamesById}
                      dragEnabled={!isAllWorkspaces}
                      canCreateTask={canCreateTask}
                      onSelectTask={setSelectedTaskId}
                      onMoveTask={handleMoveTask}
                      onCreateTask={openTaskModal}
                      onSetTaskPriority={(taskId, effort) => void handleQuickSetTaskPriority(taskId, effort)}
                      onAdvanceTask={(taskId) => void handleAdvanceTask(taskId)}
                      onOpenArchive={openArchiveModal}
                    />
                  ) : null}

                  {!isLoading && activeView === "timeline" ? (
                    <TimelineView
                      project={selectedProject}
                      tasks={isAllWorkspaces ? tasks : selectedProjectTasks}
                      projectAccentsById={projectAccentById}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={setSelectedTaskId}
                    />
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="app-mini-footer" aria-label={`Organizer versione ${APP_VERSION}`}>
        <span>Organizer</span>
        <strong>v{APP_VERSION}</strong>
      </div>

      {isProjectModalOpen ? (
        <div className="modal-backdrop" onClick={closeProjectModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h3 id="project-modal-title">Nuovo progetto</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeProjectModal}>
                x
              </button>
            </div>

            <form className="stack-form" onSubmit={handleCreateProject}>
              <label>
                <span>Nome</span>
                <input
                  value={projectForm.name}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setProjectForm((current) => ({
                      ...current,
                      name: value,
                    }));
                  }}
                  placeholder="Esempio: Cliente, studio, app..."
                />
              </label>
              <label>
                <span>Workspace genitore</span>
                <select
                  value={projectForm.parentProjectId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setProjectForm((current) => ({
                      ...current,
                      parentProjectId: value,
                    }));
                  }}
                >
                  <option value="">Nessuno</option>
                  {projects
                    .filter((project) => !project.parentProjectId)
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Descrizione</span>
                <textarea
                  value={projectForm.description}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setProjectForm((current) => ({
                      ...current,
                      description: value,
                    }));
                  }}
                  placeholder="Scrivi il focus del progetto"
                  rows={4}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--ghost" onClick={closeProjectModal}>
                  Annulla
                </button>
                <button type="submit" className="modal-button">
                  Crea progetto
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isWorkspaceEditModalOpen ? (
        <div className="modal-backdrop" onClick={closeWorkspaceEditModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-edit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h3 id="workspace-edit-modal-title">Modifica workspace</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeWorkspaceEditModal}>
                x
              </button>
            </div>

            <form className="stack-form" onSubmit={handleUpdateWorkspace}>
              <label>
                <span>Nome</span>
                <input
                  value={workspaceEditForm.name}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setWorkspaceEditForm((current) => ({
                      ...current,
                      name: value,
                    }));
                  }}
                  placeholder="Nome workspace"
                />
              </label>
              <label>
                <span>Descrizione</span>
                <textarea
                  value={workspaceEditForm.description}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setWorkspaceEditForm((current) => ({
                      ...current,
                      description: value,
                    }));
                  }}
                  placeholder="Descrivi il focus del workspace"
                  rows={4}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-button modal-button--workspace-delete"
                  onClick={() => void handleDeleteWorkspace(workspaceEditForm.projectId)}
                >
                  Elimina workspace
                </button>
                <button
                  type="button"
                  className="modal-button modal-button--workspace-cancel"
                  onClick={closeWorkspaceEditModal}
                >
                  Annulla
                </button>
                <button type="submit" className="modal-button">
                  Salva modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isTaskModalOpen ? (
        <div className="modal-backdrop" onClick={closeTaskModal}>
          <div
            className="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Task</p>
                <h3 id="task-modal-title">Nuova attivita</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeTaskModal}>
                x
              </button>
            </div>

            <form className="stack-form" onSubmit={handleCreateTask}>
              <label>
                <span>Titolo</span>
                <input
                  value={taskForm.title}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setTaskForm((current) => ({
                      ...current,
                      title: value,
                    }));
                  }}
                  placeholder="Scrivi un impegno concreto"
                />
              </label>
              <label>
                <span>Note</span>
                <textarea
                  value={taskForm.notes}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setTaskForm((current) => ({
                      ...current,
                      notes: value,
                    }));
                  }}
                  placeholder="Contesto rapido o output atteso"
                  rows={4}
                />
              </label>
              <div className="form-grid">
                <label>
                  <span>Colonna</span>
                  <select
                    value={taskForm.columnId}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setTaskForm((current) => ({
                        ...current,
                        columnId: value,
                      }));
                    }}
                  >
                    {effectiveProjectColumns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Priorita</span>
                  <select
                    value={taskForm.effort}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setTaskForm((current) => ({
                        ...current,
                        effort: value,
                      }));
                    }}
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Inizio</span>
                  <input
                    type="date"
                    value={taskForm.startDate}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setTaskForm((current) => ({
                        ...current,
                        startDate: value,
                      }));
                    }}
                  />
                </label>
                <label>
                  <span>Fine</span>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setTaskForm((current) => ({
                        ...current,
                        dueDate: value,
                      }));
                    }}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--ghost" onClick={closeTaskModal}>
                  Annulla
                </button>
                <button type="submit" className="modal-button" disabled={!canCreateTask}>
                  Aggiungi task
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isKanbanPhasesModalOpen ? (
        <div className="modal-backdrop" onClick={closeKanbanPhasesModal}>
          <div
            className="modal-card modal-card--wide modal-card--phases"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kanban-phases-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Fasi Kanban</p>
                <h3 id="kanban-phases-modal-title">
                  {selectedProject?.name ?? "Workspace"}
                </h3>
              </div>
              <button type="button" className="modal-close" onClick={closeKanbanPhasesModal}>
                x
              </button>
            </div>

            <div className="phase-list">
              {(isAllWorkspaces ? selectedProjectColumns : effectiveProjectColumns).map((column) => (
                <div
                  key={column.id}
                  className={`phase-item ${column.name === ARCHIVED_COLUMN_NAME ? "phase-item--locked" : ""}`}
                >
                  {isAllWorkspaces ? (
                    <>
                      <div className="phase-item__top">
                        <strong className="phase-item__locked-title">{column.name}</strong>
                        <div className="phase-item__order">
                          <button
                            type="button"
                            onClick={() => void handleMoveColumn(column.id, -1)}
                            disabled={column.position === 0}
                            aria-label={`Sposta in alto ${column.name}`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveColumn(column.id, 1)}
                            disabled={column.position === editableProjectColumns.length - 1}
                            aria-label={`Sposta in basso ${column.name}`}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </>
                  ) : column.name === ARCHIVED_COLUMN_NAME ? (
                    <>
                      <div className="phase-item__top">
                        <strong className="phase-item__locked-title">{column.name}</strong>
                        <span className="phase-item__locked-badge">Sistema</span>
                      </div>
                      <p className="phase-item__locked-note">
                        Fase finale fissa. Mostra gli elementi archiviati in popup dalla board.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="phase-item__top">
                        <div className="phase-item__color">
                          <input
                            type="color"
                            value={columnDrafts[column.id]?.color ?? column.color}
                            onChange={(event) => {
                              const value = event.currentTarget.value;

                              updateColumnDraft(column, { color: value });
                            }}
                            aria-label={`Colore fase ${column.name}`}
                          />
                          <div className="phase-item__icons" aria-label={`Icona fase ${column.name}`}>
                            {COLUMN_ICON_OPTIONS.map((icon) => (
                              <button
                                key={icon}
                                type="button"
                                className={`phase-item__icon-button ${(columnDrafts[column.id]?.icon ?? column.icon) === icon ? "is-selected" : ""}`}
                                onClick={() => updateColumnDraft(column, { icon })}
                                aria-label={`Seleziona icona ${icon}`}
                              >
                                <ColumnIcon icon={icon} className="phase-item__icon-svg" />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="phase-item__order">
                          <button
                            type="button"
                            onClick={() => void handleMoveColumn(column.id, -1)}
                            disabled={column.position === 0}
                            aria-label={`Sposta in alto ${column.name}`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveColumn(column.id, 1)}
                            disabled={column.position === editableProjectColumns.length - 1}
                            aria-label={`Sposta in basso ${column.name}`}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <input
                        className="phase-item__name"
                        value={columnDrafts[column.id]?.name ?? column.name}
                        onChange={(event) => {
                          const value = event.currentTarget.value;

                          updateColumnDraft(column, { name: value });
                        }}
                        placeholder="Nome fase"
                      />
                      <div className="phase-item__actions">
                        <button
                          type="button"
                          onClick={() => void handleUpdateColumn(column.id)}
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          className="phase-item__delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteColumn(column.id);
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {isAllWorkspaces ? (
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-button modal-button--ghost"
                  onClick={closeKanbanPhasesModal}
                >
                  Chiudi
                </button>
              </div>
            ) : (
              <form className="stack-form phase-form" onSubmit={handleCreateColumn}>
                <div className="phase-form__row">
                  <label>
                    <span>Nuova fase</span>
                    <input
                      value={columnForm.name}
                      onChange={(event) => {
                        const value = event.currentTarget.value;

                        setColumnForm((current) => ({ ...current, name: value }));
                      }}
                      placeholder="Esempio: In revisione cliente"
                    />
                  </label>
                <label>
                  <span>Colore</span>
                  <input
                    type="color"
                      value={columnForm.color}
                      onChange={(event) => {
                        const value = event.currentTarget.value;

                      setColumnForm((current) => ({ ...current, color: value }));
                    }}
                  />
                </label>
              </div>
              <label>
                <span>Icona</span>
                <div className="phase-form__icons">
                  {COLUMN_ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`phase-item__icon-button ${columnForm.icon === icon ? "is-selected" : ""}`}
                      onClick={() => {
                        setColumnForm((current) => ({ ...current, icon }));
                      }}
                      aria-label={`Seleziona icona ${icon}`}
                    >
                      <ColumnIcon icon={icon} className="phase-item__icon-svg" />
                    </button>
                  ))}
                </div>
              </label>
              <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-button modal-button--ghost"
                    onClick={closeKanbanPhasesModal}
                  >
                    Chiudi
                  </button>
                  <button type="submit" className="modal-button">
                    Aggiungi fase
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {isArchiveModalOpen ? (
        <div className="modal-backdrop" onClick={closeArchiveModal}>
          <div
            className="modal-card modal-card--archive"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Archivio</p>
                <h3 id="archive-modal-title">
                  {isAllWorkspaces ? "Archiviati di tutti i workspace" : `Archiviati · ${selectedProject?.name ?? ""}`}
                </h3>
              </div>
              <button type="button" className="modal-close" onClick={closeArchiveModal}>
                x
              </button>
            </div>

            <div className="archive-list">
              {archivedTasks.length ? (
                archivedTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="archive-item"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsArchiveModalOpen(false);
                    }}
                  >
                    <div>
                      <strong>{task.title}</strong>
                      <p>{projectNamesById.get(task.projectId) ?? "Workspace"}</p>
                    </div>
                    <span>{task.dueDate ?? "Senza data"}</span>
                  </button>
                ))
              ) : (
                <div className="empty-panel">
                  <h3>Nessun archiviato</h3>
                  <p>Gli eventi che finiscono in Archiviato compariranno qui.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          project={selectedTaskProject}
          columns={columns}
          checklistItems={selectedTaskChecklist}
          onClose={closeTaskDetailModal}
          onSave={(input) => void handleUpdateTask(input)}
          onAdvance={(taskId) => void handleAdvanceTask(taskId)}
          onAddChecklistItem={(taskId, label) => void handleAddChecklistItem(taskId, label)}
          onToggleChecklistItem={(itemId, completed) =>
            void handleToggleChecklistItem(itemId, completed)
          }
          onDeleteChecklistItem={(itemId) => void handleDeleteChecklistItem(itemId)}
        />
      ) : null}

      {isSettingsOpen ? (
        <div className="modal-backdrop" onClick={closeSettings}>
          <div
            className="modal-card modal-card--settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Impostazioni</p>
                <h3 id="settings-title">Preferenze applicazione</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeSettings}>
                x
              </button>
            </div>

            <div className="settings-layout">
              <aside className="settings-sidebar">
                {[
                  { id: "google-calendar", label: "Google Calendar" },
                  { id: "tracker", label: "Tracker" },
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={activeSettingsSection === section.id ? "is-active" : ""}
                    onClick={() => setActiveSettingsSection(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </aside>

              <section className="settings-panel">
                {activeSettingsSection === "google-calendar" ? (
                  <>
                    <div className="settings-panel__header">
                      <div>
                        <p className="eyebrow">Integrazione</p>
                        <h4>Google Calendar</h4>
                      </div>
                      <span className="settings-badge">Beta</span>
                    </div>

                    <div className="settings-card">
                      <p>
                        Collega il tuo account Google per leggere e modificare gli eventi del
                        calendario direttamente dall'app.
                      </p>

                      <div className="settings-facts">
                        <div className="settings-fact">
                          <span>Client ID</span>
                          <strong>{GOOGLE_CALENDAR_CLIENT_ID}</strong>
                        </div>
                        <div className="settings-fact">
                          <span>Stato</span>
                          <strong>Da collegare</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="modal-button settings-connect"
                        onClick={handleConnectGoogleCalendar}
                      >
                        Connetti account Google
                      </button>

                      <p className="settings-note">
                        La UI e la sezione impostazioni sono pronte. Il collegamento reale verrà
                        completato con un flusso OAuth sicuro per desktop, senza usare il client
                        secret nel frontend.
                      </p>
                    </div>
                  </>
                ) : null}

                {activeSettingsSection === "tracker" ? (
                  <>
                    <div className="settings-panel__header">
                      <div>
                        <p className="eyebrow">Tracker</p>
                        <h4>Abitudini e sport</h4>
                      </div>
                      <span className="settings-badge">Configurabile</span>
                    </div>

                    <div className="settings-card">
                      <button
                        type="button"
                        className="modal-button modal-button--neutral settings-connect"
                        onClick={openTrackerSectionsModal}
                      >
                        Mostra o nascondi sezioni Tracker
                      </button>
                      <button
                        type="button"
                        className="modal-button modal-button--neutral settings-connect"
                        onClick={openTrackerHabitsModal}
                      >
                        Gestisci abitudini (visibilita e colore)
                      </button>
                      <button
                        type="button"
                        className="modal-button modal-button--neutral settings-connect"
                        onClick={openTrackerActivitiesModal}
                      >
                        Modifica lista Attivita sportive
                      </button>
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {isTrackerHabitsModalOpen ? (
        <div className="modal-backdrop" onClick={closeTrackerHabitsModal}>
          <div
            className="modal-card modal-card--tracker-habits"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-habits-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Tracker</p>
                <h3 id="tracker-habits-title">Abitudini: visibilita e colori</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeTrackerHabitsModal}>
                x
              </button>
            </div>

            <div className="tracker-habits-list">
              {[...trackerHabitPreferences]
                .sort((left, right) => left.position - right.position)
                .map((habit) => (
                  <div key={habit.key} className="tracker-habits-item">
                    <div className="tracker-habits-item__main">
                      <strong>{habit.label}</strong>
                      <small>{habit.hidden ? "Nascosta nel tracker" : "Visibile nel tracker"}</small>
                    </div>
                    <label className="tracker-habits-item__color">
                      <span>Colore</span>
                      <input
                        type="color"
                        value={habit.color}
                        onChange={(event) =>
                          void handleUpdateTrackerHabit(habit.key, {
                            color: event.currentTarget.value,
                          })
                        }
                      />
                    </label>
                    <label className="tracker-habits-item__toggle">
                      <input
                        type="checkbox"
                        checked={habit.hidden}
                        onChange={(event) =>
                          void handleUpdateTrackerHabit(habit.key, {
                            hidden: event.currentTarget.checked,
                          })
                        }
                      />
                      <span>Nascondi</span>
                    </label>
                  </div>
                ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-button modal-button--ghost"
                onClick={closeTrackerHabitsModal}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTrackerSectionsModalOpen ? (
        <div className="modal-backdrop" onClick={closeTrackerSectionsModal}>
          <div
            className="modal-card modal-card--tracker-habits"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-sections-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Tracker</p>
                <h3 id="tracker-sections-title">Sezioni visibili</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeTrackerSectionsModal}>
                x
              </button>
            </div>

            <div className="tracker-habits-list">
              {(Object.keys(TRACKER_SECTION_LABELS) as TrackerSectionKey[]).map((sectionKey) => (
                <div key={sectionKey} className="tracker-habits-item tracker-habits-item--section">
                  <div className="tracker-habits-item__main">
                    <strong>{TRACKER_SECTION_LABELS[sectionKey]}</strong>
                    <small>
                      {trackerSectionVisibility[sectionKey]
                        ? "Mostrata in ogni giorno del tracker"
                        : "Nascosta nella vista Inserisci dati"}
                    </small>
                  </div>
                  <label className="tracker-habits-item__toggle">
                    <input
                      type="checkbox"
                      checked={trackerSectionVisibility[sectionKey]}
                      onChange={(event) =>
                        handleToggleTrackerSection(sectionKey, event.currentTarget.checked)
                      }
                    />
                    <span>Mostra</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-button modal-button--ghost"
                onClick={closeTrackerSectionsModal}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTrackerActivitiesModalOpen ? (
        <div className="modal-backdrop" onClick={closeTrackerActivitiesModal}>
          <div
            className="modal-card modal-card--tracker-activities"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-activities-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Tracker</p>
                <h3 id="tracker-activities-title">Lista attivita sportive</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeTrackerActivitiesModal}>
                x
              </button>
            </div>

            <form className="tracker-activities-form" onSubmit={handleCreateTrackerActivity}>
              <label>
                <span>Nuova attivita</span>
                <input
                  value={trackerActivityName}
                  onChange={(event) => setTrackerActivityName(event.currentTarget.value)}
                  placeholder="Esempio: Pilates"
                />
              </label>
              <button type="submit" className="modal-button">
                Aggiungi
              </button>
            </form>

            <div className="tracker-activities-list">
              {trackerWorkoutActivities.length ? (
                trackerWorkoutActivities.map((activity) => (
                  <div key={activity} className="tracker-activities-item">
                    <strong>{activity}</strong>
                    <button
                      type="button"
                      className="modal-button modal-button--danger"
                      onClick={() => void handleDeleteTrackerActivity(activity)}
                    >
                      Rimuovi
                    </button>
                  </div>
                ))
              ) : (
                <p className="tracker-activities-empty">
                  Nessuna attivita disponibile. Aggiungine almeno una.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-button modal-button--ghost"
                onClick={closeTrackerActivitiesModal}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
