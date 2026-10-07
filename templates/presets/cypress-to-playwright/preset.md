# Migration Preset: Cypress → Playwright

preset_version: 1.0.0

> Ten plik jest automatycznie czytany przez agentów migracyjnych.
> Zawiera reguły, wzorce i mapowania specyficzne dla migracji Cypress → Playwright.

## Source Technology: Cypress

- Pliki testowe: `.cy.ts`
- Custom commands: `cy.addFreight(token, payload)`, `cy.publishFreightSpot(...)`, etc.
- Auth: OAuth JWT token z `Cypress.env('TFS').token`
- Polling: `pollPublicationActiveWait(() => cy.getPublicationById(...), interval, timeout)` — recursive helper
- Asercje: Chai (`expect(status).to.eq(201)`) — w test body, helperach, commandach (brak separacji)
- Kontekst Mocha: `this.freightId` — zmienne między hookami
- Aliasy: `cy.get('@auctionId')` — asynchroniczne referencje
- Config: `Cypress.env('TFS')` — obiekt z `token`, `transId`, `xUserId`, `companyId`
- Skip: `skipOn(prod)` — plugin
- Parametryzacja: `describe.each(array)` — plugin `cypress-each`
- Dane: builders z npm (`makeAfganistanFreight()`) — black-box

## Target Technology: Playwright

- Pliki testowe: `.spec.ts`
- Import: `import { test, expect } from '@playwright/test'`
- Fixture: `async ({ request }) =>` — destructuring
- Auth: `xUserId` (number) z `config.env.TFS.xUserId` — header `X-User-Id`
- Polling: `expect.poll(async () => ..., POLL_CONFIG).toBe(...)` — natywny Playwright
- Asercje: `expect.soft()` w testach, `expect(expectedStatusCodes).toContain(response.status())` w serwisach
- Config: `config.env.TFS` z `loadConfig()` — `{ xUserId, companyId, transId, password }`
- Skip: `test.skip(config.env.environment === 'prod', 'Skipped on PROD')`
- Parametryzacja: `interface I*TestCase` + tablica + `for...of` loop — natywny JS
- Dane: `buildAfganistanFreightPayload(overrides?)` — lokalne, `deepMerge`, pełna kontrola

## Mapowanie wzorców Source → Target

| Aspekt | Cypress | Playwright |
|--------|---------|-----------|
| HTTP calls | `cy.addFreight(token, payload)` — custom commands | `createFreight(request, xUserId, payload)` — `src/services/` |
| Auth | `token` (JWT) | `xUserId` (number) — header `X-User-Id` |
| Polling | `pollPublicationActiveWait(...)` recursive | `expect.poll(async () => ..., POLL_CONFIG)` natywny |
| Asercje | Chai `expect().to.eq()` wszędzie | `expect.soft()` w testach, status check w serwisach |
| Test ID | `{ env: { jiraId: 'TT-XXXXX' } }` w `it()` options | `JiraId('TT-XXXXX')` jako drugi arg `test()` |
| Steps | `.then()` chains, nested callbacks | `test.step('Step N: ...', async () => {})` |
| Cleanup | Implicit / brak | `test.afterEach` z permissive status codes |
| Factories | `makeX()` z npm — black-box | `buildXPayload(overrides?)` — lokalne, `deepMerge` |
| Config | `Cypress.env('TFS')` | `config.env.TFS` z `loadConfig()` |
| Kontekst | `this.` (Mocha) | `let` w scope `describe` |
| Aliasy | `cy.get('@name')` | `let name = await ...` |
| Skip | `skipOn(prod)` | `test.skip(condition, reason)` |

## Architektura docelowa (warstwy)

```
tests/api/                     # Testy — expect, poll, test.step
src/helpers/                   # Helpery — logika, orchestracja, BEZ expect/poll
src/services/                  # Serwisy — HTTP, JEDYNE miejsce z expect na status
src/factories/                 # Factories — budowanie payloadów
src/fixtures/                  # Dane testowe per environment
src/models/                    # Interfejsy TypeScript
src/enums/                     # Enumy (wartości API)
src/configs/                   # Konfiguracja environments i kont
```

| Warstwa | `expect()` | `expect.poll()` | Rola |
|---------|-----------|-----------------|------|
| **Testy** (`.spec.ts`) | TAK | TAK | Asercje i weryfikacja statusów |
| **Helpery** (`src/helpers/`) | NIE | NIE | Logika, orchestracja, zwracanie danych |
| **Serwisy** (`src/services/`) | TAK (tylko status HTTP) | NIE | `expect(expectedStatusCodes).toContain(response.status())` |
| **Factories** | NIE | NIE | Budowanie payloadów |

## Konwencje docelowe

### Nazewnictwo i język

| Element | Język | Przykład |
|---------|-------|---------|
| Tytuł testu | Polski BEZ diakrytyków | `[TT-12876] Jako nadawca powinienem moc usunac fracht` |
| Step names | Angielski | `Step 1: Create freight and verify` |
| beforeEach/afterEach | Angielski | `Create and publish freight` |
| Pliki | camelCase | `automatedRules.spec.ts` |
| Interfejsy | `I` prefix + PascalCase | `IContractTestCase` |
| Enumy | PascalCase | `NegotiationStatus` |
| Enum values | SCREAMING_SNAKE | `CHOOSE_CARRIER` |
| Zmienne | camelCase | `freightId` |

### Pliki

| Typ | Konwencja | Przykład |
|-----|-----------|---------|
| Test | `camelCase.spec.ts` | `automatedRules.spec.ts` |
| Service | `camelCase.service.ts` | `freights.service.ts` |
| Factory | `camelCase.factory.ts` | `freights.factory.ts` |
| Helper | `camelCase.helper.ts` | `freightStatus.helper.ts` |
| Model | `camelCase.model.ts` | `freight.model.ts` |
| Enum | `camelCase.enums.ts` | `freight.enums.ts` |
| Barrel | `index.ts` | w każdym katalogu |

### JiraId — obowiązkowe

```ts
import { JiraId } from '@trans-test-automation/playwright-core';

test(
  `[${tc.jiraId}] Jako nadawca ${TFS.transId} powinienem moc ...`,
  JiraId(tc.jiraId),
  async ({ request }) => { ... },
);
```

- Format: `` `TT-${number}` ``
- W tytule: `[TT-12876]` na początku
- Jako argument: `JiraId('TT-12876')` — ZAWSZE drugi argument `test()`

### POLL_CONFIG — obowiązkowy

```ts
import { POLL_CONFIG } from '@/helpers';

await expect
  .poll(async () => {
    const { body } = await getPublicationById(request, TFS.xUserId, publicationId, Product.TFS);
    return body.status;
  }, POLL_CONFIG)
  .toBe(PublicationStatus.ACTIVE);
```

Definicja: `{ timeout: 30_000, intervals: [2_000] }`. **NIGDY bez POLL_CONFIG.**

### beforeEach / afterEach

- **beforeEach:** create freight + publish + poll ACTIVE + setup exchanges
- **afterEach:** cleanup WSZYSTKICH stworzonych zasobów — nie tylko `freightId` z beforeEach, ale też zasoby tworzone w test body
- **test body:** specyficzna akcja + asercje + warunkowy poll

**Wzorzec cleanup — tracking wielu IDs:**
```ts
const createdFreightIds: number[] = [];

test.beforeEach('Create freight', async ({ request }) => {
  const body = await createFreight(request, TFS.xUserId, payload);
  freightId = body.id;
  createdFreightIds.push(freightId);
});

test.afterEach('Cleanup freights', async ({ request }) => {
  for (const id of createdFreightIds) {
    await deleteFreight(request, TFS.xUserId, id, [StatusCodes.NO_CONTENT, StatusCodes.NOT_FOUND]);
  }
  createdFreightIds.length = 0;
});
```
Jeśli test tworzy dodatkowe zasoby (np. drugi freight w mass action) — dodaj ID do tablicy: `createdFreightIds.push(secondFreightId)`.
**NIGDY nie czyść tylko jednego zasobu gdy testy mogą tworzyć wiele.**

### Parametryzacja

```ts
interface IRuleTestCase {
  jiraId: `TT-${number}`;
  description: string;
  makeRule: (...) => ReturnType<...>;
  skipOnProd?: boolean;
}

const testCases: IRuleTestCase[] = [ ... ];

testCases.forEach((tc) => {
  test(`[${tc.jiraId}] ... - ${tc.description}`, JiraId(tc.jiraId), async ({ request }) => {
    if (tc.skipOnProd) test.skip(config.env.environment === 'prod', 'Skipped on PROD');
  });
});
```

### Negocjacje — wzorzec

```ts
// Carrier accepts → verify CHOOSE_CARRIER
await negotiationActions.accept(TFC, TFS);
await expect
  .poll(async () => getFreightNegotiationStatus(request, TFS.xUserId, freightId), POLL_CONFIG)
  .toBe(NegotiationStatus.CHOOSE_CARRIER);

// Shipper accepts → verify ACCEPTED
await negotiationActions.accept(TFS, TFC);
await expect
  .poll(async () => getFreightNegotiationStatus(request, TFS.xUserId, freightId), POLL_CONFIG)
  .toBe(NegotiationStatus.ACCEPTED);
```

### Serwisy — wzorzec

```ts
export const createFreight = async (
  request: APIRequestContext, xUserId: number, payload: IFreightPayload,
  expectedStatusCodes: StatusCodes[] = [StatusCodes.CREATED],
): Promise<T> => {
  const response = await request.post(url, { data: payload, headers });
  expect(expectedStatusCodes).toContain(response.status());
  return (await response.json()) as T;
};
```

### Factories — wzorzec

```ts
export const buildAfganistanFreightPayload = (
  overrides?: Partial<IFreightPayload>,
): IFreightPayload => deepMerge(buildBaseFreightPayload([...spots]), overrides);
```

## Krytyczne reguły migracji (z realnych błędów)

1. **Daty**: `dayjs().add(N, 'day').format()` — NIGDY `.toISOString()`. API odrzuca UTC z `Z`
2. **Base URL**: config pola (`apiFreightsHost` itd.) już zawierają `/api/rest/` — w service TYLKO `v2/xxx`
3. **Config fields**: konta to `transId`/`xUserId`/`companyId` — NIE `login`/`accountId`. URL-e to `apiFreightsHost`
4. **Response verify**: API zwraca dodatkowe pola — `expect.objectContaining({ ...payload.field })` z spread
5. **ESLint `playwright/prefer-to-have-length`**: na `body.length` (IMeasure) — wyciągnij do zmiennej zamiast `eslint-disable`:
   ```ts
   // CORRECT — zmienna omija regułę ESLint bez komentarza disable
   const freightLength = body.length;
   expect.soft(freightLength).toEqual(expect.objectContaining({ ...payload.length }));
   
   // WRONG — eslint-disable to ostateczność
   // eslint-disable-next-line playwright/prefer-to-have-length
   expect.soft(body.length).toEqual(expect.objectContaining({ ...payload.length }));
   ```
6. **Status codes**: `await expect(response).toBeOK()` dla 200, `expect(response.status()).toBe(StatusCode.XXX)` dla 201/204/404
7. **Enum VALUES nie nazwy**: NIGDY `'in_advance'` — sprawdź wartość (`PaymentPeriod.IN_ADVANCE = '2_payment_in_advance'`). Dotyczy: PaymentPeriod, Sources, PublicationType, SettlementBasis
8. **load_id**: `crypto.randomUUID()` w `loads[]` TYLKO dla multispot (`multi_stops: true`)
9. **ListTFS/ListTFC**: testy cleanup i list MUSZĄ używać `config.env.ListTFS`/`config.env.ListTFC`
10. **User-Agent per endpoint**: v1 invitations wymaga `User-Agent: 'invitations/*'`
11. **Factory selection**: `buildFtlFreightTonPayload` ≠ `buildMultiFtlFreightTonPayload`
12. **Fixtures per environment**: Cypress ma osobne pliki per env z RÓŻNYMI route IDs. NIGDY `rcData = devData`
13. **Typy obiektowe**: Contract route = `{ id, name }` (nie string). Exchange = `{ id, name }`
14. **Helper accounts**: `PublicationSwitcher` i podobne muszą przyjmować konta jako parametry
15. **POLL_CONFIG OBOWIĄZKOWY**: NIGDY `expect.poll()` bez POLL_CONFIG
16. **Helpery BEZ expect/poll**: `src/helpers/` NIGDY nie zawierają expect ani expect.poll
17. **JiraId OBOWIĄZKOWY**: `JiraId('TT-XXXXX')` jako DRUGI argument `test()`. Tytuł po polsku BEZ diakrytyków
18. **beforeEach dla powtarzalnego setup**: create + publish + poll ACTIVE → beforeEach
19. **Parametryzacja**: powtarzalne testy → `I*TestCase` + tablica + for loop
20. **Mass action >1 element**: testy "mass action" (np. `deleteFreights`) MUSZĄ operować na >1 elemencie — usunięcie jednego nie testuje masowości. Twórz dodatkowe zasoby w test body i dodaj je do tablicy cleanup
21. **Generic types na service calls**: gdy test operuje na `body` (odczytuje pola) — ZAWSZE podaj generic type: `getFreightById<IFreightPayload>(...)`. Bez generica `body` to `Record<string, unknown>` i brak typowania
22. **Importy z barrel**: `from '@/helpers'` (barrel) — NIE `from '@/helpers/utils'` (bezpośredni). Barrel jest konwencją projektu. Wyjątek: gdy importujesz coś co NIE jest wyeksportowane w barrel
23. **Nazwy zmiennych — intencja, nie lokalizacja**: `initialFreightPayload` / `updatedFreightPayload` — NIE `freightAfganistan` / `freightKotka`. Nazwy powinny opisywać rolę w teście, nie dane geograficzne z factory
24. **expect.soft konsekwentnie**: w testach API używaj `expect.soft()` dla WSZYSTKICH asercji na body/status — nie mieszaj `expect()` i `expect.soft()` w tym samym teście. Hard `expect()` rezerwuj dla warunków blokujących dalsze kroki (np. sprawdzenie że zasób istnieje przed operacją na nim)
25. **afterEach — warunkowy cleanup z cancel+archive**: w testach negocjacji afterEach MUSI sprawdzić status publikacji (`pubBody.status === 'active'`) przed `cancelPublication` + `archiveFreight`. Bezwarunkowe cancel na anulowanej publikacji = błąd. Wzorzec:
    ```ts
    test.afterEach('Cancel publication and archive freight', async ({ request }) => {
      const { body: pubBody } = await getPublicationById(request, TFS.xUserId, publicationId, Product.TFS);
      if (pubBody.status === 'active') {
        await cancelPublication(request, TFS.xUserId, publicationId);
        await archiveFreight(request, TFS.xUserId, freightId);
      }
    });
    ```
26. **Inline assertion helpers**: gdy test powtarza złożoną asercję (np. sprawdź cenę w liście negocjacji), wyciągnij do `const` function NA POZIOMIE PLIKU (nie klasy) z `expect.soft` wewnątrz. Wzorzec z `multipleCarriers.spec.ts`:
    ```ts
    const assertPriceList = (body: INegotiationsListResponse, payment: IPayment, index = 0): void => {
      const n = body._embedded.negotiations[index];
      expect.soft(n).toBeTruthy();
      if (!n) return;
      expect.soft(n.price.value).toBe(payment.price.value);
    };
    ```
27. **History verification pattern**: weryfikacja historii negocjacji — buduj tablicę expected events w odwrotnej kolejności (od najnowszego), potem iteruj `forEach((expected, i) => expect(history[i]).toEqual(expect.objectContaining(expected)))`. ZAWSZE sprawdź z OBU stron (TFS i TFC)
28. **env-conditional parametryzacja — ternary pattern**: dla skomplikowanego filtrowania per env, zamiast `let arr = [...]; if (prod) arr = [...]` użyj ternary `(env === 'prod' ? [...prod cases...] : [...all cases...]).forEach(...)` — czytelniejsze gdy test cases mają strukturę obiektową z jiraId
29. **test.beforeAll vs test.beforeEach**: `beforeAll` dla ONE-TIME setup (exchange members, SafePay tags, fetch all data for list tests). `beforeEach` dla PER-TEST setup (create freight + publish). Cypress `before()` → Playwright `beforeAll`, Cypress `beforeEach()` → Playwright `beforeEach`. NIGDY nie twórz frachtu w `beforeAll` — to shared state między testami
30. **IssueId type**: `as IssueId` (import z `playwright-core`) do type assertion na Jira ID w parametryzacji. Wzorzec: `jiraId: 'TT-17709' as IssueId`
31. **test.skip wewnątrz test body**: `test.skip(condition, reason)` jako PIERWSZA linia test body (po destructuring). NIE w beforeEach, NIE za test.step. Wzorzec: `test.skip(env.toLowerCase() === 'prod', 'Skipped on PROD')`
32. **nullPayment pattern**: gdy API pozwala na null w cenie (initial publication bez ceny) — `{ price: { currency: null as unknown as string, value: null } }`. NIE pomijaj pól — API wymaga pełnej struktury
33. **Inline generic types na service calls**: gdy odpowiedź ma niestandardową strukturę — definiuj typ inline: `getNegotiationsList<{ _embedded: { negotiations: { id: string }[] } }>(...)`. NIE twórz interfejsu dla jednorazowych typów
34. **exchangeManageHelper w beforeEach/beforeAll**: setup exchange members MUSI być PRZED publikacją. Jeśli w `beforeAll` (z `setTimeout` delay 10s po dodaniu) — to one-time. Jeśli w `beforeEach` per publication type — to per-test. Cypress `before()` z `addMemberToCorporateExchange` → Playwright `beforeEach`/`beforeAll` z `exchangeManageHelper`
35. **Permissive codes w cleanup — pełna lista**: `[StatusCodes.NO_CONTENT, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN]` dla deleteFreight. `[StatusCodes.CREATED, StatusCodes.UNPROCESSABLE_ENTITY]` dla cancelPublication. `[StatusCodes.CREATED, StatusCodes.FORBIDDEN]` dla archiveFreight. NIE pomijaj FORBIDDEN — inny test mógł zaakceptować fracht
36. **describe name — descriptive, not test class name**: `test.describe('Freight actions', ...)` — NIE `test.describe('FreightsActionsTest', ...)`. Nazwa po angielsku, descriptive, bez suffixu "Test"
37. **POLL_CONFIG_LONG dla conversation/sequential**: `POLL_CONFIG_LONG` (`{ timeout: 60_000, intervals: [2_000] }`) używaj zamiast `POLL_CONFIG` dla: `getConversationHasNegotiation`, `getFirstReceiverStatus` i inne operacje wymagające dłuższego oczekiwania (negocjacje z kontraktami, sequential). Import z `@/helpers`
38. **NegotiationActions — instancja w test body**: `new NegotiationActions(request, freightId, auctionId, offerId)` ZAWSZE wewnątrz `test.step` w test body — NIGDY w beforeEach. Powód: wymaga `auctionId`/`offerId` które powstają dopiero po publikacji w test flow
39. **`import { type X }` syntax**: ZAWSZE używaj `type` keyword dla importów interfejsów/typów: `import { type IFreightPayload } from '@/models'`. Nie `import { IFreightPayload }`. Konwencja TypeScript — oddziela typy od wartości runtime
40. **`Object.values(Enum).forEach()` dla pełnej parametryzacji**: gdy test weryfikuje WSZYSTKIE wartości enuma (np. filtrowanie po truck bodies, load types) — `Object.values(TruckBodies).forEach((value) => { test(...) })`. NIE hardcoduj listy — zmiany enuma = automatycznie nowe testy
41. **List/filter testy — asercje na COUNT, nie treść**: testy listowania/filtrowania sprawdzają tylko `body.total_count > 0` lub `body.total_count >= expectedCount`. NIE sprawdzaj treści elementów listy — inne testy mogą dodawać/usuwać dane. Sort testy sprawdzają kolejność (np. daty malejąco)
42. **Cleanup spec — bez JiraId, polskie nazwy**: pliki `massDeleteFreight.spec.ts` i podobne cleanup utility specs NIE używają `JiraId()`. Tytuły testów po polsku w formie imperatywnej: `'Usun frachty dla konta ListTFS'`. Cleanup operuje na paginacji i iteruje po stronach

## Dokumentacja docelowego repo (do czytania)

| Plik | Po co |
|------|-------|
| `ai/docs/patterns/testing-patterns.md` | ŹRÓDŁO PRAWDY o wzorcach testowych |
| `ai/docs/patterns/migration-rules.md` | Reguły z poprzednich migracji |
| `ai/docs/patterns/infrastructure-inventory.md` | Co już istnieje — nie duplikuj |
| `ai/docs/conventions/naming.md` | Konwencje nazewnictwa |
| `ai/docs/conventions/code-style.md` | Styl kodu |

## Dokumentacja source repo (Cypress, do czytania)

| Plik | Po co |
|------|-------|
| `ai/docs/patterns/config-patterns.md` | Struktura env, API hosts, auth, accounts |
| `ai/docs/patterns/testing-patterns.md` | Custom commands, polling, builders |
| `ai/docs/patterns/architecture.md` | Struktura katalogów, moduły |

## Debug — znane pułapki (dla /migrate-fix)

| # | Pułapka | Jak sprawdzić |
|---|---------|---------------|
| 1 | Enum wartości | Grep po hardcoded stringach w payloadach. Porównaj z enumami |
| 2 | Fixtures per env | Czy `rcData = devData`? Porównaj z Cypress fixtures |
| 3 | Typ parametru | String zamiast `{ id, name }` obiektu? Sprawdź `.d.ts` |
| 4 | Konta testowe | `TFS` zamiast `ListTFS`? Sprawdź `Cypress.env()` |
| 5 | User-Agent | Endpoint v1 ze specjalnym headerem? |
| 6 | load_id | Factory dodaje `load_id` do zwykłego frachtu? |
| 7 | Factory selection | Factory pasuje do typu frachtu? (FTL vs multiFTL) |
| 8 | Date format | `dayjs().format()` vs `.toISOString()`? |
| 9 | Base URL | Podwojone `/api/rest/`? |
| 10 | Polling timeout | Domyślne 5s zamiast 30s? |
| 11 | Asercja Cypress | Cypress test asertuje poprawnie? (`.excluding()` bez `.to.equal()` = no-op) |
