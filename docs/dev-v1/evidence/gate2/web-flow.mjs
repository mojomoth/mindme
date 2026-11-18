#!/usr/bin/env node
// Gate 2 web-app 전체 플로우 (실제 AI). 사용법: node docs/dev-v1/evidence/gate2/web-flow.mjs <desktop|mobile> [--photo]
// 01 랜딩 → 02 만들기(카톡 TXT + 이야기 + 이름·나이 [+ 사진]) → 진행 → 03 목록 → 04 모달(미래 30살) → 진행 → 03
// → 05 대화(스트리밍) → 프로필 시트 수정 → 나가기 → 새로고침 후 목록·대화 복원
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = 'docs/dev-v1/evidence/gate2';
const kind = process.argv[2];
const withPhoto = process.argv.includes('--photo');
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
if (!VIEWPORTS[kind]) throw new Error('desktop | mobile');

const log = { kind, withPhoto, steps: [], console: [], checks: {} };
const t0 = Date.now();
const mark = (step, extra = {}) => {
  const e = { step, t: +((Date.now() - t0) / 1000).toFixed(1), ...extra };
  log.steps.push(e);
  console.log(JSON.stringify(e));
};

const browser = await chromium.launch();
const page = await browser.newPage(VIEWPORTS[kind]);
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
let n = 0;
const shot = async (name) => {
  const path = `${OUT}/web-flow-${kind}-${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path });
  mark(`shot ${name}`);
};
const pick = async (button, file) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles(file);
};
// 앱 화면의 스크롤 영역(PhoneFrame content)
const scrollState = () =>
  page.evaluate(() => {
    const el = document.querySelector('main').parentElement;
    return { atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2, scrollWidth: document.documentElement.scrollWidth, innerWidth };
  });

try {
  // 01 랜딩 → 3초 뒤 02
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await shot('landing');
  const tl = Date.now();
  await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 6000 });
  log.checks.landingToCreateMs = Date.now() - tl;

  // 02 만들기
  await pick(page.getByRole('button', { name: /TXT 파일 업로드/ }), 'pocs/fixtures/analysis/kakao-pc.txt');
  await page.getByLabel('나의 이야기').fill('사람들 앞에서는 긴장하지만 친한 친구랑은 장난을 많이 쳐. 요즘은 첫 회사에 적응하는 중이고, 언젠가 작은 책방을 열고 싶어.');
  await page.getByLabel('이름').fill('이지우');
  await page.getByLabel(/지금 나이/).fill('26');
  if (withPhoto) await pick(page.getByRole('button', { name: '사진 업로드' }), 'pocs/fixtures/persona/synthetic-face.jpg');
  await page.waitForTimeout(300);
  await shot('create');

  // 진행 → 03 목록
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.getByRole('heading', { name: '페르소나를 만들고 있어요' }).waitFor();
  await page.waitForTimeout(800);
  await shot('working');
  await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 300_000 });
  await page.waitForTimeout(500);
  const firstNames = await page.locator('ul li strong').allTextContents();
  log.checks.firstPersonas = firstNames;
  log.checks.readyPill = await page.getByText('페르소나가 준비됐어요').isVisible();
  await shot('list');

  // 04 모달: Esc 로 닫힘 확인 → 다시 열어 미래 30살
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  log.checks.modalEscCloses = (await page.getByRole('dialog').count()) === 0;
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  await page.getByLabel('상황 설명').fill('작은 책방을 열어서 아침마다 커피를 내리고 손님과 책 이야기를 나누고 싶어.');
  const slider = page.getByLabel('그때의 나이');
  await slider.focus();
  const start = Number(await slider.inputValue());
  for (let i = start; i < 30; i++) await page.keyboard.press('ArrowRight');
  log.checks.modalAge = await slider.inputValue();
  log.checks.modalNote = await page.locator('form[role=dialog] p[aria-live]').textContent();
  await page.waitForTimeout(600); // 열림 애니메이션
  await shot('modal');
  await page.getByRole('button', { name: '생성하기' }).click();
  await page.getByRole('heading', { name: '페르소나를 만들고 있어요' }).waitFor();
  await page.waitForTimeout(800);
  await shot('working-modal');
  await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 200_000 });
  await page.waitForTimeout(500);
  log.checks.afterModal = await page.locator('ul li strong').allTextContents();
  await shot('list-new');

  // 05 대화
  const target = log.checks.afterModal[0];
  await page.locator('ul li button').first().click();
  await page.getByRole('heading', { name: target }).waitFor();
  await shot('chat');
  const box = page.getByLabel('메시지');
  await box.fill('');
  await box.type('첫줄');
  await page.keyboard.press('Shift+Enter');
  await box.type('둘째줄');
  log.checks.shiftEnterNewline = (await box.inputValue()) === '첫줄\n둘째줄';
  await box.fill('그 책방은 지금 어때? 처음 열었을 때 기분은 어땠어?');
  const before = await page.locator('main section p').count();
  await page.keyboard.press('Enter');
  await page.getByLabel('입력 중').waitFor({ timeout: 10_000 }).then(() => shot('chat-typing')).catch(() => mark('typing dots not caught'));
  await page.waitForFunction(() => !document.querySelector('[aria-label="입력 중"]') && document.querySelector('button[aria-label="보내기"]'), null, { timeout: 60_000 });
  await page.getByLabel('메시지').fill('');
  await page.waitForFunction(
    () => !document.querySelector('main')?.getAttribute('aria-busy') && document.querySelectorAll('main section p').length > 0,
  );
  await page.waitForTimeout(3000); // 스트림 끝까지
  log.checks.chatBubbles = (await page.locator('main section p').count()) - before;
  log.checks.chatReply = (await page.locator('main section > div').last().textContent())?.slice(0, 200);
  log.checks.chatScroll = await scrollState();
  await shot('chat-reply');

  // 프로필 시트: 감정 하나 추가 → 저장 → 다시 열어 확인
  await page.getByRole('button', { name: '프로필 보기' }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(600);
  await shot('profile');
  const emo = page.getByLabel(/^감정/);
  await emo.fill(`${await emo.inputValue()}, 설렘`);
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: '프로필 보기' }).click();
  log.checks.profileSaved = (await page.getByLabel(/^감정/).inputValue()).includes('설렘');
  await page.keyboard.press('Escape');
  log.checks.sheetEscCloses = (await page.getByRole('dialog').count()) === 0;
  // 시트를 열고 닫아도 화면(상태바·헤더)이 밀려 있지 않아야 한다
  log.checks.screenNotShifted = await page.evaluate(() => [...document.querySelectorAll('main')].every((m) => {
    let el = m.parentElement;
    while (el && el !== document.body) { if (el.scrollTop && getComputedStyle(el).overflow === 'hidden') return false; el = el.parentElement; }
    return true;
  }));
  await shot('chat-after-sheet');

  // 나가기 → 새로고침 → 랜딩 → 목록, 대화 복원
  await page.getByRole('button', { name: '나가기' }).click();
  await page.getByRole('heading', { name: '나의 페르소나' }).waitFor();
  log.checks.readyPillAfterChat = await page.getByText('페르소나가 준비됐어요').isVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 6000 });
  log.checks.reloadGoesToList = true;
  log.checks.listScroll = await scrollState();
  await shot('list-reloaded');
  await page.locator('ul li button').first().click();
  await page.getByRole('heading', { name: target }).waitFor();
  log.checks.restoredBubbles = await page.locator('main section > div').count();
  await shot('chat-restored');
  log.checks.storage = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])),
  );
  log.ok = true;
} catch (err) {
  log.ok = false;
  log.error = String(err);
  await page.screenshot({ path: `${OUT}/web-flow-${kind}-error.png` }).catch(() => {});
} finally {
  log.totalSec = (Date.now() - t0) / 1000;
  await writeFile(`${OUT}/web-flow-${kind}.json`, JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ ok: log.ok, error: log.error, checks: log.checks, console: log.console }, null, 2));
  await browser.close();
}
