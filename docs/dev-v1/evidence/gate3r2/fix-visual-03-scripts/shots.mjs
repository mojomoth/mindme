// VISUAL-03 수정 확인: 드래프트와 비슷한 페르소나 3개(가짜 /api/* 응답, AI 호출 없음)로 02·03·04·05 를 찍는다.
// 사용: node shots.mjs <before|after>  → evidence/gate3r2/fix-visual-03-<label>-<vp>-<screen>.png
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';
const { personaName } = await import('/Users/jeongyounglee/work/repo/mindme/packages/core/src/persona/persona.ts');

const label = process.argv[2] ?? 'after';
const BASE = 'http://localhost:3100';
const EV = '/Users/jeongyounglee/work/repo/mindme/docs/dev-v1/evidence/gate3r2';
const VP = {
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
};
const ev = (id, title, age, date) => ({ id, title, date, dateEstimated: false, age, emotions: ['설렘', '긴장'], context: '', people: ['민수'], summary: '요약' });
const events = [ev('evt_01', '중학교 생활', 15, '2015-03'), ev('evt_02', '졸업식 날', 19, '2019-02'), ev('evt_03', '첫 출근 날', 25, '2025-03')];
const greet = { 15: '꿈이 많던 중학생 시절의 나', 19: '새로운 시작을 앞둔 나', 25: '설렘과 긴장이 가득했던 하루' };
const at = new Date();
at.setHours(14, 30, 0, 0);
const t0 = at.getTime();

const browser = await chromium.launch();
const report = { label, at: new Date().toISOString(), viewports: {} };
for (const [vp, opts] of Object.entries(VP)) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/api/**', async (r) => {
    const url = r.request().url();
    if (url.endsWith('/api/analyze')) return r.fulfill({ json: { events, owner: { name: '홍길동', currentAge: 26 }, meta: { mode: 'direct', chunks: 1, units: 3, participants: [] } } });
    if (url.endsWith('/api/persona')) {
      const q = r.request().postDataJSON();
      const picked = q.events.find((e) => e.id === q.eventId);
      return r.fulfill({ json: { persona: { id: `per_${q.age}`, name: personaName(q.kind, q.age, q.profile.name, picked?.title), kind: q.kind, age: q.age, ...(picked ? { eventId: picked.id, phase: 'after' } : {}), traits: ['수줍음'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: greet[q.age] } } });
    }
    return r.abort();
  });
  const p = await ctx.newPage();
  const shot = async (name) => {
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const path = `${EV}/fix-visual-03-${label}-${vp}-${name}.png`;
    await p.screenshot({ path, animations: 'disabled' });
    return path;
  };
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.locator('#pc-story').waitFor({ timeout: 10_000 });
  await p.locator('#pc-story').fill('중학교 때 꿈이 많았어요.');
  await p.getByPlaceholder('홍길동').fill('홍길동');
  await p.getByPlaceholder('32').fill('26');
  await shot('02-create');
  await p.getByRole('button', { name: '페르소나 생성하기' }).click();
  await p.locator('li button').first().waitFor({ timeout: 20_000 });
  await shot('03-list');

  // 카드·히어로 실측 (CSS px)
  report.viewports[vp] = await p.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const rows = [...document.querySelectorAll('li button')];
    const sub = [...document.querySelectorAll('section p')].find((x) => x.textContent.includes('선택해 주세요'));
    const range = document.createRange();
    range.selectNodeContents(sub);
    const subText = range.getBoundingClientRect();
    const art = sub.parentElement.querySelector('img');
    return {
      cards: rows.map((b) => ({ ...r(b), name: b.querySelector('strong').textContent, isNew: Boolean(b.querySelector('em')), avatarBg: getComputedStyle(b.querySelector('span')).backgroundColor })),
      gaps: rows.slice(1).map((b, i) => Math.round(b.getBoundingClientRect().top - rows[i].getBoundingClientRect().bottom)),
      subTextRight: Math.round(subText.right), subTextY: [Math.round(subText.top), Math.round(subText.bottom)],
      heroArt: r(art),
      readyShown: Boolean(document.querySelector('[role=status]')),
    };
  });

  await p.getByRole('button', { name: '페르소나 생성' }).click();
  await p.getByRole('dialog').waitFor();
  await shot('04-modal');
  await p.keyboard.press('Escape');
  await p.getByRole('dialog').waitFor({ state: 'detached' });

  // 05: 15살과의 대화. 시각을 고정해 실행마다 같은 화면이 나오게 한다.
  await p.evaluate((t) => {
    localStorage.setItem('mindme:chat:per_15', JSON.stringify([
      { role: 'assistant', content: '안녕! 미래의 나는 어떻게 지내고 있어?', at: t },
      { role: 'user', content: '생각보다 잘 지내고 있어. 네가 문득 보고 싶었어.', at: t + 60_000 },
      { role: 'assistant', content: '정말? 나는 요즘 새 학기가 조금 걱정돼.', at: t + 61_000 },
    ]));
  }, t0);
  await p.locator('li button', { hasText: '15살의 홍길동' }).click();
  await p.getByRole('textbox', { name: '메시지' }).waitFor();
  await shot('05-chat');
  await ctx.close();
}
await browser.close();
await writeFile(`${EV}/fix-visual-03-${label}-measure.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
