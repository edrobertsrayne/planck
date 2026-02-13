# E2E Testing with Playwright

Comprehensive end-to-end testing suite for Planck using Playwright.

## Overview

This testing suite provides automated E2E tests for all Planck functionality:

- Authentication flows
- Navigation and routing
- CRUD operations (Classes, Modules, Lessons)
- Calendar functionality
- Module assignment workflow
- Form validation
- Responsive design

## Running Tests

### Run all tests

```bash
bun run test:e2e
```

### Run specific test file

```bash
bun run test:e2e navigation.spec.ts
```

### Debug mode

```bash
bun run test:e2e:debug
```

### View test report

```bash
bun run test:e2e:report
```

## Test Organization

```
tests/e2e/
├── fixtures/           # Test fixtures for auth, database, etc.
│   └── auth.fixture.ts # Authenticated user context
├── pages/              # Page Object Models (POMs)
│   ├── base.page.ts    # Base page with common methods
│   ├── auth.page.ts    # Authentication pages
│   ├── classes.page.ts # Classes list page
│   └── ...             # Other page models
├── helpers/            # Helper utilities
│   ├── db-helpers.ts   # Database seeding and cleanup
│   ├── date-helpers.ts # Date manipulation utilities
│   └── ...             # Other helpers
├── .auth/              # Stored authentication states
├── global-setup.ts     # Global test setup (runs once before all tests)
├── global-teardown.ts  # Global test teardown (runs once after all tests)
└── *.spec.ts           # Test files organized by feature
```

## Test Infrastructure

### Global Setup

The `global-setup.ts` file runs once before all tests and:

1. Creates a test database (`test-e2e.db`)
2. Runs database migrations
3. Seeds reference data (exam specifications, timetable config)
4. Creates a test user and saves authenticated state

### Global Teardown

The `global-teardown.ts` file runs once after all tests and:

1. Removes the test database
2. Cleans up authentication state files

### Test Database

- Uses SQLite database file: `test-e2e.db`
- Isolated from development database
- Automatically seeded with reference data
- Cleaned between test runs

### Authentication

Tests can use authenticated context by importing from the auth fixture:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test('protected page', async ({ page }) => {
	// Already authenticated as test user
	await page.goto('/dashboard');
	// ...
});
```

For unauthenticated tests, use the standard Playwright test import:

```typescript
import { test, expect } from '@playwright/test';

test('login page', async ({ page }) => {
	// Not authenticated
	await page.goto('/login');
	// ...
});
```

## Database Helpers

The `helpers/db-helpers.ts` file provides utilities for working with the test database:

### Factory Functions

```typescript
import { createTestDb, createTestClass, createTestModule } from './helpers/db-helpers';

// In a test
const { db, sqlite } = createTestDb();

const testClass = await createTestClass(db, {
	name: '11X/Ph1',
	yearGroup: 11,
	examSpecId: 'test-gcse-aqa'
});

const testModule = await createTestModule(db, {
	name: 'Forces and Motion',
	targetSpecId: 'test-gcse-aqa'
});

sqlite.close();
```

### Seeded Data

The following reference data is automatically seeded in global setup:

**Exam Specifications:**

- GCSE AQA Physics (ID: `test-gcse-aqa`)
- A-Level AQA Physics (ID: `test-alevel-aqa`)

**Topics:**

- Energy (GCSE, ID: `test-topic-energy`)
- Mechanics (A-Level, ID: `test-topic-mechanics`)

**Spec Points:**

- Several spec points for each topic

**Timetable Config:**

- Academic year: 2024-25
- 2-week timetable (Week A/B)
- 6 periods per day, 5 days per week

**Test User:**

- Email: `test@example.com`
- Password: `password123`
- Name: Test User

## Page Object Models

Page Object Models (POMs) encapsulate page interactions to reduce code duplication and improve maintainability.

### Base Page

All POMs extend `BasePage` which provides common functionality:

```typescript
import { BasePage } from './base.page';

export class ClassesPage extends BasePage {
	async clickCreateClass() {
		await this.page.click('button:has-text("Create Class")');
	}
}
```

### Using POMs in Tests

```typescript
import { test, expect } from './fixtures/auth.fixture';
import { ClassesPage } from './pages/classes.page';

test('create a class', async ({ page }) => {
	const classesPage = new ClassesPage(page);

	await classesPage.goto();
	await classesPage.clickCreateClass();
	// ...
});
```

## Writing Tests

### Best Practices

1. **Use descriptive test names:** Test names should clearly describe what is being tested
2. **Use Page Object Models:** Encapsulate page interactions in POMs
3. **Clean up after yourself:** Use database helpers to create and clean test data
4. **Test user flows, not implementation:** Focus on what users do, not how the code works
5. **Keep tests independent:** Tests should not depend on each other
6. **Use proper selectors:** Prefer data-testid attributes or semantic selectors
7. **Wait for elements:** Use Playwright's auto-waiting, but add explicit waits when needed

### Example Test

```typescript
import { test, expect } from './fixtures/auth.fixture';
import { createTestDb, createTestClass } from './helpers/db-helpers';

test.describe('Classes', () => {
	test('should display classes list', async ({ page }) => {
		// Arrange: Create test data
		const { db, sqlite } = createTestDb();
		await createTestClass(db, {
			name: 'Test Class',
			yearGroup: 11,
			examSpecId: 'test-gcse-aqa'
		});
		sqlite.close();

		// Act: Navigate to classes page
		await page.goto('/classes');

		// Assert: Verify class is displayed
		await expect(page.locator('text=Test Class')).toBeVisible();
	});
});
```

## Headless Server Environment

This project runs on a headless server, so:

- All tests run in **headless mode** only
- Only **Chromium** browser is supported
- UI mode (`--ui`) and headed mode (`--headed`) are not available
- Debug mode uses `PWDEBUG=1` environment variable

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [pull_request]

jobs:
	test:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v3
			- uses: oven-sh/setup-bun@v1
			- run: bun install
			- run: bun run test:e2e
			- uses: actions/upload-artifact@v3
				if: always()
				with:
					name: playwright-report
					path: playwright-report/
```

## Troubleshooting

### Tests failing with "cannot connect to server"

Make sure the dev server is not already running on port 5173. The test runner will automatically start the server.

### Database errors

Delete the test database and let it be recreated:

```bash
rm -f test-e2e.db
bun run test:e2e
```

### Authentication errors

Delete saved auth state and let it be recreated:

```bash
rm -rf tests/e2e/.auth
bun run test:e2e
```

### Viewing test artifacts

Test screenshots, videos, and traces are saved in `test-results/` directory when tests fail. View the HTML report for details:

```bash
bun run test:e2e:report
```

## Next Steps

- [ ] Implement Page Object Models for all pages
- [ ] Add tests for all CRUD operations
- [ ] Add tests for module assignment workflow
- [ ] Add tests for calendar functionality
- [ ] Add tests for form validation
- [ ] Add tests for error handling
- [ ] Add tests for responsive design
- [ ] Set up CI/CD pipeline
