import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AnalyzeRequestSchema,
  AvatarRequestSchema,
  ChatRequestSchema,
  PersonaRequestSchema,
  type Persona,
} from '../src/schemas.ts';

const persona: Persona = {
  id: 'p1',
  name: '15살의 홍길동',
  kind: 'past',
  age: 15,
  traits: ['수줍음'],
  speechStyle: '반말, 짧게 말함',
  memories: ['친구와 다툰 날'],
  emotions: ['서운함'],
  greeting: '안녕, 나야.',
};

test('analyze: source 는 kakao|diary|prompt 만 허용', () => {
  assert.ok(AnalyzeRequestSchema.safeParse({ source: 'kakao', text: '대화' }).success);
  assert.equal(AnalyzeRequestSchema.safeParse({ source: 'sms', text: '대화' }).success, false);
  assert.equal(AnalyzeRequestSchema.safeParse({ source: 'diary', text: '   ' }).success, false);
});

test('persona: 기본값 채움, 나이 범위 검사', () => {
  const r = PersonaRequestSchema.parse({ kind: 'future', age: 30, profile: { name: '홍길동' } });
  assert.deepEqual(r.events, []);
  assert.equal(r.situation, '');
  assert.equal(PersonaRequestSchema.safeParse({ kind: 'past', age: 0, profile: { name: '홍길동' } }).success, false);
});

test('avatar: data URL 이미지 형식만 허용', () => {
  assert.ok(AvatarRequestSchema.safeParse({ age: 15, kind: 'past' }).success);
  assert.ok(AvatarRequestSchema.safeParse({ age: 15, kind: 'past', photo: 'data:image/png;base64,AAAA' }).success);
  assert.equal(AvatarRequestSchema.safeParse({ age: 15, kind: 'past', photo: 'https://x/y.png' }).success, false);
});

test('chat: 마지막 메시지는 user', () => {
  assert.ok(ChatRequestSchema.safeParse({ persona, messages: [{ role: 'user', content: '그때 기분 어땠어?' }] }).success);
  assert.equal(
    ChatRequestSchema.safeParse({ persona, messages: [{ role: 'assistant', content: '안녕' }] }).success,
    false,
  );
});
