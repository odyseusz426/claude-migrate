# Skills — @odyseusz426/claude-migrate

Rozszerzenie SDD Framework dostarczające komendy i agentów do migracji testów Cypress → Playwright.

## Komendy

### `/migrate`

Migracja pliku Cypress → Playwright — analiza + generowanie + review.

```
/migrate <plik.cy.ts lub katalog> [--target <ścieżka>] [--propose]
```

| Parametr | Opis |
|----------|------|
| `<source>` | Plik `.cy.ts` lub katalog (rekursywnie) |
| `--target <dest>` | Repo docelowe Playwright |
| `--propose` | Tylko analiza i plan, bez generowania kodu |

**Flow:** Analiza (sesja główna) → Generowanie (`migration-spec-writer`) → Review (`migration-supervisor`) → Synchronizacja `ai/docs/`

**Agenci:** `migration-spec-writer`, `migration-supervisor`

---

### `/migrate-cr`

Poprawki po Code Review do zmigrowanych testów Playwright.

```
/migrate-cr [--file <plik.spec.ts>]
```

| Parametr | Opis |
|----------|------|
| `--file <ścieżka>` | Plik `.spec.ts` którego dotyczy CR (opcjonalne) |

**Flow:** Zebranie uwag → Analiza (sesja główna) → Poprawki (`migration-cr`) → Prezentacja i zapis

**Agent:** `migration-cr`

---

### `/migrate-fix`

Diagnoza i naprawa testów Playwright które failują, a w Cypress działają.

```
/migrate-fix <plik.spec.ts> [--all]
```

| Parametr | Opis |
|----------|------|
| `<plik.spec.ts>` | Test Playwright do naprawy |
| `--all` | Propaguj fix do innych plików z tym samym błędem |

**Flow:** Odpal test → Znajdź Cypress odpowiednik → Diagnoza (znane pułapki → debug API → porównanie payloadów) → Napraw → Propagacja → Aktualizacja `ai/docs/`

**Agent:** brak (sesja główna)

---

### `/migrate-split`

Podział brancha migracyjnego na atomowe MR — 1 klasa testowa = 1 branch = 1 MR.

```
/migrate-split [<nazwa-spec>] [--all] [--target <branch>]
```

| Parametr | Opis |
|----------|------|
| `<nazwa-spec>` | Konkretny spec do przeniesienia |
| `--all` | Analiza wszystkich speców + plan podziału |
| `--target <branch>` | Branch docelowy MR (domyślnie: `master`) |

**Flow:** Analiza zależności (sesja główna) → Plan → Kopiowanie (`migration-split`) → Weryfikacja

**Agent:** `migration-split`

---

## Agenci

| Agent | Rola | Model |
|-------|------|-------|
| `migration-analyzer` | Analiza pliku Cypress — importy, commands, Jira IDs | sonnet |
| `migration-spec-writer` | Generowanie kodu Playwright (services + factories + enums + models + spec) | sonnet |
| `migration-supervisor` | Review kompletności i spójności migracji (PASS/FAIL) | opus |
| `migration-cr` | Aplikowanie uwag z Code Review | sonnet |
| `migration-split` | Kopiowanie plików per spec do atomowych branchy | sonnet |

## Typowy flow

```
/migrate cypress/spec.cy.ts --propose   → proposal do akceptacji
/migrate cypress/spec.cy.ts             → pełna migracja (analiza + kod + review)
  → Code Review zespołu
/migrate-cr                              → poprawki po CR
/migrate-fix tests/spec.spec.ts          → naprawa failujących testów
/migrate-split --all                     → plan podziału na MR
/migrate-split freights-actions          → kopiuj spec + zależności do atomowego brancha
```

## Wymagania

- `@odyseusz426/claude-npm-sdd` jako bazowy framework
- Skonfigurowane repozytoria: `sdd dirs add <ścieżka>`
