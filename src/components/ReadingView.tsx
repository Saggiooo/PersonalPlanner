import { type FormEvent, useMemo, useState } from "react";
import type {
  ReadingCategory,
  ReadingItem,
  ReadingRating,
  ReadingStatus,
  UpsertReadingInput,
} from "../lib/types";

const STATUS_OPTIONS: Array<{ value: ReadingStatus; label: string }> = [
  { value: "letto", label: "Letto" },
  { value: "letto-parzialmente", label: "Letto parzialmente" },
  { value: "da-leggere", label: "Da leggere" },
  { value: "in-lettura", label: "In lettura" },
  { value: "da-comprare", label: "Da comprare" },
];

const RATING_OPTIONS: Array<{ value: ReadingRating; label: string }> = [
  { value: "pessimo", label: "Pessimo" },
  { value: "discreto", label: "Discreto" },
  { value: "buono", label: "Buono" },
  { value: "molto-bello", label: "Molto bello" },
];

const CATEGORY_OPTIONS: Array<{ value: ReadingCategory; label: string }> = [
  { value: "crescita-personale", label: "Crescita personale" },
  { value: "narrazione-romanzo", label: "Narrazione / Romanzo" },
  { value: "cultura-generale", label: "Cultura generale" },
  { value: "psicologia", label: "Psicologia" },
  { value: "altro", label: "Altro" },
];

const EMPTY_FORM = {
  id: "",
  status: "da-leggere" as ReadingStatus,
  title: "",
  readingYear: "",
  rating: "",
  category: "crescita-personale" as ReadingCategory,
  summary: "",
};

interface ReadingViewProps {
  items: ReadingItem[];
  onSave: (input: UpsertReadingInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function optionLabel<T extends string>(options: Array<{ value: T; label: string }>, value: T | null) {
  return options.find((option) => option.value === value)?.label ?? "Non definito";
}

export function ReadingView({ items, onSave, onDelete }: ReadingViewProps) {
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | "all">("all");
  const [yearOrder, setYearOrder] = useState<"none" | "asc" | "desc">("none");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [titleOrder, setTitleOrder] = useState<"default" | "az" | "za">("default");

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.readingYear)
            .filter((year): year is number => typeof year === "number"),
        ),
      ).sort((left, right) => right - left),
    [items],
  );

  const sortedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (yearFilter !== "all" && item.readingYear !== yearFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((left, right) => {
      if (yearOrder !== "none") {
        const leftYear = left.readingYear ?? -1;
        const rightYear = right.readingYear ?? -1;

        if (leftYear !== rightYear) {
          return yearOrder === "asc" ? leftYear - rightYear : rightYear - leftYear;
        }
      }

      if (titleOrder === "az") {
        return left.title.localeCompare(right.title);
      }

      if (titleOrder === "za") {
        return right.title.localeCompare(left.title);
      }

      if (left.updatedAt !== right.updatedAt) {
        return right.updatedAt.localeCompare(left.updatedAt);
      }

      return left.title.localeCompare(right.title);
    });
  }, [items, statusFilter, yearOrder, yearFilter, titleOrder]);

  const readCount = items.filter((item) => item.status === "letto").length;
  const inProgressCount = items.filter((item) => item.status === "in-lettura").length;
  const toBuyCount = items.filter((item) => item.status === "da-comprare").length;

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setIsBookModalOpen(true);
  }

  function openEditModal(item: ReadingItem) {
    setForm({
      id: item.id,
      status: item.status,
      title: item.title,
      readingYear: item.readingYear ? String(item.readingYear) : "",
      rating: item.rating ?? "",
      category: item.category,
      summary: item.summary,
    });
    setIsBookModalOpen(true);
  }

  function openSummaryModal(item: ReadingItem) {
    setForm({
      id: item.id,
      status: item.status,
      title: item.title,
      readingYear: item.readingYear ? String(item.readingYear) : "",
      rating: item.rating ?? "",
      category: item.category,
      summary: item.summary,
    });
    setIsSummaryModalOpen(true);
  }

  function closeAllModals() {
    setIsBookModalOpen(false);
    setIsSummaryModalOpen(false);
    setForm(EMPTY_FORM);
  }

  function buildInput() {
    return {
      id: form.id || undefined,
      status: form.status,
      title: form.title.trim(),
      readingYear: form.readingYear.trim() ? Number(form.readingYear) : null,
      rating: form.rating ? (form.rating as ReadingRating) : null,
      category: form.category,
      summary: form.summary,
    } satisfies UpsertReadingInput;
  }

  function handleSaveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    void onSave(buildInput()).then(() => {
      setIsBookModalOpen(false);
    });
  }

  function handleSaveSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.id || !form.title.trim()) {
      return;
    }

    void onSave(buildInput()).then(() => {
      setIsSummaryModalOpen(false);
    });
  }

  function handleDeleteCurrent() {
    if (!form.id) {
      return;
    }

    void onDelete(form.id).then(() => {
      closeAllModals();
    });
  }

  return (
    <section className="reading-shell">
      <header className="reading-shell__header">
        <div>
          <p className="eyebrow">Lettura</p>
          <h2>Libreria personale</h2>
          <p>Monitora stato, valutazione e riassunto dei libri letti o da leggere.</p>
        </div>
        <button type="button" className="reading-shell__action" onClick={openCreateModal}>
          + Nuovo libro
        </button>
      </header>

      <section className="reading-dashboard">
        <article className="reading-kpi">
          <span>Libri totali</span>
          <strong>{items.length}</strong>
        </article>
        <article className="reading-kpi">
          <span>Letti</span>
          <strong>{readCount}</strong>
        </article>
        <article className="reading-kpi">
          <span>In lettura</span>
          <strong>{inProgressCount}</strong>
        </article>
        <article className="reading-kpi">
          <span>Da comprare</span>
          <strong>{toBuyCount}</strong>
        </article>
      </section>

      <section className="reading-list-panel">
        <div className="reading-filters">
          <label>
            <span>Mostra solo...</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.currentTarget.value as ReadingStatus | "all")}
            >
              <option value="all">Tutti gli stati</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Ordina per anno</span>
            <select
              value={yearOrder}
              onChange={(event) =>
                setYearOrder(event.currentTarget.value as "none" | "asc" | "desc")
              }
            >
              <option value="none">Nessun ordine</option>
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </label>

          <label>
            <span>Mostra solo anno</span>
            <select
              value={yearFilter === "all" ? "all" : String(yearFilter)}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setYearFilter(value === "all" ? "all" : Number(value));
              }}
            >
              <option value="all">Tutti gli anni</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Ordine alfabetico</span>
            <select
              value={titleOrder}
              onChange={(event) =>
                setTitleOrder(event.currentTarget.value as "default" | "az" | "za")
              }
            >
              <option value="default">Predefinito</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
          </label>
        </div>

        {sortedItems.length ? (
          <div className="reading-list">
            {sortedItems.map((item) => (
              <article key={item.id} className="reading-row" onClick={() => openEditModal(item)}>
                <div className="reading-row__main">
                  <div className={`reading-status reading-status--${item.status}`}>
                    {optionLabel(STATUS_OPTIONS, item.status)}
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {optionLabel(CATEGORY_OPTIONS, item.category)} · {item.readingYear ?? "Anno non indicato"}
                    </small>
                  </div>
                </div>

                <div className="reading-row__meta">
                  <span className={item.rating ? "" : "reading-row__meta-empty"}>
                    {item.rating ? optionLabel(RATING_OPTIONS, item.rating) : "Senza voto"}
                  </span>
                  <small>{item.summary.trim() ? "Riassunto presente" : "Nessun riassunto"}</small>
                </div>

                <button
                  type="button"
                  className={`reading-row__summary ${item.summary.trim() ? "is-filled" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openSummaryModal(item);
                  }}
                >
                  Riassunto
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="reading-empty-state">
            <h3>Nessun libro salvato</h3>
            <p>Inizia aggiungendo il primo libro che vuoi tenere in libreria.</p>
          </div>
        )}
      </section>

      {isBookModalOpen ? (
        <div className="modal-backdrop" onClick={closeAllModals}>
          <div
            className="modal-card modal-card--reading"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reading-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Lettura</p>
                <h3 id="reading-modal-title">{form.id ? "Modifica libro" : "Nuovo libro"}</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeAllModals}>
                x
              </button>
            </div>

            <form className="stack-form reading-form" onSubmit={handleSaveBook}>
              <div className="reading-form__grid">
                <label>
                  <span>Stato</span>
                  <select
                    value={form.status}
                    onChange={(event) => {
                      const value = event.currentTarget.value as ReadingStatus;

                      setForm((current) => ({
                        ...current,
                        status: value,
                      }));
                    }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Titolo</span>
                  <input
                    value={form.title}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({ ...current, title: value }));
                    }}
                    placeholder="Titolo libro"
                  />
                </label>

                <label>
                  <span>Anno lettura</span>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    inputMode="numeric"
                    value={form.readingYear}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({
                        ...current,
                        readingYear: value,
                      }));
                    }}
                    placeholder="2026"
                  />
                </label>

                <label>
                  <span>Valutazione</span>
                  <select
                    value={form.rating}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({
                        ...current,
                        rating: value,
                      }));
                    }}
                  >
                    <option value="">Non definita</option>
                    {RATING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="reading-form__full">
                  <span>Categoria libro</span>
                  <select
                    value={form.category}
                    onChange={(event) => {
                      const value = event.currentTarget.value as ReadingCategory;

                      setForm((current) => ({
                        ...current,
                        category: value,
                      }));
                    }}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                {form.id ? (
                  <button
                    type="button"
                    className="modal-button modal-button--danger"
                    onClick={handleDeleteCurrent}
                  >
                    Elimina
                  </button>
                ) : null}
                <button type="button" className="modal-button modal-button--ghost" onClick={closeAllModals}>
                  Annulla
                </button>
                <button type="submit" className="modal-button">
                  {form.id ? "Salva modifiche" : "Crea libro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isSummaryModalOpen ? (
        <div className="modal-backdrop" onClick={closeAllModals}>
          <div
            className="modal-card modal-card--reading-summary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reading-summary-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Riassunto</p>
                <h3 id="reading-summary-title">{form.title || "Libro"}</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeAllModals}>
                x
              </button>
            </div>

            <form className="stack-form" onSubmit={handleSaveSummary}>
              <label>
                <span>Riassunto testuale</span>
                <textarea
                  rows={12}
                  value={form.summary}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setForm((current) => ({ ...current, summary: value }));
                  }}
                  placeholder="Scrivi qui un riassunto del libro..."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--ghost" onClick={closeAllModals}>
                  Annulla
                </button>
                <button type="submit" className="modal-button">
                  Salva riassunto
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
