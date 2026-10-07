---
description: Konfiguracja migracji — wybór presetu lub definicja reguł
argument-hint: [--preset <nazwa>]
---

# /migrate setup — Konfiguracja migracji

**Cel:** Skonfiguruj migrację — załaduj preset technologiczny lub zdefiniuj reguły ręcznie.

```
/migrate setup                              — interaktywna konfiguracja
/migrate setup --preset cypress-to-playwright  — załaduj konkretny preset
```

---

## Krok 1: Sprawdź stan

```
Czy .claude/migrate.preset.md istnieje?
  TAK → Wyświetl aktualną konfigurację, zapytaj czy zmienić
  NIE → Przejdź do konfiguracji
```

---

## Krok 2: Wybór trybu

### Tryb A: Preset (--preset lub wybór z listy)

1. **Wylistuj dostępne presety** — szukaj w:
   - Katalog paczki: `node_modules/@odyseusz426/claude-migrate/templates/presets/`
   - Lokalny katalog: `.claude/presets/` (jeśli istnieje)

2. **Wyświetl preset:**
   ```
   ## Preset: {nazwa}
   - Source: {technologia źródłowa}
   - Target: {technologia docelowa}
   - Reguł: {N}
   - Wzorców: {N}
   ```

3. **Załaduj preset:**
   - Skopiuj `preset.md` → `.claude/migrate.preset.md`
   - Skopiuj `reference-patterns.md` → `ai/reference-patterns/` (jeśli istnieje)
   - Potwierdź załadowanie

### Tryb B: Ręczna definicja (bez presetu)

1. **Zapytaj o technologie:**
   - Technologia źródłowa (np. Cypress, Jest, Mocha, JUnit)
   - Technologia docelowa (np. Playwright, Vitest, pytest)

2. **Zapytaj o repozytoria:**
   - Repo źródłowe (skąd migrujemy)
   - Repo docelowe (dokąd)
   - Repo referencyjne (opcjonalne — istniejące testy w technologii docelowej do wzorowania)

3. **Wygeneruj szkielet presetu:**
   Przeczytaj referencyjne repo (jeśli podane) i wygeneruj `.claude/migrate.preset.md` z:
   - Technologie source/target
   - Rozpoznane wzorce z referencyjnego repo
   - Pusta sekcja "Krytyczne reguły" (do uzupełnienia w trakcie migracji)

4. **Prezentuj wygenerowany preset** — czekaj na akceptację

5. **Zapisz** `.claude/migrate.preset.md`

---

## Krok 3: Konfiguracja repozytoriów

Jeśli `settings.json` nie ma skonfigurowanych `additionalDirectories`:

```
Skonfiguruj repozytoria migracji:
  sdd dirs add <ścieżka-repo-źródłowego>
  sdd dirs add <ścieżka-repo-docelowego>
  sdd dirs add <ścieżka-repo-referencyjnego>   (opcjonalne)
```

---

## Krok 4: Potwierdzenie

```markdown
## Konfiguracja migracji — gotowa

| Element | Wartość |
|---------|--------|
| Preset | {nazwa lub "custom"} |
| Source | {technologia} |
| Target | {technologia} |
| Reguł | {N} |
| Preset file | .claude/migrate.preset.md |

Gotowy do migracji. Użyj:
  /migrate <plik> --propose    → analiza i plan
  /migrate <plik>              → pełna migracja
```

---

## Zasady

- 🚫 NIE commituj — informuj co scommitować
- ✅ Preset musi istnieć przed pierwszą migracją
- ✅ Przy ręcznej definicji — generuj szkielet, nie wymuszaj pełnej specyfikacji od razu
- ✅ Reguły będą się uzupełniać w trakcie migracji (po /migrate-fix, po CR)
