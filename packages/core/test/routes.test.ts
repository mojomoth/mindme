// Route 본문(routes.ts): 키 없음 문구, analyze 응답의 meta.llm 은 includeLlm 일 때만.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { LlmAnalysisSchema } from '../src/analysis/analyze.ts';

const llmOut = {
  events: [{ title: '친구와 다툰 날', date: '2015-05-14', dateEstimated: false, age: 15, emotions: ['서운함'], context: '단톡방', people: ['민수'], summary: '다퉜다.', selfAtTime: { traits: ['고집'], speechStyle: '반말', quotes: [] } }],
  owner: { name: '지우', currentAge: 26 },
};
let inflight = 0;
let peak = 0;
mock.module('server-only', { exports: {} });
mock.module(new URL('../src/server/llm.ts', import.meta.url).href, {
  exports: {
    generateObject: async (o: { schema: { parse: (x: unknown) => unknown } }) => {
      peak = Math.max(peak, ++inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      return o.schema.parse((o.schema as unknown) === LlmAnalysisSchema ? llmOut : { moments: [] });
    },
    streamText: () => new ReadableStream(),
    editImage: async () => '',
  },
});
const { analyzeRoute } = await import('../src/server/routes.ts');

const post = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) });
const KEY = 'OPENAI_API_KEY';

test('routes: 키가 없으면 503, 사유는 숨기고 해요체 안내', async () => {
  const saved = process.env[KEY];
  delete process.env[KEY];
  const orig = console.error;
  const logs: string[] = [];
  console.error = (...a: unknown[]) => void logs.push(a.join(' '));
  try {
    const res = await analyzeRoute()(post({ source: 'prompt', text: '어제 친구랑 싸웠다.' }));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: { code: 'provider_unavailable', message: '지금은 대화를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.' } });
    assert.ok(logs.some((l) => l.includes('[api/analyze]') && l.includes(KEY)));
  } finally {
    console.error = orig;
    if (saved !== undefined) process.env[KEY] = saved;
  }
});

test('routes: analyze 는 meta.llm 을 빼고, includeLlm 이면 싣는다. 긴 기록의 구간 요약은 한꺼번에 보낸다', async () => {
  const saved = process.env[KEY];
  process.env[KEY] = 'test-placeholder';
  try {
    const plain = (await (await analyzeRoute()(post({ source: 'prompt', text: '어제 친구랑 싸웠다.' }))).json()) as { meta: Record<string, unknown> };
    assert.equal(plain.meta.mode, 'direct');
    assert.equal('llm' in plain.meta, false);
    const dev = (await (await analyzeRoute({ includeLlm: true })(post({ source: 'prompt', text: '어제 친구랑 싸웠다.' }))).json()) as { meta: { llm: unknown } };
    assert.deepEqual(dev.meta.llm, llmOut);

    peak = 0;
    const long = Array.from({ length: 3000 }, (_, i) => `${i}번째 문단. ${'오늘 있었던 일을 길게 적어 둔다. '.repeat(5)}`).join('\n\n');
    const res = (await (await analyzeRoute()(post({ source: 'prompt', text: long.slice(0, 300_000) }))).json()) as { meta: { mode: string; chunks: number } };
    assert.equal(res.meta.mode, 'summarized');
    assert.ok(res.meta.chunks >= 9 && res.meta.chunks <= 11, String(res.meta.chunks));
    assert.equal(peak, res.meta.chunks); // 요약 호출이 모두 동시에 떠 있었다
  } finally {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  }
});
