import { useEffect, useMemo, useState } from "react";
import { BodyMeasurementFigure, type MeasurementZone } from "./BodyMeasurementFigure";
import type { MeasurementEntry, UpsertMeasurementEntryInput } from "../lib/types";

interface MeasurementsViewProps {
  entries: MeasurementEntry[];
  onSaveEntry: (input: UpsertMeasurementEntryInput) => Promise<void> | void;
  onDeleteEntry: (date: string) => Promise<void> | void;
}

interface MeasurementsDraft {
  bicepLeft: string;
  bicepRight: string;
  syncBicep: boolean;
  forearmLeft: string;
  forearmRight: string;
  syncForearm: boolean;
  chest: string;
  waist: string;
  hips: string;
  quadricepsLeft: string;
  quadricepsRight: string;
  syncQuadriceps: boolean;
  calfLeft: string;
  calfRight: string;
  syncCalf: boolean;
}

type MeasurementsMode = "entry" | "dashboard" | "list";
type TrendGoal = "higher" | "lower";
type TrendTone = "improved" | "decline" | "stable";

interface MetricDefinition {
  key: string;
  shortLabel: string;
  label: string;
  unit: string;
  goal: TrendGoal;
  read: (entry: MeasurementEntry) => number | null;
}

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
});

const METRICS: MetricDefinition[] = [
  {
    key: "bicep",
    shortLabel: "Bicipite",
    label: "Bicipite medio",
    unit: "cm",
    goal: "higher",
    read: (entry) => averagePair(entry.bicepLeft, entry.bicepRight),
  },
  {
    key: "forearm",
    shortLabel: "Avambraccio",
    label: "Avambraccio medio",
    unit: "cm",
    goal: "higher",
    read: (entry) => averagePair(entry.forearmLeft, entry.forearmRight),
  },
  {
    key: "chest",
    shortLabel: "Torace",
    label: "Torace",
    unit: "cm",
    goal: "higher",
    read: (entry) => entry.chest,
  },
  {
    key: "waist",
    shortLabel: "Vita",
    label: "Vita",
    unit: "cm",
    goal: "lower",
    read: (entry) => entry.waist,
  },
  {
    key: "hips",
    shortLabel: "Fianchi",
    label: "Fianchi",
    unit: "cm",
    goal: "lower",
    read: (entry) => entry.hips,
  },
  {
    key: "quadriceps",
    shortLabel: "Quadricipite",
    label: "Quadricipite medio",
    unit: "cm",
    goal: "higher",
    read: (entry) => averagePair(entry.quadricepsLeft, entry.quadricepsRight),
  },
  {
    key: "calf",
    shortLabel: "Polpaccio",
    label: "Polpaccio medio",
    unit: "cm",
    goal: "higher",
    read: (entry) => averagePair(entry.calfLeft, entry.calfRight),
  },
];

const MEASUREMENT_GUIDES: Record<
  MeasurementZone,
  { title: string; tip: string }
> = {
  bicep: {
    title: "Bicipiti",
    tip: "Braccia rilassate lungo i fianchi. Misura il punto piu pieno del bicipite senza contrarre.",
  },
  forearm: {
    title: "Avambracci",
    tip: "Braccio rilassato e mano morbida. Misura la parte piu larga dell'avambraccio tenendo il metro parallelo al pavimento.",
  },
  chest: {
    title: "Torace",
    tip: "Passa il metro sopra i capezzoli. Inspira, espira e misura a torace rilassato senza stringere troppo.",
  },
  waist: {
    title: "Vita",
    tip: "Misura la parte piu stretta del busto, poco sopra l'ombelico, con addome rilassato e respiro naturale.",
  },
  hips: {
    title: "Fianchi",
    tip: "Piedi uniti e metro sulla parte piu ampia di glutei e fianchi, mantenendolo perfettamente orizzontale.",
  },
  quadriceps: {
    title: "Quadricipiti",
    tip: "Misura l'inizio gamba sotto la piega glutea, scaricando il peso sull'altra gamba per tenere il quadricipite rilassato.",
  },
  calf: {
    title: "Polpacci",
    tip: "Misura il punto piu largo del polpaccio stando in piedi, con appoggio stabile e muscolo non contratto.",
  },
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toNumberString(value: number | null) {
  return value === null ? "" : String(value);
}

function averagePair(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return null;
  }

  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return (left + right) / 2;
}

function toPairDraft(left: number | null, right: number | null) {
  const isSynced = right === null || right === left;
  return {
    left: toNumberString(left),
    right: toNumberString(isSynced ? left : right),
    sync: isSynced,
  };
}

function toDraft(entry?: MeasurementEntry): MeasurementsDraft {
  const bicep = toPairDraft(entry?.bicepLeft ?? null, entry?.bicepRight ?? null);
  const forearm = toPairDraft(entry?.forearmLeft ?? null, entry?.forearmRight ?? null);
  const quadriceps = toPairDraft(entry?.quadricepsLeft ?? null, entry?.quadricepsRight ?? null);
  const calf = toPairDraft(entry?.calfLeft ?? null, entry?.calfRight ?? null);

  return {
    bicepLeft: bicep.left,
    bicepRight: bicep.right,
    syncBicep: bicep.sync,
    forearmLeft: forearm.left,
    forearmRight: forearm.right,
    syncForearm: forearm.sync,
    chest: toNumberString(entry?.chest ?? null),
    waist: toNumberString(entry?.waist ?? null),
    hips: toNumberString(entry?.hips ?? null),
    quadricepsLeft: quadriceps.left,
    quadricepsRight: quadriceps.right,
    syncQuadriceps: quadriceps.sync,
    calfLeft: calf.left,
    calfRight: calf.right,
    syncCalf: calf.sync,
  };
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInput(date: string, draft: MeasurementsDraft): UpsertMeasurementEntryInput {
  const bicepLeft = parseOptionalNumber(draft.bicepLeft);
  const forearmLeft = parseOptionalNumber(draft.forearmLeft);
  const quadricepsLeft = parseOptionalNumber(draft.quadricepsLeft);
  const calfLeft = parseOptionalNumber(draft.calfLeft);

  return {
    date,
    bicepLeft,
    bicepRight: draft.syncBicep ? bicepLeft : parseOptionalNumber(draft.bicepRight),
    forearmLeft,
    forearmRight: draft.syncForearm ? forearmLeft : parseOptionalNumber(draft.forearmRight),
    chest: parseOptionalNumber(draft.chest),
    waist: parseOptionalNumber(draft.waist),
    hips: parseOptionalNumber(draft.hips),
    quadricepsLeft,
    quadricepsRight: draft.syncQuadriceps
      ? quadricepsLeft
      : parseOptionalNumber(draft.quadricepsRight),
    calfLeft,
    calfRight: draft.syncCalf ? calfLeft : parseOptionalNumber(draft.calfRight),
  };
}

function formatValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/d";
  }

  return value.toFixed(1);
}

function evaluateTrend(delta: number | null, goal: TrendGoal) {
  if (delta === null || Math.abs(delta) < 0.1) {
    return { tone: "stable" as TrendTone, label: "Stabile" };
  }

  const improved = goal === "higher" ? delta > 0 : delta < 0;

  return improved
    ? { tone: "improved" as TrendTone, label: "Miglioramento" }
    : { tone: "decline" as TrendTone, label: "Calo" };
}

function formatDelta(value: number | null) {
  if (value === null || Math.abs(value) < 0.05) {
    return "0.0";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function MeasurementsView({ entries, onSaveEntry, onDeleteEntry }: MeasurementsViewProps) {
  const todayKey = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [mode, setMode] = useState<MeasurementsMode>("entry");
  const [dashboardFromDate, setDashboardFromDate] = useState("");
  const [dashboardToDate, setDashboardToDate] = useState("");
  const [activeZone, setActiveZone] = useState<MeasurementZone | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const entriesByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const [draft, setDraft] = useState<MeasurementsDraft>(() => toDraft(entriesByDate.get(todayKey)));

  const sortedEntriesDesc = useMemo(
    () => [...entries].sort((left, right) => right.date.localeCompare(left.date)),
    [entries],
  );
  const sortedEntriesAsc = useMemo(
    () => [...entries].sort((left, right) => left.date.localeCompare(right.date)),
    [entries],
  );
  const dashboardEntries = useMemo(
    () =>
      sortedEntriesAsc.filter((entry) => {
        if (dashboardFromDate && entry.date < dashboardFromDate) {
          return false;
        }

        if (dashboardToDate && entry.date > dashboardToDate) {
          return false;
        }

        return true;
      }),
    [dashboardFromDate, dashboardToDate, sortedEntriesAsc],
  );

  useEffect(() => {
    if (isDirty) {
      return;
    }

    setDraft(toDraft(entriesByDate.get(selectedDate)));
  }, [entriesByDate, selectedDate, isDirty]);

  function updateDraft(updater: (current: MeasurementsDraft) => MeasurementsDraft) {
    setDraft((current) => updater(current));
    setIsDirty(true);
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      await Promise.resolve(onSaveEntry(toInput(selectedDate, draft)));
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(date: string) {
    const confirmDelete = window.confirm("Eliminare definitivamente questa rilevazione?");

    if (!confirmDelete) {
      return;
    }

    setDeletingDate(date);

    try {
      await Promise.resolve(onDeleteEntry(date));

      if (selectedDate === date) {
        setSelectedDate(todayKey);
        setDraft(toDraft(entriesByDate.get(todayKey)));
        setIsDirty(false);
        setActiveZone(null);
      }
    } finally {
      setDeletingDate(null);
    }
  }

  const dashboardData = useMemo(() => {
    const metrics = METRICS.map((metric) => {
      const series = dashboardEntries
        .map((entry) => ({
          date: entry.date,
          value: metric.read(entry),
        }))
        .filter((point): point is { date: string; value: number } => point.value !== null);

      const first = series[0] ?? null;
      const latest = series[series.length - 1] ?? null;
      const previous = series.length > 1 ? series[series.length - 2] : null;
      const deltaFromStart =
        latest && first ? latest.value - first.value : null;
      const deltaFromPrevious =
        latest && previous ? latest.value - previous.value : null;
      const trend = evaluateTrend(deltaFromStart, metric.goal);

      return {
        metric,
        samples: series.length,
        first,
        latest,
        previous,
        deltaFromStart,
        deltaFromPrevious,
        trend,
      };
    });

    const improvedCount = metrics.filter((item) => item.trend.tone === "improved").length;
    const declineCount = metrics.filter((item) => item.trend.tone === "decline").length;
    const stableCount = metrics.filter((item) => item.trend.tone === "stable").length;
    const firstDate = dashboardEntries[0]?.date ?? null;
    const lastDate = dashboardEntries[dashboardEntries.length - 1]?.date ?? null;

    return {
      metrics,
      improvedCount,
      declineCount,
      stableCount,
      firstDate,
      lastDate,
      totalEntries: dashboardEntries.length,
    };
  }, [dashboardEntries]);

  const selectedEntry = entriesByDate.get(selectedDate);
  const updatedAtLabel = selectedEntry?.updatedAt
    ? UPDATED_AT_FORMATTER.format(new Date(selectedEntry.updatedAt))
    : null;
  const activeGuide = activeZone
    ? MEASUREMENT_GUIDES[activeZone]
    : {
        title: "Guida rapida",
        tip: "Seleziona una misura per vedere come posizionare il metro in modo coerente tra una rilevazione e l'altra.",
      };

  return (
    <section className="measurements-shell">
      <header className="measurements-shell__header">
        <div>
          <p className="eyebrow">Misurazioni</p>
          <h2>Misure corporee</h2>
          <p>Registra, confronta e analizza tutte le rilevazioni nel tempo.</p>
        </div>
        <div className="measurements-shell__actions">
          <div className="measurements-mode-switch" role="tablist" aria-label="Modalita misurazioni">
            <button
              type="button"
              className={mode === "entry" ? "is-active" : ""}
              onClick={() => setMode("entry")}
            >
              Inserimento dati
            </button>
            <button
              type="button"
              className={mode === "dashboard" ? "is-active" : ""}
              onClick={() => setMode("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={mode === "list" ? "is-active" : ""}
              onClick={() => setMode("list")}
            >
              Elenco completo
            </button>
          </div>
          <span className="measurements-meta">
            {mode === "entry"
              ? isDirty
                ? "Modifiche non salvate"
                : updatedAtLabel
                  ? `Ultimo salvataggio: ${updatedAtLabel}`
                  : "Nessuna misurazione salvata"
              : sortedEntriesDesc.length
                ? `${sortedEntriesDesc.length} rilevazioni disponibili`
                : "Nessuna rilevazione salvata"}
          </span>
        </div>
      </header>

      {mode === "entry" ? (
        <div className="measurements-layout">
          <section className="measurements-form-panel">
            <div className="measurements-form">
            <article
              className={`measurements-card ${activeZone === "bicep" ? "is-active" : ""}`}
              onMouseEnter={() => setActiveZone("bicep")}
              onMouseLeave={() => setActiveZone(null)}
            >
              <header>
                <h3>Bicipite (cm)</h3>
                <label className="measurements-sync">
                  <input
                    type="checkbox"
                    checked={draft.syncBicep}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      updateDraft((current) => ({
                        ...current,
                        syncBicep: checked,
                        bicepRight: checked ? current.bicepLeft : current.bicepRight,
                      }));
                    }}
                  />
                  <span>Destro uguale a sinistro</span>
                </label>
              </header>
              <div className="measurements-pair">
                <label>
                  <span>Sinistro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.bicepLeft}
                    onFocus={() => setActiveZone("bicep")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({
                        ...current,
                        bicepLeft: value,
                        bicepRight: current.syncBicep ? value : current.bicepRight,
                      }));
                    }}
                  />
                </label>
                <label>
                  <span>Destro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.bicepRight}
                    disabled={draft.syncBicep}
                    onFocus={() => setActiveZone("bicep")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({ ...current, bicepRight: value }));
                    }}
                  />
                </label>
              </div>
            </article>

            <article
              className={`measurements-card ${activeZone === "forearm" ? "is-active" : ""}`}
              onMouseEnter={() => setActiveZone("forearm")}
              onMouseLeave={() => setActiveZone(null)}
            >
              <header>
                <h3>Avambraccio (cm)</h3>
                <label className="measurements-sync">
                  <input
                    type="checkbox"
                    checked={draft.syncForearm}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      updateDraft((current) => ({
                        ...current,
                        syncForearm: checked,
                        forearmRight: checked ? current.forearmLeft : current.forearmRight,
                      }));
                    }}
                  />
                  <span>Destro uguale a sinistro</span>
                </label>
              </header>
              <div className="measurements-pair">
                <label>
                  <span>Sinistro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.forearmLeft}
                    onFocus={() => setActiveZone("forearm")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({
                        ...current,
                        forearmLeft: value,
                        forearmRight: current.syncForearm ? value : current.forearmRight,
                      }));
                    }}
                  />
                </label>
                <label>
                  <span>Destro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.forearmRight}
                    disabled={draft.syncForearm}
                    onFocus={() => setActiveZone("forearm")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({ ...current, forearmRight: value }));
                    }}
                  />
                </label>
              </div>
            </article>

            <article className="measurements-card measurements-card--single-grid">
              <label
                className={activeZone === "chest" ? "is-active" : ""}
                onMouseEnter={() => setActiveZone("chest")}
                onMouseLeave={() => setActiveZone(null)}
              >
                <span>Torace (cm)</span>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={draft.chest}
                  onFocus={() => setActiveZone("chest")}
                  onBlur={() => setActiveZone(null)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDraft((current) => ({ ...current, chest: value }));
                  }}
                />
              </label>

              <label
                className={activeZone === "waist" ? "is-active" : ""}
                onMouseEnter={() => setActiveZone("waist")}
                onMouseLeave={() => setActiveZone(null)}
              >
                <span>Vita (cm)</span>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={draft.waist}
                  onFocus={() => setActiveZone("waist")}
                  onBlur={() => setActiveZone(null)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDraft((current) => ({ ...current, waist: value }));
                  }}
                />
              </label>

              <label
                className={activeZone === "hips" ? "is-active" : ""}
                onMouseEnter={() => setActiveZone("hips")}
                onMouseLeave={() => setActiveZone(null)}
              >
                <span>Fianchi (cm)</span>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={draft.hips}
                  onFocus={() => setActiveZone("hips")}
                  onBlur={() => setActiveZone(null)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateDraft((current) => ({ ...current, hips: value }));
                  }}
                />
              </label>
            </article>

            <article
              className={`measurements-card ${activeZone === "quadriceps" ? "is-active" : ""}`}
              onMouseEnter={() => setActiveZone("quadriceps")}
              onMouseLeave={() => setActiveZone(null)}
            >
              <header>
                <h3>Quadricipite (cm)</h3>
                <label className="measurements-sync">
                  <input
                    type="checkbox"
                    checked={draft.syncQuadriceps}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      updateDraft((current) => ({
                        ...current,
                        syncQuadriceps: checked,
                        quadricepsRight: checked ? current.quadricepsLeft : current.quadricepsRight,
                      }));
                    }}
                  />
                  <span>Destro uguale a sinistro</span>
                </label>
              </header>
              <div className="measurements-pair">
                <label>
                  <span>Sinistro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.quadricepsLeft}
                    onFocus={() => setActiveZone("quadriceps")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({
                        ...current,
                        quadricepsLeft: value,
                        quadricepsRight: current.syncQuadriceps ? value : current.quadricepsRight,
                      }));
                    }}
                  />
                </label>
                <label>
                  <span>Destro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.quadricepsRight}
                    disabled={draft.syncQuadriceps}
                    onFocus={() => setActiveZone("quadriceps")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({ ...current, quadricepsRight: value }));
                    }}
                  />
                </label>
              </div>
            </article>

            <article
              className={`measurements-card ${activeZone === "calf" ? "is-active" : ""}`}
              onMouseEnter={() => setActiveZone("calf")}
              onMouseLeave={() => setActiveZone(null)}
            >
              <header>
                <h3>Polpaccio (cm)</h3>
                <label className="measurements-sync">
                  <input
                    type="checkbox"
                    checked={draft.syncCalf}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      updateDraft((current) => ({
                        ...current,
                        syncCalf: checked,
                        calfRight: checked ? current.calfLeft : current.calfRight,
                      }));
                    }}
                  />
                  <span>Destro uguale a sinistro</span>
                </label>
              </header>
              <div className="measurements-pair">
                <label>
                  <span>Sinistro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.calfLeft}
                    onFocus={() => setActiveZone("calf")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({
                        ...current,
                        calfLeft: value,
                        calfRight: current.syncCalf ? value : current.calfRight,
                      }));
                    }}
                  />
                </label>
                <label>
                  <span>Destro</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.calfRight}
                    disabled={draft.syncCalf}
                    onFocus={() => setActiveZone("calf")}
                    onBlur={() => setActiveZone(null)}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({ ...current, calfRight: value }));
                    }}
                  />
                </label>
              </div>
            </article>
            </div>

            <div className="measurements-form-actions">
              <label className="measurements-date-field">
                <span>Data rilevazione</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const nextDate = event.currentTarget.value;

                    if (!nextDate) {
                      return;
                    }

                    setSelectedDate(nextDate);
                    setDraft(toDraft(entriesByDate.get(nextDate)));
                    setIsDirty(false);
                    setActiveZone(null);
                  }}
                />
              </label>
              <button
                type="button"
                className="measurements-save"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? "Salvataggio..." : "Salva misurazioni"}
              </button>
            </div>
          </section>

          <aside className="measurements-figure-card">
            <article className="measurements-guide-box">
              <span>Come misurare</span>
              <strong>{activeGuide.title}</strong>
              <p>{activeGuide.tip}</p>
            </article>
            <header>
              <h3>Sagoma corpo</h3>
              <span>Le aree si illuminano durante l&apos;inserimento.</span>
            </header>
            <div className="measurements-figure">
              <BodyMeasurementFigure activeZone={activeZone} />
            </div>
          </aside>
        </div>
      ) : null}

      {mode === "dashboard" ? (
        <section className="measurements-dashboard">
          <div className="measurements-dashboard__filters">
            <label className="measurements-date-field">
              <span>Dal</span>
              <input
                type="date"
                value={dashboardFromDate}
                max={dashboardToDate || undefined}
                onChange={(event) => setDashboardFromDate(event.currentTarget.value)}
              />
            </label>
            <label className="measurements-date-field">
              <span>Al</span>
              <input
                type="date"
                value={dashboardToDate}
                min={dashboardFromDate || undefined}
                onChange={(event) => setDashboardToDate(event.currentTarget.value)}
              />
            </label>
          </div>

          <div className="measurements-dashboard__summary">
            <article className="measurements-kpi measurements-kpi--summary">
              <span>Rilevazioni totali</span>
              <strong>{dashboardData.totalEntries}</strong>
              <small>
                {dashboardData.firstDate && dashboardData.lastDate
                  ? `${DATE_FORMATTER.format(new Date(dashboardData.firstDate))} - ${DATE_FORMATTER.format(new Date(dashboardData.lastDate))}`
                  : "Inserisci almeno una rilevazione"}
              </small>
            </article>
            <article className="measurements-kpi measurements-kpi--improved">
              <span>Miglioramenti</span>
              <strong>{dashboardData.improvedCount}</strong>
              <small>Metriche in miglioramento</small>
            </article>
            <article className="measurements-kpi measurements-kpi--decline">
              <span>Cali</span>
              <strong>{dashboardData.declineCount}</strong>
              <small>Metriche in calo</small>
            </article>
            <article className="measurements-kpi measurements-kpi--stable">
              <span>Stabili</span>
              <strong>{dashboardData.stableCount}</strong>
              <small>Metriche senza variazioni forti</small>
            </article>
          </div>

          <div className="measurements-dashboard__grid">
            {dashboardData.metrics.map((item) => (
              <article
                key={item.metric.key}
                className={`measurements-metric-card measurements-metric-card--${item.trend.tone}`}
              >
                <header>
                  <h3>{item.metric.label}</h3>
                  <span>{item.trend.label}</span>
                </header>
                <div className="measurements-metric-card__value">
                  <strong>{formatValue(item.latest?.value ?? null)}</strong>
                  <small>{item.metric.unit}</small>
                </div>
                <p>
                  Variazione totale:{" "}
                  <strong>{formatDelta(item.deltaFromStart)} {item.metric.unit}</strong>
                </p>
                <p>
                  Ultima variazione:{" "}
                  <strong>{formatDelta(item.deltaFromPrevious)} {item.metric.unit}</strong>
                </p>
                <small>
                  Campioni: {item.samples}
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "list" ? (
        <section className="measurements-list">
          {sortedEntriesDesc.length ? (
            sortedEntriesDesc.map((entry) => (
              <article key={entry.date} className="measurements-list__item">
                <div className="measurements-list__head">
                  <strong>{DATE_FORMATTER.format(new Date(entry.date))}</strong>
                  <span>Aggiornato: {UPDATED_AT_FORMATTER.format(new Date(entry.updatedAt))}</span>
                </div>

                <div className="measurements-list__metrics">
                  {METRICS.map((metric) => (
                    <div key={metric.key} className="measurements-list__metric">
                      <span>{metric.shortLabel}</span>
                      <strong>{formatValue(metric.read(entry))} {metric.unit}</strong>
                    </div>
                  ))}
                </div>

                <div className="measurements-list__actions">
                  <button
                    type="button"
                    className="measurements-list__edit"
                    onClick={() => {
                      setMode("entry");
                      setSelectedDate(entry.date);
                      setDraft(toDraft(entry));
                      setIsDirty(false);
                    }}
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    className="measurements-list__delete"
                    onClick={() => void handleDelete(entry.date)}
                    disabled={deletingDate === entry.date}
                  >
                    {deletingDate === entry.date ? "Elimino..." : "Elimina"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="measurements-list__empty">
              Nessuna misurazione presente. Inserisci la prima dalla modalita "Inserimento dati".
            </p>
          )}
        </section>
      ) : null}
    </section>
  );
}
