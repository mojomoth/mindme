#!/usr/bin/env node
// 사용법: pnpm shot <url> <desktop|mobile> <출력경로.png> [--full]
//   desktop = 1440x900, mobile = 390x844 (iPhone, 터치, DPR 3)
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

const [url, kind, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fullPage = process.argv.includes('--full');

if (!url || !out || !(kind in VIEWPORTS)) {
  console.error('사용법: node scripts/shot.mjs <url> <desktop|mobile> <out.png> [--full]');
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage(VIEWPORTS[kind]);
  const res = await page.goto(url, { waitUntil: 'networkidle' });
  if (!res?.ok()) throw new Error(`HTTP ${res?.status()} ${url}`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await page.screenshot({ path: out, fullPage });
  console.log(`saved ${out} (${kind})`);
} finally {
  await browser.close();
}
