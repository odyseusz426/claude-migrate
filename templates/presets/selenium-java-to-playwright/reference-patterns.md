# Playwright UI Testing Patterns

> Wzorce dla projektów testów UI (Playwright + TypeScript) migrowanych z Selenium Java.

## Architektura warstw

```
tests/                         # Testy — expect, test.step, test.describe
src/pages/                     # Page Objects — lokatory + akcje, BEZ asercji
src/components/                # Komponenty UI wielokrotnego użytku
src/fixtures/                  # Custom fixtures (test.extend)
src/helpers/                   # Utility functions
src/models/                    # Interfejsy TypeScript
src/enums/                     # Enumy
src/configs/                   # Konfiguracja environments
```

## Zasada: gdzie expect, gdzie nie

| Warstwa | `expect()` | Rola |
|---------|-----------|------|
| **Testy** (`.spec.ts`) | TAK | Asercje, flow, orchestracja |
| **Page Objects** (`src/pages/`) | NIE | Lokatory + akcje na elementach |
| **Components** (`src/components/`) | NIE | Reusable UI fragments |
| **Fixtures** (`src/fixtures/`) | NIE | Setup danych/stanu |
| **Helpers** (`src/helpers/`) | NIE | Utility functions |

**Kluczowa zasada:** Page Objects NIGDY nie zawierają expect. Zwracają dane/wykonują akcje — test decyduje co zweryfikować.

## Page Object — wzorzec bazowy

### Selenium Java (źródło)

```java
public class LoginPage {
    private WebDriver driver;
    
    @FindBy(id = "email")
    private WebElement emailInput;
    
    @FindBy(id = "password")
    private WebElement passwordInput;
    
    @FindBy(css = ".btn-submit")
    private WebElement submitButton;
    
    @FindBy(css = ".error-message")
    private WebElement errorMessage;
    
    public LoginPage(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);
    }
    
    public DashboardPage login(String email, String password) {
        emailInput.sendKeys(email);
        passwordInput.sendKeys(password);
        submitButton.click();
        return new DashboardPage(driver);
    }
    
    public String getErrorMessage() {
        return errorMessage.getText();
    }
    
    public boolean isErrorDisplayed() {
        try {
            return errorMessage.isDisplayed();
        } catch (NoSuchElementException e) {
            return false;
        }
    }
}
```

### Playwright TypeScript (cel)

```ts
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  // Lokatory — lazy, readonly, deklarowane jako pola
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Log in' });
    this.errorMessage = page.locator('.error-message');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorText(): Promise<string> {
    return (await this.errorMessage.textContent()) ?? '';
  }
}
```

**Kluczowe różnice:**
- Brak `PageFactory.initElements` — lokatory lazy
- Brak `@FindBy` — lokatory w konstruktorze
- Brak `isDisplayed()` boolean — asercja `expect(locator).toBeVisible()` w teście
- Brak try/catch na `NoSuchElementException` — locator nie rzuca gdy element nie istnieje
- Brak zwracania nowego Page Object — nawigacja w teście
- Wszystkie metody `async` z `await`

## Page Object — wzorzec z komponentami

```ts
import { type Page, type Locator } from '@playwright/test';
import { Navbar } from '@/components/Navbar.component';

export class DashboardPage {
  readonly navbar: Navbar;
  readonly welcomeMessage: Locator;
  readonly statsCards: Locator;

  constructor(private readonly page: Page) {
    this.navbar = new Navbar(page);
    this.welcomeMessage = page.getByRole('heading', { name: /Welcome/ });
    this.statsCards = page.locator('[data-testid="stats-card"]');
  }

  async getStatsCount(): Promise<number> {
    return this.statsCards.count();
  }
}
```

## Component — wzorzec

```ts
import { type Page, type Locator } from '@playwright/test';

export class Navbar {
  readonly logo: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.logo = page.getByRole('banner').getByRole('link', { name: 'Logo' });
    this.userMenu = page.getByTestId('user-menu');
    this.logoutButton = page.getByRole('menuitem', { name: 'Logout' });
  }

  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.click();
  }
}
```

## Lokatory — hierarchia preferencji

### 1. Role-based (najlepszy — odporny na zmiany UI)

```ts
// Przyciski
page.getByRole('button', { name: 'Submit' });
page.getByRole('button', { name: /submit/i });  // regex — case insensitive

// Linki
page.getByRole('link', { name: 'Home' });

// Nagłówki
page.getByRole('heading', { name: 'Dashboard', level: 1 });

// Inputy
page.getByRole('textbox', { name: 'Email' });
page.getByRole('checkbox', { name: 'Remember me' });

// Navigation / landmarks
page.getByRole('navigation');
page.getByRole('banner');
page.getByRole('main');
```

### 2. Label/placeholder (dobry — user-facing)

```ts
page.getByLabel('Email address');
page.getByPlaceholder('Enter your email');
page.getByText('Welcome back');
page.getByAltText('Company logo');
page.getByTitle('Close dialog');
```

### 3. Test ID (stabilny — gdy UI text się zmienia)

```ts
page.getByTestId('submit-button');
page.getByTestId('user-table-row');
```

### 4. CSS selector (fallback)

```ts
page.locator('.btn-primary');
page.locator('#user-email');
page.locator('[data-custom="value"]');
page.locator('.parent >> .child');  // descendant
```

### 5. XPath (ostateczność)

```ts
page.locator('xpath=//div[contains(@class, "special")]');
```

## Mapowanie lokatorów Selenium → Playwright

| Selenium Java | Playwright TS | Uwagi |
|--------------|---------------|-------|
| `By.id("email")` | `page.locator('#email')` lub `page.getByTestId('email')` | Preferuj getByTestId |
| `By.cssSelector(".btn")` | `page.locator('.btn')` | 1:1 |
| `By.xpath("//div[@class='x']")` | `page.locator('.x')` | Przepisz na CSS |
| `By.className("active")` | `page.locator('.active')` | 1:1 |
| `By.name("email")` | `page.locator('[name="email"]')` lub `page.getByLabel('Email')` | Preferuj getByLabel |
| `By.linkText("Home")` | `page.getByRole('link', { name: 'Home' })` | Role-based |
| `By.partialLinkText("Ho")` | `page.getByRole('link', { name: /Ho/ })` | Regex |
| `By.tagName("input")` | `page.locator('input')` | Rzadko używany |

## Waity — eliminacja

### Selenium Java (źródło) — USUNĄĆ

```java
// Explicit wait — USUNĄĆ
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("msg")));

// Fluent wait — USUNĄĆ
new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(30))
    .pollingEvery(Duration.ofSeconds(2))
    .until(ExpectedConditions.elementToBeClickable(By.id("btn")));

// Thread.sleep — USUNĄĆ
Thread.sleep(3000);

// Implicit wait — USUNĄĆ
driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
```

### Playwright TypeScript (cel) — auto-wait

```ts
// Playwright auto-czeka na element przed kliknięciem — BEZ explicit waits
await page.locator('#btn').click();

// Assertion auto-retry — czeka aż warunek spełniony
await expect(page.locator('#msg')).toBeVisible();
await expect(page.locator('#msg')).toHaveText('Success');

// Edge case — czekanie na specyficzny stan (rzadko potrzebne)
await page.locator('#loader').waitFor({ state: 'hidden' });

// Czekanie na nawigację (gdy click triggeruje page load)
await Promise.all([
  page.waitForURL('**/dashboard'),
  page.locator('#login-btn').click(),
]);

// Czekanie na network response
const responsePromise = page.waitForResponse('**/api/users');
await page.locator('#refresh').click();
const response = await responsePromise;
```

## Asercje — mapowanie

### Selenium + JUnit/TestNG/AssertJ → Playwright expect

```ts
// TEXT
// Java: assertEquals("Welcome", element.getText());
await expect(locator).toHaveText('Welcome');
await expect(locator).toContainText('Welcome');     // partial match

// VISIBILITY
// Java: assertTrue(element.isDisplayed());
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();                 // not displayed

// ATTRIBUTE
// Java: assertEquals("link", element.getAttribute("href"));
await expect(locator).toHaveAttribute('href', 'link');
await expect(locator).toHaveAttribute('href', /link/);  // regex

// CSS CLASS
// Java: assertTrue(element.getAttribute("class").contains("active"));
await expect(locator).toHaveClass(/active/);

// VALUE (input)
// Java: assertEquals("hello", element.getAttribute("value"));
await expect(locator).toHaveValue('hello');

// COUNT
// Java: assertEquals(5, elements.size());
await expect(locator).toHaveCount(5);

// ENABLED/DISABLED
// Java: assertTrue(element.isEnabled());
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();

// CHECKED
// Java: assertTrue(element.isSelected());
await expect(locator).toBeChecked();

// URL
// Java: assertTrue(driver.getCurrentUrl().contains("/dashboard"));
await expect(page).toHaveURL(/dashboard/);
await expect(page).toHaveURL('https://example.com/dashboard');

// TITLE
// Java: assertEquals("Home", driver.getTitle());
await expect(page).toHaveTitle('Home');
await expect(page).toHaveTitle(/Home/);

// SOFT ASSERTIONS — nie przerywają testu
await expect.soft(locator).toHaveText('Welcome');
await expect.soft(locator).toBeVisible();
```

## Test structure — transformacja

### Selenium Java (źródło)

```java
public class LoginTest extends BaseTest {
    private LoginPage loginPage;
    
    @BeforeMethod
    public void setUp() {
        driver.get(baseUrl + "/login");
        loginPage = new LoginPage(driver);
    }
    
    @AfterMethod
    public void tearDown() {
        driver.manage().deleteAllCookies();
    }
    
    @Test
    public void testSuccessfulLogin() {
        DashboardPage dashboard = loginPage.login("user@test.com", "pass123");
        assertEquals("Dashboard", driver.getTitle());
        assertTrue(dashboard.getWelcomeText().contains("Welcome"));
    }
    
    @Test
    public void testInvalidLogin() {
        loginPage.login("invalid@test.com", "wrong");
        assertTrue(loginPage.isErrorDisplayed());
        assertEquals("Invalid credentials", loginPage.getErrorMessage());
    }
    
    @Test(dataProvider = "loginData")
    public void testLoginVariations(String email, String password, boolean success) {
        loginPage.login(email, password);
        if (success) {
            assertEquals("Dashboard", driver.getTitle());
        } else {
            assertTrue(loginPage.isErrorDisplayed());
        }
    }
    
    @DataProvider(name = "loginData")
    public Object[][] loginData() {
        return new Object[][] {
            {"user@test.com", "pass123", true},
            {"invalid@test.com", "wrong", false},
            {"", "", false},
        };
    }
}
```

### Playwright TypeScript (cel)

```ts
import { expect, test } from '@playwright/test';
import { LoginPage } from '@/pages/LoginPage.page';
import { DashboardPage } from '@/pages/DashboardPage.page';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await loginPage.login('user@test.com', 'pass123');

    await expect(page).toHaveTitle('Dashboard');
    const dashboard = new DashboardPage(page);
    await expect(dashboard.welcomeMessage).toContainText('Welcome');
  });

  test('invalid login shows error message', async ({ page }) => {
    await loginPage.login('invalid@test.com', 'wrong');

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toHaveText('Invalid credentials');
  });
});

// Parametryzacja — osobny describe lub tablica
interface ILoginTestCase {
  email: string;
  password: string;
  expectSuccess: boolean;
  description: string;
}

const loginTestCases: ILoginTestCase[] = [
  { email: 'user@test.com', password: 'pass123', expectSuccess: true, description: 'valid credentials' },
  { email: 'invalid@test.com', password: 'wrong', expectSuccess: false, description: 'invalid password' },
  { email: '', password: '', expectSuccess: false, description: 'empty fields' },
];

test.describe('Login variations', () => {
  loginTestCases.forEach((tc) => {
    test(`login with ${tc.description}`, async ({ page }) => {
      const loginPage = new LoginPage(page);
      await page.goto('/login');
      await loginPage.login(tc.email, tc.password);

      if (tc.expectSuccess) {
        await expect(page).toHaveTitle('Dashboard');
      } else {
        await expect(loginPage.errorMessage).toBeVisible();
      }
    });
  });
});
```

## Custom fixtures — wzorzec

### Selenium Java (źródło) — BaseTest

```java
public abstract class BaseTest {
    protected WebDriver driver;
    
    @BeforeMethod
    public void baseSetUp() {
        driver = DriverFactory.create("chrome");
        driver.manage().window().maximize();
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    }
    
    @AfterMethod
    public void baseTearDown() {
        if (driver != null) driver.quit();
    }
}
```

### Playwright TypeScript (cel) — custom fixture

```ts
// src/fixtures/auth.fixture.ts
import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '@/pages/LoginPage.page';

interface AuthFixtures {
  authenticatedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.login(
      process.env.TEST_USER_EMAIL ?? 'test@example.com',
      process.env.TEST_USER_PASSWORD ?? 'password',
    );
    await page.waitForURL('**/dashboard');
    // Teraz page jest zalogowany — przekaż do testu
    await use(page);
    // Cleanup po teście (opcjonalnie)
  },
});

export { expect } from '@playwright/test';

// Użycie w teście:
// import { test, expect } from '@/fixtures/auth.fixture';
// test('dashboard shows data', async ({ authenticatedPage }) => { ... });
```

## Storage state — auth reuse (zamiast login w każdym teście)

```ts
// scripts/global-setup.ts — uruchamiany raz przed wszystkimi testami
import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com/login');
  await page.getByLabel('Email').fill('user@test.com');
  await page.getByLabel('Password').fill('pass123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
  // Zapisz cookies + localStorage
  await page.context().storageState({ path: '.auth/user.json' });
  await browser.close();
}

export default globalSetup;

// playwright.config.ts
export default defineConfig({
  globalSetup: './scripts/global-setup.ts',
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```

## Frames — mapowanie

### Selenium Java

```java
driver.switchTo().frame("iframe-name");
driver.findElement(By.id("inner-btn")).click();
driver.switchTo().defaultContent();  // wróć do głównej strony
```

### Playwright TypeScript

```ts
// Nie trzeba "switchTo" i "switchBack" — frameLocator to scoped query
const frame = page.frameLocator('#iframe-name');
await frame.locator('#inner-btn').click();
// Nie trzeba switchTo().defaultContent() — po prostu użyj page.locator()
```

## Multi-tab / popup — mapowanie

### Selenium Java

```java
String mainWindow = driver.getWindowHandle();
element.click(); // otwiera nowe okno
for (String handle : driver.getWindowHandles()) {
    if (!handle.equals(mainWindow)) {
        driver.switchTo().window(handle);
        break;
    }
}
// praca na nowym oknie
driver.close();
driver.switchTo().window(mainWindow);
```

### Playwright TypeScript

```ts
const popupPromise = page.waitForEvent('popup');
await page.locator('#open-new-tab').click();
const popup = await popupPromise;
// popup to nowy Page object — nie trzeba "switchTo"
await expect(popup).toHaveURL(/new-tab/);
await popup.close();
// page nadal działa — nie trzeba "switchBack"
```

## Select / Dropdown — mapowanie

### Selenium Java

```java
Select dropdown = new Select(driver.findElement(By.id("country")));
dropdown.selectByValue("PL");
dropdown.selectByVisibleText("Poland");
dropdown.selectByIndex(2);
String selected = dropdown.getFirstSelectedOption().getText();
```

### Playwright TypeScript

```ts
const dropdown = page.locator('#country');
await dropdown.selectOption({ value: 'PL' });
await dropdown.selectOption({ label: 'Poland' });
await dropdown.selectOption({ index: 2 });
// Multi-select
await dropdown.selectOption(['PL', 'DE', 'FR']);
```

## File upload — mapowanie

### Selenium Java

```java
WebElement fileInput = driver.findElement(By.css("input[type='file']"));
fileInput.sendKeys("/path/to/file.pdf");
```

### Playwright TypeScript

```ts
await page.locator('input[type="file"]').setInputFiles('path/to/file.pdf');
// Multiple files
await page.locator('input[type="file"]').setInputFiles(['file1.pdf', 'file2.pdf']);
// Clear
await page.locator('input[type="file"]').setInputFiles([]);
```

## JavaScript execution — mapowanie

### Selenium Java

```java
JavascriptExecutor js = (JavascriptExecutor) driver;
js.executeScript("arguments[0].scrollIntoView(true);", element);
String value = (String) js.executeScript("return document.title;");
js.executeScript("arguments[0].click();", element);  // force click
```

### Playwright TypeScript

```ts
// Scroll
await locator.scrollIntoViewIfNeeded();

// Evaluate
const title = await page.evaluate(() => document.title);

// Force click (omija auto-wait) — TYLKO gdy standardowy click nie działa
await locator.click({ force: true });

// Evaluate z argumentem
const text = await page.evaluate(
  (selector) => document.querySelector(selector)?.textContent,
  '.my-element',
);
```

## Network interception — mapowanie

### Selenium Java (brak natywnego, potrzebny proxy/CDP)

```java
// Selenium nie ma natywnego network interception
// Używano BrowserMob Proxy lub DevTools Protocol
```

### Playwright TypeScript (natywne)

```ts
// Mock API response
await page.route('**/api/users', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 1, name: 'User' }]),
  }),
);

// Intercept and modify
await page.route('**/api/data', (route) =>
  route.continue({ headers: { ...route.request().headers(), 'X-Custom': 'value' } }),
);

// Wait for specific API call
const responsePromise = page.waitForResponse('**/api/users');
await page.locator('#load-users').click();
const response = await responsePromise;
const data = await response.json();
```

## Visual regression — brak w Selenium, natywne w Playwright

```ts
// Screenshot comparison
await expect(page).toHaveScreenshot('dashboard.png');
await expect(locator).toHaveScreenshot('component.png');

// Z opcjami
await expect(page).toHaveScreenshot('dashboard.png', {
  maxDiffPixelRatio: 0.01,
  mask: [page.locator('.dynamic-date')],  // ignoruj dynamiczne elementy
});
```

## Konfiguracja — playwright.config.ts

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
```

## Mapowanie Selenium Java → Playwright TS — kompletna tabela

| Selenium Java | Playwright TypeScript |
|--------------|---------------------|
| `new ChromeDriver()` | `({ page }) =>` (auto) |
| `driver.quit()` | auto (lifecycle) |
| `driver.get(url)` | `await page.goto(url)` |
| `driver.navigate().back()` | `await page.goBack()` |
| `driver.navigate().forward()` | `await page.goForward()` |
| `driver.navigate().refresh()` | `await page.reload()` |
| `driver.getCurrentUrl()` | `page.url()` |
| `driver.getTitle()` | `await page.title()` |
| `driver.getPageSource()` | `await page.content()` |
| `driver.findElement(By.css())` | `page.locator('css')` |
| `driver.findElements(By.css())` | `page.locator('css')` (`.all()` / `.count()`) |
| `element.click()` | `await locator.click()` |
| `element.sendKeys("text")` | `await locator.fill("text")` |
| `element.sendKeys(Keys.ENTER)` | `await locator.press('Enter')` |
| `element.clear()` | `await locator.clear()` |
| `element.getText()` | `await locator.textContent()` |
| `element.getAttribute("x")` | `await locator.getAttribute("x")` |
| `element.getCssValue("color")` | `await locator.evaluate(el => getComputedStyle(el).color)` |
| `element.isDisplayed()` | `await locator.isVisible()` lub `expect(locator).toBeVisible()` |
| `element.isEnabled()` | `await locator.isEnabled()` lub `expect(locator).toBeEnabled()` |
| `element.isSelected()` | `await locator.isChecked()` |
| `new Select(el).selectByValue()` | `await locator.selectOption({ value: '...' })` |
| `new Actions(driver).moveToElement(el)` | `await locator.hover()` |
| `new Actions(driver).doubleClick(el)` | `await locator.dblclick()` |
| `new Actions(driver).contextClick(el)` | `await locator.click({ button: 'right' })` |
| `new Actions(driver).dragAndDrop(s,t)` | `await source.dragTo(target)` |
| `new Actions(driver).sendKeys(Keys.TAB)` | `await page.keyboard.press('Tab')` |
| `driver.switchTo().frame(el)` | `page.frameLocator('#frame')` |
| `driver.switchTo().defaultContent()` | (nie potrzebne) |
| `driver.switchTo().alert().accept()` | `page.on('dialog', d => d.accept())` |
| `driver.manage().deleteAllCookies()` | `await context.clearCookies()` |
| `driver.manage().window().maximize()` | config: `viewport: { width: 1920, height: 1080 }` |
| `((JavascriptExecutor) d).executeScript()` | `await page.evaluate(() => {})` |
| `((TakesScreenshot) d).getScreenshotAs()` | `await page.screenshot()` |
| `WebDriverWait(d, 10).until(EC.*)` | USUNĄĆ — auto-wait |
| `Thread.sleep(N)` | USUNĄĆ |
| `@Test` | `test('...', async ({ page }) => {})` |
| `@BeforeMethod` / `@BeforeEach` | `test.beforeEach(async ({ page }) => {})` |
| `@AfterMethod` / `@AfterEach` | `test.afterEach(async ({ page }) => {})` |
| `@BeforeClass` / `@BeforeAll` | `test.beforeAll(async () => {})` |
| `@AfterClass` / `@AfterAll` | `test.afterAll(async () => {})` |
| `@DataProvider` / `@ParameterizedTest` | `interface + array + forEach` |
| `@Test(groups = {"smoke"})` | `test('...', { tag: '@smoke' }, ...)` |
| `@Ignore` / `@Disabled` | `test.skip()` |
| `assertEquals(exp, act)` | `expect(act).toBe(exp)` |
| `assertTrue(cond)` | `expect(cond).toBeTruthy()` |
| `assertFalse(cond)` | `expect(cond).toBeFalsy()` |
| `assertNull(obj)` | `expect(obj).toBeNull()` |
| `assertNotNull(obj)` | `expect(obj).not.toBeNull()` |
| `assertThat(x).contains(y)` (AssertJ) | `expect(x).toContain(y)` |
