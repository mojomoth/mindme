#!/usr/bin/env node
// Gate 3 정리 후 회귀 확인 (실제 AI). 사용법: node docs/dev-v1/evidence/gate3/cleanup-flow.mjs
// 랜딩 → 만들기(카톡 TXT·이야기·사진) → 진행 → 목록 → 대화 1회 → /pocs 목록·페르소나 PoC 사진 줄이기
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const WEB = 'http://localhost:3100';
const POCS = 'http://localhost:3101';
const OUT = 'docs/dev-v1/evidence/gate3';

// 키 값은 출력하지 않는다. 응답 본문에 섞였는지만 센다.
const keyVals = readFileSync('.env', 'utf8')
  .split('\n')
  .map((l) => l.match(/^\s*([A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*["']?([^"'\s]+)/))
  .filter((m) => m && m[2].length >= 8)
  .map((m) => m[2]);

const log = { checks: {}, console: [], keyHits: 0, bodies: 0 };
const t0 = Date.now();
const check = (k, v) => {
  log.checks[k] = v;
  console.log(`CHECK ${k} = ${JSON.stringify(v)}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
page.on('response', (res) => {
  if (/image|font/.test(res.headers()['content-type'] ?? '')) return;
  res
    .text()
    .then((b) => {
      log.bodies++;
      if (keyVals.some((k) => b.includes(k)) || /sk-(proj-)?[A-Za-z0-9_-]{24,}/.test(b)) log.keyHits++;
    })
    .catch(() => {});
});
const shot = (name) => page.screenshot({ path: `${OUT}/cleanup-${name}.png` });
const pick = async (button, file) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles(file);
};
const LIST = () => page.getByRole('heading', { name: '나의 페르소나' });

try {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
  await shot('01-landing');
  await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 8000 });

  await pick(page.getByRole('button', { name: /TXT 파일 업로드/ }), 'docs/dev-v1/evidence/gate2/critic-e2e-r1-kakao.txt');
  await page.getByLabel('나의 이야기').fill('그림 얘기만 나오면 신이 나. 회사를 그만두고 작업실에서 전업 화가로 버티는 중이고, 언젠가 개인전을 여는 게 꿈이야.');
  await page.getByLabel('이름').fill('한도윤');
  await page.getByLabel(/지금 나이/).fill('28');
  await pick(page.getByRole('button', { name: '사진 업로드' }), 'pocs/fixtures/persona/synthetic-face.jpg');
  await page.waitForTimeout(400);
  await shot('02-create');

  const tc = Date.now();
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.getByRole('heading', { name: '페르소나를 만들고 있어요' }).waitFor();
  await LIST().waitFor({ timeout: 360_000 });
  await page.waitForTimeout(500);
  await shot('03-list');
  const personas = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas') ?? '[]'));
  check('create', {
    ms: Date.now() - tc,
    count: personas.length,
    kinds: personas.map((p) => p.kind),
    avatars: personas.map((p) => (p.avatar ? p.avatar.slice(0, 22) : null)),
  });

  await page.locator('ul li button').first().click();
  await page.getByRole('button', { name: '프로필 보기' }).waitFor();
  const box = page.getByLabel('메시지');
  await box.fill('요즘 제일 마음 쓰이는 게 뭐야?');
  const bubbles = page.locator('main section p[class*="bubbleIn"]:not([aria-label])');
  const before = await bubbles.count();
  await page.keyboard.press('Enter');
  let len = 0;
  let still = Date.now();
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    if ((await page.locator('main [role=alert]').count()) > 0) break;
    if ((await bubbles.count()) > before) {
      const l = ((await bubbles.last().textContent()) ?? '').length;
      if (l !== len) (len = l), (still = Date.now());
      else if (Date.now() - still > 2500 && (await page.getByLabel('입력 중').count()) === 0) break;
    }
    await page.waitForTimeout(100);
  }
  check('chat', { replyLen: len, alert: (await page.locator('main [role=alert]').count()) > 0, reply: (await bubbles.last().textContent())?.slice(0, 120) });
  await shot('04-chat');

  // pocs: 목록(준비 중 분기 제거 후) + 페르소나 PoC 사진 줄이기(@mindme/ui shrinkImage)
  await page.goto(`${POCS}/pocs`, { waitUntil: 'networkidle' });
  check('pocsIndex', { links: await page.locator('ul li a').count(), badges: await page.locator('ul li a span span').allTextContents() });
  await shot('05-pocs-index');
  await page.goto(`${POCS}/pocs/persona`, { waitUntil: 'networkidle' });
  await pick(page.getByRole('button', { name: '얼굴 사진 올리기' }), 'pocs/fixtures/persona/synthetic-face.jpg');
  await page.getByAltText('올린 사진').waitFor({ timeout: 10_000 });
  check('pocsPhoto', await page.getByText(/KB 로 줄였어요/).textContent());
  await shot('06-pocs-persona-photo');
} catch (e) {
  log.error = String(e.message ?? e).slice(0, 300);
  console.log('ERROR', log.error);
  await shot('error').catch(() => {});
} finally {
  await page.waitForTimeout(500);
  log.seconds = +((Date.now() - t0) / 1000).toFixed(1);
  writeFileSync(`${OUT}/cleanup-flow.json`, JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ console: log.console, keyHits: log.keyHits, bodies: log.bodies, seconds: log.seconds }));
  await browser.close();
}
