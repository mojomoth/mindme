// recheck-behavior-r1: NEW-story-future-leak. 실제 앱(3100) 04 모달 → 05 대화로 실제 AI 3회(past persona, chat, present persona).
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFileSync } from 'node:fs';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const BASE = 'http://localhost:3100';
const shot = (n) => `${EV}/recheck-behavior-r1-story-${n}.png`;
const { buildPersonaInput, selectedEvent, PersonaGenerateRequestSchema } = await import(`${REPO}/packages/core/src/persona/persona.ts`);

const story = '첫 출근 날 사수가 말이 없어서 눈치를 많이 봤어요. 점심시간에는 회사 옥상에서 혼자 김밥을 먹었던 게 아직도 기억나요.';
const profile = { name: '한서윤', currentAge: 29, story };
const ev = (id, title, date, extra) => ({ id, title, date, dateEstimated: false, emotions: ['긴장'], context: '', people: [], summary: '', ...extra });
const events = [
  ev('evt_01', '중학교 졸업식 날', '2012-02-14', { emotions: ['아쉬움', '설렘'], people: ['민지'], summary: '민지와 교복에 낙서하며 사진을 찍고 고등학교에서도 연락하자고 약속했다.' }),
  ev('evt_02', '수능 끝난 날', '2015-11-12', { emotions: ['홀가분함'], people: ['엄마'], summary: '시험장을 나와 엄마와 떡볶이를 먹었다.' }),
  ev('evt_03', '첫 출근에 말 없는 사수 앞에서 긴장한 날', '첫 출근 날', { dateEstimated: true, emotions: ['긴장', '눈치'], people: ['사수'], summary: '첫 출근 날 사수가 말이 없어서 눈치를 많이 봤다.' }),
  ev('evt_04', '팀 회식에서 건배사를 한 날', '2023-12-20', { emotions: ['쑥스러움'], people: ['팀장님'], summary: '연말 팀 회식에서 처음으로 건배사를 했다.' }),
];
const pBase = { kind: 'past', phase: 'after', traits: ['수줍음'], speechStyle: '반말', emotions: ['설렘'] };
const seedPersonas = [
  { ...pBase, id: 'per_seed26', name: '팀 회식에서 건배사를 한 날의 한서윤', age: 26, eventId: 'evt_04', memories: ['연말 회식에서 건배사를 했다'], greeting: '건배사 하고 나니까 얼굴이 아직도 뜨거워.' },
  { ...pBase, id: 'per_seed15', name: '중학교 졸업식 날의 한서윤', age: 15, eventId: 'evt_01', memories: ['민지랑 교복에 낙서했다'], greeting: '졸업식 끝났는데 아직 실감이 안 나.' },
];
const LEAK = /출근|사수|회사|입사|직장|팀장|월급|회식|건배/;
const STORY_ONLY = /옥상|김밥/; // 이야기에만 있는 세부(사건 evt_03 요약에는 없음)

const out = { at: new Date().toISOString(), target: BASE, viewport: '390x844', setup: { profile, events: events.map((e) => ({ id: e.id, title: e.title, date: e.date, age: e.age ?? null })), seedPersonas: seedPersonas.map((p) => p.name) }, pure: {}, api: [], console: [], pageErrors: [], steps: {} };

// 1) AI 없이: 서버가 AI 에 넘기는 입력에 이야기 원문이 들어가는지
for (const [k, body] of Object.entries({
  past17: { kind: 'past', age: 17, situation: '고등학교 2학년, 기말고사를 앞두고 독서실에 다니던 때', events, profile },
  present29: { kind: 'present', age: 29, situation: '요즘 주말마다 혼자 등산을 다니고 있어요', events, profile },
})) {
  const req = PersonaGenerateRequestSchema.parse(body);
  const input = buildPersonaInput(req, selectedEvent(req));
  out.pure[k] = { hasStoryBlock: input.includes('[나의 이야기]'), hasStoryText: input.includes(story), leakTerms: [...new Set(input.match(new RegExp(LEAK, 'g')) ?? [])], storyOnlyTerms: [...new Set(input.match(new RegExp(STORY_ONLY, 'g')) ?? [])], chars: input.length };
}
console.log('pure', JSON.stringify(out.pure));

// 2) 실제 앱
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(([p, e, ps]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('mindme:')) localStorage.removeItem(k);
  localStorage.setItem('mindme:profile', JSON.stringify(p));
  localStorage.setItem('mindme:events', JSON.stringify(e));
  localStorage.setItem('mindme:personas', JSON.stringify(ps));
}, [profile, events, seedPersonas]);
const page = await ctx.newPage();
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && out.console.push({ type: m.type(), text: m.text().slice(0, 400) }));
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 400)));
const t0 = new Map();
page.on('request', (r) => {
  if (!r.url().includes('/api/')) return;
  t0.set(r, Date.now());
  if (r.url().endsWith('/api/persona')) {
    const b = r.postDataJSON();
    out.api.push({ url: '/api/persona', req: { kind: b.kind, age: b.age, situation: b.situation, eventId: b.eventId ?? null, phase: b.phase ?? null, eventsCount: b.events?.length, profile: b.profile, keys: Object.keys(b) } });
  }
});
page.on('response', async (r) => {
  if (!r.url().includes('/api/')) return;
  const rec = { url: r.url().replace(BASE, ''), status: r.status(), headersMs: Date.now() - (t0.get(r.request()) ?? Date.now()), crisis: r.headers()['x-crisis'] ?? null };
  out.api.push(rec);
});

const leakOf = (p) => {
  const text = [p.name, p.speechStyle, ...p.memories, p.greeting, ...p.traits, ...p.emotions].join('\n');
  return { leak: [...new Set(text.match(new RegExp(LEAK, 'g')) ?? [])], storyOnly: [...new Set(text.match(new RegExp(STORY_ONLY, 'g')) ?? [])] };
};
const personasNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas')));

async function modalCreate(situation, age, label) {
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.locator('#pm-situation').fill(situation);
  await page.locator('#pm-age').fill(String(age));
  out.steps[`${label}Pill`] = await dialog.locator('output').innerText();
  await page.screenshot({ path: shot(`${label}-modal`), animations: 'disabled' });
  const before = (await personasNow()).length;
  const t = Date.now();
  await dialog.getByRole('button', { name: '생성하기' }).click();
  if (await page.getByRole('button', { name: '새로 만들기' }).isVisible().catch(() => false)) {
    out.steps[`${label}SameNamed`] = true;
    await page.getByRole('button', { name: '새로 만들기' }).click();
  }
  await page.waitForFunction((n) => (JSON.parse(localStorage.getItem('mindme:personas')) ?? []).length > n, before, { timeout: 180_000 });
  await page.locator('li button').first().waitFor();
  await page.waitForTimeout(600);
  const made = (await personasNow())[0];
  out.steps[label] = { ms: Date.now() - t, persona: { id: made.id, name: made.name, kind: made.kind, age: made.age, eventId: made.eventId ?? null, traits: made.traits, speechStyle: made.speechStyle, memories: made.memories, emotions: made.emotions, greeting: made.greeting }, check: leakOf(made) };
  await page.screenshot({ path: shot(`${label}-list`), animations: 'disabled' });
  return made;
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('li button').first().waitFor({ timeout: 15_000 });
  out.steps.seededList = await page.locator('li button strong').allInnerTexts();

  // 과거 17살 (실제 AI 1)
  const past = await modalCreate('고등학교 2학년, 기말고사를 앞두고 독서실에 다니던 때', 17, 'past17');

  // 05 대화 '요즘 무슨 일 있었어?' (실제 AI 2)
  await page.locator('li button', { hasText: past.name }).first().click();
  const box = page.getByRole('textbox', { name: '메시지' });
  await box.waitFor();
  await box.fill('요즘 무슨 일 있었어?');
  await page.getByRole('button', { name: '보내기' }).click();
  await page.waitForFunction((id) => (JSON.parse(localStorage.getItem(`mindme:chat:${id}`) ?? '[]').at(-1)?.role === 'assistant' && JSON.parse(localStorage.getItem(`mindme:chat:${id}`)).length >= 3), past.id, { timeout: 120_000 });
  await page.waitForTimeout(800);
  const chat = await page.evaluate((id) => JSON.parse(localStorage.getItem(`mindme:chat:${id}`)), past.id);
  const reply = chat.at(-1).content;
  out.steps.chat = { sent: '요즘 무슨 일 있었어?', reply, leak: [...new Set(reply.match(new RegExp(LEAK, 'g')) ?? [])], storyOnly: [...new Set(reply.match(new RegExp(STORY_ONLY, 'g')) ?? [])], alerts: await page.getByRole('alert').allInnerTexts() };
  await page.screenshot({ path: shot('past17-chat'), animations: 'disabled' });
  await page.getByRole('button', { name: '나가기' }).click();
  await page.locator('li button').first().waitFor();

  // 현재 29살 (실제 AI 3)
  await modalCreate('요즘 주말마다 혼자 등산을 다니고 있어요', 29, 'present29');
  out.steps.finalList = await page.locator('li button strong').allInnerTexts();
} catch (e) {
  out.error = String(e).slice(0, 800);
  await page.screenshot({ path: shot('error'), animations: 'disabled' }).catch(() => {});
} finally {
  await browser.close();
}
out.verdict = {
  pastPromptHasStory: out.pure.past17.hasStoryBlock || out.pure.past17.hasStoryText,
  presentPromptHasStory: out.pure.present29.hasStoryBlock && out.pure.present29.hasStoryText,
  pastPersonaLeak: out.steps.past17?.check.leak ?? null,
  pastChatLeak: out.steps.chat?.leak ?? null,
  presentStoryOnlyTerms: out.steps.present29?.check.storyOnly ?? null,
  presentLeakTerms: out.steps.present29?.check.leak ?? null,
};
writeFileSync(`${EV}/recheck-behavior-r1-story.json`, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ steps: out.steps, verdict: out.verdict, api: out.api, console: out.console, pageErrors: out.pageErrors, error: out.error }, null, 1));
