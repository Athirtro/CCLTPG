import { test as base } from '@playwright/test';

import { clearRateLimits } from './rate-limits.js';

export const test = base.extend<{}>({});

test.beforeEach(async () => {
  await clearRateLimits();
});
