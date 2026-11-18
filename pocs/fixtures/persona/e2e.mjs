#!/usr/bin/env node
// /pocs/persona 실제 흐름: 사건 선택 → 사진 업로드 → 아바타 생성 → 페르소나 생성 → 편집 → 확정(localStorage) → 대화 PoC 목록 확인.
// 사용법: node pocs/fixtures/persona/e2e.mjs [출력 디렉터리]   (dev 서버 3101 필요, 실제 AI 호출 2회)
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, '../../../docs/dev-v1/evidence/gate1'));
const base = 'http://localhost:3101';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}/pocs/persona`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('mindme:personas'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/persona-form-mobile.png`, fullPage: true });

  await page.getByRole('combobox').selectOption('evt_fight');
  await page.getByRole('radio', { name: '사건 직후' }).click();
  await page.getByLabel('상황 설명').fill('민수랑 싸우고 집에 돌아온 저녁. 방문 닫고 혼자 누워 있다.');

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '얼굴 사진 올리기' }).click();
  await (await chooser).setFiles(path.join(here, 'synthetic-face.jpg'));
  await page.getByAltText('올린 사진').waitFor();

  let t = Date.now();
  await page.getByRole('button', { name: '15살 아바타 만들기' }).click();
  await page.getByAltText('만든 아바타').waitFor({ timeout: 150_000 });
  const avatarMs = Date.now() - t;

  t = Date.now();
  await page.getByRole('button', { name: '페르소나 만들기' }).click();
  const nameInput = page.getByLabel('페르소나 이름');
  await nameInput.waitFor({ timeout: 90_000 });
  const personaMs = Date.now() - t;
  const name = await nameInput.inputValue();

  // 편집: 감정에 하나 더한다. 한 글자씩 쳐서 끝의 쉼표·띄어쓰기가 지워지지 않는지도 본다.
  const emotions = page.getByLabel('감정 (쉼표로 구분)');
  await emotions.click();
  await emotions.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length)); // 모바일 에뮬레이션에선 End 키가 커서를 못 옮긴다
  await emotions.pressSequentially(', 외로운 마음');
  await page.getByRole('button', { name: '확정하고 저장하기' }).click();
  await page.getByRole('status').waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas') ?? '[]'));
  await page.screenshot({ path: `${out}/persona-result-mobile.png`, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${out}/persona-result-desktop.png`, fullPage: true });

  await page.goto(`${base}/pocs/chat`, { waitUntil: 'networkidle' });
  const inChat = (await page.content()).includes(name);

  console.log(
    JSON.stringify({
      avatarMs,
      personaMs,
      name,
      saved: saved.length,
      savedEmotions: saved[0]?.emotions,
      avatarStored: `${saved[0]?.avatar?.slice(0, 22)}… ${saved[0]?.avatar?.length} chars`,
      inChat,
    }),
  );
} finally {
  await browser.close();
}
