# Changelog

Tutte le modifiche rilevanti al progetto `Organizer` vengono tracciate qui.

## [0.1.0] - 2026-03-09

### Added
- Pagine principali: `Organizer`, `Tracker`, `Misurazioni`, `Lettura`, `Abbonamenti`.
- Persistenza locale SQLite per workspace, task, tracker, misurazioni, lettura e abbonamenti.
- Dashboard e strumenti di configurazione in `Impostazioni` (tracker + Google Calendar UI).
- Vista board/timeline, modali evento e strumenti avanzati per fasi Kanban.

### Changed
- Restyling generale dark con componenti coerenti tra le sezioni.
- Miglioramenti UX su drag&drop, popup, campi inline e gestione workspace.
- Tema `Lettura` aggiornato con accenti arancioni.

### Fixed
- Correzioni crash su input form (event pooling React).
- Correzioni salvataggi DB e allineamento query/placeholder.
- Correzioni layout, selettori e interazioni in vari popup.
