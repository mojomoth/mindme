import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { TimelineEvent } from '@mindme/core';

// data.ts 는 @mindme/ui(tsx)에서 webNative 만 쓴다. node 는 tsx 를 못 읽으니 막아 둔다.
mock.module('@mindme/ui', { namedExports: { webNative: { storage: {} } } });
const { nearestEvent } = await import('./data.ts');

const profile = { name: '홍길동', currentAge: 26 };
const relay: TimelineEvent = {
  id: 'evt_01', title: '친구와 다툰 날', date: '2013-05', dateEstimated: true, age: 13,
  emotions: ['서운함'], context: '계주 조 편성 문제로 서진과 다퉜다.', people: ['서진'], summary: '서진과 계주 때문에 다퉜다.',
};

test('nearestEvent: 1살 차 사건은 고르고, 2살 차 사건은 고르지 않는다 (core ±1살 규칙)', () => {
  const situation = '친구 서진과 계주 때문에 다툰 일';
  assert.equal(nearestEvent(situation, 14, [relay], profile)?.id, 'evt_01');
  assert.equal(nearestEvent(situation, 15, [relay], profile), undefined);
});
