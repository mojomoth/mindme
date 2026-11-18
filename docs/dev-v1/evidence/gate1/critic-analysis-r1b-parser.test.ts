// Critic r1b: 파서 엣지 케이스 (구현자 테스트와 별개로 작성). 실행: node --test <이 파일>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKakao, splitDiary, kakaoDayBlocks } from '../../../../packages/core/src/analysis/parse.ts';

const pc = [
  '김하늘 님과 카카오톡 대화',
  '저장한 날짜 : 2023-01-02 10:00:00',
  '',
  '--------------- 2022년 12월 31일 토요일 ---------------',
  '[김하늘] [오후 11:58] 올해 마지막 날이다',
  '[최도윤] [오후 11:59] 내년엔 꼭 말할게',
  '',
  '사실 나 너한테 할 말 있었어',
  '  들여쓴 줄도 있음',
  '[김하늘] [오후 11:59] 사진',
  '김하늘님이 들어왔습니다.',
  '이 줄은 시스템 메시지 뒤라 버려져야 함',
  '--------------- 2023년 1월 1일 일요일 ---------------',
  '[최도윤] [오전 12:00] 새해 복 많이 받아',
  '[김하늘] [오전 12:01] 아까 할 말이 뭔데? [오후 3:00] 이건 본문',
  '[최도윤] [오후 12:30] 점심 먹고 얘기하자',
].join('\r\n');

test('PC: CRLF·빈 줄 포함 여러 줄, 자정 넘는 날짜 구분선, 오전/오후 12시, 본문 속 대괄호', () => {
  const c = parseKakao('﻿' + pc);
  assert.equal(c.title, '김하늘');
  assert.deepEqual(c.participants, ['김하늘', '최도윤']);
  assert.equal(c.me, '최도윤');
  assert.deepEqual(
    c.messages.map((m) => [m.date, m.time, m.author]),
    [
      ['2022-12-31', '23:58', '김하늘'],
      ['2022-12-31', '23:59', '최도윤'],
      ['2023-01-01', '00:00', '최도윤'],
      ['2023-01-01', '00:01', '김하늘'],
      ['2023-01-01', '12:30', '최도윤'],
    ],
  );
  assert.equal(c.messages[1]!.text, '내년엔 꼭 말할게\n\n사실 나 너한테 할 말 있었어\n  들여쓴 줄도 있음');
  assert.equal(c.messages[3]!.text, '아까 할 말이 뭔데? [오후 3:00] 이건 본문');
  assert.ok(!c.messages.some((m) => m.text.includes('시스템 메시지 뒤')));
});

test('Android: 날짜+시간 구분줄, 여러 줄, 본문 속 " : "', () => {
  const c = parseKakao(
    [
      '김하늘 님과 카카오톡 대화',
      '저장한 날짜 : 2023년 1월 2일 오전 10:00',
      '',
      '2022년 12월 31일 오후 11:58',
      '2022년 12월 31일 오후 11:58, 김하늘 : 시간 : 거의 자정',
      '둘째 줄',
      '2023년 1월 1일 오전 12:00',
      '2023년 1월 1일 오전 12:00, 최도윤 : 새해!',
    ].join('\n'),
  );
  assert.deepEqual(
    c.messages.map((m) => [m.date, m.time, m.author, m.text]),
    [
      ['2022-12-31', '23:58', '김하늘', '시간 : 거의 자정\n둘째 줄'],
      ['2023-01-01', '00:00', '최도윤', '새해!'],
    ],
  );
  assert.equal(c.me, '최도윤');
});

test('iOS: 요일 구분선 + "YYYY. M. D. 오후 h:mm, 이름 : 메시지" 여러 줄', () => {
  const c = parseKakao(
    [
      '2022년 12월 31일 토요일',
      '2022. 12. 31. 오후 11:58, 김하늘 : 첫 줄',
      '둘째 줄',
      '',
      '넷째 줄',
      '2023년 1월 1일 일요일',
      '2023. 1. 1. 오전 12:00, 최도윤 : 이모티콘',
      '2023. 1. 1. 오전 12:01, 최도윤 : 응',
    ].join('\n'),
    '도윤',
  );
  assert.equal(c.me, '최도윤');
  assert.deepEqual(
    c.messages.map((m) => [m.date, m.time, m.text]),
    [
      ['2022-12-31', '23:58', '첫 줄\n둘째 줄\n\n넷째 줄'],
      ['2023-01-01', '00:01', '응'],
    ],
  );
});

test('Mac CSV: 헤더 줄, 따옴표 안 여러 줄·쉼표·"" 이스케이프', () => {
  const c = parseKakao(
    ['Date,User,Message', '2023-01-01 00:00:00,"최도윤","새해, 복 많이"', '2023-01-01 00:01:00,"김하늘","그가 ""안녕""이라 했어', '둘째 줄"'].join('\n'),
  );
  assert.deepEqual(
    c.messages.map((m) => [m.author, m.text]),
    [
      ['최도윤', '새해, 복 많이'],
      ['김하늘', '그가 "안녕"이라 했어\n둘째 줄'],
    ],
  );
});

test('빈 파일·공백만·형식 아님: 메시지 0개', () => {
  for (const s of ['', '   \n\n', '﻿', '그냥 메모\n두 번째 줄']) {
    const c = parseKakao(s);
    assert.equal(c.messages.length, 0);
    assert.equal(c.me, undefined);
  }
  assert.deepEqual(splitDiary(''), []);
});

test('2MB 대용량: 2초 안에 파싱, 메시지 수 보존, 날짜 블록 유지', () => {
  const day = (d: number) => `--------------- 2020년 ${1 + Math.floor(d / 28)}월 ${1 + (d % 28)}일 월요일 ---------------`;
  const lines: string[] = ['김하늘 님과 카카오톡 대화'];
  let n = 0;
  for (let d = 0; d < 300; d++) {
    lines.push(day(d));
    for (let i = 0; i < 120; i++, n++) lines.push(`[${i % 2 ? '김하늘' : '최도윤'}] [오후 ${1 + (i % 11)}:${String(i % 60).padStart(2, '0')}] 오늘도 그냥 잡담 ${n}번째`);
  }
  const big = lines.join('\n');
  assert.ok(big.length * 3 > 2_000_000, `${big.length}자`);
  const t = performance.now();
  const c = parseKakao(big);
  const ms = performance.now() - t;
  assert.equal(c.messages.length, n);
  assert.ok(ms < 2000, `${ms}ms`);
  assert.equal(kakaoDayBlocks(c).length, 300);
  console.log(`# 2MB: ${big.length}자 (${Buffer.byteLength(big)}B), 메시지 ${n}, ${ms.toFixed(0)}ms`);
});

test('[관찰] 여러 줄 메시지 안에 날짜 구분선처럼 생긴 줄', () => {
  const c = parseKakao(['2023년 1월 1일 일요일', '2023. 1. 1. 오전 9:00, 김하늘 : 우리 처음 만난 날', '2019년 3월 2일 토요일', '기억나?'].join('\n'));
  console.log('# 관찰:', JSON.stringify(c.messages.map((m) => m.text)));
});
