import { type FormEvent, useMemo, useState } from "react";
import type {
  SubscriptionCategory,
  SubscriptionFrequency,
  SubscriptionItem,
  SubscriptionSharing,
  SubscriptionStatus,
  UpsertSubscriptionInput,
} from "../lib/types";

const STATUS_OPTIONS: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: "attivo", label: "Attivo" },
  { value: "da-disattivare", label: "Da disattivare" },
  { value: "disattivato", label: "Disattivato" },
  { value: "non-so", label: "Non so" },
];

const FREQUENCY_OPTIONS: Array<{ value: SubscriptionFrequency; label: string }> = [
  { value: "giornaliera", label: "Giornaliera" },
  { value: "mensile", label: "Mensile" },
  { value: "annuale", label: "Annuale" },
];

const CATEGORY_OPTIONS: Array<{ value: SubscriptionCategory; label: string }> = [
  { value: "personale", label: "Personale" },
  { value: "lavoro", label: "Lavoro" },
];

const SHARING_OPTIONS: Array<{ value: SubscriptionSharing; label: string }> = [
  { value: "individuale", label: "Individuale" },
  { value: "condiviso", label: "Condiviso" },
];

const EMPTY_FORM = {
  id: "",
  status: "attivo" as SubscriptionStatus,
  name: "",
  totalPrice: "",
  mySharePrice: "",
  frequency: "mensile" as SubscriptionFrequency,
  platform: "",
  billingSource: "",
  renewalDate: new Date().toISOString().slice(0, 10),
  category: "personale" as SubscriptionCategory,
  sharing: "individuale" as SubscriptionSharing,
  sharedPeople: [] as string[],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) {
    return "Da definire";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addFrequency(date: Date, frequency: SubscriptionFrequency) {
  const nextDate = new Date(date);

  if (frequency === "giornaliera") {
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }

  if (frequency === "mensile") {
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }

  nextDate.setFullYear(nextDate.getFullYear() + 1);
  return nextDate;
}

function rollRenewalDate(value: string, frequency: SubscriptionFrequency) {
  const baseDate = parseDateOnly(value);

  if (!baseDate) {
    return new Date().toISOString().slice(0, 10);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextRenewal = new Date(baseDate);
  let safety = 0;

  while (nextRenewal < today && safety < 500) {
    const advanced = addFrequency(nextRenewal, frequency);
    nextRenewal.setTime(advanced.getTime());
    safety += 1;
  }

  return formatDateOnly(nextRenewal);
}

function toAnnualCost(value: number, frequency: SubscriptionFrequency, status: SubscriptionStatus) {
  if (status === "disattivato") {
    return 0;
  }

  if (frequency === "giornaliera") {
    return value * 365;
  }

  if (frequency === "mensile") {
    return value * 12;
  }

  return value;
}

function buildPieSegments(total: number, personal: number, work: number) {
  if (!total) {
    return [];
  }

  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const slices = [
    { key: "personale", value: personal, color: "#5f72ff" },
    { key: "lavoro", value: work, color: "#f08f54" },
  ].filter((slice) => slice.value > 0);

  let offset = 0;
  return slices.map((slice) => {
    const dash = (slice.value / total) * circumference;
    const segment = {
      ...slice,
      dasharray: `${dash} ${circumference - dash}`,
      dashoffset: -offset,
    };
    offset += dash;
    return segment;
  });
}

interface SubscriptionsViewProps {
  items: SubscriptionItem[];
  onSave: (input: UpsertSubscriptionInput) => Promise<string | void>;
  onDelete: (id: string) => Promise<void>;
}

export function SubscriptionsView({ items, onSave, onDelete }: SubscriptionsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPeopleModalOpen, setIsPeopleModalOpen] = useState(false);
  const [personDraft, setPersonDraft] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const activeItems = useMemo(
    () => items.filter((item) => item.status !== "disattivato"),
    [items],
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.status !== right.status) {
          return left.status.localeCompare(right.status);
        }

        return left.name.localeCompare(right.name);
      }),
    [items],
  );

  const annualTotal = useMemo(
    () =>
      activeItems.reduce(
        (total, item) => total + toAnnualCost(item.mySharePrice, item.frequency, item.status),
        0,
      ),
    [activeItems],
  );

  const annualGrossTotal = useMemo(
    () =>
      activeItems.reduce(
        (total, item) => total + toAnnualCost(item.totalPrice, item.frequency, item.status),
        0,
      ),
    [activeItems],
  );

  const monthlyAverage = annualTotal / 12;

  const categoryTotals = useMemo(() => {
    const totals = {
      personale: 0,
      lavoro: 0,
    };

    for (const item of activeItems) {
      totals[item.category] += toAnnualCost(item.mySharePrice, item.frequency, item.status);
    }

    return totals;
  }, [activeItems]);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const paymentsThisMonth = useMemo(
    () =>
      [...activeItems]
        .filter((item) => {
          if (!item.renewalDate) {
            return false;
          }

          const renewal = new Date(`${item.renewalDate}T00:00:00`);
          return renewal.getMonth() === currentMonth && renewal.getFullYear() === currentYear;
        })
        .sort((left, right) => left.renewalDate.localeCompare(right.renewalDate)),
    [activeItems, currentMonth, currentYear],
  );

  const pieSegments = buildPieSegments(
    annualTotal,
    categoryTotals.personale,
    categoryTotals.lavoro,
  );

  function openCreateModal() {
    setForm({
      ...EMPTY_FORM,
      renewalDate: new Date().toISOString().slice(0, 10),
    });
    setPersonDraft("");
    setIsModalOpen(true);
  }

  function openEditModal(item: SubscriptionItem) {
    setForm({
      id: item.id,
      status: item.status,
      name: item.name,
      totalPrice: String(item.totalPrice),
      mySharePrice: String(item.mySharePrice),
      frequency: item.frequency,
      platform: item.platform,
      billingSource: item.billingSource,
      renewalDate: item.renewalDate,
      category: item.category,
      sharing: item.sharing,
      sharedPeople: item.sharedPeople,
    });
    setPersonDraft("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setIsPeopleModalOpen(false);
    setPersonDraft("");
    setForm(EMPTY_FORM);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const totalPrice = Number.parseFloat(form.totalPrice);
    const parsedMySharePrice = Number.parseFloat(form.mySharePrice);
    const mySharePrice =
      Number.isFinite(parsedMySharePrice) && parsedMySharePrice >= 0
        ? parsedMySharePrice
        : totalPrice;

    if (
      !form.name.trim() ||
      !Number.isFinite(totalPrice)
    ) {
      return;
    }

    const nextItem: UpsertSubscriptionInput = {
      id: form.id || crypto.randomUUID(),
      status: form.status,
      name: form.name.trim(),
      totalPrice,
      mySharePrice,
      frequency: form.frequency,
      platform: form.platform.trim(),
      billingSource: form.billingSource.trim(),
      renewalDate: rollRenewalDate(form.renewalDate, form.frequency),
      category: form.category,
      sharing: form.sharing,
      sharedPeople: form.sharing === "condiviso" ? form.sharedPeople : [],
    };

    void onSave(nextItem)
      .then(() => {
        closeModal();
      })
      .catch((error) => {
        console.error(error);
      });
  }

  function handleDelete(id: string) {
    void onDelete(id)
      .then(() => {
        if (form.id === id) {
          closeModal();
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  function addSharedPerson() {
    const nextPerson = personDraft.trim();

    if (!nextPerson) {
      return;
    }

    setForm((current) => ({
      ...current,
      sharedPeople: current.sharedPeople.includes(nextPerson)
        ? current.sharedPeople
        : [...current.sharedPeople, nextPerson],
    }));
    setPersonDraft("");
  }

  function removeSharedPerson(name: string) {
    setForm((current) => ({
      ...current,
      sharedPeople: current.sharedPeople.filter((person) => person !== name),
    }));
  }

  return (
    <section className="subscriptions-shell">
      <header className="subscriptions-shell__header">
        <div>
          <p className="eyebrow">Abbonamenti</p>
          <h2>I tuoi Abbonamenti</h2>
          <p>Monitora costi ricorrenti, rinnovi e peso reale tra personale e lavoro.</p>
        </div>
        <button type="button" className="subscriptions-shell__action" onClick={openCreateModal}>
          + Nuovo abbonamento
        </button>
      </header>

      <section className="subscriptions-dashboard">
        <article className="subscriptions-kpi subscriptions-kpi--primary">
          <span>Costo annuo a mio carico</span>
          <strong>{formatCurrency(annualTotal)}</strong>
          <small>Il dashboard usa il costo realmente a tuo carico</small>
        </article>
        <article className="subscriptions-kpi">
          <span>Totale annuo lordo</span>
          <strong>{formatCurrency(annualGrossTotal)}</strong>
          <small>Somma dei prezzi completi degli abbonamenti attivi</small>
        </article>
        <article className="subscriptions-kpi">
          <span>Media mensile</span>
          <strong>{formatCurrency(monthlyAverage)}</strong>
          <small>Media distribuita su 12 mesi</small>
        </article>
        <article className="subscriptions-kpi">
          <span>Condivisi</span>
          <strong>{activeItems.filter((item) => item.sharing === "condiviso").length}</strong>
          <small>Abbonamenti condivisi con altre persone</small>
        </article>
      </section>

      <section className="subscriptions-panels">
        <article className="subscriptions-panel subscriptions-panel--chart">
          <header>
            <h3>Costi divisi per categoria</h3>
            <p>Distribuzione annua del costo a tuo carico.</p>
          </header>
          <div className="subscriptions-pie">
            <svg viewBox="0 0 220 220" className="subscriptions-pie__chart" aria-hidden="true">
              <circle cx="110" cy="110" r="78" className="subscriptions-pie__track" />
              <g transform="rotate(-90 110 110)">
                {pieSegments.map((segment) => (
                  <circle
                    key={segment.key}
                    cx="110"
                    cy="110"
                    r="78"
                    className="subscriptions-pie__segment"
                    style={{
                      stroke: segment.color,
                      strokeDasharray: segment.dasharray,
                      strokeDashoffset: segment.dashoffset,
                    }}
                  />
                ))}
              </g>
            </svg>
            <div className="subscriptions-pie__center">
              <strong>{items.length}</strong>
              <span>abbonamenti</span>
            </div>
          </div>
          <div className="subscriptions-legend">
            <div>
              <span className="subscriptions-legend__dot subscriptions-legend__dot--personal" />
              <strong>Personale</strong>
              <small>{formatCurrency(categoryTotals.personale)}</small>
            </div>
            <div>
              <span className="subscriptions-legend__dot subscriptions-legend__dot--work" />
              <strong>Lavoro</strong>
              <small>{formatCurrency(categoryTotals.lavoro)}</small>
            </div>
          </div>
        </article>

        <article className="subscriptions-panel">
          <header>
            <h3>Pagamenti in questo mese</h3>
            <p>Rinnovi previsti nel mese corrente.</p>
          </header>
          <div className="subscriptions-payments">
            {paymentsThisMonth.length ? (
              paymentsThisMonth.map((item) => (
                <div key={item.id} className="subscriptions-payments__item">
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.platform || "Piattaforma non indicata"}
                      {item.sharing === "condiviso" && item.sharedPeople.length
                        ? ` · condiviso con ${item.sharedPeople.length} persone`
                        : ""}
                    </small>
                  </div>
                  <div>
                    <strong>{formatCurrency(item.mySharePrice)}</strong>
                    <small>{formatDate(item.renewalDate)}</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="subscriptions-empty">
                Nessun rinnovo previsto in questo mese.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="subscriptions-list-panel">
        <header className="subscriptions-list-panel__header">
          <div>
            <h3>I tuoi Abbonamenti</h3>
            <p>Elenco completo con costo totale, quota personale e condivisioni.</p>
          </div>
        </header>

        {sortedItems.length ? (
          <div className="subscriptions-list">
            {sortedItems.map((item) => (
              <article
                key={item.id}
                className={`subscriptions-row subscriptions-row--${item.status}`}
                onClick={() => openEditModal(item)}
              >
                <div className="subscriptions-row__main">
                  <div className={`subscriptions-status subscriptions-status--${item.status}`}>
                    {item.status === "attivo" ? "Attivo ora" : STATUS_OPTIONS.find((option) => option.value === item.status)?.label ?? item.status}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.platform || "Piattaforma"} · {item.billingSource || "Addebito non indicato"}
                    </small>
                    {item.sharing === "condiviso" ? (
                      <div className="subscriptions-shared-people">
                        {item.sharedPeople.length ? (
                          item.sharedPeople.map((person) => (
                            <span key={`${item.id}-${person}`} className="subscriptions-person-chip">
                              {person}
                            </span>
                          ))
                        ) : (
                          <span className="subscriptions-person-chip">Condiviso</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="subscriptions-row__meta">
                  <span>{formatCurrency(item.totalPrice)}</span>
                  <small>Prezzo totale</small>
                </div>

                <div className="subscriptions-row__meta subscriptions-row__meta--my-share">
                  <span>{formatCurrency(item.mySharePrice)}</span>
                  <small>
                    {item.sharing === "condiviso" ? "A mio carico" : "Quota personale"}
                  </small>
                </div>

                <div className="subscriptions-row__meta">
                  <span>{CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label}</span>
                  <small>
                    {FREQUENCY_OPTIONS.find((option) => option.value === item.frequency)?.label}
                    {" · "}
                    {formatDate(item.renewalDate)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="subscriptions-empty-state">
            <h3>Nessun abbonamento</h3>
            <p>Inizia aggiungendo il primo servizio ricorrente che vuoi monitorare.</p>
          </div>
        )}
      </section>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal-card modal-card--subscriptions"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Abbonamenti</p>
                <h3 id="subscription-modal-title">
                  {form.id ? "Modifica abbonamento" : "Nuovo abbonamento"}
                </h3>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>
                x
              </button>
            </div>

            <form className="stack-form subscriptions-form" onSubmit={handleSubmit}>
              <div className="subscriptions-form__grid">
                <label>
                  <span>Stato</span>
                  <select
                    value={form.status}
                    onChange={(event) => {
                      const value = event.currentTarget.value as SubscriptionStatus;

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
                  <span>Nome</span>
                  <input
                    value={form.name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({ ...current, name: value }));
                    }}
                    placeholder="Esempio: Spotify Family"
                  />
                </label>

                <label>
                  <span>Prezzo totale</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.totalPrice}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({
                        ...current,
                        totalPrice: value,
                        mySharePrice:
                          current.sharing === "individuale" ? value : current.mySharePrice,
                      }));
                    }}
                    placeholder="15.99"
                  />
                </label>

                <label>
                  <span>Prezzo a mio carico</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.mySharePrice}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({
                        ...current,
                        mySharePrice: value,
                      }));
                    }}
                    placeholder="5.33"
                  />
                </label>

                <label>
                  <span>Frequenza</span>
                  <select
                    value={form.frequency}
                    onChange={(event) => {
                      const value = event.currentTarget.value as SubscriptionFrequency;

                      setForm((current) => ({
                        ...current,
                        frequency: value,
                      }));
                    }}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Tipo</span>
                  <select
                    value={form.sharing}
                    onChange={(event) => {
                      const value = event.currentTarget.value as SubscriptionSharing;

                      setForm((current) => ({
                        ...current,
                        sharing: value,
                        sharedPeople: value === "condiviso" ? current.sharedPeople : [],
                        mySharePrice:
                          value === "condiviso" ? current.mySharePrice : current.totalPrice,
                      }));
                    }}
                  >
                    {SHARING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Piattaforma</span>
                  <input
                    value={form.platform}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({ ...current, platform: value }));
                    }}
                    placeholder="App Store, sito, Stripe..."
                  />
                </label>

                <label>
                  <span>Dove viene addebitato</span>
                  <input
                    value={form.billingSource}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({
                        ...current,
                        billingSource: value,
                      }));
                    }}
                    placeholder="Carta Fineco, PayPal..."
                  />
                </label>

                <label>
                  <span>Quando si rinnova</span>
                  <input
                    type="date"
                    value={form.renewalDate}
                    onChange={(event) => {
                      const value = event.currentTarget.value;

                      setForm((current) => ({
                        ...current,
                        renewalDate: value,
                      }));
                    }}
                  />
                </label>

                <label>
                  <span>Categoria</span>
                  <select
                    value={form.category}
                    onChange={(event) => {
                      const value = event.currentTarget.value as SubscriptionCategory;

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

              {form.sharing === "condiviso" ? (
                <section className="subscriptions-sharing-box">
                  <div className="subscriptions-sharing-box__copy">
                    <div>
                      <strong>Condivisione</strong>
                      <p>Gestisci le persone con cui condividi questo abbonamento.</p>
                    </div>
                    <div className="subscriptions-sharing-box__stats">
                      <div className="subscriptions-sharing-box__stat">
                        <span>Persone</span>
                        <strong>{form.sharedPeople.length}</strong>
                      </div>
                      <div className="subscriptions-sharing-box__stat">
                        <span>Tua quota</span>
                        <strong>
                          {form.mySharePrice.trim() ? formatCurrency(Number(form.mySharePrice)) : "n/d"}
                        </strong>
                      </div>
                    </div>
                    {form.sharedPeople.length ? (
                      <div className="subscriptions-sharing-box__people">
                        {form.sharedPeople.map((person) => (
                          <span key={person} className="subscriptions-person-chip">
                            {person}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="subscriptions-sharing-box__empty">
                        Nessuna persona aggiunta per ora.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="modal-button modal-button--neutral subscriptions-sharing-box__trigger"
                    onClick={() => setIsPeopleModalOpen((current) => !current)}
                  >
                    {isPeopleModalOpen ? "Nascondi persone" : "Gestisci persone"}
                  </button>
                </section>
              ) : null}

              <div className="modal-actions">
                {form.id ? (
                  <button
                    type="button"
                    className="modal-button modal-button--danger"
                    onClick={() => handleDelete(form.id)}
                  >
                    Elimina
                  </button>
                ) : null}
                <button type="button" className="modal-button modal-button--ghost" onClick={closeModal}>
                  Annulla
                </button>
                <button type="submit" className="modal-button">
                  {form.id ? "Salva modifiche" : "Crea abbonamento"}
                </button>
              </div>
            </form>

            {isPeopleModalOpen ? (
              <div className="subscriptions-people-modal">
                <div className="subscriptions-people-modal__header">
                  <div>
                    <h4>Persone coinvolte</h4>
                    <p>Aggiungi o rimuovi chi condivide questo abbonamento.</p>
                  </div>
                  <button
                    type="button"
                    className="modal-button modal-button--ghost"
                    onClick={() => setIsPeopleModalOpen(false)}
                  >
                    Chiudi
                  </button>
                </div>

                <div className="subscriptions-people-modal__form">
                  <input
                    value={personDraft}
                    onChange={(event) => setPersonDraft(event.currentTarget.value)}
                    placeholder="Nome persona"
                  />
                  <button
                    type="button"
                    className="modal-button modal-button--neutral subscriptions-people-modal__add"
                    onClick={addSharedPerson}
                  >
                    Aggiungi
                  </button>
                </div>

                <div className="subscriptions-people-list">
                  {form.sharedPeople.length ? (
                    form.sharedPeople.map((person) => (
                      <div key={person} className="subscriptions-people-list__item">
                        <strong>{person}</strong>
                        <button
                          type="button"
                          className="subscriptions-row__delete"
                          onClick={() => removeSharedPerson(person)}
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="subscriptions-empty">Nessuna persona aggiunta.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
