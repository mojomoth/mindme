import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { dataUrlToFile, parseRequest, upstreamFail } from '../src/server/http.ts';

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
  assert.deepEqual(await errorOf(notJson.error!), { status: 400, code: 'invalid_request', message: 'JSON 형식이 아닙니다.' });

  const withPath = await errorOf((await parseRequest(post('{"n":0}'), Schema, { maxBody: 100 })).error!);
  assert.match(withPath.message, /^n: /);
  const msgOnly = await errorOf((await parseRequest(post('{"n":0}'), Schema, { maxBody: 100, invalid: 'message' })).error!);
  assert.doesNotMatch(msgOnly.message, /^n: /);
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
