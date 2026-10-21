import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'webkit.spec.ts',
  testIgnore: [],
  use: {
    ...base.use, channel: undefined, browserName: 'webkit',
    viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  },
});
