# Playwright API Testing Patterns

> Wzorce dla projektów testów API (Playwright + TypeScript) używanych w Freight Service i pokrewnych projektach migrowanych z Cypress.

## Architektura warstw

```
tests/api/                     # Testy — expect, poll, test.step
src/helpers/                   # Helpery — logika, orchestracja, BEZ expect/poll
src/services/                  # Serwisy — wywołania HTTP, JEDYNE miejsce z expect na status HTTP
src/factories/                 # Factories — budowanie payloadów
src/fixtures/                  # Dane testowe per środowisko
src/models/                    # Interfejsy TypeScript
src/enums/                     # Enumy (wartości API)
src/configs/                   # Konfiguracja środowisk i kont
```

## Zasada: gdzie expect, gdzie nie

| Warstwa | `expect()` | `expect.poll()` | Rola |
|---------|-----------|-----------------|------|
| **Testy** (`.spec.ts`) | TAK | TAK | Asercje i weryfikacja statusów |
| **Helpery** (`src/helpers/`) | NIE | NIE | Logika, orchestracja, zwracanie danych |
| **Serwisy** (`src/services/`) | TAK (tylko status HTTP) | NIE | `expect(expectedStatusCodes).toContain(response.status())` |
| **Factories** | NIE | NIE | Budowanie payloadów |

**Kluczowa zasada:** helpery NIGDY nie zawierają expect ani poll. Zwracają dane — test decyduje co zweryfikować.

**Wyjątek:** Orchestratory typu `PublicationSwitcher` mogą zawierać wewnętrzny poll gdy zarządzają wieloma krokami publikacji.

## POLL_CONFIG — globalna konfiguracja pollingu

```ts
// src/helpers/utils/poll.config.ts
export const POLL_CONFIG = { timeout: 30_000, intervals: [2_000] };
```

**ZAWSZE** przekazywany jako drugi argument `expect.poll()`:

```ts
await expect
  .poll(async () => {
    const { body } = await getPublicationById(request, TFS.xUserId, publicationId, Product.TFS);
    return body.status;
  }, POLL_CONFIG)
  .toBe(PublicationStatus.ACTIVE);
```

**Nigdy nie używaj `expect.poll()` bez `POLL_CONFIG`.**

## Wzorce helperów

### 1. Prosta funkcja (preferowany)

```ts
export const getFreightNegotiationStatus = async (
  request: APIRequestContext, xUserId: number, freightId: number,
): Promise<string> => {
  const { body } = await getFreightById(request, xUserId, freightId, Product.TFS);
  return body.negotiation_status;
};
```

### 2. Orchestrator z callbackiem

```ts
export const setupFreightAndPublish = async (
  request: APIRequestContext,
  buildPublicationPayload: (freightId: number) => IPublicationPayload,  // callback rozwiązuje chicken-and-egg
  freightPayload: IFreightPayload = buildAfganistanFreightPayload(),
): Promise<ISetupFreightAndPublishResult> => {
  const freightBody = await createFreight(request, TFS.xUserId, freightPayload);
  const pubBody = await publishFreightSpot(request, TFS.xUserId, buildPublicationPayload(freightBody.id));
  return { freightId: freightBody.id, publicationId: pubBody.id, auctionId: pubBody.auction_id, pubBody };
};
```

### 3. Builder pattern

```ts
const rule = new AutomatedRuleMaker()
  .withCorporateExchange()
  .withPrivateExchange()
  .makeRule(freightId, { is_first_buy: true });
```

### 4. Klasa ze stanem (NegotiationActions)

```ts
const negotiationActions = new NegotiationActions(request, freightId, auctionId, offerId);
await negotiationActions.accept(TFC, TFS);   // wewnętrzny version counter
await negotiationActions.accept(TFS, TFC);
```

### 5. Exchange manage helper (check-and-add z boolean return)

```ts
const memberAdded = await exchangeManageHelper(
  request, companyId, [CorporateExchangeRoles.MANDATORY],
  ExtendPublicationType.CORPORATE_EXCHANGE, corporateExchangeId,
);
if (memberAdded) await new Promise((r) => setTimeout(r, 10_000));
```

## Parametryzacja testów

### Pattern 1: Tablica test case'ów z interfejsem

```ts
interface IRuleTestCase {
  jiraId: `TT-${number}`;
  description: string;
  makeRule: (freightId: number, terms: typeof initialPublicationTerms) => ReturnType<AutomatedRuleMaker['makeRule']>;
  skipOnProd?: boolean;
}

const ruleTestCases: IRuleTestCase[] = [
  { jiraId: 'TT-17709', description: 'gielda korporacyjna',
    makeRule: (id, terms) => new AutomatedRuleMaker().withCorporateExchange().makeRule(id, terms) },
];

ruleTestCases.forEach((tc) => {
  test(`[${tc.jiraId}] ... - ${tc.description}`, JiraId(tc.jiraId), async ({ request }) => {
    if (tc.skipOnProd) test.skip(config.env.environment === 'prod', 'Skipped on PROD');
  });
});
```

### Pattern 2: Pętla po wartościach z describe (forEach)

```ts
spotPublications.forEach((publishType) => {
  test.describe(`Publication cancellation - ${publishType}`, () => {
    test.beforeEach('Create and publish freight', async ({ request }) => { ... });
    test.afterEach('Delete freight', async ({ request }) => { ... });
    test(`[TT-22726] Anuluj publikacje`, JiraId('TT-22726'), async ({ request }) => { ... });
  });
});
```

### Pattern 3: Env-conditional filtering

```ts
let spotPublications: SpotPublicationType[] = [...all types...];
if (equalsIgnoreCase(env, 'PROD')) {
  spotPublications = [SpotPublicationType.PRIVATE_EXCHANGE];
}
```

### Pattern 4: Callbacki i flagi w interfejsie (gdy logika się różni)

```ts
interface IAddReceiverTestCase {
  jiraId: `TT-${number}`;
  buildPayload: (freightId: number, receiver: boolean) => IPublicationPayload;
  addReceiver: (request: APIRequestContext, publicationId: number) => Promise<void>;
  pollBeforeAdd: boolean;
}
```

## beforeEach / afterEach

### Co idzie do beforeEach
- Tworzenie frachtu (`createFreight`)
- Publikacja (`publishFreightSpot` / `PublicationSwitcher`)
- Poll na ACTIVE status
- Setup giełd (dodawanie członków)

### Co idzie do afterEach
- Cleanup: `deleteFreight` z permissive status codes `[NO_CONTENT, NOT_FOUND, FORBIDDEN]`

### Co zostaje w teście
- Specyficzna akcja testowa
- Asercje na wynik akcji
- Warunkowe expect.poll na zmianę statusu

## Wzorzec negocjacji

**Schemat: akcja → weryfikacja statusu (expect.poll). Zawsze.**

```ts
await test.step('Step 4: Carrier accepts and verify CHOOSE_CARRIER', async () => {
  const negotiationActions = new NegotiationActions(request, freightId, auctionId, offerId);
  await negotiationActions.accept(TFC, TFS);
  await expect
    .poll(async () => getFreightNegotiationStatus(request, TFS.xUserId, freightId), POLL_CONFIG)
    .toBe(NegotiationStatus.CHOOSE_CARRIER);
});

await test.step('Step 5: Shipper accepts and verify ACCEPTED', async () => {
  const negotiationActions = new NegotiationActions(request, freightId, auctionId, offerId);
  await negotiationActions.accept(TFS, TFC);
  await expect
    .poll(async () => getFreightNegotiationStatus(request, TFS.xUserId, freightId), POLL_CONFIG)
    .toBe(NegotiationStatus.ACCEPTED);
});
```

## Serwisy — wzorzec

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

## Factories — wzorzec

```ts
export const buildAfganistanFreightPayload = (
  overrides?: Partial<IFreightPayload>,
): IFreightPayload => deepMerge(buildBaseFreightPayload([...spots]), overrides);
```

- Nazwa: `build*Payload`
- Opcjonalne `Partial<T>` overrides mergowane przez `deepMerge()`

## JiraId — integracja z Jira/Xray

Każdy test MUSI mieć `JiraId()` jako drugi argument:

```ts
import { JiraId } from '@trans-test-automation/playwright-core';

test(
  `[${tc.jiraId}] Jako nadawca ${TFS.transId} powinienem moc opublikowac fracht - ${tc.description}`,
  JiraId(tc.jiraId),
  async ({ request }) => { ... },
);
```

### Reguły JiraId

- **Format:** `` `TT-${number}` `` (template literal type w interfejsach)
- **W tytule testu:** zawsze w nawiasach kwadratowych na początku: `[TT-12876]`
- **Jako argument:** `JiraId('TT-12876')` — ZAWSZE drugi argument `test()`
- **W parametryzacji:** pole `jiraId` w interfejsie test case
- **Nie pomijaj:** reviewer odrzuci test bez JiraId

```ts
interface IRuleTestCase {
  jiraId: `TT-${number}`;  // template literal type!
  description: string;
  // ...
}
```

## Nazewnictwo — język (PL vs EN)

### Co po polsku

| Element | Przykład | Uwaga |
|---------|---------|-------|
| **Tytuł testu** | `"[TT-12876] Jako nadawca 1173260-1 powinienem moc opublikowac fracht z regula automatyczna - kontrakt trasa"` | BEZ polskich znaków diakrytycznych (ą→a, ę→e, ś→s, etc.) |
| **Test case `description`** | `'gielda korporacyjna'`, `'kontrakt palety'` | Krótki opis wariantu |
| **describe block** (opcjonalnie) | `'Freight automated rules - contracts'` | Angielski OK, ale dopuszczalny polski |

### Co po angielsku

| Element | Przykład | Uwaga |
|---------|---------|-------|
| **Step names** | `"Step 1: Create freight and verify it was created"` | Zawsze numerowane `Step N:` |
| **beforeEach/afterEach** | `"Create and publish freight"`, `"Delete freight"` | Krótki opis akcji |
| **Nazwy plików** | `automatedRulesContracts.spec.ts` | camelCase |
| **Zmienne** | `freightId`, `publicationId`, `auctionId` | camelCase |
| **Interfejsy** | `IContractTestCase`, `IPayment` | PascalCase z `I` prefix |
| **Enumy** | `NegotiationStatus`, `PublicationStatus` | PascalCase |
| **Enum values** | `CHOOSE_CARRIER`, `IN_PROGRESS` | SCREAMING_SNAKE_CASE |
| **Komentarze w kodzie** | `// Ensure TFC2 is a member` | Angielski |
| **Helper/service nazwy** | `getFreightNegotiationStatus()`, `createFreight()` | camelCase |

### Dlaczego tak?

- **Tytuły testów po polsku** — raportowanie w Jira/Xray jest po polsku, reviewer widzi polskie tytuły
- **Bez diakrytyków** — unikamy problemów z encoding w raportach i CI
- **Kod po angielsku** — standard branżowy, czytelność dla wszystkich

## Konta testowe

```ts
const TFS = config.env.TFS;   // Shipper (nadawca/spedytor)
const TFC = config.env.TFC;   // Carrier (przewoźnik)
const TFF = config.env.TFF;   // Second carrier / forwarder
```

Każde konto: `{ xUserId, companyId, transId, password }`.

## Mapowanie Cypress → Playwright (kluczowe zmiany)

| Aspekt | Cypress | Playwright |
|--------|---------|-----------|
| **HTTP calls** | `cy.addFreight(token, payload)` — custom commands z npm module | `createFreight(request, xUserId, payload)` — lokalne `src/services/` z `async/await` |
| **Auth** | `token` (OAuth JWT) z `Cypress.env('TFS').token` | `xUserId` (number) z `config.env.TFS.xUserId` — header `X-User-Id` |
| **Polling** | `pollPublicationActiveWait(() => cy.getPublicationById(...), 2000, 30000)` — custom recursive helper | `expect.poll(async () => ..., POLL_CONFIG).toBe(...)` — natywny Playwright |
| **Asercje** | `expect(status).to.eq(201)` (Chai), w test body | `expect(expectedStatusCodes).toContain(response.status())` w serwisie; `expect.soft()` w teście |
| **Expect placement** | Wszędzie (test, helper, command) | **Strict:** serwisy = status HTTP, testy = business logic, helpery = ZERO expect |
| **JiraId** | `it('...', { env: { jiraId: 'TT-XXXXX' } }, () => {})` | `test('...', JiraId('TT-XXXXX'), async ({ request }) => {})` — drugi argument |
| **Nazewnictwo** | Angielski (tytuły testów) | Polski (tytuły), angielski (step names, kod) |
| **Parametryzacja** | `describe.each(array)('label', (param) => {})` — plugin `cypress-each` | `for (const tc of testCases) { test(...) }` — natywny JS loop |
| **Steps** | `.then()` chains, nested callbacks | `test.step('Step N: ...', async () => {})` — liniowy, czytelny |
| **Cleanup** | Implicit / brak explicit cleanup | `test.afterEach` z `deleteFreight(request, xUserId, id, [NO_CONTENT, NOT_FOUND, FORBIDDEN])` |
| **Factories** | `makeAfganistanFreight()` — z npm module, black-box | `buildAfganistanFreightPayload(overrides?)` — lokalne, `deepMerge`, pełna kontrola |
| **Config** | `Cypress.env('TFS')` + `setTokensInConfig()` | `config.env.TFS` z `loadConfig()` — konto: `{ xUserId, companyId, transId, password }` |

### Co się poprawiło

1. **Pełna widoczność HTTP** — żadnych ukrytych custom commands, każdy endpoint widoczny w `src/services/`
2. **Strict separation of concerns** — expect TYLKO tam gdzie powinny być
3. **POLL_CONFIG** — jedna konfiguracja pollingu zamiast parametrów per wywołanie
4. **Explicit cleanup** — afterEach z permissive status codes, brak "zombie" danych testowych
5. **Liniowa czytelność** — `test.step()` zamiast callback hell
6. **Parametryzacja natywna** — bez pluginów, interfejs + tablica + for loop

## Pliki pomocnicze

| Typ | Konwencja nazwy | Przykład |
|-----|-----------------|---------|
| Helper | `camelCase.helper.ts` | `freightStatus.helper.ts` |
| Service | `camelCase.service.ts` | `freights.service.ts` |
| Factory | `camelCase.factory.ts` | `freights.factory.ts` |
| Model | `camelCase.model.ts` | `freight.model.ts` |
| Enum | `camelCase.enums.ts` | `freight.enums.ts` |
| Test | `camelCase.spec.ts` | `automatedRules.spec.ts` |
| Barrel | `index.ts` | w każdym katalogu |

---

## Jak napisać nowy test od zera

### Checklist

1. Sprawdź czy **serwis** istnieje (`src/services/`) — jeśli nie, stwórz wg wzorca
2. Sprawdź czy **factory** istnieje (`src/factories/`) — jeśli nie, stwórz
3. Sprawdź czy **helper** jest potrzebny (`src/helpers/`)
4. Sprawdź czy **enum** i **model** istnieją
5. Dodaj **barrel export** (`index.ts`)

### Szablon

```ts
import { type APIRequestContext, expect, test } from '@playwright/test';
import { JiraId } from '@trans-test-automation/playwright-core';
import { StatusCodes } from 'http-status-codes';

import { config } from '@/configs';
import { POLL_CONFIG } from '@/helpers';

const TFS = config.env.TFS;
const TFC = config.env.TFC;

test.describe('Opis grupy', () => {
  let freightId: number;

  test.beforeEach('Create and publish freight', async ({ request }) => {
    // setup
  });

  test.afterEach('Delete freight', async ({ request }) => {
    await deleteFreight(request, TFS.xUserId, freightId, [
      StatusCodes.NO_CONTENT, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN,
    ]);
  });

  test('[TT-XXXXX] Jako nadawca powinienem moc ...', JiraId('TT-XXXXX'), async ({ request }) => {
    await test.step('Step 1: ...', async () => { /* akcja */ });
    await test.step('Step 2: Verify ...', async () => {
      await expect.poll(async () => /* poll */, POLL_CONFIG).toBe(expected);
    });
  });
});
```

### Kluczowe zasady (quick ref)

| Zasada | Opis |
|--------|------|
| JiraId zawsze | Drugi argument `test()` |
| Tytuł po polsku | Bez diakrytyków (a nie ą) |
| Stepy po angielsku | `Step N: ...` |
| POLL_CONFIG | Zawsze z `expect.poll()` |
| Cleanup w afterEach | Permissive codes |
| Expect w helperach | NIGDY |
| forEach do iteracji | Nie `for...of` |
| Daty: `dayjs().format()` | Nie `.toISOString()` |

### Uruchamianie

```bash
npm run test:rc-local           # UI mode (debug)
npm run test:rc-local:report    # HTML report + auto-open
npm run show-report             # otwórz ostatni raport
```
