#!/usr/bin/env node
// Gate 2 fix-visual-r1: 데스크톱 목업에서 스크롤한 내용이 상태바·다이내믹 아일랜드와 겹치지 않는지 확인.
// 사용법: node docs/dev-v1/evidence/gate2/fix-visual-r1-verify.mjs  (apps/web 3100 실행 중, AI 호출 없음)
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const OUT = 'docs/dev-v1/evidence/gate2';
const BASE = 'http://localhost:3100';
const persona = (id, name, kind, age) => ({ id, name, kind, age, traits: ['수줍음'], speechStyle: '반말', memories: ['체육대회 날 서진과 다툼'], emotions: ['서운함'], greeting: '…왔어? 오늘 좀 기분이 별로야.' });
const seed = {
  'mindme:profile': { name: '이지우', currentAge: 26 },
  'mindme:events': [],
  'mindme:personas': [
    persona('a', '체육대회 계주 일로 서진과 다툰 날의 이지우', 'past', 15),
    persona('b', '지금의 이지우', 'present', 26),
    persona('c', '30살의 이지우', 'future', 30),
    persona('d', '첫 출근 후 일주일을 돌아본 날의 이지우', 'past', 25),
    persona('e', '졸업하며 친구와 다른 학교로 갈라진 날의 이지우', 'past', 16),
  ],
};
const res = {};
const b = await chromium.launch();
// 상태바(화면 상단 57px) 아래에 놓인 요소 중 보이는 텍스트가 상태바 덮개보다 위에 그려지는지: elementFromPoint 로 상태바 영역 몇 점을 찍어 맨 위 요소를 본다.
const probe = (p) => p.evaluate(() => {
  const c = document.querySelector('main').parentElement;
  const sr = c.parentElement.getBoundingClientRect();
  const bar = c.parentElement.firstElementChild; // StatusBar
  const top = [];
  for (const x of [0.15, 0.3, 0.5, 0.7, 0.85]) for (const y of [10, 30, 50]) {
    const el = document.elementFromPoint(sr.left + sr.width * x, sr.top + y);
    top.push(bar.contains(el) || el === bar ? 'statusBar' : `${el?.tagName}.${String(el?.className).slice(0, 30)}`);
  }
  return { scrollTop: c.scrollTop, clientH: c.clientHeight, scrollH: c.scrollHeight, barBg: getComputedStyle(bar).backgroundColor, hits: [...new Set(top)] };
});
const wheel = async (p, dy) => { await p.mouse.move(720, 500); await p.mouse.wheel(0, dy); await p.waitForTimeout(500); };

{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 6000 });
  await p.evaluate(() => document.fonts.ready);
  res.create_top = await probe(p);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-desktop-02-top.png` });
  await wheel(p, 60);
  res.create_wheel60 = await probe(p);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-desktop-02-wheel60.png` });
  await wheel(p, 2000);
  res.create_bottom = await probe(p);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-desktop-02-bottom.png` });

  await p.evaluate((d) => { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); }, seed);
  await p.reload({ waitUntil: 'networkidle' });
  await p.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 8000 });
  await p.waitForTimeout(500);
  res.list_top = await probe(p);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-desktop-03-top.png` });
  await wheel(p, 2000);
  res.list_bottom = await probe(p);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-desktop-03-bottom.png` });

  // 05 대화: 자체 상단 바가 상태바 뒤를 채우므로 덮개가 없어야 한다(통과 화면 그대로)
  await wheel(p, -2000);
  await p.locator('ul li button').first().click();
  await p.getByRole('button', { name: '프로필 보기' }).waitFor();
  await p.waitForTimeout(500);
  res.chat = await probe(p);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-desktop-05-chat.png` });
  await p.close();
}
{
  // 모바일(<=600px): 목업·상태바 없음 → 영향 없음
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 6000 });
  res.mobile_statusBarDisplay = await p.evaluate(() => getComputedStyle(document.querySelector('main').parentElement.parentElement.firstElementChild).display);
  await p.screenshot({ path: `${OUT}/fix-visual-r1-mobile-02-create.png` });
  await p.close();
}
await writeFile(`${OUT}/fix-visual-r1-verify.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
await b.close();
