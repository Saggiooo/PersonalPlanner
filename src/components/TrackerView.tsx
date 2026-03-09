import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TrackerEntry,
  TrackerHabitKey,
  TrackerHabitPreference,
  TrackerSectionKey,
  UpsertTrackerEntryInput,
} from "../lib/types";

interface TrackerViewProps {
  year: number;
  month: number;
  years: number[];
  entries: TrackerEntry[];
  workoutActivities: string[];
  habitPreferences: TrackerHabitPreference[];
  sectionVisibility: Record<TrackerSectionKey, boolean>;
  onAddYear: () => void;
  onChangeYear: (year: number) => void;
  onChangeMonth: (month: number) => void;
  onSaveEntry: (input: UpsertTrackerEntryInput) => void;
}

interface TrackerDayDraft {
  weightKg: string;
  didWorkout: boolean;
  workoutType: string;
  workoutMinutes: string;
  stepsOver8000: boolean;
  readBook: boolean;
  skincare: boolean;
  meditation: boolean;
  creatine: boolean;
  supplements: boolean;
  avoidedReels: boolean;
  kcalTotal: string;
  proteinG: string;
  carbsG: string;
  sugarsG: string;
  fatsG: string;
  notes: string;
}

const MONTH_LABELS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
});

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthDays(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayDate = new Date(year, month - 1, index + 1);
    return {
      date: dayDate,
      key: toDateKey(dayDate),
    };
  });
}

function toYearDays(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const days: Array<{ date: Date; key: string }> = [];

  for (
    let currentDate = new Date(startDate);
    currentDate <= endDate;
    currentDate.setDate(currentDate.getDate() + 1)
  ) {
    const dayDate = new Date(currentDate);
    days.push({
      date: dayDate,
      key: toDateKey(dayDate),
    });
  }

  return days;
}

function toNumberString(value: number | null) {
  return value === null ? "" : String(value);
}

function toDraft(entry?: TrackerEntry): TrackerDayDraft {
  return {
    weightKg: toNumberString(entry?.weightKg ?? null),
    didWorkout: entry?.didWorkout ?? false,
    workoutType: entry?.workoutType ?? "",
    workoutMinutes: toNumberString(entry?.workoutMinutes ?? null),
    stepsOver8000: entry?.stepsOver8000 ?? false,
    readBook: entry?.readBook ?? false,
    skincare: entry?.skincare ?? false,
    meditation: entry?.meditation ?? false,
    creatine: entry?.creatine ?? false,
    supplements: entry?.supplements ?? false,
    avoidedReels: entry?.avoidedReels ?? false,
    kcalTotal: toNumberString(entry?.kcalTotal ?? null),
    proteinG: toNumberString(entry?.proteinG ?? null),
    carbsG: toNumberString(entry?.carbsG ?? null),
    sugarsG: toNumberString(entry?.sugarsG ?? null),
    fatsG: toNumberString(entry?.fatsG ?? null),
    notes: entry?.notes ?? "",
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDayLabel(date: Date) {
  const raw = DAY_LABEL_FORMATTER.format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getHabitValue(draft: TrackerDayDraft, key: TrackerHabitKey) {
  switch (key) {
    case "readBook":
      return draft.readBook;
    case "skincare":
      return draft.skincare;
    case "meditation":
      return draft.meditation;
    case "creatine":
      return draft.creatine;
    case "supplements":
      return draft.supplements;
    case "avoidedReels":
      return draft.avoidedReels;
    default:
      return false;
  }
}

function toRgbHexTriplet(hexColor: string) {
  const hex = hexColor.trim().replace("#", "");
  const normalizedHex = hex.length === 3
    ? hex.split("").map((char) => `${char}${char}`).join("")
    : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return "94, 123, 255";
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function hasTrackedData(entry: TrackerEntry | undefined) {
  if (!entry) {
    return false;
  }

  return (
    entry.weightKg !== null ||
    entry.didWorkout ||
    (entry.workoutType?.trim() ?? "").length > 0 ||
    entry.workoutMinutes !== null ||
    entry.stepsOver8000 ||
    entry.readBook ||
    entry.skincare ||
    entry.meditation ||
    entry.creatine ||
    entry.supplements ||
    entry.avoidedReels ||
    entry.kcalTotal !== null ||
    entry.proteinG !== null ||
    entry.carbsG !== null ||
    entry.sugarsG !== null ||
    entry.fatsG !== null ||
    entry.notes.trim().length > 0
  );
}

function getHabitEntryValue(entry: TrackerEntry | undefined, key: TrackerHabitKey) {
  if (!entry) {
    return false;
  }

  switch (key) {
    case "readBook":
      return entry.readBook;
    case "skincare":
      return entry.skincare;
    case "meditation":
      return entry.meditation;
    case "creatine":
      return entry.creatine;
    case "supplements":
      return entry.supplements;
    case "avoidedReels":
      return entry.avoidedReels;
    default:
      return false;
  }
}

function formatMetric(value: number | null, decimals = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "n/d";
  }

  return value.toFixed(decimals);
}

export function TrackerView({
  year,
  month,
  years,
  entries,
  workoutActivities,
  habitPreferences,
  sectionVisibility,
  onAddYear,
  onChangeYear,
  onChangeMonth,
  onSaveEntry,
}: TrackerViewProps) {
  const [draftsByDate, setDraftsByDate] = useState<Record<string, TrackerDayDraft>>({});
  const [trackerMode, setTrackerMode] = useState<"entry" | "dashboard">("entry");
  const saveTimeoutByDateRef = useRef<Record<string, number>>({});
  const todayKey = toDateKey(new Date());
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayTimestamp = todayDate.getTime();
  const periodDays = useMemo(
    () => (month === 0 ? toYearDays(year) : toMonthDays(year, month)),
    [year, month],
  );
  const entryDays = useMemo(
    () => (month === 0 ? [] : periodDays),
    [month, periodDays],
  );
  const entriesByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const sortedHabits = useMemo(
    () => [...habitPreferences].sort((left, right) => left.position - right.position),
    [habitPreferences],
  );
  const visibleHabits = useMemo(
    () => sortedHabits.filter((habit) => !habit.hidden),
    [sortedHabits],
  );

  const dashboard = useMemo(() => {
    const isYearView = month === 0;
    const monthRows = periodDays.map((day, index) => ({
      day,
      index,
      entry: entriesByDate.get(day.key),
    }));
    const totalDays = monthRows.length;
    const trackedDays = monthRows.reduce(
      (count, row) => count + (hasTrackedData(row.entry) ? 1 : 0),
      0,
    );

    const monthBuckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      monthIndex,
      workoutMinutes: 0,
      weightSum: 0,
      weightCount: 0,
    }));

    for (const row of monthRows) {
      const currentMonthIndex = row.day.date.getMonth();

      if (row.entry?.didWorkout) {
        monthBuckets[currentMonthIndex].workoutMinutes += Math.max(
          0,
          row.entry.workoutMinutes ?? 0,
        );
      }

      if (row.entry?.weightKg !== null && row.entry?.weightKg !== undefined) {
        monthBuckets[currentMonthIndex].weightSum += row.entry.weightKg;
        monthBuckets[currentMonthIndex].weightCount += 1;
      }
    }

    const workoutSeries = isYearView
      ? monthBuckets.map((bucket) => ({
          key: `month-${bucket.monthIndex + 1}`,
          index: bucket.monthIndex,
          label: MONTH_LABELS[bucket.monthIndex].slice(0, 3),
          value: bucket.workoutMinutes,
        }))
      : monthRows.map((row) => ({
          key: row.day.key,
          index: row.index,
          label: `${row.day.date.getDate()}`,
          value:
            row.entry?.didWorkout
              ? Math.max(0, row.entry.workoutMinutes ?? 0)
              : 0,
        }));
    const maxWorkoutValue = Math.max(1, ...workoutSeries.map((item) => item.value));
    const workoutActiveCount = workoutSeries.reduce(
      (count, item) => count + (item.value > 0 ? 1 : 0),
      0,
    );
    const totalWorkoutMinutes = workoutSeries.reduce((sum, item) => sum + item.value, 0);

    const weightSeries = isYearView
      ? monthBuckets.flatMap((bucket) =>
          bucket.weightCount
            ? [
                {
                  key: `weight-month-${bucket.monthIndex + 1}`,
                  index: bucket.monthIndex,
                  value: bucket.weightSum / bucket.weightCount,
                },
              ]
            : [],
        )
      : monthRows.flatMap((row) =>
          row.entry?.weightKg !== null && row.entry?.weightKg !== undefined
            ? [{ key: row.day.key, index: row.index, value: row.entry.weightKg }]
            : [],
        );
    const weightDelta =
      weightSeries.length >= 2
        ? weightSeries[weightSeries.length - 1].value - weightSeries[0].value
        : null;

    const avg = (values: number[]) =>
      values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;

    const kcalValues = monthRows
      .map((row) => row.entry?.kcalTotal)
      .filter((value): value is number => value !== null && value !== undefined);
    const proteinValues = monthRows
      .map((row) => row.entry?.proteinG)
      .filter((value): value is number => value !== null && value !== undefined);
    const carbsValues = monthRows
      .map((row) => row.entry?.carbsG)
      .filter((value): value is number => value !== null && value !== undefined);
    const sugarsValues = monthRows
      .map((row) => row.entry?.sugarsG)
      .filter((value): value is number => value !== null && value !== undefined);
    const fatsValues = monthRows
      .map((row) => row.entry?.fatsG)
      .filter((value): value is number => value !== null && value !== undefined);

    const habitStats = sortedHabits.map((habit) => {
      const completed = monthRows.reduce(
        (count, row) => count + (getHabitEntryValue(row.entry, habit.key) ? 1 : 0),
        0,
      );

      return {
        ...habit,
        completed,
        rate: totalDays ? completed / totalDays : 0,
      };
    });

    const totalHabitChecks = totalDays * Math.max(1, sortedHabits.length);
    const completedHabitChecks = habitStats.reduce((sum, habit) => sum + habit.completed, 0);
    const habitCompletionRate = totalHabitChecks
      ? completedHabitChecks / totalHabitChecks
      : 0;

    const notesDays = monthRows.reduce(
      (count, row) => count + ((row.entry?.notes.trim().length ?? 0) > 0 ? 1 : 0),
      0,
    );

    const recentTrackedDays = monthRows
      .filter((row) => hasTrackedData(row.entry))
      .slice(-6)
      .reverse();

    const bestHabit = [...habitStats].sort((left, right) => right.rate - left.rate)[0] ?? null;

    return {
      totalDays,
      periodDays,
      trackedDays,
      chartSpan: isYearView ? 12 : totalDays,
      isYearView,
      workoutActiveCount,
      workoutActiveLabel: isYearView ? "mesi attivi" : "giorni attivi",
      totalWorkoutMinutes,
      avgWorkoutMinutes: workoutActiveCount ? totalWorkoutMinutes / workoutActiveCount : null,
      stepsDays: monthRows.reduce(
        (count, row) => count + (row.entry?.stepsOver8000 ? 1 : 0),
        0,
      ),
      weightSeries,
      weightDelta,
      workoutSeries,
      maxWorkoutValue,
      avgKcal: avg(kcalValues),
      avgProtein: avg(proteinValues),
      avgCarbs: avg(carbsValues),
      avgSugars: avg(sugarsValues),
      avgFats: avg(fatsValues),
      habitStats,
      habitCompletionRate,
      notesDays,
      recentTrackedDays,
      bestHabit,
    };
  }, [entriesByDate, month, periodDays, sortedHabits]);

  useEffect(() => {
    const nextDrafts: Record<string, TrackerDayDraft> = {};

    for (const day of entryDays) {
      nextDrafts[day.key] = toDraft(entriesByDate.get(day.key));
    }

    setDraftsByDate(nextDrafts);
  }, [entriesByDate, entryDays]);

  useEffect(() => {
    return () => {
      const timeoutIds = Object.values(saveTimeoutByDateRef.current);

      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  function toInput(date: string, draft: TrackerDayDraft): UpsertTrackerEntryInput {
    return {
      date,
      weightKg: parseOptionalNumber(draft.weightKg),
      didWorkout: draft.didWorkout,
      workoutType: draft.didWorkout ? draft.workoutType || null : null,
      workoutMinutes: draft.didWorkout ? parseOptionalNumber(draft.workoutMinutes) : null,
      stepsOver8000: draft.stepsOver8000,
      readBook: draft.readBook,
      skincare: draft.skincare,
      meditation: draft.meditation,
      creatine: draft.creatine,
      supplements: draft.supplements,
      avoidedReels: draft.avoidedReels,
      kcalTotal: parseOptionalNumber(draft.kcalTotal),
      proteinG: parseOptionalNumber(draft.proteinG),
      carbsG: parseOptionalNumber(draft.carbsG),
      sugarsG: parseOptionalNumber(draft.sugarsG),
      fatsG: parseOptionalNumber(draft.fatsG),
      notes: draft.notes,
    };
  }

  function scheduleAutoSave(date: string, draft: TrackerDayDraft) {
    const existingTimeout = saveTimeoutByDateRef.current[date];

    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    saveTimeoutByDateRef.current[date] = window.setTimeout(() => {
      onSaveEntry(toInput(date, draft));
      delete saveTimeoutByDateRef.current[date];
    }, 320);
  }

  function updateDayDraft(date: string, patch: Partial<TrackerDayDraft>) {
    setDraftsByDate((current) => {
      const nextDraft = {
        ...(current[date] ?? toDraft()),
        ...patch,
      };
      scheduleAutoSave(date, nextDraft);

      return {
        ...current,
        [date]: nextDraft,
      };
    });
  }

  function updateHabitValue(date: string, habitKey: TrackerHabitKey, checked: boolean) {
    switch (habitKey) {
      case "readBook":
        updateDayDraft(date, { readBook: checked });
        break;
      case "skincare":
        updateDayDraft(date, { skincare: checked });
        break;
      case "meditation":
        updateDayDraft(date, { meditation: checked });
        break;
      case "creatine":
        updateDayDraft(date, { creatine: checked });
        break;
      case "supplements":
        updateDayDraft(date, { supplements: checked });
        break;
      case "avoidedReels":
        updateDayDraft(date, { avoidedReels: checked });
        break;
      default:
        break;
    }
  }

  const weightChartWidth = 680;
  const weightChartHeight = 220;
  const weightChartPaddingX = 34;
  const weightChartPaddingY = 18;
  const weightValues = dashboard.weightSeries.map((item) => item.value);
  const rawMinWeight = weightValues.length ? Math.min(...weightValues) : 0;
  const rawMaxWeight = weightValues.length ? Math.max(...weightValues) : 1;
  const weightAxisPadding = rawMaxWeight - rawMinWeight < 0.2 ? 0.15 : 0;
  const minWeight = rawMinWeight - weightAxisPadding;
  const maxWeight = rawMaxWeight + weightAxisPadding;
  const weightRange = Math.max(0.1, maxWeight - minWeight);
  const weightPoints = dashboard.weightSeries.map((item) => {
    const x =
      weightChartPaddingX +
      (item.index / Math.max(1, dashboard.chartSpan - 1)) *
        (weightChartWidth - weightChartPaddingX * 2);
    const y =
      weightChartHeight -
      weightChartPaddingY -
      ((item.value - minWeight) / weightRange) *
        (weightChartHeight - weightChartPaddingY * 2);

    return { ...item, x, y };
  });
  const weightLinePath = weightPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const weightAreaPath =
    weightPoints.length > 1
      ? `${weightLinePath} L ${weightPoints[weightPoints.length - 1]?.x ?? 0} ${weightChartHeight - weightChartPaddingY} L ${weightPoints[0]?.x ?? 0} ${weightChartHeight - weightChartPaddingY} Z`
      : "";
  const todayPeriodIndex = month === 0
    ? todayDate.getMonth()
    : dashboard.periodDays.findIndex((day) => day.key === todayKey);
  const clampedTodayIndex = Math.min(
    Math.max(0, todayPeriodIndex),
    Math.max(0, dashboard.chartSpan - 1),
  );
  const todayX =
    weightChartPaddingX +
    (clampedTodayIndex / Math.max(1, dashboard.chartSpan - 1)) *
      (weightChartWidth - weightChartPaddingX * 2);
  const xAxisTicks = month === 0
    ? MONTH_LABELS.map((label, index) => ({
        index,
        x:
          weightChartPaddingX +
          (index / Math.max(1, dashboard.chartSpan - 1)) *
            (weightChartWidth - weightChartPaddingX * 2),
        label: label.slice(0, 3),
      }))
    : (() => {
        const xTickCount = Math.min(6, Math.max(2, dashboard.chartSpan));
        const xTickIndices = Array.from(
          new Set(
            Array.from({ length: xTickCount }, (_, index) =>
              Math.round(
                (index / Math.max(1, xTickCount - 1)) *
                  Math.max(0, dashboard.chartSpan - 1),
              ),
            ),
          ),
        );

        return xTickIndices.map((index) => {
          const day = dashboard.periodDays[index];
          const x =
            weightChartPaddingX +
            (index / Math.max(1, dashboard.chartSpan - 1)) *
              (weightChartWidth - weightChartPaddingX * 2);

          return {
            index,
            x,
            label: `${day?.date.getDate() ?? ""}`,
          };
        });
      })();
  const yTickCount = 5;
  const yAxisTicks = Array.from({ length: yTickCount }, (_, index) => {
    const ratio = index / Math.max(1, yTickCount - 1);
    const value = maxWeight - ratio * weightRange;
    const y = weightChartPaddingY + ratio * (weightChartHeight - weightChartPaddingY * 2);

    return {
      value,
      y,
      label: value.toFixed(1),
    };
  });
  const isCurrentViewedPeriod =
    month === 0
      ? year === todayDate.getFullYear()
      : year === todayDate.getFullYear() && month === todayDate.getMonth() + 1;
  const periodTitle = month === 0 ? `Anno ${year}` : `${MONTH_LABELS[month - 1]} ${year}`;
  const nutritionMetrics = [
    { label: "Proteine", value: dashboard.avgProtein ?? 0, unit: "g", color: "#56b8ff" },
    { label: "Carbo", value: dashboard.avgCarbs ?? 0, unit: "g", color: "#7b7dff" },
    { label: "Zuccheri", value: dashboard.avgSugars ?? 0, unit: "g", color: "#f3b44a" },
    { label: "Grassi", value: dashboard.avgFats ?? 0, unit: "g", color: "#f072a8" },
  ];
  const maxNutritionMetric = Math.max(
    1,
    ...nutritionMetrics.map((metric) => metric.value),
  );
  const workoutBarMaxHeight = 108;

  function getWorkoutBarHeight(value: number) {
    if (value <= 0 || dashboard.maxWorkoutValue <= 0) {
      return 2;
    }

    return Math.max(4, (value / dashboard.maxWorkoutValue) * workoutBarMaxHeight);
  }

  return (
    <section className="tracker-shell">
      <header className="tracker-shell__header">
        <div>
          <p className="eyebrow">Tracker</p>
          <h2>{periodTitle}</h2>
          <p>Monitoraggio giornaliero di sport, abitudini e alimentazione.</p>
        </div>
        <div className="tracker-mode-switch" role="tablist" aria-label="Modalita tracker">
          <button
            type="button"
            className={trackerMode === "entry" ? "is-active" : ""}
            onClick={() => setTrackerMode("entry")}
          >
            Inserisci dati
          </button>
          <button
            type="button"
            className={trackerMode === "dashboard" ? "is-active" : ""}
            onClick={() => setTrackerMode("dashboard")}
          >
            Dashboard
          </button>
        </div>
      </header>

      <section className="tracker-picker">
        <div className="tracker-picker__years" role="tablist" aria-label="Anni tracker">
          {years.map((yearOption) => (
            <button
              key={yearOption}
              type="button"
              className={yearOption === year ? "is-active" : ""}
              onClick={() => onChangeYear(yearOption)}
            >
              {yearOption}
            </button>
          ))}
          <button
            type="button"
            className="tracker-picker__year-add"
            onClick={onAddYear}
            aria-label="Aggiungi anno successivo"
          >
            +
          </button>
        </div>

        <div className="tracker-picker__months" role="tablist" aria-label="Mesi tracker">
          {MONTH_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              className={month === index + 1 ? "is-active" : ""}
              onClick={() => onChangeMonth(index + 1)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={month === 0 ? "is-active" : ""}
            onClick={() => onChangeMonth(0)}
          >
            Tutti
          </button>
        </div>
      </section>

      {trackerMode === "entry" ? (
      month === 0 ? (
      <section className="tracker-entry-unavailable">
        <h3>Vista annuale disponibile in Dashboard</h3>
        <p>
          Per vedere le statistiche dell&apos;intero anno selezionato, usa la modalità
          Dashboard. Per inserire dati giornalieri seleziona un singolo mese.
        </p>
        <button
          type="button"
          className="tracker-entry-unavailable__action"
          onClick={() => setTrackerMode("dashboard")}
        >
          Vai a Dashboard
        </button>
      </section>
      ) : (
      <div className="tracker-days">
        {entryDays.map((day) => {
          const draft = draftsByDate[day.key] ?? toDraft();
          const isToday = day.key === todayKey;
          const isPast = day.date.getTime() < todayTimestamp;
          const workoutTypeOptions =
            draft.workoutType && !workoutActivities.includes(draft.workoutType)
              ? [draft.workoutType, ...workoutActivities]
              : workoutActivities;

          return (
            <article
              key={day.key}
              className={`tracker-day-card ${isToday ? "is-today" : ""} ${isPast ? "is-past" : ""}`}
            >
              <header className="tracker-day-card__header">
                <h3>{toDayLabel(day.date)}</h3>
                {isToday ? (
                  <span>
                    <strong className="tracker-day-card__today-pill">Oggi</strong>
                  </span>
                ) : null}
              </header>

              <div className="tracker-day-card__grid">
                {sectionVisibility.weight ? (
                  <label>
                    <span>PESO (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={draft.weightKg}
                      onChange={(event) => {
                        updateDayDraft(day.key, { weightKg: event.currentTarget.value });
                      }}
                    />
                  </label>
                ) : null}

                {sectionVisibility.sport ? (
                  <section className="tracker-group tracker-group--sport">
                    <h4>Sport</h4>
                    <div className="tracker-fields tracker-fields--sport-line">
                      <label className="tracker-check">
                        <input
                          type="checkbox"
                          checked={draft.didWorkout}
                          onChange={(event) =>
                            updateDayDraft(day.key, { didWorkout: event.currentTarget.checked })
                          }
                        />
                        <span>Allenamento</span>
                      </label>
                      <label className="tracker-inline-field tracker-inline-field--activity">
                        <span>Attivita</span>
                        <select
                          value={draft.workoutType}
                          onChange={(event) =>
                            updateDayDraft(day.key, { workoutType: event.currentTarget.value })
                          }
                          disabled={!draft.didWorkout}
                        >
                          <option value="">Seleziona attivita</option>
                          {workoutTypeOptions.map((workoutType) => (
                            <option key={workoutType} value={workoutType}>
                              {workoutType}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tracker-inline-field tracker-inline-field--minutes">
                        <span>Min</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={draft.workoutMinutes}
                          onChange={(event) =>
                            updateDayDraft(day.key, { workoutMinutes: event.currentTarget.value })
                          }
                          disabled={!draft.didWorkout}
                        />
                      </label>
                      <label className="tracker-check">
                        <input
                          type="checkbox"
                          checked={draft.stepsOver8000}
                          onChange={(event) =>
                            updateDayDraft(day.key, { stepsOver8000: event.currentTarget.checked })
                          }
                        />
                        <span>8000+ passi</span>
                      </label>
                    </div>
                  </section>
                ) : null}

                {sectionVisibility.habits ? (
                  <section className="tracker-group">
                    <h4>Abitudini</h4>
                    <div className="tracker-fields tracker-fields--checks">
                      {visibleHabits.map((habit) => {
                        const checked = getHabitValue(draft, habit.key);

                        return (
                          <label
                            key={habit.key}
                            className={`tracker-check tracker-check--habit ${checked ? "is-checked" : ""}`}
                            style={{
                              ["--habit-rgb" as string]: toRgbHexTriplet(habit.color),
                              ["--habit-solid" as string]: habit.color,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                updateHabitValue(day.key, habit.key, event.currentTarget.checked)
                              }
                            />
                            <span>{habit.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {sectionVisibility.nutrition ? (
                  <section className="tracker-group">
                    <h4>Alimentazione</h4>
                    <div className="tracker-fields tracker-fields--nutrition">
                      <label>
                        <span>Kcal totali</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={draft.kcalTotal}
                          onChange={(event) =>
                            updateDayDraft(day.key, { kcalTotal: event.currentTarget.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Proteine</span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          inputMode="decimal"
                          value={draft.proteinG}
                          onChange={(event) =>
                            updateDayDraft(day.key, { proteinG: event.currentTarget.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Carbo</span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          inputMode="decimal"
                          value={draft.carbsG}
                          onChange={(event) =>
                            updateDayDraft(day.key, { carbsG: event.currentTarget.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Zuccheri</span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          inputMode="decimal"
                          value={draft.sugarsG}
                          onChange={(event) =>
                            updateDayDraft(day.key, { sugarsG: event.currentTarget.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Grassi</span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          inputMode="decimal"
                          value={draft.fatsG}
                          onChange={(event) =>
                            updateDayDraft(day.key, { fatsG: event.currentTarget.value })
                          }
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {sectionVisibility.notes ? (
                  <label className="tracker-notes">
                    <span>Note della giornata</span>
                    <textarea
                      value={draft.notes}
                      onChange={(event) =>
                        updateDayDraft(day.key, { notes: event.currentTarget.value })
                      }
                      rows={2}
                      placeholder="Osservazioni, energia, umore, sonno..."
                    />
                  </label>
                ) : null}
              </div>

            </article>
          );
        })}
      </div>
      )
      ) : (
        <section className="tracker-dashboard">
          <div className="tracker-dashboard__summary">
            <article className="tracker-kpi">
              <span>Giorni compilati</span>
              <strong>{dashboard.trackedDays}/{dashboard.totalDays}</strong>
              <small>{Math.round((dashboard.trackedDays / Math.max(1, dashboard.totalDays)) * 100)}% periodo</small>
            </article>
            <article className="tracker-kpi">
              <span>Workout</span>
              <strong>{dashboard.totalWorkoutMinutes} min</strong>
              <small>{dashboard.workoutActiveCount} {dashboard.workoutActiveLabel}</small>
            </article>
            <article className="tracker-kpi">
              <span>Adesione abitudini</span>
              <strong>{Math.round(dashboard.habitCompletionRate * 100)}%</strong>
              <small>{dashboard.bestHabit ? `Top: ${dashboard.bestHabit.label}` : "Nessuna abitudine"}</small>
            </article>
            <article className="tracker-kpi">
              <span>Passi 8000+</span>
              <strong>{dashboard.stepsDays}</strong>
              <small>giorni sopra soglia</small>
            </article>
            <article className="tracker-kpi">
              <span>Peso medio</span>
              <strong>{formatMetric(weightValues.length ? weightValues.reduce((sum, value) => sum + value, 0) / weightValues.length : null)} kg</strong>
              <small>
                {dashboard.weightDelta === null
                  ? "Trend non disponibile"
                  : `${dashboard.weightDelta >= 0 ? "+" : ""}${dashboard.weightDelta.toFixed(1)} kg`}
              </small>
            </article>
            <article className="tracker-kpi">
              <span>Note giornaliere</span>
              <strong>{dashboard.notesDays}</strong>
              <small>giorni con note</small>
            </article>
          </div>

          <div className="tracker-dashboard__grid">
            <article className="tracker-panel tracker-panel--weight">
              <header>
                <h3>Trend peso</h3>
                <span>{weightValues.length} rilevazioni</span>
              </header>
              {weightPoints.length >= 2 ? (
                <svg
                  className="tracker-chart tracker-chart--weight"
                  viewBox={`0 0 ${weightChartWidth} ${weightChartHeight}`}
                  role="img"
                  aria-label="Grafico andamento peso"
                >
                  {yAxisTicks.map((tick, index) => (
                    <g key={`y-${index}`}>
                      <line
                        x1={weightChartPaddingX}
                        y1={tick.y}
                        x2={weightChartWidth - weightChartPaddingX}
                        y2={tick.y}
                        className="tracker-chart__grid-line"
                      />
                      <text
                        x={weightChartPaddingX - 6}
                        y={tick.y}
                        dy="0.32em"
                        textAnchor="end"
                        className="tracker-chart__axis-label tracker-chart__axis-label--y"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}
                  <line
                    x1={weightChartPaddingX}
                    y1={weightChartHeight - weightChartPaddingY}
                    x2={weightChartWidth - weightChartPaddingX}
                    y2={weightChartHeight - weightChartPaddingY}
                    className="tracker-chart__axis"
                  />
                  {isCurrentViewedPeriod && todayPeriodIndex >= 0 ? (
                    <line
                      x1={todayX}
                      y1={weightChartPaddingY}
                      x2={todayX}
                      y2={weightChartHeight - weightChartPaddingY}
                      className="tracker-chart__today-line"
                    />
                  ) : null}
                  {weightAreaPath ? <path d={weightAreaPath} className="tracker-chart__area" /> : null}
                  <path d={weightLinePath} className="tracker-chart__line" />
                  {weightPoints.map((point) => (
                    <circle
                      key={point.key}
                      cx={point.x}
                      cy={point.y}
                      r="3.2"
                      className="tracker-chart__dot"
                    />
                  ))}
                  {xAxisTicks.map((tick) => (
                    <g key={`x-${tick.index}`}>
                      <line
                        x1={tick.x}
                        y1={weightChartHeight - weightChartPaddingY}
                        x2={tick.x}
                        y2={weightChartHeight - weightChartPaddingY + 4}
                        className="tracker-chart__tick"
                      />
                      <text
                        x={tick.x}
                        y={weightChartHeight - 2}
                        textAnchor="middle"
                        className="tracker-chart__axis-label"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                <p className="tracker-panel__empty">Inserisci almeno 2 pesi nel periodo per vedere il trend.</p>
              )}
            </article>

            <article className="tracker-panel tracker-panel--workout">
              <header>
                <h3>Workout giornalieri</h3>
                <span>Media: {formatMetric(dashboard.avgWorkoutMinutes, 0)} min</span>
              </header>
              <div className="tracker-bars">
                {dashboard.workoutSeries.map((item) => (
                  <div key={item.key} className="tracker-bars__item">
                    <div className="tracker-bars__value">{item.value || ""}</div>
                    <div
                      className="tracker-bars__bar"
                      title={`${item.value} min`}
                      style={{
                        height: `${getWorkoutBarHeight(item.value)}px`,
                      }}
                    />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="tracker-panel tracker-panel--habits">
              <header>
                <h3>Completamento abitudini</h3>
                <span>Su {dashboard.totalDays} giorni</span>
              </header>
              <div className="tracker-habit-progress">
                {dashboard.habitStats.map((habit) => (
                  <div key={habit.key} className="tracker-habit-progress__item">
                    <div className="tracker-habit-progress__row">
                      <strong>{habit.label}</strong>
                      <span>{habit.completed}/{dashboard.totalDays}</span>
                    </div>
                    <div className="tracker-habit-progress__bar-track">
                      <div
                        className="tracker-habit-progress__bar-fill"
                        style={{
                          width: `${habit.rate * 100}%`,
                          background: `linear-gradient(90deg, ${habit.color}, rgba(255,255,255,0.2))`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="tracker-panel tracker-panel--nutrition">
              <header>
                <h3>Medie alimentazione</h3>
                <span>Valori medi del periodo</span>
              </header>
              <div className="tracker-nutrition__kcal">
                <span>Kcal medie</span>
                <strong>{formatMetric(dashboard.avgKcal, 0)} kcal</strong>
              </div>
              <div className="tracker-nutrition">
                {nutritionMetrics.map((metric) => (
                  <div key={metric.label} className="tracker-nutrition__item">
                    <div className="tracker-nutrition__row">
                      <strong>{metric.label}</strong>
                      <span>{formatMetric(metric.value, 0)} {metric.unit}</span>
                    </div>
                    <div className="tracker-nutrition__bar-track">
                      <div
                        className="tracker-nutrition__bar-fill"
                        style={{
                          width: `${(metric.value / maxNutritionMetric) * 100}%`,
                          background: metric.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="tracker-panel tracker-panel--recent">
            <header>
              <h3>Ultimi giorni compilati</h3>
              <span>Più recenti</span>
            </header>
            {dashboard.recentTrackedDays.length ? (
              <div className="tracker-recent">
                {dashboard.recentTrackedDays.map((item) => (
                  <div key={item.day.key} className="tracker-recent__item">
                    <strong>{toDayLabel(item.day.date)}</strong>
                    <div>
                      <span>{item.entry?.didWorkout ? "Workout" : "No workout"}</span>
                      <span>{item.entry?.kcalTotal ?? "n/d"} kcal</span>
                      <span>{item.entry?.notes.trim() ? "Con note" : "Senza note"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tracker-panel__empty">Nessun dato salvato per questo periodo.</p>
            )}
          </article>
        </section>
      )}
    </section>
  );
}
