---
description: Diagnozuje i naprawia test docelowy który failuje, a w źródłowym działa
argument-hint: <ścieżka do pliku testowego> [--all]
---

# /migrate-fix — Diagnoza i naprawa

**Cel:** Test docelowy failuje, w źródłowym działa. Zdiagnozuj root cause, napraw, potwierdź.

```
/migrate-fix <plik>        — napraw konkretny plik
/migrate-fix <plik> --all  — napraw + sprawdź inne pliki z tym samym błędem
```

---

## Krok 0: Walidacja

```
Czy .claude/migrate.preset.md istnieje?
  NIE → "Uruchom /migrate setup najpierw" → STOP
  TAK → załaduj preset (Read) — sekcja "Debug — znane pułapki"
```

---

## Krok 1: Odpal test i zbierz błąd

```bash
# Komenda testowa z presetu (sekcja "Uruchamianie testów")
# np. npx playwright test <plik> --reporter=line
# np. npx vitest run <plik>
{komenda z presetu} 2>&1 | tail -40
```

Jeśli test przechodzi → powiedz użytkownikowi i STOP.
Jeśli failuje → zapisz:
- Które testy failują (nazwy + IDs)
- Komunikaty błędów (status code, assertion message)
- Linia kodu w której pada

---

## Krok 2: Znajdź odpowiednik źródłowy

1. **Znajdź plik źródłowy** — szukaj po test ID lub nazwie testu
2. **Przeczytaj plik źródłowy** — porównaj z docelowym:
   - Importy i commands → jakie services/fabryki używa?
   - Payload structure → czy payloady się zgadzają?
   - Config/konta → czy te same konta?
   - Asercje → czy źródłowy w ogóle asertuje poprawnie?

---

## Krok 3: Diagnoza — systematyczny debug

Pracuj **sekwencyjnie**, od najprostszego do najtrudniejszego:

### 3a. Sprawdź znane pułapki (z presetu)

Przeczytaj sekcję "Debug — znane pułapki" z `.claude/migrate.preset.md`.
Jeśli istnieje `ai/docs/patterns/migration-rules.md` — sprawdź też.

Dla KAŻDEJ pułapki sprawdź czy test ją łamie.

### 3b. Jeśli nie znaleziono → debug API response

Dodaj tymczasowy logging do service function:
```typescript
console.error('DEBUG request:', JSON.stringify(payload, null, 2));
console.error('DEBUG response:', JSON.stringify(await response.json(), null, 2));
```

Odpal test, przeanalizuj response, **USUŃ debug logging po diagnozie**.

### 3c. Porównaj payloady source vs target

Zestawienie tabelaryczne:
```
| Pole | Source | Target | Match? |
|------|--------|--------|--------|
```

Sprawdź SZCZEGÓLNIE:
- Enum values (nie nazwy — wartości!)
- Typy obiektowe (string vs `{id, name}`)
- Warunkowe pola
- Headers per endpoint

### 3d. Porównaj source library z target implementacją

Przeczytaj TYLKO:
- Endpoint URL + HTTP method
- Payload structure
- Headers
- Response handling

---

## Krok 4: Napraw

1. **Minimalna poprawka** — napraw TYLKO to co powoduje fail
2. **Odpal test ponownie** — potwierdź że przechodzi
3. **Nadal failuje?** → wróć do Krok 3 z nowym błędem

---

## Krok 5: Propagacja (jeśli --all)

Jeśli root cause to pattern który może się powtarzać:

```bash
grep -r "hardcoded_string" tests/ src/ --include="*.ts"
```

Napraw WSZYSTKIE wystąpienia. Uruchom dotknięte testy.

---

## Krok 6: Aktualizacja ai/docs/

**OBOWIĄZKOWO** po naprawie:

1. **`migration-rules.md`** — jeśli odkryto NOWY pattern:
   ```markdown
   ### N. Nazwa reguły
   Opis + CORRECT/WRONG przykład + skąd się wzięło
   ```

2. **`infrastructure-inventory.md`** — jeśli zmodyfikowano komponent

3. **`.claude/migrate.preset.md`** — jeśli nowa reguła jest ogólna, dodaj do sekcji "Krytyczne reguły" i "Debug — znane pułapki"

---

## Krok 7: Raport

```markdown
## Fix: {nazwa pliku}

### Testy: {N passed} / {N total}

### Root cause
{1-2 zdania}

### Zmienione pliki
| Plik | Zmiana |
|------|--------|

### Nowa reguła (jeśli dodano)
{treść — lub "brak, istniejąca reguła #N"}

### Propagacja
{lista plików — lub "nie dotyczy"}
```

---

## Zasady

- 🚫 NIE commituj — informuj co scommitować
- 🚫 NIE zostawiaj debug logging — ZAWSZE usuń po diagnozie
- ✅ Najpierw znane pułapki z presetu — oszczędność tokenów
- ✅ Porównuj WARTOŚCI nie nazwy
- ✅ Minimalna poprawka — nie refaktoruj otoczenia
- ✅ Uruchom test po naprawie — ZAWSZE
- ✅ Propaguj fix jeśli pattern się powtarza
- ✅ Aktualizuj ai/docs/ i preset — następna osoba nie traci czasu
