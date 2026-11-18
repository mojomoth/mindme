import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zodErrorMessage } from '../src/errors.ts';
import { AnalyzeRequestSchema, ChatRequestSchema, PersonaRequestSchema } from '../src/schemas.ts';
import { SAMPLE_PERSONA } from '../src/chat/index.ts';

const msg = (schema: { safeParse: (v: unknown) => { error?: unknown } }, v: unknown) =>
  zodErrorMessage(schema.safeParse(v).error as Parameters<typeof zodErrorMessage>[0]);
const profile = { name: '홍길동' };

test('zod 오류 → 한국어 문구 (영어 기본 메시지 없음)', () => {
  const cases: [string, string][] = [
    [msg(AnalyzeRequestSchema, { source: 'sms', text: 'a' }), '기록 종류 값이 올바르지 않아요.'],
    [msg(AnalyzeRequestSchema, { source: 'diary', text: '   ' }), '기록을 입력해 주세요.'],
    [msg(AnalyzeRequestSchema, { source: 'diary', text: 'a'.repeat(300_001) }), '기록은 300,000자 이하로 줄여 주세요.'],
    [msg(AnalyzeRequestSchema, { text: 'a' }), '기록 종류 값이 올바르지 않아요.'], // enum 이 빠지면 invalid_value
    [msg(PersonaRequestSchema, { kind: 'past', age: 0, profile }), '나이는 1 이상이어야 해요.'],
    [msg(PersonaRequestSchema, { kind: 'past', age: 121, profile }), '나이는 120 이하여야 해요.'],
    [msg(PersonaRequestSchema, { kind: 'past', age: '열다섯', profile }), '나이 형식이 올바르지 않아요.'],
    [msg(PersonaRequestSchema, { kind: 'past', age: 15, profile: { name: '' } }), '이름을 입력해 주세요.'],
    [msg(PersonaRequestSchema, { kind: 'past', age: 15 }), '프로필을 입력해 주세요.'],
    [msg(ChatRequestSchema, { persona: SAMPLE_PERSONA, messages: [] }), '대화가 하나 이상 있어야 해요.'],
    [msg(ChatRequestSchema, { persona: SAMPLE_PERSONA, messages: [{ role: 'assistant', content: '응' }] }), '마지막 메시지는 user 여야 합니다.'],
    [msg(ChatRequestSchema, { persona: { ...SAMPLE_PERSONA, name: 'x'.repeat(41) }, messages: [{ role: 'user', content: '응' }] }), '페르소나 이름은 40자 이하로 줄여 주세요.'],
    [msg(ChatRequestSchema, { persona: SAMPLE_PERSONA, messages: [{ role: 'user', content: '' }] }), '메시지를 입력해 주세요.'],
    [msg(ChatRequestSchema, 'x'), '요청 형식이 올바르지 않아요.'],
  ];
  for (const [got, want] of cases) assert.equal(got, want);
  for (const [got] of cases) assert.doesNotMatch(got, /Invalid|expected|received|Too (big|small)/);
});
