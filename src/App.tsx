import { type FormEvent, useEffect, useState } from "react";
import "./App.css";
import { KanbanBoard } from "./components/KanbanBoard";
import { TaskDetailModal } from "./components/TaskDetailModal";
import { TimelineView } from "./components/TimelineView";
import { COLUMN_ICON_OPTIONS, ColumnIcon } from "./lib/columnIcons";
import {
  ARCHIVED_COLUMN_NAME,
  advanceTask,
  createChecklistItem,
  createColumn,
  createProject,
  createTask,
  deleteColumn,
  deleteProject,
  loadWorkspace,
  moveTask,
  reorderColumns,
  toggleChecklistItem,
  updateColumn,
  updateProject,
  updateProjectIcon,
  updateTask,
} from "./lib/database";
import { PRIORITY_OPTIONS } from "./lib/priorities";
import type { BoardColumn, ViewMode, WorkspaceSnapshot } from "./lib/types";

const ALL_WORKSPACES_ID = "__all__";
const AGGREGATE_COLUMN_PREFIX = "all:";
const DEFAULT_NEW_COLUMN_COLOR = "#5450ff";
const WORKSPACE_ICON_OPTIONS = ["💼", "📚", "🏠", "🧠", "💻", "🗂️", "🎯", "✍️", "🧾", "🧪"];
const GOOGLE_CALENDAR_CLIENT_ID =
  "109644726881-j16a7f4ulc6vgv22b3s1djvrbkpt0pj3.apps.googleusercontent.com";
const AGGREGATE_COLUMN_ORDER_STORAGE_KEY = "organizer.aggregate-column-order";

interface ColumnDraft {
  name: string;
  color: string;
  icon: string;
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
  const [iconPickerProjectId, setIconPickerProjectId] = useState<string | null>(null);
  const [aggregateColumnOrder, setAggregateColumnOrder] = useState<string[]>([]);

  useEffect(() => {
    void refreshWorkspace();
  }, []);

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
    : effectiveProjectColumns.map((column, position) => ({
        id: `${AGGREGATE_COLUMN_PREFIX}${column.name}`,
        projectId: selectedProjectId,
        name: column.name,
        color: column.color,
        icon: column.icon,
        position,
      }));
  const editableProjectColumns = (isAllWorkspaces ? selectedProjectColumns : effectiveProjectColumns).filter(
    (column) => column.name !== ARCHIVED_COLUMN_NAME,
  );
  const selectedProjectTasks = (isAllWorkspaces
    ? tasks.map((task) => ({
        ...task,
        columnId: `${AGGREGATE_COLUMN_PREFIX}${allColumnsById.get(task.columnId)?.name ?? "Backlog"}`,
      }))
    : tasks
        .filter((task) => selectedProjectTreeIds.has(task.projectId))
        .map((task) => ({
          ...task,
          columnId: `${AGGREGATE_COLUMN_PREFIX}${allColumnsById.get(task.columnId)?.name ?? "Backlog"}`,
        }))
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
  }

  function toggleIconPicker(projectId: string) {
    setIconPickerProjectId((current) => (current === projectId ? null : projectId));
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
        const targetColumn = columns.find(
          (column) => column.projectId === currentColumnOwnerId && column.name === targetName,
        );

        if (!targetColumn) {
          return;
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
      setSelectedTaskId(taskId);
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
  }) {
    try {
      await updateTask(input);
      await refreshWorkspace();
    } catch (updateError) {
      setError("Non sono riuscito a salvare l'evento.");
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

  async function handleUpdateProjectIcon(projectId: string, icon: string) {
    try {
      await updateProjectIcon(projectId, icon);
      setIconPickerProjectId(null);
      await refreshWorkspace();
    } catch (updateError) {
      setError("Non sono riuscito ad aggiornare l'icona del workspace.");
      console.error(updateError);
    }
  }

  function handleConnectGoogleCalendar() {
    setError(
      "Collegamento Google Calendar non ancora attivato: per completarlo serve configurare OAuth Desktop/PKCE senza salvare il client secret nell'app.",
    );
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
                (item.id === "board" && activeView !== "home")
                  ? "is-active"
                  : ""
              }
              onClick={() => {
                if (item.id === "home") {
                  setActiveView("home");
                }

                if (item.id === "board") {
                  setActiveView("board");
                }
              }}
            >
              {item.label}
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

        {activeView !== "home" ? (
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
                    {view.label}
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
                        className="project-chip__icon-button"
                        aria-label={`Cambia icona workspace ${project.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleIconPicker(project.id);
                        }}
                      >
                        <span className="project-chip__icon" aria-hidden="true">
                          {project.icon}
                        </span>
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
                      {iconPickerProjectId === project.id ? (
                        <div className="project-chip__picker" onClick={(event) => event.stopPropagation()}>
                          {WORKSPACE_ICON_OPTIONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              className={`project-chip__picker-item ${project.icon === icon ? "is-selected" : ""}`}
                              onClick={() => void handleUpdateProjectIcon(project.id, icon)}
                            >
                              {icon}
                            </button>
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
                      canManageColumns={canManageColumns}
                      canCreateTask={canCreateTask}
                      onSelectTask={setSelectedTaskId}
                      onMoveTask={handleMoveTask}
                      onDeleteColumn={(columnId) => void handleDeleteColumn(columnId)}
                      onCreateTask={openTaskModal}
                      onAdvanceTask={(taskId) => void handleAdvanceTask(taskId)}
                      onOpenArchive={openArchiveModal}
                    />
                  ) : null}

                  {!isLoading && activeView === "timeline" ? (
                    <TimelineView
                      project={selectedProject}
                      tasks={isAllWorkspaces ? tasks : selectedProjectTasks}
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
                  className="modal-button modal-button--danger"
                  onClick={() => void handleDeleteWorkspace(workspaceEditForm.projectId)}
                >
                  Elimina workspace
                </button>
                <button
                  type="button"
                  className="modal-button modal-button--ghost"
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
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
