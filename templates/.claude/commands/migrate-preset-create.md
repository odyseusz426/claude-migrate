---
description: Tworzy nowy preset migracji na podstawie analizy repozytoriów źródłowego i docelowego
argument-hint: <nazwa-presetu> [--source <ścieżka>] [--target <ścieżka>] [--reference <ścieżka>]
---

# /migrate preset-create — Tworzenie nowego presetu migracji

**Cel:** Przeanalizuj repo źródłowe i docelowe (+ opcjonalnie referencyjne), rozpoznaj wzorce obu technologii i wygeneruj kompletny preset migracji.

```
/migrate preset-create <nazwa>
/migrate preset-create <nazwa> --source ../cypress-repo --target ../playwright-repo
/migrate preset-create <nazwa> --source ../old-repo --target ../new-repo --reference ../existing-migrated-repo
```

Parametry:
- `<nazwa>` — nazwa presetu (kebab-case, np. `jest-to-vitest`, `junit-to-kotest`)
- `--source <ścieżka>` — repo z kodem źródłowym (opcjonalne — zapyta interaktywnie)
- `--target <ścieżka>` — repo z kodem docelowym (opcjonalne — zapyta interaktywnie)
- `--reference <ścieżka>` — repo z już zmigrowanym kodem do wzorowania (opcjonalne)

---

## Krok 1: Zbierz informacje

Jeśli nie podano flag:

```
1. Jak nazywasz tę migrację? (np. jest-to-vitest, cypress-to-playwright)
2. Wskaż repo źródłowe (technologia z której migrujemy):
3. Wskaż repo docelowe (technologia na którą migrujemy):
4. (Opcjonalnie) Wskaż repo referencyjne — istniejący kod w technologii docelowej do wzorowania:
```

---

## Krok 2: Analiza source (technologia źródłowa)

Przeczytaj z repo źródłowego — **minimum plików, maximum informacji:**

### 2a. Wykrycie technologii i frameworka

```
Sprawdź kolejno:
- package.json → dependencies/devDependencies (cypress, jest, mocha, junit, pytest...)
- Pliki konfiguracyjne (cypress.config.ts, jest.config.ts, vitest.config.ts, pytest.ini...)
- Struktura katalogów (cypress/e2e/, __tests__/, tests/, spec/...)
- Rozszerzenia plików testowych (.cy.ts, .test.ts, .spec.ts, _test.go, _test.py...)
```

### 2b. Rozpoznanie wzorców source

Przeczytaj **2-3 reprezentatywne pliki testowe** (różnej złożoności) i wyciągnij:

| Wzorzec | Co szukać |
|---------|-----------|
| Pliki testowe | Rozszerzenie, konwencja nazw |
| Import testów | `import { test } from ...`, `describe`, `it`, `def test_` |
| Asercje | Chai, Jest expect, pytest assert, assertThat |
| Setup/cleanup | beforeEach, setUp, @Before, fixture |
| Mockowanie | cy.intercept, jest.mock, unittest.mock |
| Async/polling | cy.wait, waitFor, polling helpers |
| Config/env | Cypress.env, process.env, conftest.py |
| Custom commands/helpers | cy.*, custom matchers, fixtures |
| Parametryzacja | describe.each, @pytest.mark.parametrize, @ParameterizedTest |
| Test IDs/tagi | jiraId, @tag, markers |
| Dane testowe | Factories, fixtures, builders, seeds |
| Auth | Token, headers, login flow |

### 2c. Jeśli source ma ai/docs/ — przeczytaj

Skróci analizę znacząco. Szukaj:
- `ai/docs/patterns/testing-patterns.md`
- `ai/docs/patterns/config-patterns.md`
- `ai/docs/patterns/architecture.md`

---

## Krok 3: Analiza target (technologia docelowa)

### 3a. Wykrycie technologii

Jak wyżej — package.json, config, struktura katalogów.

### 3b. Rozpoznanie wzorców target

Jeśli repo docelowe ma istniejące testy → przeczytaj **2-3 pliki** i wyciągnij te same wzorce co z source.

Jeśli repo docelowe jest puste → użyj **repo referencyjnego** (jeśli podano).

Jeśli brak referencji → **zapytaj użytkownika** o kluczowe decyzje:

```
## Decyzje do podjęcia

Nie znalazłem istniejących testów w docelowym repo. Potrzebuję decyzji:

1. **Architektura warstw** — jak organizować kod?
   - Flat (testy + helpers w jednym katalogu)?
   - Layered (tests/, services/, factories/, helpers/)?

2. **Konwencja asercji** — gdzie expect?
   - Wszędzie (jak source)?
   - Strict separation (expect tylko w testach, serwisy zwracają dane)?

3. **Nazewnictwo** — język w testach?
   - Angielski?
   - Polski? (jeśli tak — z diakrytykami czy bez?)

4. **Test IDs** — jak tagować testy?
   - Jira ID? Test Rail? Własne?

5. **Inne konwencje** — co jest ważne w Twoim projekcie?
```

### 3c. Jeśli target ma ai/docs/ — przeczytaj

---

## Krok 4: Analiza referencyjnego repo (opcjonalne)

Jeśli podano `--reference`:
1. Przeczytaj **3-5 plików testowych** — wybierz różnorodne (prosty test, złożony, z parametryzacją)
2. Wyciągnij **wzorce docelowe** — to jest Twój "gold standard"
3. Porównaj z source — zbuduj tabelę mapowania

---

## Krok 5: Generowanie presetu

Na podstawie zebranych danych wygeneruj preset wg struktury:

```markdown
# Migration Preset: {Source} → {Target}

> Ten plik jest automatycznie czytany przez agentów migracyjnych.
> Zawiera reguły, wzorce i mapowania specyficzne dla migracji {Source} → {Target}.

## Source Technology: {nazwa}

- Pliki testowe: `{rozszerzenie}`
- Import: `{pattern importu testów}`
- Asercje: `{pattern asercji}` — {gdzie używane}
- Setup/cleanup: `{pattern}` — {opis}
- Config: `{pattern}` — {opis}
- Parametryzacja: `{pattern}` — {opis}
- Custom helpers: `{pattern}` — {opis}
- Dane testowe: `{pattern}` — {opis}
{...inne rozpoznane wzorce}

## Target Technology: {nazwa}

- Pliki testowe: `{rozszerzenie}`
- Import: `{pattern importu testów}`
- Asercje: `{pattern asercji}` — {gdzie używane}
- Setup/cleanup: `{pattern}` — {opis}
- Config: `{pattern}` — {opis}
- Parametryzacja: `{pattern}` — {opis}
{...inne rozpoznane wzorce}

## Mapowanie wzorców Source → Target

| Aspekt | {Source} | {Target} |
|--------|----------|----------|
| Pliki testowe | `{rozszerzenie}` | `{rozszerzenie}` |
| Import | `{pattern}` | `{pattern}` |
| Asercje | `{pattern}` | `{pattern}` |
| Setup | `{pattern}` | `{pattern}` |
| Cleanup | `{pattern}` | `{pattern}` |
| Async/polling | `{pattern}` | `{pattern}` |
| Config | `{pattern}` | `{pattern}` |
| Parametryzacja | `{pattern}` | `{pattern}` |
| Test IDs | `{pattern}` | `{pattern}` |
| Dane testowe | `{pattern}` | `{pattern}` |
| Auth | `{pattern}` | `{pattern}` |

## Architektura docelowa (warstwy)

{opis struktury katalogów i separacji odpowiedzialności}

## Konwencje docelowe

### Nazewnictwo i język
{tabela: element → język → przykład}

### Pliki
{tabela: typ → konwencja → przykład}

### Wzorce kodu
{kluczowe wzorce z code examples}

## Krytyczne reguły migracji

{na start: sekcja pusta lub z regułami wykrytymi z analizy}
{reguły będą się uzupełniać po każdym /migrate-fix}

> **Uwaga:** Ta sekcja rośnie z czasem. Po każdej naprawie (/migrate-fix) nowe reguły
> są automatycznie dodawane. Pierwsze migracje mogą wymagać więcej poprawek.

## Dokumentacja docelowego repo (do czytania)

{tabela: plik → po co — jeśli ai/docs/ istnieje}

## Dokumentacja source repo (do czytania)

{tabela: plik → po co — jeśli ai/docs/ istnieje}

## Debug — znane pułapki

{na start: sekcja pusta lub z pułapkami wykrytymi z analizy referencyjnej}
{pułapki będą się uzupełniać po każdym /migrate-fix}

## Uruchamianie testów

{komenda do uruchomienia testów w technologii docelowej}
```

---

## Krok 6: Prezentacja i zapis

1. **Wyświetl wygenerowany preset** — pełna treść
2. **Czekaj na akceptację** i ewentualne korekty
3. Po `tak`:
   - Zapisz do `.claude/migrate.preset.md` (aktywny preset)
   - Zapisz kopię do `templates/presets/{nazwa}/preset.md` (jeśli w repo claude-migrate)
   - Jeśli są reference-patterns → zapisz jako `templates/presets/{nazwa}/reference-patterns.md`

```markdown
## Preset "{nazwa}" — ✅ Utworzony

| Element | Wartość |
|---------|--------|
| Source | {technologia} |
| Target | {technologia} |
| Reguł | {N} (rośnie z czasem) |
| Plik | .claude/migrate.preset.md |

### Co dalej?
- `/migrate <plik> --propose` — pierwsza migracja (z proposalem)
- Po naprawkach (/migrate-fix) reguły automatycznie się uzupełnią
- Ręczne korekty presetu: edytuj `.claude/migrate.preset.md`
```

---

## Krok 7: Generowanie reference-patterns (opcjonalne)

Jeśli z analizy target/reference wynika bogaty zestaw wzorców → wygeneruj osobny plik `reference-patterns.md` z:
- Kompletne code examples dla każdego wzorca
- Szablony testów, serwisów, factories
- Mapowanie source → target z pełnym kodem

---

## Wskazówki

### Jak rozpoznać technologię bez ai/docs/?

| Plik | Technologia |
|------|-------------|
| `cypress.config.ts` | Cypress |
| `playwright.config.ts` | Playwright |
| `jest.config.ts/js` | Jest |
| `vitest.config.ts` | Vitest |
| `pytest.ini` / `conftest.py` | pytest |
| `phpunit.xml` | PHPUnit |
| `build.gradle` + `junit` | JUnit |
| `karma.conf.js` | Karma |
| `mocha` w package.json | Mocha |

### Ile plików czytać?

- **Minimum 2, max 5** plików testowych z source i target/reference
- Wybieraj **różnorodne** — prosty test, złożony, z parametryzacją, z setupem
- **Nie czytaj node_modules** na tym etapie — wystarczą pliki testowe i config

### Co jeśli source i target to ta sama technologia?

To nadal migracja — może być upgrade wersji, zmiana architektury, refactoring struktury.
Preset opisuje "stary styl" vs "nowy styl" zamiast "technologia A" vs "technologia B".

---

## Zasady

- 🚫 NIE commituj — informuj co scommitować
- ✅ Czytaj minimum plików — wystarczy 2-3 per repo do rozpoznania wzorców
- ✅ Pytaj o decyzje zamiast zgadywać — szczególnie konwencje i architekturę
- ✅ Generuj sekcje "Krytyczne reguły" i "Debug — znane pułapki" jako puste/minimalne — wypełnią się z czasem
- ✅ Preset to żywy dokument — będzie rósł po każdym /migrate-fix
