#!/usr/bin/env node
// AI 없이 확인하는 상태: 실패 화면(다시 시도), 360px 목록 겹침, 오프라인 대화 실패 안내. 사용법: node docs/dev-v1/evidence/gate2/web-states.mjs
import { chromium } from '@playwright/test';
const OUT = 'docs/dev-v1/evidence/gate2';
const BASE = 'http://localhost:3100';
const b = await chromium.launch();
const out = {};
const persona = (id, name, kind, age) => ({ id, name, kind, age, traits: ['수줍음'], speechStyle: '반말', memories: ['체육대회 날 서진과 다툼'], emotions: ['서운함'], greeting: '…왔어? 오늘 좀 기분이 별로야.' });
const seed = {
  'mindme:profile': { name: '이지우', currentAge: 26 },
  'mindme:events': [],
  'mindme:personas': [persona('a', '체육대회 계주 일로 서진과 다툰 날의 이지우', 'past', 15), persona('b', '지금의 이지우', 'present', 26), persona('c', '30살의 이지우', 'future', 30)],
};

// 1) 실패 → 다시 시도 (analyze 를 502 로 막는다)
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  let calls = 0;
  await p.route('**/api/analyze', (r) => (calls++, r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream_error', message: '기록을 분석하지 못했어요. 잠시 뒤 다시 시도해 주세요.' } }) })));
  await p.goto(BASE);
  await p.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 6000 });
  await p.getByLabel('나의 이야기').fill('중학교 때 친구와 크게 싸운 적이 있어.');
  await p.getByLabel(/지금 나이/).fill('26');
  await p.getByRole('button', { name: '페르소나 생성하기' }).click();
  await p.getByRole('heading', { name: '페르소나를 만들지 못했어요' }).waitFor();
  await p.screenshot({ path: `${OUT}/web-state-desktop-error.png` });
  await p.getByRole('button', { name: '다시 시도' }).click();
  await p.getByRole('heading', { name: '페르소나를 만들지 못했어요' }).waitFor();
  out.retryCalls = calls;
  out.errorText = await p.locator('main [role=alert]').textContent();
  await p.getByRole('button', { name: '입력 화면으로' }).click();
  out.backToCreateKeepsStory = (await p.getByLabel('나의 이야기').inputValue()).length > 0;
  await p.close();
}

// 2) 360px 목록 + 대화 실패 안내(오프라인)
{
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.addInitScript((d) => { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); }, seed);
  await p.goto(BASE);
  await p.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 6000 });
  out.overlap360 = await p.evaluate(() => {
    const art = document.querySelector('[class*=heroArt] img').getBoundingClientRect();
    return [...document.querySelectorAll('[class*=hero] h2, [class*=hero] p')].map((el) => {
      const r = el.getBoundingClientRect();
      // 글자 끝(줄 단위 range)과 캐릭터 그림이 겹치는지
      const range = document.createRange(); range.selectNodeContents(el);
      const hit = [...range.getClientRects()].some((t) => t.right > art.left + 20 && t.bottom > art.top && t.top < art.bottom);
      return { text: el.textContent, hit };
    });
  });
  out.hScroll360 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await p.screenshot({ path: `${OUT}/web-state-mobile360-list.png` });
  await p.route('**/api/chat', (r) => r.abort('internetdisconnected'));
  await p.locator('ul li button').first().click();
  await p.getByLabel('메시지').fill('그날 기억나?');
  await p.keyboard.press('Enter');
  await p.locator('main [role=alert]').waitFor();
  out.chatOfflineText = await p.locator('main [role=alert]').textContent();
  await p.screenshot({ path: `${OUT}/web-state-mobile360-chat-offline.png` });
  await p.close();
}
await b.close();
console.log(JSON.stringify(out, null, 2));
