export type ViewMode = "home" | "board" | "timeline";

export interface Project {
  id: string;
  name: string;
  description: string;
  parentProjectId: string | null;
  accent: string;
  icon: string;
  status: string;
  createdAt: string;
}

export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  color: string;
  icon: string;
  position: number;
}

export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  notes: string;
  effort: string;
  lane: string;
  position: number;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  label: string;
  completed: boolean;
  position: number;
  createdAt: string;
}

export interface WorkspaceSnapshot {
  projects: Project[];
  columns: BoardColumn[];
  tasks: Task[];
  checklistItems: ChecklistItem[];
}

export interface NewProjectInput {
  name: string;
  description: string;
  parentProjectId: string | null;
}

export interface UpdateProjectInput {
  projectId: string;
  name: string;
  description: string;
}

export interface NewTaskInput {
  projectId: string;
  columnId: string;
  title: string;
  notes: string;
  effort: string;
  lane: string;
  startDate: string | null;
  dueDate: string | null;
}

export interface NewColumnInput {
  projectId: string;
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateColumnInput {
  columnId: string;
  name: string;
  color: string;
  icon: string;
}

export interface UpdateTaskInput {
  taskId: string;
  title: string;
  notes: string;
  effort: string;
  startDate: string | null;
  dueDate: string | null;
}
