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

## POLL_CONFIG / POLL_CONFIG_LONG — konfiguracja pollingu

```ts
// src/helpers/utils/poll.config.ts
export const POLL_CONFIG = { timeout: 30_000, intervals: [2_000] };
export const POLL_CONFIG_LONG = { timeout: 60_000, intervals: [2_000] };
```

**ZAWSZE** przekazywany jako drugi argument `expect.poll()`:

- `POLL_CONFIG` — domyślny (30s) — publikacje, statusy, proste operacje
- `POLL_CONFIG_LONG` — dłuższy (60s) — `getConversationHasNegotiation`, `getFirstReceiverStatus`, operacje wymagające przetwarzania (negocjacje z kontraktami, sequential)

```ts
// Standard — POLL_CONFIG
await expect
  .poll(async () => {
    const { body } = await getPublicationById(request, TFS.xUserId, publicationId, Product.TFS);
    return body.status;
  }, POLL_CONFIG)
  .toBe(PublicationStatus.ACTIVE);

// Long — POLL_CONFIG_LONG (conversations, sequential contracts)
await expect
  .poll(async () => getConversationHasNegotiation(request, TFC.xUserId, publicationId), POLL_CONFIG_LONG)
  .toBe(true);
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

### Co idzie do beforeAll (one-time setup)
- Exchange members setup (`exchangeManageHelper`)
- SafePay tags setup (`setSafePayTag`)
- Fetch all data for list tests (`getAllFreights`)
- **NIGDY** tworzenie frachtu — to shared state między testami

### Co idzie do beforeEach (per-test setup)
- Tworzenie frachtu (`createFreight`)
- Publikacja (`publishFreightSpot` / `PublicationSwitcher`)
- Poll na ACTIVE status
- Per-test exchange setup (jeśli zależy od parametru forEach)

### Co idzie do afterEach
- Cleanup WSZYSTKICH stworzonych zasobów — tablica IDs, iteracja, `arr.length = 0`
- Permissive codes: `[NO_CONTENT, NOT_FOUND, FORBIDDEN]`
- **NIGDY** nie czyść tylko jednego zasobu gdy testy mogą tworzyć wiele (np. mass action tworzy dodatkowe w test body)

```ts
const createdFreightIds: number[] = [];

test.afterEach('Cleanup freights', async ({ request }) => {
  for (const id of createdFreightIds) {
    await deleteFreight(request, TFS.xUserId, id, [StatusCodes.NO_CONTENT, StatusCodes.NOT_FOUND]);
  }
  createdFreightIds.length = 0;
});
```

### afterEach — wariant negocjacje (warunkowy cancel+archive)

```ts
test.afterEach('Cancel publication and archive freight', async ({ request }) => {
  const { body: pubBody } = await getPublicationById(request, TFS.xUserId, publicationId, Product.TFS);
  if (pubBody.status === 'active') {
    await cancelPublication(request, TFS.xUserId, publicationId);
    await archiveFreight(request, TFS.xUserId, freightId);
  }
});
```

### Permissive codes — pełna lista per service

| Service | Permissive codes |
|---------|-----------------|
| `deleteFreight` | `[NO_CONTENT, NOT_FOUND, FORBIDDEN]` |
| `cancelPublication` | `[CREATED, UNPROCESSABLE_ENTITY]` |
| `archiveFreight` | `[CREATED, FORBIDDEN]` |

### Co zostaje w tescie
- `test.skip(condition, reason)` — PIERWSZA linia
- Specyficzna akcja testowa
- Asercje na wynik akcji
- Warunkowe expect.poll na zmiane statusu

## Inline assertion helpers

Gdy test powtarza złożoną asercję — wyciągnij do `const` function na poziomie pliku:

```ts
const assertPriceList = (body: INegotiationsListResponse, payment: IPayment, index = 0): void => {
  const n = body._embedded.negotiations[index];
  expect.soft(n).toBeTruthy();
  if (!n) return;
  expect.soft(n.price.value).toBe(payment.price.value);
  expect.soft(n.price.currency).toBe(payment.price.currency);
};
```

## History verification pattern

```ts
const expectedHistory = [
  negotiationHistoryEvent(NegotiationHistoryEventName.NEGOTIATION_OWNER_ACCEPT, TFS.xUserId, payment2),
  negotiationHistoryEvent(NegotiationHistoryEventName.NEGOTIATION_PARTICIPANT_OFFER, TFC.xUserId, payment2),
  negotiationHistoryEvent(NegotiationHistoryEventName.NEGOTIATION_OWNER_OFFER, TFS.xUserId, payment),
  negotiationHistoryEvent(NegotiationHistoryEventName.NEGOTIATION_CREATED, TFS.xUserId, initialPayment),
];
// Sprawdź z OBU stron
const historyFromTFS = await getHistory(request, TFS.xUserId, negotiationId);
expectedHistory.forEach((expected, i) => expect(historyFromTFS[i]).toEqual(expect.objectContaining(expected)));
const historyFromTFC = await getHistory(request, TFC.xUserId, negotiationId);
expectedHistory.forEach((expected, i) => expect(historyFromTFC[i]).toEqual(expect.objectContaining(expected)));
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

## Import convention — `type` keyword

```ts
// CORRECT — type keyword for interfaces/types
import { type APIRequestContext, expect, test } from '@playwright/test';
import { type IFreightPayload } from '@/models';
import { type IPayment } from '@/models';

// WRONG — no type keyword
import { APIRequestContext, expect, test } from '@playwright/test';
import { IFreightPayload } from '@/models';
```

## NegotiationActions — instancja w test body

NegotiationActions ZAWSZE tworzony wewnątrz `test.step` — wymaga `auctionId`/`offerId` z publikacji:

```ts
test('[TT-XXXXX] Negotiate', JiraId('TT-XXXXX'), async ({ request }) => {
  await test.step('Step 3: Negotiate', async () => {
    const negotiationActions = new NegotiationActions(request, freightId, auctionId, offerId);
    await negotiationActions.accept(TFC, TFS);
  });
});
```

## List/filter testy — count only

```ts
// CORRECT — asercja na count
expect.soft(body.total_count).toBeGreaterThan(0);
expect.soft(body.total_count).toBeGreaterThanOrEqual(expectedCount);

// WRONG — asercja na treść elementów (inne testy mogą zmienić dane)
expect.soft(body._embedded.freights[0].id).toBe(freightId);
```

## Enum parametryzacja — Object.values

```ts
Object.values(TruckBodies).forEach((truckBody) => {
  test(`Filter by truck body: ${truckBody}`, async ({ request }) => {
    // ...filter and assert count
  });
});
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
  const createdFreightIds: number[] = [];
  const initialPayload = buildAfganistanFreightPayload();

  test.beforeEach('Create freight', async ({ request }) => {
    const body = await createFreight(request, TFS.xUserId, initialPayload);
    freightId = body.id;
    createdFreightIds.push(freightId);
  });

  test.afterEach('Cleanup freights', async ({ request }) => {
    for (const id of createdFreightIds) {
      await deleteFreight(request, TFS.xUserId, id, [StatusCodes.NO_CONTENT, StatusCodes.NOT_FOUND]);
    }
    createdFreightIds.length = 0;
  });

  test('[TT-XXXXX] Jako nadawca powinienem moc ...', JiraId('TT-XXXXX'), async ({ request }) => {
    await test.step('Step 1: ...', async () => { /* akcja */ });
    await test.step('Step 2: Verify ...', async () => {
      await expect.poll(async () => /* poll */, POLL_CONFIG).toBe(expected);
    });
  });
});
```
