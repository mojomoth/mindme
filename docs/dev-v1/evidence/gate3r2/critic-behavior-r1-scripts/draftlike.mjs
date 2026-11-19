// 외형 비교 보조: 드래프트와 비슷한 데이터·상태(짧은 이름·문장, 준비 배지, 입력 중 표시)로 03·05 를 찍는다. /api/* 는 가짜 응답
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
const { personaName } = await import('/Users/jeongyounglee/work/repo/mindme/packages/core/src/persona/persona.ts');
const BASE = 'http://localhost:3100';
const EV = '/Users/jeongyounglee/work/repo/mindme/docs/dev-v1/evidence/gate3r2';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ev = (id, title, age, date) => ({ id, title, date, dateEstimated: false, age, emotions: ['설렘', '긴장'], context: '', people: ['민수'], summary: '요약' });
const events = [ev('evt_01', '중학교 생활', 15, '2015-03'), ev('evt_02', '졸업식 날', 19, '2019-02'), ev('evt_03', '첫 출근 날', 25, '2025-03')];
const greet = { 15: '꿈이 많던 중학생 시절의 나', 19: '새로운 시작을 앞둔 나', 25: '설렘과 긴장이 가득했던 하루' };
await ctx.route('**/api/**', async (r) => {
  const url = r.request().url();
  if (url.endsWith('/api/analyze')) return r.fulfill({ json: { events, owner: { name: '홍길동', currentAge: 26 }, meta: { mode: 'direct', chunks: 1, units: 3, participants: [] } } });
  if (url.endsWith('/api/persona')) {
    const q = r.request().postDataJSON();
    const picked = q.events.find((e) => e.id === q.eventId);
    return r.fulfill({ json: { persona: { id: `per_${q.age}`, name: personaName(q.kind, q.age, q.profile.name, picked?.title), kind: q.kind, age: q.age, ...(picked ? { eventId: picked.id, phase: 'after' } : {}), traits: ['수줍음'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: greet[q.age] ?? '안녕! 미래의 나는 어떻게 지내고 있어?' } } });
  }
  if (url.endsWith('/api/chat')) {
    await new Promise((res) => setTimeout(res, 15_000));
    return r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: '음… 친구들이랑 반이 갈릴까 봐.' });
  }
  return r.abort();
});
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.locator('#pc-story').waitFor({ timeout: 10_000 });
await p.locator('#pc-story').fill('중학교 때 꿈이 많았어요.');
await p.getByPlaceholder('홍길동').fill('홍길동');
await p.getByPlaceholder('32').fill('26');
await p.getByRole('button', { name: '페르소나 생성하기' }).click();
await p.locator('li button').first().waitFor({ timeout: 20_000 });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
await p.screenshot({ path: `${EV}/critic-behavior-r1-visual-draftlike-03-list.png`, animations: 'disabled' });
console.log(await p.locator('li button strong').allInnerTexts());

// 05: 15살 대화. 인사 → 나 → 그때의 나 → 나(입력 중 표시)
await p.evaluate(() => {
  const ps = JSON.parse(localStorage.getItem('mindme:personas'));
  const p15 = ps.find((x) => x.age === 15);
  p15.greeting = '안녕! 미래의 나는 어떻게 지내고 있어?';
  localStorage.setItem('mindme:personas', JSON.stringify(ps));
  const t = Date.now() - 120_000;
  localStorage.setItem(`mindme:chat:${p15.id}`, JSON.stringify([
    { role: 'assistant', content: '안녕! 미래의 나는 어떻게 지내고 있어?', at: t },
    { role: 'user', content: '생각보다 잘 지내고 있어. 네가 문득 보고 싶었어.', at: t + 60_000 },
    { role: 'assistant', content: '정말? 나는 요즘 새 학기가 조금 걱정돼.', at: t + 61_000 },
  ]));
});
await p.reload({ waitUntil: 'networkidle' });
await p.locator('li button').first().waitFor({ timeout: 10_000 });
await p.locator('li button', { hasText: '15살의 홍길동' }).click();
await p.getByRole('textbox', { name: '메시지' }).fill('어떤 게 제일 걱정돼?');
await p.getByRole('button', { name: '보내기' }).click();
await p.locator('p[aria-label="입력 중"]').waitFor({ timeout: 5_000 });
await p.waitForTimeout(500);
await p.screenshot({ path: `${EV}/critic-behavior-r1-visual-draftlike-05-chat.png`, animations: 'disabled' });
await b.close();
console.log('ok');
