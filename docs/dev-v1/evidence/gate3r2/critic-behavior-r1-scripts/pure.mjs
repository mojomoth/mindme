// Gate 3 r2 critic-behavior r1: 순수 함수 실측 (AI 호출 없음)
// 실행: node --conditions=react-server --experimental-test-module-mocks pure.mjs
import { mock } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';

const REPO = '/Users/jeongyounglee/work/repo/mindme';
const out = { at: new Date().toISOString(), checks: {} };

// persona-chat-1: 위기 키워드 (트리아지 MISS 문장 + 관용 표현 오탐)
{
  const { detectCrisis, detectCrisisInChat } = await import(`${REPO}/packages/core/src/chat/index.ts`);
  const hits = ['차라리 죽는 게 나아', '사는 게 의미가 없어', '살아야 할 이유가 없어', '죽어야겠다', 'i want to end my life', '그냥 영원히 자고 싶어', '살아서 뭐하나 싶어', '사는 게 무슨 의미가 있나 싶어', '죽을 거야 진짜'];
  const misses = ['배고파 죽겠어', '웃겨 죽겠다', '숙제 끝내고 싶어', '더워 죽는 줄 알았어', '귀여워 죽겠다', '시험 끝나서 살 것 같아'];
  const multi = detectCrisisInChat([
    { role: 'user', content: '요즘 사는 게 의미가 없어' },
    { role: 'assistant', content: '무슨 일 있어?' },
    { role: 'user', content: '아니 그냥' },
  ]);
  const r = { hits: Object.fromEntries(hits.map((s) => [s, detectCrisis(s)])), falsePositives: Object.fromEntries(misses.map((s) => [s, detectCrisis(s)])), earlierUserMessage: multi };
  r.pass = Object.values(r.hits).every(Boolean) && !Object.values(r.falsePositives).some(Boolean) && multi;
  out.checks['persona-chat-1-keywords'] = r;
}

// analysis-1: 여러 줄 메시지 속 날짜 구분선 모양 줄
{
  const { parseKakao } = await import(`${REPO}/packages/core/src/analysis/parse.ts`);
  const android = [
    '박서진 님과 카카오톡 대화',
    '2019년 3월 1일 금요일',
    '2019년 3월 1일 오후 11:50, 이지우 : 내일 일정 정리',
    '2019년 3월 2일 토요일',
    '오전 10시 학교 앞',
    '오후 2시 도서관',
    '2019년 3월 1일 오후 11:52, 박서진 : 오키',
    '2019년 3월 2일 토요일',
    '2019년 3월 2일 오전 9:00, 이지우 : 일어났어?',
  ].join('\n');
  const pc = [
    '박서진 님과 카카오톡 대화',
    '--------------- 2019년 3월 1일 금요일 ---------------',
    '[이지우] [오후 11:50] 내일 일정 정리',
    '2019년 3월 2일 토요일',
    '오전 10시 학교 앞',
    '오후 2시 도서관',
    '[박서진] [오후 11:52] 오키',
    '--------------- 2019년 3월 2일 토요일 ---------------',
    '[이지우] [오전 9:00] 일어났어?',
  ].join('\n');
  const a = parseKakao(android).messages;
  const p = parseKakao(pc).messages;
  const ok = (ms) =>
    ms.length === 3 &&
    ms[0].text === '내일 일정 정리\n2019년 3월 2일 토요일\n오전 10시 학교 앞\n오후 2시 도서관' &&
    ms[1].date === '2019-03-01' && ms[1].text === '오키' &&
    ms[2].date === '2019-03-02';
  // 회귀: 기존 예시 파일
  const mobileFx = parseKakao(await readFile(`${REPO}/pocs/fixtures/analysis/kakao-mobile.txt`, 'utf8'));
  const pcFx = parseKakao(await readFile(`${REPO}/pocs/fixtures/analysis/kakao-pc.txt`, 'utf8'));
  const leaked = (ms) => ms.filter((m) => /\d{4}년 \d{1,2}월 \d{1,2}일 [월화수목금토일]요일/.test(m.text)).map((m) => m.text.slice(0, 60));
  // 경계: 날짜 구분선 바로 뒤가 시스템 줄·파일 끝인 경우(트리아지: 이때도 구분선으로 본다)
  const edgeSystem = parseKakao(['2019년 3월 1일 오후 11:50, 이지우 : 잘 자', '2019년 3월 2일 토요일', '2019년 3월 2일 오전 8:00, 박서진님이 들어왔습니다.', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'].join('\n')).messages;
  const edgeEof = parseKakao(['2019년 3월 1일 오후 11:50, 이지우 : 잘 자', '2019년 3월 2일 토요일', ''].join('\n')).messages;
  out.checks['analysis-1'] = {
    android: a.map((m) => ({ date: m.date, author: m.author, text: m.text })),
    pc: p.map((m) => ({ date: m.date, author: m.author, text: m.text })),
    fixtures: {
      mobile: { messages: mobileFx.messages.length, me: mobileFx.me, dates: [...new Set(mobileFx.messages.map((m) => m.date))], leakedSeparators: leaked(mobileFx.messages) },
      pc: { messages: pcFx.messages.length, dates: [...new Set(pcFx.messages.map((m) => m.date))], leakedSeparators: leaked(pcFx.messages) },
    },
    edgeSystemNext: edgeSystem.map((m) => ({ date: m.date, text: m.text })),
    edgeEof: edgeEof.map((m) => ({ date: m.date, text: m.text })),
    pass: ok(a) && ok(p) && !leaked(mobileFx.messages).length && !leaked(pcFx.messages).length,
  };
}

// analysis-3: 구간 요약 경로에서 나이 단서가 최종 입력까지 가는지 (가짜 generate)
{
  const { analyzeRecords, DIRECT_CHARS, LlmAnalysisSchema } = await import(`${REPO}/packages/core/src/analysis/analyze.ts`);
  const lines = ['박서진 님과 카카오톡 대화', '2019년 3월 1일 금요일'];
  lines.push('2019년 3월 1일 오후 11:50, 이지우 : 나 95년생이야 그래서 너보다 한 살 많아');
  for (let d = 2; lines.join("\n").length < DIRECT_CHARS * 2; d++) {
    const day = ((d - 1) % 28) + 1;
    const mo = 3 + Math.floor((d - 1) / 28);
    lines.push(`2019년 ${mo}월 ${day}일 ${'월화수목금토일'[d % 7]}요일`);
    for (let i = 0; i < 20; i++) lines.push(`2019년 ${mo}월 ${day}일 오후 ${(i % 11) + 1}:${String(i).padStart(2, '0')}, ${i % 2 ? '박서진' : '이지우'} : 오늘 점심 뭐 먹었어 그냥 그랬어 ${i}`);
  }
  const calls = [];
  const generate = async ({ schema, system, input }) => {
    calls.push({ system: system.slice(0, 40), input });
    if (schema !== LlmAnalysisSchema) {
      const hasClue = input.includes('95년생');
      return { moments: [], ownerClues: hasClue ? ['2019-03-01 나 95년생이야 그래서 너보다 한 살 많아'] : [] };
    }
    return { events: [], owner: { name: '이지우', currentAge: null } };
  };
  const res = await analyzeRecords({ source: 'kakao', text: lines.join('\n'), me: '이지우' }, generate, '2026-11-19');
  const final = calls.at(-1).input;
  out.checks['analysis-3-fake'] = {
    chars: lines.join('\n').length,
    mode: res.meta.mode,
    chunks: res.meta.chunks,
    calls: calls.length,
    finalHasClue: final.includes('나이 단서:') && final.includes('95년생'),
    finalTail: final.slice(-160),
    pass: res.meta.mode === 'summarized' && final.includes('95년생'),
  };
}

// persona-chat-3: 설정 문구가 memories 에서 빠지는지 (personaFromDraft)
{
  const { personaFromDraft } = await import(`${REPO}/packages/core/src/persona/persona.ts`);
  const req = { kind: 'past', age: 9, situation: '', events: [], profile: { name: '김서연', currentAge: 30 } };
  const draft = {
    traits: ['수줍음'],
    speechStyle: '반말',
    memories: [
      '대화 상대는 어른이 된 나라는 건 알지만 잘 모르겠다',
      '이름은 김서연이고 지금 아홉 살이다',
      '어른이 된 나라는 사람이 말을 걸어서 신기하다',
      '내 이름은 서연이다',
      '아홉 살 이후의 일은 모른다',
      '운동회 날 달리기에서 넘어져서 울었다',
      '할머니 집 마당에서 강아지랑 놀았다',
      '내 이름을 친구가 놀려서 속상했다',
    ],
    emotions: ['설렘'],
    greeting: '안녕',
  };
  const p = personaFromDraft(req, draft, 'per_x', undefined);
  out.checks['persona-chat-3'] = {
    kept: p.memories,
    pass: p.memories.length === 3 && p.memories.includes('운동회 날 달리기에서 넘어져서 울었다') && p.memories.includes('내 이름을 친구가 놀려서 속상했다'),
  };
}

// NEW-local-env: OPENAI_API_KEY 없이 OPENAI_KEY 만 있어도 읽고, 둘 다 있으면 앞 이름 우선 (가짜 값)
{
  const saved = { a: process.env.OPENAI_API_KEY, b: process.env.OPENAI_KEY };
  delete process.env.OPENAI_API_KEY;
  process.env.OPENAI_KEY = 'fake-b';
  const env = await import(`${REPO}/packages/core/src/server/env.ts`);
  const onlyB = { has: env.hasKey('openai'), read: env.readKey('openai') === 'fake-b' };
  process.env.OPENAI_API_KEY = 'fake-a';
  const both = env.readKey('openai') === 'fake-a';
  process.env.OPENAI_API_KEY = '  ';
  const blankA = env.readKey('openai') === 'fake-b';
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_KEY;
  let noneMsg;
  try { env.readKey('openai'); } catch (e) { noneMsg = e.message; }
  const none = { has: env.hasKey('openai'), msg: noneMsg };
  if (saved.a !== undefined) process.env.OPENAI_API_KEY = saved.a;
  if (saved.b !== undefined) process.env.OPENAI_KEY = saved.b;
  out.checks['NEW-local-env'] = { onlyB, both, blankA, none, pass: onlyB.has && onlyB.read && both && blankA && !none.has && /OPENAI_API_KEY/.test(noneMsg) };
}

// persona-chat-2: pickEvents 같은 이름 회피 (트리아지 예시)
{
  mock.module('file:///Users/jeongyounglee/work/repo/mindme/packages/ui/src/index.ts', { namedExports: { webNative: { storage: { get: () => null, set() {}, remove() {} } } } });
  const { pickEvents, plainName } = await import(`${REPO}/apps/web/lib/data.ts`);
  const { personaName } = await import(`${REPO}/packages/core/src/persona/persona.ts`);
  const ev = (id, title, age, emotions = ['서운함']) => ({ id, title, date: '2015-05', dateEstimated: true, age, emotions, context: '', people: ['민수'], summary: '' });
  const me = { name: '홍길동', currentAge: 26 };
  const cases = {
    triage: [ev('e1', '민수와 크게 다툼', 15, ['서운함', '분노']), ev('e2', '반장 선거에서 떨어짐', 15, ['창피함']), ev('e3', '전학', 17)],
    whenTitles: [ev('e1', '민수와 다툰 날', 15, ['서운함', '분노']), ev('e2', '반장 선거에서 떨어진 날', 15), ev('e3', '전학 간 날', 17)],
    allSameAge: [ev('e1', '다툼', 15), ev('e2', '화해', 15), ev('e3', '졸업', 15)],
  };
  const r = {};
  for (const [k, events] of Object.entries(cases)) {
    const picked = pickEvents(events, me);
    const names = picked.map((x) => plainName({ name: personaName('past', x.age, me.name, x.event.title), kind: 'past', age: x.age }, me.name));
    r[k] = { picked: picked.map((x) => x.event.id), names, unique: new Set(names).size === names.length };
  }
  r.pass = Object.values(r).every((x) => x.unique) && r.whenTitles.picked.length === 3;
  out.checks['persona-chat-2'] = r;
}

await writeFile(`${REPO}/docs/dev-v1/evidence/gate3r2/critic-behavior-r1-pure.json`, JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out.checks)) console.log(k, v.pass ? 'PASS' : 'FAIL', JSON.stringify(v).slice(0, 700));
