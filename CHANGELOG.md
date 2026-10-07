# Changelog

## [2.3.0] - 2026-10-07

### Changed
- Refaktor CLI — logika wydzielona do `lib/` (fs-utils, commands/init, commands/preset)
- `cli.js` to teraz cienka warstwa I/O, logika biznesowa w testowalnych modułach

### Added
- Wersjonowanie presetów — `preset_version: X.Y.Z` w pliku presetu
- `claude-migrate preset <nazwa> --update` — aktualizacja presetu (porównuje wersje)
- Testy (`node:test`) — 22 testy pokrywające fs-utils, init, preset (z --update)
- `npm test` script

## [2.2.0] - 2026-10-07

### Added
- Walidacja `init` — sprawdza czy `@odyseusz426/claude-npm-sdd` jest zainstalowany
- `--dry-run` dla `init` i `preset` — podgląd plików do skopiowania

### Removed
- Agent `migration-analyzer` — analiza odbywa się w sesji głównej (oszczędność tokenów)

### Fixed
- Referencje do `migration-analyzer` usunięte z SKILLS.md, README.md, skills.json i pozostałych agentów

## [2.1.0] - 2026-10-06

### Changed
- Ujednolicenie CLI na polski — audit fix

## [2.0.0] - 2026-10-06

### Changed
- Generalizacja na preset-based universal migration toolkit

## [1.0.0] - 2026-10-06

### Added
- Initial release — Cypress → Playwright migration toolkit
