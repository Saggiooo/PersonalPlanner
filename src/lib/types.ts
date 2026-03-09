export type ViewMode =
  | "home"
  | "board"
  | "timeline"
  | "tracker"
  | "measurements"
  | "subscriptions"
  | "reading";

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
  timelineColor: string | null;
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
  timelineColor?: string | null;
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
  timelineColor: string | null;
}

export interface TrackerEntry {
  date: string;
  weightKg: number | null;
  didWorkout: boolean;
  workoutType: string | null;
  workoutMinutes: number | null;
  stepsOver8000: boolean;
  readBook: boolean;
  skincare: boolean;
  meditation: boolean;
  creatine: boolean;
  supplements: boolean;
  avoidedReels: boolean;
  kcalTotal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fatsG: number | null;
  notes: string;
  updatedAt: string;
}

export interface UpsertTrackerEntryInput {
  date: string;
  weightKg: number | null;
  didWorkout: boolean;
  workoutType: string | null;
  workoutMinutes: number | null;
  stepsOver8000: boolean;
  readBook: boolean;
  skincare: boolean;
  meditation: boolean;
  creatine: boolean;
  supplements: boolean;
  avoidedReels: boolean;
  kcalTotal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fatsG: number | null;
  notes: string;
}

export type TrackerHabitKey =
  | "readBook"
  | "skincare"
  | "meditation"
  | "creatine"
  | "supplements"
  | "avoidedReels";

export interface TrackerHabitPreference {
  key: TrackerHabitKey;
  label: string;
  color: string;
  hidden: boolean;
  position: number;
}

export type TrackerSectionKey =
  | "weight"
  | "sport"
  | "habits"
  | "nutrition"
  | "notes";

export interface MeasurementEntry {
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
}

export interface UpsertMeasurementEntryInput {
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
}

export type SubscriptionStatus =
  | "attivo"
  | "da-disattivare"
  | "disattivato"
  | "non-so";

export type SubscriptionFrequency = "giornaliera" | "mensile" | "annuale";

export type SubscriptionCategory = "personale" | "lavoro";

export type SubscriptionSharing = "individuale" | "condiviso";

export interface SubscriptionItem {
  id: string;
  status: SubscriptionStatus;
  name: string;
  totalPrice: number;
  mySharePrice: number;
  frequency: SubscriptionFrequency;
  platform: string;
  billingSource: string;
  renewalDate: string;
  category: SubscriptionCategory;
  sharing: SubscriptionSharing;
  sharedPeople: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSubscriptionInput {
  id?: string | null;
  status: SubscriptionStatus;
  name: string;
  totalPrice: number;
  mySharePrice: number;
  frequency: SubscriptionFrequency;
  platform: string;
  billingSource: string;
  renewalDate: string;
  category: SubscriptionCategory;
  sharing: SubscriptionSharing;
  sharedPeople: string[];
}

export type ReadingStatus =
  | "letto"
  | "letto-parzialmente"
  | "da-leggere"
  | "in-lettura"
  | "da-comprare";

export type ReadingRating = "pessimo" | "discreto" | "buono" | "molto-bello";

export type ReadingCategory =
  | "crescita-personale"
  | "narrazione-romanzo"
  | "cultura-generale"
  | "psicologia"
  | "altro";

export interface ReadingItem {
  id: string;
  status: ReadingStatus;
  title: string;
  readingYear: number | null;
  rating: ReadingRating | null;
  category: ReadingCategory;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertReadingInput {
  id?: string | null;
  status: ReadingStatus;
  title: string;
  readingYear: number | null;
  rating: ReadingRating | null;
  category: ReadingCategory;
  summary: string;
}
