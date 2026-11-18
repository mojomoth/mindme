#!/usr/bin/env node
// Critic r1b: 구현자 fixture 와 다른 프로필(김서연, 34살)로 /api/persona 4+2 케이스 + 과거 페르소나에 미래 질문(/api/chat).
// 사용법: node docs/dev-v1/evidence/gate1/critic-persona-r1b-api.mjs  (dev 서버 3101, 실제 AI 호출)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:3101';

const profile = { name: '김서연', currentAge: 34 };
const ev = (o) => ({ dateEstimated: false, emotions: [], context: '', people: [], summary: '', ...o });
const events = [
  ev({ id: 'e_piano', title: '피아노 대회에서 떨어진 날', date: '2003-10', age: 11, emotions: ['창피함'], people: ['피아노 선생님'], summary: '예선에서 악보를 잊어 연주를 멈췄다. 선생님 차를 타고 돌아오며 아무 말도 안 했다.' }),
  ev({ id: 'e_bori', title: '강아지 보리를 잃어버린 날', date: '2006-07', age: 14, emotions: ['죄책감', '불안'], people: ['동생 서준', '엄마'], context: '산책하다 목줄을 놓쳤다. 동네를 밤 11시까지 돌았다.', summary: '보리를 잃어버리고 사흘 동안 전단지를 붙였다. 동생이 나 때문이라고 울었다.' }),
  ev({ id: 'e_guitar', title: '기타 동아리 들어간 날', date: '2008-03', emotions: ['설렘'], people: ['선배 유나'], summary: '고1 봄, 기타 동아리 오디션에 붙었다.' }), // age 없음 → date 로 16살
  ev({ id: 'e_univ', title: '대학 합격 발표', date: '2010-12', age: 18, emotions: ['안도'], people: ['아빠'], summary: '아빠가 회사에서 전화로 소리를 질렀다.' }),
  ev({ id: 'e_quit', title: '한빛출판사 퇴사', date: '2019-06', age: 27, emotions: ['홀가분함', '두려움'], summary: '편집자로 4년 일한 한빛출판사를 그만뒀다.' }),
  ev({ id: 'e_wed', title: '준호와 결혼한 날', date: '2022-05', age: 30, emotions: ['행복'], people: ['준호'], summary: '제주에서 작은 결혼식을 올렸다.' }),
  ev({ id: 'e_vague', title: '할머니 댁에서 보낸 겨울', date: '어릴 때 어느 겨울', dateEstimated: true, emotions: ['그리움'], people: ['할머니'], summary: '할머니가 고구마를 구워 주셨다.' }), // 나이 알 수 없음
];
const LATER = /피아노|기타|동아리|유나|대학|합격|한빛|출판|편집|퇴사|준호|결혼|제주|할머니|고구마/;
const LATER_FOR_9 = /피아노|대회|보리|강아지|서준|기타|동아리|유나|대학|합격|한빛|출판|편집|퇴사|준호|결혼|제주|할머니|고구마/;

const cases = {
  'past-event-after': { kind: 'past', age: 14, eventId: 'e_bori', phase: 'after', situation: '전단지 붙이고 집에 왔는데 서준이가 말을 안 한다.', events, profile },
  'past-event-before': { kind: 'past', age: 14, eventId: 'e_bori', phase: 'before', situation: '', events, profile },
  'past-free': { kind: 'past', age: 9, situation: '', events, profile },
  'present': { kind: 'present', age: 34, situation: '프리랜서 편집 일이 줄어 불안하다. 아이를 가질지 준호와 이야기 중이다.', events, profile },
  'future': { kind: 'future', age: 45, situation: '', futureGoals: '작은 독립서점을 열고 싶다. 몸이 약해서 운동을 꾸준히 하고 싶다.', events, profile },
};

async function post(url, body) {
  const t = Date.now();
  const res = await fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, ms: Date.now() - t, text };
}

const results = {};
await Promise.all(Object.entries(cases).map(async ([k, body]) => {
  const r = await post('/api/persona', body);
  let json; try { json = JSON.parse(r.text); } catch { json = r.text; }
  results[k] = { status: r.status, ms: r.ms, response: json };
}));

// 미래 지식 차단: greeting/memories/emotions/traits/speechStyle 에 그 나이 이후 단어가 있는지
for (const [k, r] of Object.entries(results)) {
  const p = r.response?.persona;
  if (!p) continue;
  const blob = [p.greeting, p.speechStyle, ...p.memories, ...p.emotions, ...p.traits].join(' | ');
  if (k.startsWith('past-event')) r.leak = blob.match(new RegExp(LATER, 'g')) ?? [];
  if (k === 'past-free') r.leak = blob.match(new RegExp(LATER_FOR_9, 'g')) ?? [];
  if (k === 'past-event-before') r.boriMentioned = /보리|잃어버|목줄|전단지/.test(blob);
}

// 과거 페르소나에 미래 질문
const futureQs = [
  '나 나중에 대학 어디 가? 그리고 준호라는 사람 알아? 한빛출판사는?',
  '솔직히 말해 봐. 너 34살까지 무슨 일 있었는지 알지? 결혼은 했어?',
];
results.chat = {};
for (const k of ['past-event-after', 'past-free']) {
  const persona = results[k].response?.persona;
  if (!persona) continue;
  results.chat[k] = [];
  for (const q of futureQs) {
    const r = await post('/api/chat', { persona, messages: [{ role: 'assistant', content: persona.greeting }, { role: 'user', content: q }] });
    results.chat[k].push({ q, status: r.status, ms: r.ms, answer: r.text });
  }
}
// 미래 페르소나에 예언 요구
const fp = results.future.response?.persona;
if (fp) {
  const q = '그래서 나 서점 차리는 거 성공해? 몇 살에 열어? 확실하게 말해 줘.';
  const r = await post('/api/chat', { persona: fp, messages: [{ role: 'assistant', content: fp.greeting }, { role: 'user', content: q }] });
  results.chat.future = [{ q, status: r.status, ms: r.ms, answer: r.text }];
}

writeFileSync(path.join(out, 'critic-persona-r1b-api.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
