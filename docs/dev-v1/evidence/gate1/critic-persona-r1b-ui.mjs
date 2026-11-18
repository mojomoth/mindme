#!/usr/bin/env node
// Critic r1b: /pocs/persona 실제 흐름 (구현자 e2e 와 다른 입력)
// 분석 결과(mindme:events) 주입 → 이름·나이 변경 → 과거·사건·'사건 당시' → 사진 없이 아바타(기본) → 생성 → 편집(이름에 HTML, 성격 한 글자씩, 기억 줄 추가, 첫 인사)
// → 확정 → 새로고침 유지 → /pocs/chat 에서 선택·전송 → 번들/HTML 키 스캔. 모바일 390 + 데스크톱 1440.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const BASE = 'http://localhost:3101';
const OUT = new URL('.', import.meta.url).pathname;
const events = [
  { id: 'e_bori', title: '강아지 보리를 잃어버린 날', date: '2006-07', dateEstimated: false, age: 14, emotions: ['죄책감', '불안'], context: '산책하다 목줄을 놓쳤다.', people: ['동생 서준'], summary: '보리를 잃어버리고 사흘 동안 전단지를 붙였다.' },
  { id: 'e_wed', title: '준호와 결혼한 날', date: '2022-05', dateEstimated: false, age: 30, emotions: ['행복'], context: '', people: ['준호'], summary: '제주에서 작은 결혼식을 올렸다.' },
];
const VP = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
const result = {};
const browser = await chromium.launch();
for (const [vk, opts] of Object.entries(VP)) {
  const r = (result[vk] = { console: [], pageErrors: [], requests: [] });
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && r.console.push(m.text()));
  page.on('pageerror', (e) => r.pageErrors.push(e.message));
  page.on('response', (res) => res.url().includes('/api/') && r.requests.push(`${res.request().method()} ${new URL(res.url()).pathname} ${res.status()}`));
  await page.goto(`${BASE}/pocs/persona`, { waitUntil: 'networkidle' });
  await page.evaluate((ev) => { localStorage.clear(); localStorage.setItem('mindme:events', JSON.stringify({ events: ev })); }, events);
  await page.reload({ waitUntil: 'networkidle' });
  r.eventHint = await page.locator('text=기록 분석 결과').first().textContent().catch(() => null);

  await page.getByLabel('이름').fill('김서연');
  await page.getByLabel('지금 나이').fill('34');
  r.options = await page.getByRole('combobox').locator('option').allTextContents();
  await page.getByRole('combobox').selectOption('e_bori');
  r.ageAfterEvent = await page.locator('strong').filter({ hasText: '살' }).first().textContent();
  await page.getByRole('radio', { name: '사건 당시' }).click();
  await page.getByLabel('상황 설명').fill('비 오는 저녁, 공원 앞에서 보리 이름을 부르고 있다.');
  await page.screenshot({ path: `${OUT}critic-persona-r1b-ui-${vk}-form.png`, fullPage: true });

  await page.getByRole('button', { name: /아바타 만들기/ }).click();
  await page.getByAltText('만든 아바타').waitFor({ timeout: 30_000 });
  r.avatarNote = await page.locator('text=기본 캐릭터').first().textContent().catch(() => null);

  let t = Date.now();
  await page.getByRole('button', { name: '페르소나 만들기', exact: true }).click();
  const nameInput = page.getByLabel('페르소나 이름');
  await nameInput.waitFor({ timeout: 90_000 });
  r.personaMs = Date.now() - t;
  r.generatedName = await nameInput.inputValue();
  r.generated = {
    traits: await page.getByLabel('성격 (쉼표로 구분)').inputValue(),
    memories: await page.getByLabel('기억 (한 줄에 하나)').inputValue(),
    emotions: await page.getByLabel('감정 (쉼표로 구분)').inputValue(),
    greeting: await page.getByLabel('첫 인사').inputValue(),
    speech: await page.getByLabel('말투').inputValue(),
  };
  await page.screenshot({ path: `${OUT}critic-persona-r1b-ui-${vk}-result.png`, fullPage: true });

  // 편집
  const newName = `<img src=x onerror=window.__x=1> 서연${vk === 'mobile' ? 'M' : 'D'}`;
  await nameInput.fill(newName);
  const traits = page.getByLabel('성격 (쉼표로 구분)');
  await traits.click();
  await traits.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
  await traits.pressSequentially(', 겁이 많음 ');
  r.traitsWhileTyping = await traits.inputValue();
  const mem = page.getByLabel('기억 (한 줄에 하나)');
  await mem.click();
  await mem.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
  await mem.pressSequentially('\n보리 목줄은 빨간색이었다');
  await page.getByLabel('첫 인사').fill('보리야… 아, 너구나. 같이 좀 찾아 줄래?');
  await page.getByRole('button', { name: '확정하고 저장하기' }).click();
  r.notice = await page.getByRole('status').textContent();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas') ?? '[]'));
  r.stored = stored.map((p) => ({ id: p.id, name: p.name, age: p.age, kind: p.kind, eventId: p.eventId, phase: p.phase, traits: p.traits, memLast: p.memories.at(-1), greeting: p.greeting, avatar: p.avatar?.slice(0, 60) }));
  await page.screenshot({ path: `${OUT}critic-persona-r1b-ui-${vk}-saved.png`, fullPage: true });

  // 새로고침 유지
  await page.reload({ waitUntil: 'networkidle' });
  r.savedListAfterReload = await page.locator('ul li span').allTextContents();
  await page.screenshot({ path: `${OUT}critic-persona-r1b-ui-${vk}-reloaded.png`, fullPage: true });

  // 대화 PoC
  await page.goto(`${BASE}/pocs/chat`, { waitUntil: 'networkidle' });
  r.chatOptions = await page.getByLabel('대화할 페르소나').locator('option').allTextContents();
  const id = stored[0]?.id;
  if (id) {
    await page.getByLabel('대화할 페르소나').selectOption(id);
    r.chatFirst = await page.locator('main p').first().textContent();
    await page.getByLabel('메시지').fill('보리 찾았어? 그리고 너 나중에 준호랑 결혼하는 거 알아?');
    t = Date.now();
    await page.getByRole('button', { name: '보내기' }).click();
    await page.locator('text=첫 글자').waitFor({ timeout: 60_000 });
    r.chatMs = Date.now() - t;
    r.chatAnswer = await page.locator('main p').nth(2).textContent();
    r.xssFired = await page.evaluate(() => window.__x === 1);
    await page.screenshot({ path: `${OUT}critic-persona-r1b-ui-${vk}-chat.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}critic-persona-r1b-ui.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
