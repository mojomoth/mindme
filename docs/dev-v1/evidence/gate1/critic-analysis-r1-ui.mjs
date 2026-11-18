// Critic(analysis r1): /pocs/analysis 실조작. 업로드 → 분석 → 추가·수정·삭제 → 새로고침 유지.
// 사용법: node docs/dev-v1/evidence/gate1/critic-analysis-r1-ui.mjs <업로드할 TXT> <desktop|mobile>
import { chromium } from '@playwright/test';
import path from 'node:path';

const [file, kind = 'desktop'] = process.argv.slice(2);
const OUT = path.dirname(new URL(import.meta.url).pathname);
const VP = {
  desktop: { viewport: { width: 1280, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}[kind];
const log = (...a) => console.log(`[${kind}]`, ...a);
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext(VP);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('dialog', (d) => d.accept());

try {
  await page.goto('http://localhost:3101/pocs/analysis', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 업로드 (카카오톡 기본 선택, 이름 비움)
  await page.locator('input[type=file]').setInputFiles(file);
  const ta = page.getByLabel('내용 붙여넣기');
  await page.waitForFunction(() => document.querySelector('textarea')?.value.length > 0);
  log('업로드 후 글자 수', (await ta.inputValue()).length);

  const t0 = Date.now();
  await page.getByRole('button', { name: '분석하기' }).click();
  await page.getByRole('button', { name: '분석하기' }).waitFor({ timeout: 180_000 });
  const err = await page.locator('section[aria-label="입력"] p').last().textContent();
  const items = page.locator('ol > li');
  const n = await items.count();
  log('분석', ((Date.now() - t0) / 1000).toFixed(1) + 's', '사건', n, '| 마지막 문단:', err);
  const titles = async () => (await page.locator('ol > li h3').allTextContents()).join(' / ');
  const whens = async () => (await page.locator('ol > li > div:first-child').allTextContents()).join(' / ');
  log('제목', await titles());
  log('시점', await whens());
  await page.screenshot({ path: `${OUT}/critic-analysis-r1-${kind}-analyzed.png`, fullPage: true });

  // 추가: 연도 없는 시점 + 나이 → 출생연도로 정렬되어야 한다
  await page.getByRole('button', { name: '사건 추가' }).click();
  const form = page.locator('form').first();
  await form.getByLabel('제목').fill('크리틱 추가 사건');
  await form.getByLabel('시점').fill('고3 여름');
  await form.getByLabel('나이').fill('19');
  await form.getByLabel('감정 (쉼표로 구분)').fill('지침, 오기');
  await form.getByLabel('무슨 일이 있었나요').fill('독서실에서 밤을 새웠다.');
  await form.getByRole('button', { name: '저장' }).click();
  log('추가 후', await items.count(), '|', await titles());

  // 잘못된 값: 나이 200 → 오류 문구, 저장 안 됨
  await page.getByRole('button', { name: '사건 추가' }).click();
  const bad = page.locator('form').first();
  await bad.getByLabel('제목').fill('나이 오류');
  await bad.getByLabel('시점').fill('2020');
  await bad.getByLabel('나이').fill('200');
  await bad.getByRole('button', { name: '저장' }).click();
  log('잘못된 나이 오류문구:', await bad.locator('p').first().textContent().catch(() => '(없음)'));
  await bad.getByRole('button', { name: '취소' }).click();

  // 수정: 첫 사건 제목 변경
  await items.first().getByRole('button', { name: '수정' }).click();
  const edit = items.first().locator('form');
  await edit.getByLabel('제목').fill('크리틱이 고친 제목');
  await edit.getByRole('button', { name: '저장' }).click();
  log('수정 후', await titles());

  // 삭제: 마지막 사건
  const lastTitle = await items.last().locator('h3').textContent();
  await items.last().getByRole('button', { name: '삭제' }).click();
  log('삭제한 사건:', lastTitle, '→ 남은', await items.count());
  const before = await titles();

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('ol > li').first().waitFor();
  const after = await titles();
  log('새로고침 후', after);
  log('유지 여부', before === after ? 'OK' : 'MISMATCH');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:events') ?? '[]').map((e) => e.id + ':' + e.title));
  log('localStorage mindme:events', stored.join(' | '));
  await page.screenshot({ path: `${OUT}/critic-analysis-r1-${kind}-reloaded.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log('가로 넘침(px)', overflow);
} finally {
  log('오류', errors.length ? errors : '없음');
  await browser.close();
}
