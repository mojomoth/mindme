import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { personaName, type TimelineEvent } from '@mindme/core';

// data.ts 는 @mindme/ui(tsx)에서 webNative 만 쓴다. node 는 tsx 를 못 읽으니 막아 둔다.
mock.module('@mindme/ui', { namedExports: { webNative: { storage: {} } } });
const { avatarBgAt, isNewest, nearestEvent, pickEvents, plainName } = await import('./data.ts');

test('isNewest: 한 번에 여러 개를 만들어도 \'새로운 페르소나\'는 목록 맨 앞(가장 최근) 하나에만 붙는다', () => {
  const personas = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
  const flags = (newIds: string[]) => personas.map((p) => isNewest(personas, newIds, p.id));
  assert.deepEqual(flags(['c', 'b', 'a']), [true, false, false]);
  // 맨 앞을 열어 newIds 에서 빠지면 다음 카드로 옮겨 가지 않는다
  assert.deepEqual(flags(['b', 'a']), [false, false, false]);
  assert.deepEqual(flags([]), [false, false, false]);
});

test('avatarBgAt: 카드마다 색이 다르고, 새 페르소나를 앞에 붙여도 기존 색은 그대로다', () => {
  const three = [0, 1, 2].map((i) => avatarBgAt(i, 3));
  assert.deepEqual(three, ['var(--mm-avatar-blue)', 'var(--mm-avatar-yellow)', 'var(--mm-avatar-peach)']);
  const four = [0, 1, 2, 3].map((i) => avatarBgAt(i, 4));
  assert.deepEqual(four.slice(1), three);
  assert.notEqual(four[0], four[1]);
});

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

test('plainName: 사건 제목이 잘린 이름만 나이 이름으로 바꾼다', () => {
  assert.equal(plainName({ name: '졸업하며 서진과 헤어짐을 아쉬워…의 홍길동', kind: 'past', age: 17 }, '홍길동'), '17살의 홍길동');
  assert.equal(plainName({ name: '첫 출근 날의 홍길동', kind: 'past', age: 25 }, '홍길동'), '첫 출근 날의 홍길동');
});

test('pickEvents: 같은 이름이 될 사건은 고르지 않는다 (같은 나이·명사형 제목)', () => {
  const ev = (id: string, age: number, title: string, emotions: string[]): TimelineEvent => ({ ...relay, id, age, title, emotions });
  const events = [
    ev('evt_01', 15, '민수와 크게 다툼', ['화남', '서운함']),
    ev('evt_02', 15, '반장 선거에서 떨어짐', ['속상함']),
    ev('evt_03', 17, '첫 아르바이트', []),
    ev('evt_04', 15, '반장 선거에서 떨어진 날', []),
  ];
  const me = { name: '홍길동', currentAge: 26 };
  const names = pickEvents(events, me).map(({ event, age }) => plainName({ name: personaName('past', age, me.name, event.title), kind: 'past', age }, me.name));
  assert.deepEqual(names, ['15살의 홍길동', '17살의 홍길동', '반장 선거에서 떨어진 날의 홍길동']);
});
