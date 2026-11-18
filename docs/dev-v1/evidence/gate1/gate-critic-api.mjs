// Gate 1 최종 Critic: analyze → persona → avatar(사진 없음) → chat 스트리밍을 실제로 1회씩 호출한다.
// 실행: node docs/dev-v1/evidence/gate1/gate-critic-api.mjs > docs/dev-v1/evidence/gate1/gate-critic-api.json
const BASE = 'http://localhost:3101';
const out = {};
const t = () => performance.now();

async function post(path, body) {
  const s = t();
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: res.status, ms: Math.round(t() - s), headers: Object.fromEntries([...res.headers].filter(([k]) => ['content-type', 'server-timing', 'x-crisis'].includes(k))), json };
}

// 1) analyze (prompt)
const text = [
  '중학교 2학년 봄, 제일 친한 친구 민수와 체육대회 조 편성 때문에 크게 싸웠다. 일주일 동안 말을 안 했다.',
  '고등학교 1학년 여름에 민수가 먼저 편지를 줘서 화해했다. 그날 같이 떡볶이를 먹으며 울었다.',
  '스물다섯 살 3월, 첫 회사에 출근했다. 너무 긴장해서 점심도 못 먹었다.',
].join('\n\n');
const a = await post('/api/analyze', { source: 'prompt', text });
out.analyze = { status: a.status, ms: a.ms, eventCount: a.json?.events?.length, titles: a.json?.events?.map((e) => `${e.id} ${e.title} (${e.date}, age ${e.age ?? '-'})`), mode: a.json?.meta?.mode, error: a.json?.error };
const events = a.json?.events ?? [];

// 2) persona (past, 첫 사건 직후)
const ev = events[0];
const p = await post('/api/persona', {
  kind: 'past', age: ev?.age ?? 15, eventId: ev?.id, phase: 'after', situation: '', events,
  profile: { name: '홍길동', currentAge: 32 },
});
out.persona = { status: p.status, ms: p.ms, persona: p.json?.persona, error: p.json?.error };

// 3) avatar (사진 없음 → 기본 캐릭터, AI 호출 없음)
const av = await post('/api/persona/avatar', { age: 15, kind: 'past' });
out.avatar = { status: av.status, ms: av.ms, ...av.json };
if (av.json?.avatar) {
  const r = await fetch(BASE + av.json.avatar);
  out.avatar.assetStatus = r.status;
  out.avatar.assetType = r.headers.get('content-type');
}

// 4) chat 스트리밍
const persona = p.json?.persona;
const s = t();
const res = await fetch(BASE + '/api/chat', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ persona, messages: [{ role: 'assistant', content: persona?.greeting ?? '왔어?' }, { role: 'user', content: '그날 집에 와서 기분이 어땠어?' }] }),
});
const reader = res.body.getReader();
const dec = new TextDecoder();
let reply = '', chunks = 0, firstMs = null;
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  if (firstMs === null) firstMs = Math.round(t() - s);
  chunks++;
  reply += dec.decode(value, { stream: true });
}
out.chat = { status: res.status, contentType: res.headers.get('content-type'), xCrisis: res.headers.get('x-crisis'), chunks, firstChunkMs: firstMs, totalMs: Math.round(t() - s), reply };

// 5) 오류 계약 표본
out.errors = {
  analyzeBadJson: await fetch(BASE + '/api/analyze', { method: 'POST', body: '{' }).then(async (r) => [r.status, await r.json()]),
  chatLastAssistant: (await post('/api/chat', { messages: [{ role: 'assistant', content: 'hi' }] })).json,
  personaFutureYoung: (await post('/api/persona', { kind: 'future', age: 20, profile: { name: '홍길동', currentAge: 32 } })).json,
  avatarBadPhoto: (await post('/api/persona/avatar', { age: 15, kind: 'past', photo: 'data:image/gif;base64,AAAA' })).json,
};
console.log(JSON.stringify(out, null, 2));
