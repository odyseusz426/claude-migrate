# Playwright API Testing Patterns

> Wzorce dla projektów testów API (Playwright + TypeScript) używanych w Freight Service i pokrewnych projektach migrowanych z Cypress.

## Architektura warstw

```
tests/api/                     # Testy — expect, poll, test.step
src/helpers/                   # Helpery — logika, orchestracja, BEZ expect/poll
src/services/                  # Serwisy — wywołania HTTP, JEDYNE miejsce z expect na status HTTP
src/factories/                 # Factories — budowanie payloadów
src/fixtures/                  # Dane testowe per environment
src/models/                    # Interfejsy TypeScript
src/enums/                     # Enumy (wartości API)
src/configs/                   # Konfiguracja environments i kont
```

## Zasada: gdzie expect, gdzie nie

| Warstwa | `expect()` | `expect.poll()` | Rola |
|---------|-----------|-----------------|------|
| **Testy** (`.spec.ts`) | TAK | TAK | Asercje i weryfikacja statusów |
| **Helpery** (`src/helpers/`) | NIE | NIE | Logika, orchestracja, zwracanie danych |
| **Serwisy** (`src/services/`) | TAK (tylko status HTTP) | NIE | `expect(expectedStatusCodes).toContain(response.status())` |
| **Factories** | NIE | NIE | Budowanie payloadów |

**Kluczowa zasada:** helpery NIGDY nie zawierają expect ani poll. Zwracają dane — test decyduje co zweryfikować.

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
  buildPublicationPayload: (freightId: number) => IPublicationPayload,
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

### Pattern 2: Petla po wartosciach z describe

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

## beforeEach / afterEach

### Co idzie do beforeEach
- Tworzenie frachtu (`createFreight`)
- Publikacja (`publishFreightSpot` / `PublicationSwitcher`)
- Poll na ACTIVE status
- Setup gield

### Co idzie do afterEach
- Cleanup: `deleteFreight` z permissive codes `[NO_CONTENT, NOT_FOUND, FORBIDDEN]`

### Co zostaje w tescie
- Specyficzna akcja testowa
- Asercje na wynik akcji
- Warunkowe expect.poll na zmiane statusu

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

## Mapowanie Cypress → Playwright

| Aspekt | Cypress | Playwright |
|--------|---------|-----------|
| HTTP calls | `cy.addFreight(token, payload)` custom commands | `createFreight(request, xUserId, payload)` `src/services/` |
| Auth | `token` (OAuth JWT) | `xUserId` (number) — header `X-User-Id` |
| Polling | recursive helper | `expect.poll(async () => ..., POLL_CONFIG)` |
| Asercje | Chai everywhere | `expect.soft()` w testach, status w serwisach |
| JiraId | `{ env: { jiraId } }` w options | `JiraId()` jako drugi arg `test()` |
| Steps | `.then()` chains | `test.step('Step N: ...', async () => {})` |
| Cleanup | implicit | `test.afterEach` z permissive codes |
| Config | `Cypress.env('TFS')` | `config.env.TFS` z `loadConfig()` |

## Jak napisac nowy test od zera — szablon

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
