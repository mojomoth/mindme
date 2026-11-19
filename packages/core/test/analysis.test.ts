import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kakaoDayBlocks, packChunks, parseKakao, splitDiary } from '../src/analysis/parse.ts';
import {
  analyzeRecords,
  AnalyzeInputError,
  CHUNK_CHARS,
  dateKey,
  DIRECT_CHARS,
  LlmAnalysisSchema,
  normalizeEvents,
  normalizeOwner,
  ANALYZE_SYSTEM,
  sortByTime,
  type Generate,
  type LlmEvent,
} from '../src/analysis/analyze.ts';
import { AnalyzeResponseSchema } from '../src/schemas.ts';

const fixture = (name: string) => readFileSync(new URL(`../../../pocs/fixtures/analysis/${name}`, import.meta.url), 'utf8');

test('kakao PC: 날짜 구분선·여러 줄 메시지·사진 제외, 1:1 제목으로 나 추정', () => {
  const chat = parseKakao(fixture('kakao-pc.txt'));
  assert.equal(chat.title, '박서진');
  assert.deepEqual(chat.participants, ['박서진', '이지우']);
  assert.equal(chat.me, '이지우');
  const first = chat.messages[0]!;
  assert.deepEqual(first, { date: '2015-05-13', time: '21:02', author: '박서진', text: '내일 체육대회 계주 순서 정해졌대' });
  const multi = chat.messages.find((m) => m.text.startsWith('내가 바통'))!;
  assert.equal(multi.date, '2015-05-14');
  assert.equal(multi.text.split('\n').length, 3);
  assert.ok(!chat.messages.some((m) => m.text === '사진'));
  assert.ok(chat.messages.some((m) => m.date === '2024-03-09' && m.time === '20:45'));
});

test('kakao 모바일(iOS): 시스템 메시지·이모티콘 제외, 여러 줄, 오전/오후', () => {
  const chat = parseKakao(fixture('kakao-mobile.txt'), '이지우');
  assert.equal(chat.me, '이지우');
  assert.deepEqual(chat.participants, ['이지우', '엄마', '아빠', '이지호']);
  assert.ok(!chat.messages.some((m) => /들어왔습니다|나갔습니다|이모티콘|^사진$/.test(m.text)));
  const report = chat.messages.find((m) => m.text.startsWith('첫 출근 끝'))!;
  assert.equal(report.time, '19:48');
  assert.equal(report.text.split('\n').length, 5);
  assert.equal(chat.messages[0]!.date, '2024-02-29');
  assert.equal(chat.messages.find((m) => m.text.startsWith('이제 지하철'))!.time, '07:12');
});

test('kakao Android · 24시간 표기 · Mac CSV · 오전 12시', () => {
  const android = parseKakao(
    [
      '저장한 날짜 : 2024년 3월 5일 오후 3:00',
      '2015년 5월 14일 목요일',
      '2015년 5월 14일 오전 12:05, 박서진 : 자?',
      '2015년 5월 14일 오후 12:30, 박서진님이 이지우님을 초대했습니다.',
      '2015년 5월 14일 오후 12:31, 이지우 : 응 : 아니',
    ].join('\n'),
    '지우',
  );
  assert.deepEqual(
    android.messages.map((m) => [m.time, m.author, m.text]),
    [
      ['00:05', '박서진', '자?'],
      ['12:31', '이지우', '응 : 아니'],
    ],
  );
  assert.equal(android.me, '이지우', '부분 일치로 나를 찾는다');

  const ios24 = parseKakao('2024. 3. 2. 14:30, 홍길동 : 안녕');
  assert.deepEqual(ios24.messages[0], { date: '2024-03-02', time: '14:30', author: '홍길동', text: '안녕' });

  const csv = parseKakao(['Date,User,Message', '2024-03-02 14:30:00,"홍길동","첫 줄', '둘째 줄 ""인용"""'].join('\n'));
  assert.deepEqual(csv.messages[0], { date: '2024-03-02', time: '14:30', author: '홍길동', text: '첫 줄\n둘째 줄 "인용"' });
});

test('kakao: 여러 줄 메시지 속 날짜 구분선 모양 줄은 본문으로 남고 다음 메시지 날짜를 바꾸지 않는다', () => {
  const quote = ['2019년 3월 2일 토요일', '그날 비 왔잖아'];
  const android = parseKakao(
    ['2019년 3월 1일 금요일', '2019년 3월 1일 오후 9:00, 이지우 : 기억나?', ...quote, '', '2019년 3월 1일 오후 9:05, 박서진 : 응'].join('\n'),
  );
  const pc = parseKakao(
    ['--------------- 2019년 3월 1일 금요일 ---------------', '[이지우] [오후 9:00] 기억나?', ...quote, '[박서진] [오후 9:05] 응'].join('\n'),
  );
  for (const chat of [android, pc]) {
    assert.deepEqual(
      chat.messages.map((m) => [m.date, m.text]),
      [
        ['2019-03-01', `기억나?\n${quote.join('\n')}`],
        ['2019-03-01', '응'],
      ],
    );
  }
});

test('kakao: (모바일) 날짜 구분선 뒤가 시간 없는 시스템 줄·파일 끝이어도 구분선으로 읽고, PC 파일의 맨 날짜 줄은 본문으로 남긴다', () => {
  const night = '2019년 3월 1일 오후 11:50, 이지우 : 잘 자';
  const divider = '2019년 3월 2일 토요일';
  const system = parseKakao([night, divider, '박서진님이 들어왔습니다.', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'].join('\n'));
  assert.deepEqual(
    system.messages.map((m) => [m.date, m.text]),
    [
      ['2019-03-01', '잘 자'],
      ['2019-03-02', '안녕'],
    ],
  );
  const eof = parseKakao([night, divider, ''].join('\n'));
  assert.deepEqual(eof.messages.map((m) => [m.date, m.text]), [['2019-03-01', '잘 자']]);
  const pc = parseKakao(
    [
      '--------------- 2019년 3월 1일 금요일 ---------------',
      '[이지우] [오후 11:50] 잘 자',
      divider,
      '--------------- 2019년 3월 3일 일요일 ---------------',
      '[박서진] [오전 9:00] 안녕',
    ].join('\n'),
  );
  assert.deepEqual(
    pc.messages.map((m) => [m.date, m.text]),
    [
      ['2019-03-01', `잘 자\n${divider}`],
      ['2019-03-03', '안녕'],
    ],
  );
  // PC: 여러 줄 메시지가 날짜 모양 줄로 끝나고 바로 시스템 줄이 와도 날짜를 바꾸지 않는다 (Gate 3 r2 recheck 회귀)
  const pcSystem = parseKakao(
    [
      '--------------- 2019년 3월 1일 금요일 ---------------',
      '[이지우] [오후 11:50] 일기 제목은',
      '2010년 5월 8일 토요일',
      '박서진님이 들어왔습니다.',
      '[박서진] [오후 11:55] 안녕',
    ].join('\n'),
  );
  assert.deepEqual(
    pcSystem.messages.map((m) => [m.date, m.text]),
    [
      ['2019-03-01', '일기 제목은\n2010년 5월 8일 토요일'],
      ['2019-03-01', '안녕'],
    ],
  );
  // 모바일 파일 본문에 PC 모양 줄이 인용돼도 이후 모바일 구분선은 그대로 읽는다 (Codex r2)
  const quoted = parseKakao(
    [
      '2019년 3월 1일 금요일',
      '2019년 3월 1일 오후 9:00, 지우 : 친구가 이렇게 보냈어',
      '[민수] [오후 8:30] 안녕',
      '2019년 3월 2일 토요일',
      '2019년 3월 2일 오전 9:00, 지우 : 오늘은 괜찮아',
      '2019년 3월 3일 일요일',
      '2019년 3월 3일 오전 9:00, 서진 : 학교 가자',
    ].join('\n'),
  );
  assert.deepEqual(
    quoted.messages.filter((m) => m.date >= '2019-03-02').map((m) => [m.date, m.text]),
    [
      ['2019-03-02', '오늘은 괜찮아'],
      ['2019-03-03', '학교 가자'],
    ],
  );
});

test('kakao: 형식이 아니면 메시지 0개, 없는 이름은 me 없음', () => {
  assert.equal(parseKakao('그냥 메모입니다\n두 번째 줄').messages.length, 0);
  assert.equal(parseKakao(fixture('kakao-pc.txt'), '김철수').me, undefined);
});

test('diary: 날짜 머리줄 여러 형식으로 분할, 머리줄 없으면 통째', () => {
  const entries = splitDiary(fixture('diary.txt'));
  assert.deepEqual(
    entries.map((e) => e.date),
    [undefined, '2018-11-15', '2019-02-12', '2019-08-23', '2019-12-10'],
  );
  assert.ok(entries[1]!.text.startsWith('수능 끝.'));
  assert.deepEqual(splitDiary('오늘은 비가 왔다.\n우산을 잃어버렸다.'), [{ text: '오늘은 비가 왔다.\n우산을 잃어버렸다.' }]);
  // 긴 줄은 날짜로 시작해도 머리줄이 아니다
  assert.equal(splitDiary('2019년 2월 12일에 졸업했는데 그날 일은 아직도 생생하게 기억난다.').length, 1);
});

test('kakaoDayBlocks / packChunks: 날짜 경계 유지, 큰 블록은 머리줄 다시 붙임', () => {
  const blocks = kakaoDayBlocks(parseKakao(fixture('kakao-pc.txt')));
  assert.equal(blocks.length, 5);
  assert.ok(blocks[1]!.startsWith('## 2015-05-14\n16:31 이지우(나): 야 박서진'));
  assert.ok(blocks[1]!.includes('들었거든 / 나도 진짜'));

  const packed = packChunks(blocks, 400);
  assert.ok(packed.every((c) => c.length <= 400));
  assert.equal(packed.join('\n').replace(/\n/g, '').length >= blocks.join('').replace(/\n/g, '').length, true);

  const big = `## 2020-01-01\n${Array.from({ length: 50 }, (_, i) => `10:${String(i).padStart(2, '0')} 나: ${'가'.repeat(40)}`).join('\n')}`;
  const parts = packChunks([big, '## 2020-01-02\n짧음'], 500);
  assert.ok(parts.length > 3);
  assert.ok(parts.every((c) => c.length <= 500 && c.startsWith('## 2020-01-0')));
  assert.ok(packChunks(['x'.repeat(1000)], 300).every((c) => c.length <= 300));
});

test('dateKey / sortByTime: 연도 없는 사건은 출생연도(2000)+나이, 그것도 없으면 AI 순서상 앞 사건 바로 뒤', () => {
  assert.equal(dateKey('2015-05-14'), 20150514);
  assert.equal(dateKey('2015년 5월'), 20150500);
  assert.equal(dateKey('2015-05 ~ 2016'), 20150500);
  assert.equal(dateKey('중학교 2학년 봄'), undefined);
  const sorted = sortByTime([
    { date: '2024-03-04', age: 24 },
    { date: '2015-05-14', age: 15 },
    { date: '열 살 무렵', age: 10 },
    { date: '어느 겨울' },
  ]);
  assert.deepEqual(
    sorted.map((e) => e.date),
    ['열 살 무렵', '어느 겨울', '2015-05-14', '2024-03-04'],
  );
});

const llmEvent = (over: Partial<LlmEvent>): LlmEvent => ({
  title: '사건',
  date: '2015-05-14',
  dateEstimated: false,
  age: null,
  emotions: [],
  context: '',
  people: [],
  summary: '',
  selfAtTime: { traits: [], speechStyle: '', quotes: [] },
  ...over,
});

test('normalizeEvents: 계약 길이로 자르고 정렬 후 id 부여', () => {
  const events = normalizeEvents([
    llmEvent({ title: '첫 출근', date: '2024-03-04', age: 24.4 }),
    llmEvent({ title: 'ㄱ'.repeat(200), date: '', age: 0, emotions: Array(15).fill('서운함'), people: [' ', '민수'] }),
  ]);
  // 날짜 없는 사건은 바로 앞 사건(첫 출근) 뒤에 남는다
  assert.deepEqual(events.map((e) => e.id), ['evt_01', 'evt_02']);
  assert.equal(events[0]!.age, 24);
  assert.equal(events[1]!.title.length, 80);
  assert.equal(events[1]!.date, '시점 모름');
  assert.equal(events[1]!.age, undefined);
  assert.equal(events[1]!.emotions.length, 10);
  assert.deepEqual(events[1]!.people, ['민수']);
});

test('analyzeRecords: 짧으면 한 번, 길면 구간 요약 후 분석', async () => {
  const calls: { system: string; input: string }[] = [];
  const fake: Generate = async (o) => {
    calls.push({ system: o.system, input: o.input });
    const out =
      (o.schema as unknown) === LlmAnalysisSchema
        ? { events: [llmEvent({ title: '친구와 다툰 날', age: 15 })], owner: { name: null, currentAge: null } }
        : {
            moments: [{ date: '2015-05-14', what: '다툼', people: ['박서진'], emotions: ['서운함'], myWords: ['됐어'] }],
            ownerClues: calls.length === 1 ? ['2015-01-03 나 2000년생이야'] : [],
          };
    return o.schema.parse(out);
  };

  const short = await analyzeRecords({ source: 'kakao', text: fixture('kakao-pc.txt') }, fake, '2026-11-17');
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.input, /오늘: 2026-11-17\n기록 종류: 카카오톡 대화 내보내기\n참여자: 박서진, 이지우\n나: 이지우/);
  assert.equal(short.meta.mode, 'direct');
  assert.ok(AnalyzeResponseSchema.safeParse(short).success);
  assert.equal(short.events[0]!.title, '친구와 다툰 날');
  // AI 가 '나'를 모르면 카카오톡의 '나'와 사건(2015-05-14, 15살 → 2000년생)으로 채운다
  assert.deepEqual(short.owner, { name: '이지우', currentAge: 26 });

  calls.length = 0;
  const days = Array.from({ length: 120 }, (_, d) => {
    const date = new Date(Date.UTC(2015, 0, 1 + d));
    const header = `--------------- ${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 목요일 ---------------`;
    return [header, ...Array.from({ length: 10 }, () => `[이지우] [오후 2:30] ${'오늘 학교에서 있었던 일 '.repeat(4)}`)].join('\n');
  });
  const long = days.join('\n');
  assert.ok(long.length > DIRECT_CHARS);
  const res = await analyzeRecords({ source: 'kakao', text: long, me: '이지우' }, fake);
  assert.equal(res.meta.mode, 'summarized');
  assert.equal(calls.length, res.meta.chunks + 1);
  assert.ok(calls.slice(0, -1).every((c) => c.input.length <= CHUNK_CHARS + 200));
  assert.match(calls.at(-1)!.input, /## 2015-05-14 \| 다툼 \| 인물: 박서진 \| 감정: 서운함 \| 나의 말: "됐어"/);
  // 구간 요약이 잡담 속 나이 단서를 따로 남기면 최종 분석 입력 끝에 붙는다 (단서가 있는 구간만)
  assert.match(calls[0]!.system, /ownerClues: '나'의 나이·출생연도·학년/);
  assert.ok(calls.at(-1)!.input.endsWith('\n\n나이 단서:\n- 2015-01-03 나 2000년생이야'));

  await assert.rejects(analyzeRecords({ source: 'kakao', text: '그냥 메모' }, fake), AnalyzeInputError);
});

test('normalizeOwner: AI 값 우선, 없으면 대화명·사건으로 계산, 사건 나이보다 어리지 않게', () => {
  const events = normalizeEvents([llmEvent({ date: '2015-05-14', age: 15 }), llmEvent({ date: '2024-03-04', age: 24 })]);
  assert.deepEqual(normalizeOwner({ name: ' "홍길동"\n', currentAge: 31.6 }, events, '길동', '2026-11-19'), { name: '홍길동', currentAge: 32 });
  assert.deepEqual(normalizeOwner({ name: null, currentAge: null }, events, '길동', '2026-11-19'), { name: '길동', currentAge: 26 });
  assert.deepEqual(normalizeOwner({ name: null, currentAge: 20 }, events, undefined, '2026-11-19'), { name: null, currentAge: 24 });
  assert.deepEqual(normalizeOwner({ name: '', currentAge: null }, [], undefined, '2026-11-19'), { name: null, currentAge: null });
  assert.deepEqual(normalizeOwner({ name: '가'.repeat(30), currentAge: 500 }, [], undefined, '2026-11-19').currentAge, null);
});

test('분석 프롬프트: 사건 제목은 \'~한 날\'로, owner 를 묻는다', () => {
  assert.match(ANALYZE_SYSTEM, /'~한 날'/);
  assert.match(ANALYZE_SYSTEM, /명사형으로 끝내지 않는다/);
  assert.match(ANALYZE_SYSTEM, /owner:/);
});
