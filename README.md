# @odyseusz426/claude-migrate

Rozszerzenie SDD Framework — toolkit migracji testów Cypress do Playwright dla Claude Code.

## Wymagania

- `@odyseusz426/claude-npm-sdd` zainstalowany i zainicjalizowany (`sdd init`)

## Instalacja

```bash
# Skonfiguruj registry (jednorazowo)
echo "@odyseusz426:registry=https://npm.pkg.github.com" >> ~/.npmrc

# Zainstaluj globalnie
npm i -g @odyseusz426/claude-migrate
```

## Użycie

```bash
# W katalogu projektu (po sdd init):
claude-migrate init               # kopiuje agentów i komendy migracyjne
claude-migrate init --force       # nadpisuje istniejące pliki
claude-migrate --version          # wersja paczki
```

## Po instalacji

Skonfiguruj repozytoria migracji:
```bash
sdd dirs add ../cypress-e2e-tests           # repo Cypress (źródło)
sdd dirs add ../playwright-tests            # repo Playwright (cel)
sdd dirs add ../playwright-core             # core library
sdd dirs add ../reference-playwright-repo   # repo referencyjne (wzorce)
```

## Komendy

| Komenda | Cel |
|---------|-----|
| `/migrate` | Migracja pliku Cypress → Playwright (analiza + generowanie + review) |
| `/migrate-cr` | Poprawki po Code Review do zmigrowanych testów |
| `/migrate-fix` | Debug i naprawa failujących zmigrowanych testów |
| `/migrate-split` | Podział brancha migracyjnego na atomowe MR per klasa testowa |

## Agenci

| Agent | Rola | Model |
|-------|------|-------|
| `migration-analyzer` | Analiza pliku Cypress | sonnet |
| `migration-spec-writer` | Generowanie kodu Playwright | sonnet |
| `migration-supervisor` | Review kompletności i spójności | opus |
| `migration-cr` | Poprawki po Code Review | sonnet |
| `migration-split` | Podział na atomowe branche | sonnet |

## Flow migracji

```
/migrate cypress/spec.cy.ts
  → migration-analyzer (analiza Cypress)
  → migration-spec-writer (generowanie Playwright)
  → migration-supervisor (review)
  → Code Review zespołu
  → /migrate-cr (poprawki)
  → /migrate-split (podział na MR)
```

## Licencja

MIT
