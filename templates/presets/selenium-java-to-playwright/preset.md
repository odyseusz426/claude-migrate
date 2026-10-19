# Migration Preset: Selenium (Java) → Playwright (TypeScript)

preset_version: 1.0.0

> Ten plik jest automatycznie czytany przez agentów migracyjnych.
> Zawiera reguły, wzorce i mapowania specyficzne dla migracji Selenium Java → Playwright TypeScript.

## Source Technology: Selenium + Java

- Język: Java (8+/11+/17+)
- Framework testowy: JUnit 4/5 lub TestNG
- Driver: `WebDriver` (ChromeDriver, GeckoDriver) — ręczne zarządzanie
- Page Object: klasy Java z `@FindBy` / `By.cssSelector()` / `By.xpath()`
- Waity: `WebDriverWait` + `ExpectedConditions` (explicit), `Thread.sleep()` (anti-pattern), implicit waits
- Asercje: JUnit `assertEquals()`, Hamcrest `assertThat()`, AssertJ `assertThat().isEqualTo()`
- Lokatory: `By.id()`, `By.cssSelector()`, `By.xpath()`, `By.className()`, `By.name()`, `By.linkText()`
- Akcje: `Actions` class (drag, hover, double-click), `JavascriptExecutor`
- Konfiguracja: properties files, `@Before`/`@After` setup, driver factory pattern
- Dane testowe: `@DataProvider` (TestNG), `@ParameterizedTest` (JUnit 5), CSV/Excel readers
- Screenshots: `TakesScreenshot` interface, manual capture
- Reporting: ExtentReports, Allure, custom listeners
- Setup/Teardown: `@BeforeClass`/`@AfterClass`, `@BeforeMethod`/`@AfterMethod` (TestNG), `@BeforeAll`/`@AfterAll`/`@BeforeEach`/`@AfterEach` (JUnit 5)

## Target Technology: Playwright (TypeScript)

- Język: TypeScript
- Framework: `@playwright/test`
- Import: `import { test, expect } from '@playwright/test'`
- Page Object: klasy TS z `page.locator()` — lokatory lazy, bez `@FindBy`
- Waity: auto-wait wbudowany w każdą akcję — BRAK explicit waits w 95% przypadków
- Asercje: `expect(locator).toBeVisible()`, `expect(locator).toHaveText()`, `expect(page).toHaveURL()`
- Lokatory: `page.locator()`, `page.getByRole()`, `page.getByText()`, `page.getByTestId()`, `page.getByLabel()`
- Akcje: natywne metody na locator (`click()`, `fill()`, `hover()`, `dragTo()`)
- Konfiguracja: `playwright.config.ts` + `use: {}` sekcja
- Dane testowe: arrays + `for...of`, fixtures, parametryzacja natywna
- Screenshots: automatyczne on failure, `page.screenshot()`, `expect(page).toHaveScreenshot()`
- Reporting: HTML reporter (wbudowany), Allure plugin, custom reporters
- Setup/Teardown: `test.beforeAll()`, `test.afterAll()`, `test.beforeEach()`, `test.afterEach()`
- Fixtures: custom fixtures via `test.extend<T>()`

## Mapowanie wzorców Source → Target

| Aspekt | Selenium Java | Playwright TS |
|--------|--------------|---------------|
| Driver init | `new ChromeDriver()` + options | `test({}, async ({ page }) => {})` — auto |
| Driver quit | `driver.quit()` w `@After` | Automatyczny — Playwright zarządza lifecycle |
| Navigate | `driver.get(url)` | `page.goto(url)` |
| Find element | `driver.findElement(By.css())` | `page.locator('css')` — lazy, no StaleElement |
| Find elements | `driver.findElements(By.css())` | `page.locator('css')` — ten sam API, `.count()` / `.all()` |
| Click | `element.click()` | `locator.click()` — auto-wait |
| Type text | `element.sendKeys("text")` | `locator.fill("text")` — czyści i wpisuje |
| Clear + type | `element.clear(); element.sendKeys()` | `locator.fill()` — clear wbudowany |
| Get text | `element.getText()` | `locator.textContent()` lub `expect(locator).toHaveText()` |
| Get attribute | `element.getAttribute("href")` | `locator.getAttribute("href")` |
| Is displayed | `element.isDisplayed()` | `expect(locator).toBeVisible()` — assertion, nie boolean |
| Is enabled | `element.isEnabled()` | `expect(locator).toBeEnabled()` |
| Select dropdown | `new Select(el).selectByValue()` | `locator.selectOption({ value: '...' })` |
| Checkbox | `if (!el.isSelected()) el.click()` | `locator.check()` / `locator.uncheck()` |
| Hover | `new Actions(driver).moveToElement(el)` | `locator.hover()` |
| Drag & drop | `new Actions(driver).dragAndDrop(src, tgt)` | `src.dragTo(tgt)` |
| Double click | `new Actions(driver).doubleClick(el)` | `locator.dblclick()` |
| Right click | `new Actions(driver).contextClick(el)` | `locator.click({ button: 'right' })` |
| Frame switch | `driver.switchTo().frame(el)` | `page.frameLocator('#frame').locator()` |
| New tab/window | `driver.switchTo().window(handle)` | `page.waitForEvent('popup')` → nowy `Page` |
| Alert accept | `driver.switchTo().alert().accept()` | `page.on('dialog', d => d.accept())` |
| JS execute | `((JavascriptExecutor) driver).executeScript()` | `page.evaluate(() => {})` |
| Screenshot | `((TakesScreenshot) driver).getScreenshotAs()` | `page.screenshot()` lub auto on failure |
| Explicit wait | `new WebDriverWait(driver, 10).until(EC.visibilityOf(el))` | USUNĄĆ — auto-wait. `locator.waitFor()` w edge cases |
| Implicit wait | `driver.manage().timeouts().implicitlyWait()` | USUNĄĆ — Playwright nie potrzebuje |
| Thread.sleep | `Thread.sleep(3000)` | USUNĄĆ — anti-pattern. `page.waitForTimeout()` TYLKO jako ostateczność |
| Page Object fields | `@FindBy(css = "...")` `WebElement field` | `readonly field = this.page.locator('...')` — lazy |
| Page Object init | `PageFactory.initElements(driver, this)` | `new PageObject(page)` — nie trzeba init |
| Assertions | `assertEquals(expected, actual)` | `expect(locator).toHaveText(expected)` — web-first |
| Soft assertions | brak natywny (AssertJ `SoftAssertions`) | `expect.soft(locator).toHaveText()` |
| Parametryzacja | `@DataProvider` / `@ParameterizedTest` | tablica + `for...of` lub `test.describe()` loop |
| Test groups/tags | `@Tag` / `groups = {"smoke"}` | `test('...', { tag: '@smoke' }, ...)` |
| Parallel | TestNG `parallel="methods"` / JUnit `@Execution(CONCURRENT)` | `playwright.config.ts` → `workers: N` |
| Base URL | properties / hardcoded | `playwright.config.ts` → `use: { baseURL }` |
| Timeouts | `WebDriverWait` timeout param | `playwright.config.ts` → `timeout`, `expect: { timeout }` |
| Test retry | brak natywny / custom runner | `playwright.config.ts` → `retries: N` |
| Report | ExtentReports / Allure | HTML reporter wbudowany, Allure plugin |
| Environment | System.getProperty / .properties | `use: { ... }` lub `process.env.*` lub custom config |

## Architektura docelowa (warstwy)

```
tests/                         # Testy — expect, test.step, test.describe
src/pages/                     # Page Objects — lokatory + akcje, BEZ asercji
src/components/                # Komponenty UI wielokrotnego użytku
src/fixtures/                  # Custom fixtures (test.extend)
src/helpers/                   # Utility functions (date formatting, data gen)
src/models/                    # Interfejsy TypeScript (dane testowe, API responses)
src/enums/                     # Enumy (stany, typy, role)
src/configs/                   # Konfiguracja (environments, users)
```

| Warstwa | `expect()` | Rola |
|---------|-----------|------|
| **Testy** (`.spec.ts`) | TAK | Asercje, flow, orchestracja |
| **Page Objects** (`src/pages/`) | NIE (z wyjątkiem `waitFor` w edge cases) | Lokatory + akcje na elementach |
| **Components** (`src/components/`) | NIE | Reusable UI fragments |
| **Fixtures** (`src/fixtures/`) | NIE | Setup danych/stanu |
| **Helpers** (`src/helpers/`) | NIE | Utility, data generation |

## Konwencje docelowe

### Nazewnictwo i język

| Element | Konwencja | Przykład |
|---------|-----------|---------|
| Pliki testowe | `camelCase.spec.ts` | `userLogin.spec.ts` |
| Page Objects | `PascalCase.page.ts` | `LoginPage.page.ts` |
| Components | `PascalCase.component.ts` | `Navbar.component.ts` |
| Interfejsy | `I` prefix + PascalCase | `IUserCredentials` |
| Zmienne | camelCase | `loginPage`, `submitButton` |
| Lokatory | camelCase, deskryptywne | `emailInput`, `submitButton`, `errorMessage` |
| Test titles | Opisowe, w języku projektu | zależy od konwencji zespołu |
| Describe blocks | Angielski, descriptive | `'Login page'`, `'User registration'` |

### Pliki

| Typ | Konwencja | Przykład |
|-----|-----------|---------|
| Test | `camelCase.spec.ts` | `userLogin.spec.ts` |
| Page Object | `PascalCase.page.ts` | `LoginPage.page.ts` |
| Component | `PascalCase.component.ts` | `Navbar.component.ts` |
| Fixture | `camelCase.fixture.ts` | `auth.fixture.ts` |
| Helper | `camelCase.helper.ts` | `dateFormat.helper.ts` |
| Model | `camelCase.model.ts` | `user.model.ts` |
| Config | `camelCase.config.ts` | `env.config.ts` |

## Krytyczne reguły migracji (z realnych problemów)

### Waity — najważniejsza zmiana

1. **USUŃ WSZYSTKIE explicit waits**: `WebDriverWait` + `ExpectedConditions` → USUNĄĆ. Playwright auto-wait robi to samo
2. **USUŃ WSZYSTKIE Thread.sleep**: `Thread.sleep(N)` → USUNĄĆ. Jeśli czekasz na konkretny stan — użyj `expect(locator).toBeVisible()` lub `locator.waitFor()`
3. **USUŃ implicit waits**: `implicitlyWait()` → USUNĄĆ. Playwright ma własny timeout system
4. **NIE zamieniaj sleep na waitForTimeout**: `Thread.sleep(3000)` → NIE `page.waitForTimeout(3000)`. Znajdź prawdziwy warunek oczekiwania
5. **Wyjątek — animacje/thirdparty**: `page.waitForTimeout(500)` TYLKO gdy czekasz na animację CSS lub thirdparty widget bez hookable event. Zawsze komentarz dlaczego

### Lokatory — migracja

6. **Preferuj user-facing lokatory**: `By.id("submit")` → `page.getByRole('button', { name: 'Submit' })` gdy to możliwe. Hierarchia: `getByRole` > `getByTestId` > `getByText` > `locator('css')` > `locator('xpath')`
7. **XPath → CSS/role**: Przepisuj XPath na CSS selector lub role-based locator. XPath TYLKO gdy nie ma alternatywy (np. text contains w złożonym DOM)
8. **By.id → getByTestId**: `By.id("user-email")` → `page.getByTestId('user-email')` (jeśli projekt używa `data-testid`) lub `page.locator('#user-email')`
9. **By.className → locator**: `By.className("btn-primary")` → `page.locator('.btn-primary')`
10. **By.name → locator**: `By.name("email")` → `page.locator('[name="email"]')` lub `page.getByLabel('Email')`
11. **By.linkText → getByRole**: `By.linkText("Click here")` → `page.getByRole('link', { name: 'Click here' })`
12. **By.partialLinkText → getByRole**: `By.partialLinkText("Click")` → `page.getByRole('link', { name: /Click/ })`
13. **Chained findElements → locator chain**: `parent.findElement(By.css("child"))` → `page.locator('.parent .child')` lub `page.locator('.parent').locator('.child')`

### Asercje — zmiana paradygmatu

14. **Boolean checks → web-first assertions**: `assertTrue(el.isDisplayed())` → `await expect(locator).toBeVisible()`. Web-first czeka na warunek, boolean sprawdza natychmiast
15. **getText + assertEquals → toHaveText**: `assertEquals("Hello", el.getText())` → `await expect(locator).toHaveText('Hello')` — auto-retry
16. **getAttribute + assertEquals → toHaveAttribute**: `assertEquals("val", el.getAttribute("href"))` → `await expect(locator).toHaveAttribute('href', 'val')`
17. **URL check → toHaveURL**: `assertTrue(driver.getCurrentUrl().contains("/dashboard"))` → `await expect(page).toHaveURL(/dashboard/)`
18. **Title check → toHaveTitle**: `assertEquals("Title", driver.getTitle())` → `await expect(page).toHaveTitle('Title')`
19. **Count check → toHaveCount**: `assertEquals(5, els.size())` → `await expect(locator).toHaveCount(5)`
20. **NIE mieszaj expect() i expect.soft()**: `expect()` dla warunków blokujących dalsze kroki, `expect.soft()` dla niezależnych asercji w jednym teście

### Page Object — transformacja

21. **@FindBy → readonly locator**: `@FindBy(css = ".btn") WebElement btn;` → `readonly btn = this.page.locator('.btn');`. Lokatory są lazy — nie rzucają StaleElementException
22. **PageFactory.initElements USUNĄĆ**: nie potrzebny — Playwright lokatory są lazy-evaluated
23. **Konstruktor Page Object**: Java: `LoginPage(WebDriver driver)` → TS: `constructor(private readonly page: Page) {}`
24. **Metody Page Object zwracają Page Object**: `return new DashboardPage(driver)` → `return new DashboardPage(this.page)`. Alternatywnie: zwracaj `void` i nawiguj w teście
25. **BRAK asercji w Page Object**: Java PO często mają `verifyPageLoaded()` z asercjami → PRZENIEŚ do testów. PO = lokatory + akcje
26. **driver jako pole → page jako readonly**: `protected WebDriver driver;` → `constructor(private readonly page: Page) {}`

### Driver management — eliminacja

27. **USUŃ driver setup/teardown**: `new ChromeDriver()` / `driver.quit()` → USUNĄĆ. Playwright zarządza browserem
28. **USUŃ DesiredCapabilities/Options**: `ChromeOptions options = new ChromeOptions()` → `playwright.config.ts` sekcja `use: {}`
29. **USUŃ driver factory/provider**: `DriverFactory.getDriver()` → USUNĄĆ. Playwright ma wbudowane zarządzanie

### Struktura testów — transformacja

30. **@Test → test()**: `@Test public void testLogin()` → `test('should login successfully', async ({ page }) => {})`
31. **@BeforeClass/@BeforeAll → test.beforeAll**: one-time setup
32. **@BeforeMethod/@BeforeEach → test.beforeEach**: per-test setup
33. **@AfterClass/@AfterAll → test.afterAll**: one-time teardown
34. **@AfterMethod/@AfterEach → test.afterEach**: per-test teardown
35. **try/finally cleanup → afterEach**: Java `try { test } finally { cleanup }` → `test.afterEach(async () => { cleanup })`
36. **@DataProvider → tablica + for...of**: parametryzacja — interface + tablica + loop wokół `test()` lub `test.describe()`
37. **TestNG groups → Playwright tags**: `@Test(groups = {"smoke"})` → `test('...', { tag: '@smoke' }, ...)`
38. **@Ignore/@Disabled → test.skip**: `@Ignore("reason")` → `test.skip(true, 'reason')` lub `test.fixme()`

### Async — fundamentalna zmiana

39. **WSZYSTKO jest async/await**: Selenium Java jest synchroniczny, Playwright TS jest asynchroniczny. KAŻDA interakcja z `page`/`locator` wymaga `await`
40. **Brak return value z akcji → void Promise**: `element.click()` (Java, void) → `await locator.click()` (TS, Promise<void>)
41. **Łańcuchy akcji → sekwencyjne await**: Java: `actions.moveToElement(el).click().perform()` → TS: `await locator.hover(); await locator.click();`

### Konfiguracja

42. **properties → playwright.config.ts**: `config.properties` → `playwright.config.ts` z `defineConfig({})`
43. **System.getProperty → process.env**: `System.getProperty("env")` → `process.env.ENV` lub custom config loader
44. **Base URL**: konfiguracja w `playwright.config.ts` → `use: { baseURL: '...' }`, potem `page.goto('/')` zamiast pełnego URL

### Typowe pułapki Java → TS

45. **Null checks**: Java `if (element != null)` → TS `if (await locator.count() > 0)` — NIE sprawdzaj null na locator, bo locator to query, nie element
46. **StaleElementException**: NIE istnieje w Playwright — lokatory są re-evaluated przy każdym użyciu
47. **Type casting**: Java `(JavascriptExecutor) driver` → TS `page.evaluate()` — brak castingu
48. **String concatenation w selektorach**: Java `By.css("[data-id='" + id + "']")` → TS `` page.locator(`[data-id="${id}"]`) `` — template literal
49. **Collection iteration**: Java `for (WebElement el : elements)` → TS `for (const el of await locator.all())`
50. **Exceptions → expect failures**: Java `try/catch NoSuchElementException` → TS `expect(locator).toBeVisible()` / `expect(locator).toBeHidden()`

## Dokumentacja docelowego repo (do czytania)

| Plik | Po co |
|------|-------|
| `playwright.config.ts` | Konfiguracja projektu — base URL, timeouts, reporters |
| `ai/docs/patterns/testing-patterns.md` | Wzorce testowe (jeśli SDD) |
| `ai/docs/conventions/code-style.md` | Styl kodu |
| `package.json` | Zależności, skrypty npm |
| `tsconfig.json` | Ścieżki, aliasy `@/` |

## Dokumentacja source repo (Selenium Java, do czytania)

| Plik | Po co |
|------|-------|
| `pom.xml` / `build.gradle` | Zależności, wersja Selenium, runner |
| `src/test/resources/*.properties` | Konfiguracja środowisk |
| `src/main/java/**/pages/` | Page Objects — struktura, konwencje |
| `src/test/java/**/tests/` | Testy — setup, flow, asercje |
| `src/main/java/**/utils/` | Helpers, wait wrappers, driver factory |

## Debug — znane pułapki (dla /migrate-fix)

| # | Pułapka | Jak sprawdzić |
|---|---------|---------------|
| 1 | Brakujący await | Test przechodzi ale nic nie robi — dodaj `await` do KAŻDEJ interakcji z page/locator |
| 2 | Stary XPath | XPath z Java skopiowany 1:1 — przepisz na CSS/role locator |
| 3 | Thread.sleep zamieniony na waitForTimeout | Szukaj `waitForTimeout` — zamień na proper wait condition |
| 4 | Asercja boolean zamiast web-first | `expect(await locator.isVisible()).toBe(true)` → `expect(locator).toBeVisible()` |
| 5 | Page Object z asercjami | PO zawiera `expect()` — przenieś do testu |
| 6 | Explicit wait zachowany | `page.waitForSelector()` zamiast auto-wait — usuń, Playwright czeka sam |
| 7 | driver.get zamiast page.goto | Szukaj `driver.` w kodzie — powinno być `page.` |
| 8 | Brak destructuring w test | `async function(page)` zamiast `async ({ page }) =>` |
| 9 | Synchronous thinking | Sekwencja bez await — każda linia z page/locator MUSI mieć await |
| 10 | findElement zamiast locator | `page.findElement(...)` — nie istnieje, użyj `page.locator()` |
| 11 | assertEquals argument order | Java: `assertEquals(expected, actual)` — w Playwright: `expect(actual).toBe(expected)` — odwrócona kolejność |
| 12 | Implicit waits conflict | Implicit wait z Selenium → Playwright nie ma odpowiednika, po prostu usuń |
| 13 | Frame handling | `switchTo().frame()` bez przywrócenia → `page.frameLocator()` nie wymaga switch back |
| 14 | Window handles | `driver.getWindowHandles()` → `page.waitForEvent('popup')` — inny model mentalny |
| 15 | Select wrapper | `new Select(el)` → `locator.selectOption()` — bez wrapper class |
