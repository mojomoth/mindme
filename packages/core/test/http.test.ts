import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { dataUrlToFile, parseRequest, rateLimit, upstreamFail } from '../src/server/http.ts';

const Schema = z.object({ n: z.int().min(1) });
const post = (body: string) => new Request('http://x/api', { method: 'POST', body });
const errorOf = async (res: Response) => ({ status: res.status, ...((await res.json()) as { error: { code: string; message: string } }).error });

test('http: 검증 통과하면 data', async () => {
  const r = await parseRequest(post('{"n":3}'), Schema, { maxBody: 100 });
  assert.deepEqual(r.data, { n: 3 });
});

test('http: 413 · JSON 아님 · 검증 실패 문구 3종', async () => {
  const big = await parseRequest(post('{"n":3}'), Schema, { maxBody: 3, tooLarge: '너무 커요' });
  assert.deepEqual(await errorOf(big.error!), { status: 413, code: 'payload_too_large', message: '너무 커요' });

  const notJson = await parseRequest(post('{'), Schema, { maxBody: 100 });
  assert.deepEqual(await errorOf(notJson.error!), { status: 400, code: 'invalid_request', message: '보낸 내용을 읽지 못했어요. 다시 시도해 주세요.' });

  const korean = await errorOf((await parseRequest(post('{"n":0}'), Schema, { maxBody: 100 })).error!);
  assert.deepEqual(korean, { status: 400, code: 'invalid_request', message: '요청 형식이 올바르지 않아요.' }); // n 은 라벨 없음
  const fixed = await errorOf((await parseRequest(post('{"n":0}'), Schema, { maxBody: 100, invalid: '고정 문구' })).error!);
  assert.equal(fixed.message, '고정 문구');
});

test('http: prepare 로 기본값을 채운다', async () => {
  const r = await parseRequest(post('{}'), Schema, { maxBody: 100, prepare: (b) => ({ ...b, n: b.n ?? 7 }) });
  assert.deepEqual(r.data, { n: 7 });
});

test('http: 429 는 rateLimited 문구가 있을 때만 503', async () => {
  const err = new Error('LLM 호출 실패 (HTTP 429): limit');
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(upstreamFail('t', err, 'x', '한도').status, 503);
    assert.equal(upstreamFail('t', err, 'x').status, 502);
  } finally {
    console.error = orig;
  }
});

test('http: data URL → File', async () => {
  const f = dataUrlToFile(`data:image/png;base64,${Buffer.from('abc').toString('base64')}`);
  assert.equal(f.type, 'image/png');
  assert.equal(f.name, 'photo.png');
  assert.equal(await f.text(), 'abc');
});

test('http: Content-Length 가 상한의 3배를 넘으면 읽기 전에 413, 기본 문구는 해요체', async () => {
  const req = new Request('http://x/api', { method: 'POST', body: '{"n":3}', headers: { 'content-length': '100' } });
  const r = await parseRequest(req, Schema, { maxBody: 10 });
  assert.deepEqual(await errorOf(r.error!), { status: 413, code: 'payload_too_large', message: '보낸 내용이 너무 길어요. 조금 줄여서 다시 보내 주세요.' });
});

test('http: rateLimit 은 IP·이름별로 세고, 넘으면 429 + Retry-After', async () => {
  let called = 0;
  const handler = rateLimit('t', 2, 60_000, async () => (called++, new Response('ok')));
  const from = (ip: string) => new Request('http://x/api', { method: 'POST', headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });
  assert.equal((await handler(from('1.1.1.1'))).status, 200);
  assert.equal((await handler(from('1.1.1.1'))).status, 200);
  const limited = await handler(from('1.1.1.1'));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.deepEqual(await errorOf(limited), { status: 429, code: 'rate_limited', message: '짧은 시간에 요청이 많았어요. 1분쯤 뒤에 다시 시도해 주세요.' });
  assert.equal((await handler(from('2.2.2.2'))).status, 200); // 다른 IP 는 따로
  assert.equal((await rateLimit('u', 2, 60_000, async () => new Response('ok'))(from('1.1.1.1'))).status, 200); // 다른 이름도 따로
  assert.equal(called, 3);
});

test('http: 다른 사이트에서 브라우저로 보낸 요청은 403, 같은 출처·헤더 없음은 통과', async () => {
  const withSite = (site: string) =>
    new Request('http://x/api', { method: 'POST', body: '{"n":3}', headers: { 'content-type': 'text/plain', 'sec-fetch-site': site } });
  const cross = await parseRequest(withSite('cross-site'), Schema, { maxBody: 100 });
  assert.equal(cross.error?.status, 403);
  assert.equal((await cross.error!.json()).error.code, 'forbidden');
  assert.deepEqual((await parseRequest(withSite('same-origin'), Schema, { maxBody: 100 })).data, { n: 3 });
  assert.deepEqual((await parseRequest(post('{"n":3}'), Schema, { maxBody: 100 })).data, { n: 3 });
});
