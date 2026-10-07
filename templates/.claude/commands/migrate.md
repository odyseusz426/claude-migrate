---
description: Migruje pliki z technologii źródłowej na docelową — analiza + generowanie + review
argument-hint: <ścieżka do pliku lub katalogu> [--target <ścieżka docelowa>] [--propose]
---

# /migrate — Uniwersalna migracja

**Cel:** Przepisz pliki z technologii źródłowej na docelową z pełnym zachowaniem logiki, identyfikatorów testów i cleanup.

> **Zasada MR: 1 klasa testowa = 1 MR.** MR zawiera spec + TYLKO te services/factories/enumy/helpery/modele których ta klasa potrzebuje.

```
/migrate <source> [--target <dest>] [--propose]
```

Parametry:
- `<source>` — plik źródłowy lub katalog (rekursywnie)
- `--target <dest>` — repo docelowe (domyślnie: wypisz w raporcie)
- `--propose` — tylko analiza i plan, bez generowania kodu

---

## Krok 0: Walidacja

```
1. Czy .claude/migrate.preset.md istnieje?
   NIE → "Uruchom /migrate setup najpierw" → STOP
   TAK → załaduj preset (Read)

2. Jeśli <source> to plik → SINGLE
   Jeśli <source> to katalog → BATCH
   Jeśli nie istnieje → STOP

3. Jeśli --propose → TRYB PROPOSE (P1-P2)
   Bez --propose → TRYB EXECUTE (1-4)
```

---

## TRYB PROPOSE (--propose)

### Krok P1: Analiza w sesji głównej (BEZ subagenta)

**NIE deleguj do agenta** — sesja główna robi analizę bezpośrednio (oszczędność tokenów).
Użyj Read/Grep/Glob do zebrania danych:

1. **Przeczytaj plik źródłowy** — wylistuj testy, identyfikatory, importy, commands
2. **Znajdź definicje commands/helperów** — sprawdź w `ai/docs/` i node_modules
3. **Znajdź definicje importów** — fabryki, enumy, helpery
4. **Sprawdź referencyjne repo** — co można reużyć. Czytaj TYLKO pliki bezpośrednio powiązane
5. **Sprawdź docelowe repo** — co już istnieje w `src/`

**Zasada oszczędności:** czytaj tylko pliki bezpośrednio powiązane. Nie skanuj szeroko.
**Zasada ZERO HALUCYNACJI:** nie znalazłeś definicji → UNKNOWNS, nie zgaduj.

**OBOWIĄZKOWO przeczytaj z docelowego repo:**
- `ai/docs/patterns/testing-patterns.md` — wzorce testowe
- `ai/docs/patterns/migration-rules.md` — reguły z poprzednich migracji (jeśli istnieje)
- `ai/docs/patterns/infrastructure-inventory.md` — istniejące komponenty (jeśli istnieje)

### Krok P2: Proposal → artefakt

Zapisz do `ai/changes/migrate-{nazwa}/proposal.md`:

```markdown
## Migration Proposal: {nazwa pliku}

### Podsumowanie
- Źródło: `{ścieżka}`
- Technologia: {source} → {target}
- Testy: {N} | IDs: {lista}

### Plan plików
| Plik docelowy | Typ | Pewność |
|---|---|---|
| `tests/...` | spec | ✅/⚠️/❓ |
| `src/services/...` | service | ✅/⚠️/❓ |

### Mapowanie testów
| # | ID | Test źródłowy | Uwagi |
|---|---|---|---|

### Commands → Services
| Command | HTTP | Endpoint | Service method |
|---|---|---|---|

### Reużywalne z docelowego repo
| Plik | Co | Pasuje? |

### UNKNOWNS (jeśli są)
- {czego nie udało się znaleźć}

### Wątpliwości (jeśli są)
- {ryzyka}
```

**Czekaj na akceptację.** Po `tak` → TRYB EXECUTE (Krok 2-4, pomijając Krok 1).

---

## TRYB EXECUTE

### Krok 1: Analiza (TYLKO jeśli nie było --propose)

Identycznie jak P1, ale bez artefaktu. Krótkie podsumowanie:

```
## Analiza: {nazwa}
- Testy: {N} | IDs: {lista}
- Commands: {lista}
- Do stworzenia: {lista plików}
```

Kontynuuj automatycznie.

---

### Krok 2: Generowanie kodu (JEDEN agent)

Deleguj do **jednego** subagenta `migration-writer`:

```
Prompt:
Na podstawie analizy, wygeneruj WSZYSTKIE pliki migracji naraz.

## Plik źródłowy
{treść pliku}

## Analiza
{raport z Krok 1 lub P1 — ZWIĘŹLE}

## Znalezione definicje
{commands — endpoint, HTTP method, payload structure}
{fabryki — payloady}
{enumy — wartości}

## Wzorce z referencyjnych repo (KONKRETNY kod do wzorowania)
{wklej TYLKO pliki do wzorowania}

## Pliki do wygenerowania
1. src/services/xxx.service.ts
2. src/factories/xxx.factory.ts
...

## Krytyczne reguły (z presetu)
{lista reguł z .claude/migrate.preset.md}
```

Agent zwraca treść WSZYSTKICH plików w jednym raporcie.

---

### Krok 3: Review (migration-supervisor)

Deleguj do subagenta `migration-supervisor`:

```
Prompt:
Zweryfikuj migrację.

## Oryginał
{treść pliku źródłowego}

## Wygenerowane pliki
{treść WSZYSTKICH plików z Krok 2}
```

Verdykt: PASS / PASS WITH NOTES / FAIL.
- FAIL → napraw i ponów review
- PASS → Krok 4

---

### Krok 4: Synchronizacja ai/docs/ (sesja główna — po PASS)

**OBOWIĄZKOWO** zaktualizuj artefakty (jeśli istnieją w docelowym repo):

#### 4a. `infrastructure-inventory.md` — dodaj nowe komponenty
#### 4b. `migration-rules.md` — dodaj nowe reguły (jeśli odkryto)
#### 4c. `migration-progress.md` — zaktualizuj status
#### 4d. Weryfikacja spójności — sprawdź czy KAŻDY komponent jest w inventory

---

### Prezentacja wyniku

```markdown
## Migracja: {nazwa} — ✅ PASS

| Plik | Typ | Status |
|---|---|---|
| tests/... | spec | ✅ nowy |
| src/services/... | service | ✅ nowy |

### Co dalej?
Sugerowane następne pliki (priorytet: ta sama domena, reużycie komponentów):
- `{następny-plik}` — {N testów, reużywa: X, Y}
```

---

## BATCH — cały katalog

Wylistuj pliki, czekaj na potwierdzenie.
- **BATCH + --propose:** analiza per plik, zbiorczy Proposal
- **BATCH execute:** sekwencyjnie, reużywaj pliki z poprzednich iteracji

---

## Zasady oszczędności tokenów

1. **Analiza w sesji głównej** — nie deleguj do agenta
2. **Jeden agent na generowanie** — wszystkie pliki naraz
3. **Nie powtarzaj treści** — zwięzłe podsumowanie do agenta
4. **Nie czytaj tego samego dwa razy**
5. **Referencyjne repo** — TYLKO pliki bezpośrednio potrzebne

## Zasady migracji

- 🚫 NIE commituj — informuj co scommitować
- 🚫 NIE nadpisuj bez potwierdzenia
- ✅ 1:1 mapowanie testów
- ✅ Zachowaj WSZYSTKIE identyfikatory testów
- ✅ Zachowaj cleanup
- ✅ Reużywaj istniejące pliki
- ✅ Supervisor jako ostatni krok — zawsze
