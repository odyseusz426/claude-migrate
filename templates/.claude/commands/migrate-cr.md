---
description: Aplikuje uwagi z Code Review do zmigrowanych plików
argument-hint: [--file <ścieżka do pliku>]
---

# /migrate-cr — Poprawki po Code Review

**Cel:** Przeanalizuj uwagi z Code Review i wprowadź poprawki w zmigrowanych plikach, zachowując spójność ze standardami projektu.

```
/migrate-cr [--file <ścieżka>]
```

Parametry:
- `--file <ścieżka>` — plik którego dotyczy CR (opcjonalne — agent sam zidentyfikuje)
- Uwagi z CR — użytkownik wkleja je po wywołaniu komendy

---

## Krok 0: Walidacja

```
Czy .claude/migrate.preset.md istnieje?
  NIE → "Uruchom /migrate setup najpierw" → STOP
  TAK → kontynuuj
```

---

## Krok 1: Zebranie uwag

Jeśli użytkownik nie wkleił uwag z CR:
→ Zapytaj: "Wklej uwagi z Code Review (komentarze reviewerów)."

---

## Krok 2: Analiza w sesji głównej (BEZ subagenta)

1. **Przeczytaj pliki dotknięte CR** — zidentyfikuj z uwag
2. **Przeczytaj `.claude/migrate.preset.md`** — konwencje do zastosowania
3. **Przeczytaj `ai/docs/`** z docelowego repo — testing-patterns, conventions
4. **Przeczytaj `ai/docs/patterns/infrastructure-inventory.md`** — co reużyć

---

## Krok 3: Delegacja do `migration-cr`

Deleguj do subagenta `migration-cr`:

```
Prompt:
Przeanalizuj uwagi z Code Review i wprowadź poprawki.

## Uwagi z CR
{wklejone uwagi}

## Pliki do poprawki
{treść plików — wklej zamiast kazać agentowi czytać}

## Kontekst projektowy
{zwięzłe podsumowanie reguł z presetu i ai/docs/ — TYLKO relevantne}

## Istniejąca infrastruktura (jeśli relevantna)
{components do reużycia}
```

---

## Krok 4: Prezentacja i zapis

1. **Wyświetl** listę uwag i plan zmian
2. **Czekaj na akceptację**
3. Po `tak` → zapisz pliki
4. Podsumuj co scommitować

```markdown
## CR Poprawki: {nazwa} — ✅ Gotowe

| Plik | Zmiana |
|---|---|

### Do scommitowania:
- `git add {lista plików}`
- Sugerowany message: `fix(tests): apply CR feedback for {nazwa}`
```

---

## Zasady

- 🚫 NIE commituj — informuj co scommitować
- 🚫 NIE nadpisuj bez potwierdzenia
- ✅ Propaguj poprawki spójnie — konwencja we WSZYSTKICH plikach
- ✅ Stosuj konwencje z presetu
- ✅ Reużywaj istniejące components
