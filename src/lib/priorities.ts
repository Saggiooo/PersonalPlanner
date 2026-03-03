const PRIORITY_MAP = {
  Urgente: { label: "Urgente", tone: "urgent" },
  Alta: { label: "Alta", tone: "high" },
  Normale: { label: "Normale", tone: "normal" },
  Bassa: { label: "Bassa", tone: "low" },
  Nessuna: { label: "Nessuna", tone: "none" },
  Deep: { label: "Alta", tone: "high" },
  Focus: { label: "Normale", tone: "normal" },
  Studio: { label: "Normale", tone: "normal" },
  Light: { label: "Bassa", tone: "low" },
} as const;

export const PRIORITY_OPTIONS = [
  "Urgente",
  "Alta",
  "Normale",
  "Bassa",
  "Nessuna",
] as const;

export type PriorityTone = (typeof PRIORITY_MAP)[keyof typeof PRIORITY_MAP]["tone"];

export function getPriorityMeta(value: string) {
  return PRIORITY_MAP[value as keyof typeof PRIORITY_MAP] ?? PRIORITY_MAP.Nessuna;
}
