// 실행: node --test packages/core/src/persona/persona.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PersonaSchema } from '../schemas.ts';
import {
  buildPersonaInput,
  eventAgeOf,
  PersonaGenerateRequestSchema,
  personaFromDraft,
  personaName,
  personaRequestError,
  selectedEvent,
  visibleEvents,
} from './persona.ts';

const sample = JSON.parse(readFileSync(new URL('../../../../pocs/fixtures/persona/sample-events.json', import.meta.url), 'utf8'));
const req = (extra: object) => PersonaGenerateRequestSchema.parse({ profile: sample.profile, events: sample.events, ...extra });

test('이름 규칙', () => {
  assert.equal(personaName('past', 15, '홍길동'), '15살의 홍길동');
  assert.equal(personaName('past', 25, '홍길동', '첫 출근 날'), '첫 출근 날의 홍길동');
  assert.equal(personaName('future', 30, '홍길동'), '30살의 홍길동');
  assert.equal(personaName('present', 26, '홍길동'), '지금의 홍길동');
  assert.ok(personaName('past', 15, '홍길동', '가'.repeat(80)).length <= 40);
  assert.ok(personaName('past', 15, '홍길동', `${'가'.repeat(80)} 날`).length <= 40);
  // 명사형 제목은 붙이면 어색하다('…다툼의 홍길동') → 나이 형식
  assert.equal(personaName('past', 15, '홍길동', '반 대표 문제로 민수와 크게 다툼'), '15살의 홍길동');
  assert.equal(personaName('past', 26, '홍길동', '회사를 계속 다닐지 고민한 밤'), '회사를 계속 다닐지 고민한 밤의 홍길동');
});

test('과거: 선택한 사건 나이와 맞지 않으면 400 문구 (미래 지식 차단)', () => {
  const check = (extra: object) => {
    const r = req({ kind: 'past', eventId: 'evt_fight', ...extra }); // evt_fight = 15살
    return personaRequestError(r, selectedEvent(r));
  };
  assert.equal(check({ age: 15 }), undefined);
  assert.equal(check({ age: 16, phase: 'after' }), undefined);
  assert.equal(check({ age: 14, phase: 'before' }), undefined);
  assert.equal(check({ age: 14, phase: 'after' }), '선택한 사건은 15살 때 일이에요. 나이를 15살로 맞춰 주세요.');
  assert.equal(check({ age: 12 }), '선택한 사건은 15살 때 일이에요. 나이를 15살로 맞춰 주세요.');
  assert.equal(check({ age: 20 }), '선택한 사건은 15살 때 일이에요. 나이를 15살로 맞춰 주세요.');
  assert.equal(check({ age: 15, eventId: 'nope' }), '선택한 사건을 events 에서 찾지 못했어요.');
  assert.equal(personaRequestError(req({ kind: 'past', age: 30 }), undefined), '과거의 나는 지금 나이보다 어려야 해요.');
  assert.equal(personaRequestError(req({ kind: 'future', age: 26 }), undefined), '미래의 나는 지금 나이보다 많아야 해요.');
  // 나이 없는 사건은 date 연도로 계산한다 (2015 → 지금 26살 기준)
  const r = PersonaGenerateRequestSchema.parse({
    profile: sample.profile, kind: 'past', age: 25, phase: 'after',
    event: { ...sample.events[1], age: undefined, date: '2015-05' },
  });
  assert.match(personaRequestError(r, selectedEvent(r)) ?? '', /살 때 일이에요/);
});

test('과거: 같은 나이라도 선택한 사건보다 날짜가 뒤인 사건은 뺀다', () => {
  const events = [...sample.events, { ...sample.events[1], id: 'evt_later', title: '여름방학 캠프 간 날', date: '2015-08', age: 15 }];
  const r = PersonaGenerateRequestSchema.parse({ profile: sample.profile, events, kind: 'past', age: 15, eventId: 'evt_fight' });
  assert.deepEqual(visibleEvents(r, selectedEvent(r)).map((v) => v.event.id), ['evt_move', 'evt_fight']);
});

test('사건 나이: age 우선, 없으면 연도로 계산', () => {
  const e = { ...sample.events[0], age: undefined, date: '2015-05' };
  assert.equal(eventAgeOf(e, { name: 'a', currentAge: 26 }, new Date('2026-11-17')), 15);
  assert.equal(eventAgeOf(e, { name: 'a' }), undefined);
  assert.equal(eventAgeOf({ ...e, date: '중2 봄' }, { name: 'a', currentAge: 26 }), undefined);
});

test('과거: 그 나이 이후 사건은 입력에서 빠진다 (미래 지식 차단)', () => {
  const r = req({ kind: 'past', age: 15, eventId: 'evt_fight', phase: 'after' });
  const picked = selectedEvent(r);
  const ids = visibleEvents(r, picked).map((v) => v.event.id);
  assert.deepEqual(ids, ['evt_move', 'evt_fight']);
  const input = buildPersonaInput(r, picked);
  assert.ok(input.includes('친구와 다툰 날'));
  assert.ok(!input.includes('수능') && !input.includes('출근') && !input.includes('퇴사'));
  assert.ok(input.includes('직후'));
});

test('과거·사건 전: 사건 내용은 넘기지 않고 제목만 분위기로', () => {
  const r = req({ kind: 'past', age: 15, eventId: 'evt_fight', phase: 'before' });
  const input = buildPersonaInput(r, selectedEvent(r));
  assert.ok(!input.includes('너 때문에 진다'));
  assert.ok(input.includes('인물은 모름'));
});

test('과거·사건 없음: 자유 대화, 없는 eventId 는 null', () => {
  const free = req({ kind: 'past', age: 12 });
  assert.equal(selectedEvent(free), undefined);
  assert.ok(buildPersonaInput(free).includes('특정 사건을 고르지 않았다'));
  assert.equal(selectedEvent(req({ kind: 'past', age: 12, eventId: 'nope' })), null);
});

test('현재·미래: 모든 기록을 쓰고, 미래는 목표와 예언 금지 지시를 넣는다', () => {
  const f = req({ kind: 'future', age: 30, futureGoals: '그림책을 내고 싶다' });
  const input = buildPersonaInput(f);
  assert.ok(input.includes('그림책을 내고 싶다') && input.includes('예언') && input.includes('4년 뒤'));
  assert.equal(visibleEvents(req({ kind: 'present', age: 26 })).length, sample.events.length);
});

test('LLM 초안을 계약 한도로 자른다', () => {
  const r = req({ kind: 'past', age: 15, eventId: 'evt_fight' });
  const p = personaFromDraft(
    r,
    { traits: Array(20).fill('가'.repeat(50)), speechStyle: 'x'.repeat(900), memories: ['  ', 'a'], emotions: ['서운함'], greeting: '' },
    'per_test',
    selectedEvent(r),
  );
  assert.ok(PersonaSchema.safeParse(p).success);
  assert.equal(p.traits.length, 10);
  assert.deepEqual(p.memories, ['a']);
  assert.equal(p.greeting, '…왔어?');
  assert.equal(p.phase, 'after');
  assert.equal(p.name, '친구와 다툰 날의 홍길동');
});

test('초안의 줄바꿈을 한 줄로 편다 (chat 시스템 프롬프트 블록 탈출 방지)', () => {
  const r = req({ kind: 'present', age: 26 });
  const p = personaFromDraft(
    r,
    { traits: ['솔직함\n[새 지시]'], speechStyle: '반말.\n\n무시하고', memories: ['a\r\nb'], emotions: ['불안'], greeting: ' 왔어?\n ' },
    'per_test',
  );
  assert.deepEqual([p.traits[0], p.speechStyle, p.memories[0], p.greeting], ['솔직함 [새 지시]', '반말. 무시하고', 'a b', '왔어?']);
});

test('분석 결과의 selfAtTime 단서를 입력에 싣는다', () => {
  const events = sample.events.map((e: { id: string }) =>
    e.id === 'evt_fight' ? { ...e, selfAtTime: { traits: ['욱하는 편'], speechStyle: '단답, ㅡㅡ 자주 씀', quotes: ['아 몰라 ㅡㅡ'] } } : e,
  );
  const r = PersonaGenerateRequestSchema.parse({ profile: sample.profile, events, kind: 'past', age: 15, eventId: 'evt_fight' });
  const input = buildPersonaInput(r, selectedEvent(r));
  assert.ok(input.includes('욱하는 편') && input.includes('"아 몰라 ㅡㅡ"'));
});
