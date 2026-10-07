# Skills — @odyseusz426/claude-migrate

Uniwersalny toolkit migracji dla Claude Code. Technologia źródłowa i docelowa definiowana przez presety.

## Komendy

### `/migrate setup`

Konfiguracja migracji — wybór presetu technologicznego lub ręczna definicja reguł i repozytoriów referencyjnych.

```
/migrate setup                                → interaktywna konfiguracja
/migrate setup --preset cypress-to-playwright  → załaduj preset
```

**Flow:** Wybór presetu / definicja reguł → Konfiguracja repozytoriów → Zapis `.claude/migrate.preset.md`

---

### `/migrate`

Migracja pliku z technologii źródłowej na docelową — analiza + generowanie + review.

```
/migrate <plik lub katalog> [--target <ścieżka>] [--propose]
```

| Parametr | Opis |
|----------|------|
| `<source>` | Plik źródłowy lub katalog (rekursywnie) |
| `--target <dest>` | Repo docelowe |
| `--propose` | Tylko analiza i plan, bez generowania kodu |

**Wymaga:** `.claude/migrate.preset.md` (z `/migrate setup`)

**Flow:** Analiza (sesja główna) → Generowanie (`migration-writer`) → Review (`migration-supervisor`) → Synchronizacja `ai/docs/`

---

### `/migrate-cr`

Poprawki po Code Review do zmigrowanych plików.

```
/migrate-cr [--file <ścieżka>]
```

**Flow:** Zebranie uwag → Analiza (sesja główna) → Poprawki (`migration-cr`) → Prezentacja i zapis

---

### `/migrate-fix`

Diagnoza i naprawa plików docelowych które failują, a w źródłowej technologii działają.

```
/migrate-fix <plik> [--all]
```

| Parametr | Opis |
|----------|------|
| `<plik>` | Plik docelowy do naprawy |
| `--all` | Propaguj fix do innych plików z tym samym błędem |

**Flow:** Odpal test → Znajdź odpowiednik źródłowy → Diagnoza (znane pułapki → debug → porównanie) → Napraw → Propagacja → Aktualizacja docs + preset

---

### `/migrate preset-create`

Tworzenie nowego presetu migracji — analizuje repo źródłowe i docelowe, rozpoznaje wzorce, generuje plik presetu.

```
/migrate preset-create <nazwa> [--source <ścieżka>] [--target <ścieżka>] [--reference <ścieżka>]
```

| Parametr | Opis |
|----------|------|
| `<nazwa>` | Nazwa presetu (kebab-case, np. `jest-to-vitest`) |
| `--source` | Repo z kodem źródłowym |
| `--target` | Repo z kodem docelowym |
| `--reference` | Repo z już zmigrowanym kodem do wzorowania |

**Flow:** Analiza source → Analiza target/reference → Pytania o decyzje (jeśli brak wzorców) → Generowanie presetu → Zapis `.claude/migrate.preset.md`

---

## Agenci

| Agent | Rola | Model |
|-------|------|-------|
| `migration-writer` | Generowanie kodu docelowego (services + factories + testy) | sonnet |
| `migration-supervisor` | Review kompletności i spójności (PASS/FAIL) | opus |
| `migration-cr` | Aplikowanie uwag z Code Review | sonnet |

## Presety

Presety zawierają wiedzę specyficzną dla pary technologii (reguły, mapowania, wzorce).

| Preset | Source → Target |
|--------|----------------|
| `cypress-to-playwright` | Cypress → Playwright (API tests) |

### Ładowanie presetu

```bash
claude-migrate preset cypress-to-playwright
```

Lub interaktywnie: `/migrate setup`

### Tworzenie własnego presetu

```
/migrate preset-create jest-to-vitest --source ../jest-app --target ../vitest-app
```

Komenda analizuje oba repozytoria, rozpoznaje wzorce i generuje preset. Jeśli brakuje informacji — pyta o decyzje (architektura warstw, konwencje nazewnictwa, język testów itp.).

## Typowy flow

```
claude-migrate init                            → zainstaluj agentów i komendy
claude-migrate preset cypress-to-playwright    → załaduj preset
/migrate source/spec.cy.ts --propose           → analiza i plan
/migrate source/spec.cy.ts                     → pełna migracja
  → Code Review zespołu
/migrate-cr                                    → poprawki po CR
/migrate-fix tests/spec.spec.ts                → naprawa failujących testów
```

## Wymagania

- `@odyseusz426/claude-npm-sdd` jako bazowy framework
- Skonfigurowane repozytoria: `sdd dirs add <ścieżka>`
