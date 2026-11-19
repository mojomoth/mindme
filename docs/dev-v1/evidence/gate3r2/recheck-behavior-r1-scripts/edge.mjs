// recheck-behavior-r1: analysis-1-edge. core parseKakao 를 직접 불러 경계 입력을 확인한다(AI 없음).
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const { parseKakao } = await import(`${REPO}/packages/core/src/analysis/parse.ts`);
const P = (lines) => parseKakao(lines.join('\n')).messages.map((m) => [m.date, m.time, m.text]);
const night = '2019년 3월 1일 오후 11:50, 이지우 : 잘 자';
const div = '2019년 3월 2일 토요일';
const pcDiv = (d) => `--------------- 2019년 3월 ${d}일 ${'금토일'[d - 1]}요일 ---------------`;
const cases = {
  // 1) 구분선 뒤가 시간 없는 시스템 줄(모바일 Android)
  mobileSystemNext: { in: [night, div, '박서진님이 들어왔습니다.', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-02', '09:00', '안녕']] },
  // 2) 다른 시스템 문구(초대·나감)
  mobileSystemInvite: { in: [night, div, '이지우님이 김민수님을 초대했습니다.', '2019년 3월 2일 오전 9:00, 김민수 : 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-02', '09:00', '안녕']] },
  mobileSystemLeft: { in: [night, div, '박서진님이 나갔습니다.'], want: [['2019-03-01', '23:50', '잘 자']] },
  // 3) 구분선과 시스템 줄 사이에 빈 줄
  mobileBlankThenSystem: { in: [night, div, '', '', '박서진님이 들어왔습니다.', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-02', '09:00', '안녕']] },
  // 4) 시간 있는 시스템 줄(같은 날짜)
  mobileTimedSystem: { in: [night, div, '2019년 3월 2일 오전 8:59, 박서진님이 들어왔습니다.', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-02', '09:00', '안녕']] },
  // 5) 파일 끝(빈 줄로 끝남 / 줄바꿈 없이 끝남 / CRLF)
  eofTrailingNewline: { in: [night, div, ''], want: [['2019-03-01', '23:50', '잘 자']] },
  eofNoNewline: { in: [night, div], want: [['2019-03-01', '23:50', '잘 자']] },
  eofBlankLines: { in: [night, div, '', '', ''], want: [['2019-03-01', '23:50', '잘 자']] },
  // 6) iOS 메시지 줄 + 구분선 + 시스템 줄
  iosSystemNext: { in: ['2019. 3. 1. 오후 11:50, 이지우 : 잘 자', div, '박서진님이 들어왔습니다.', '2019. 3. 2. 오전 9:00, 박서진 : 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-02', '09:00', '안녕']] },
  // 7) PC 판: 날짜 모양 줄 바로 뒤가 PC 구분선 / 시스템 줄 / 파일 끝
  pcThenPcDivider: { in: [pcDiv(1), '[이지우] [오후 11:50] 잘 자', div, pcDiv(3), '[박서진] [오전 9:00] 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-03', '09:00', '안녕']] },
  pcThenSystem: { in: [pcDiv(1), '[이지우] [오후 11:50] 잘 자', div, '박서진님이 들어왔습니다.', '[박서진] [오후 11:55] 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-01', '23:55', '안녕']] },
  pcThenSystemFarDate: { in: [pcDiv(1), '[이지우] [오후 9:00] 우리 처음 만난 날 기억나?', '2010년 1월 1일 금요일', '박서진님이 들어왔습니다.', '[박서진] [오후 9:05] 응 기억나', '[이지우] [오후 9:06] 벌써 9년이네'], want: [['2019-03-01', '21:00', '우리 처음 만난 날 기억나?\n2010년 1월 1일 금요일'], ['2019-03-01', '21:05', '응 기억나'], ['2019-03-01', '21:06', '벌써 9년이네']] },
  // 8) 여러 줄 메시지 중간의 날짜 모양 줄 뒤에 일반 본문 → 본문으로 남고 다음 날짜도 그대로
  midAndroid: { in: ['2019년 3월 1일 금요일', '2019년 3월 1일 오후 9:00, 이지우 : 기억나?', div, '그날 비 왔잖아', '우산 하나로 둘이 썼던 날', '2019년 3월 1일 오후 9:05, 박서진 : 응'], want: [['2019-03-01', '21:00', `기억나?\n${div}\n그날 비 왔잖아\n우산 하나로 둘이 썼던 날`], ['2019-03-01', '21:05', '응']] },
  midAndroidBlankBetween: { in: ['2019년 3월 1일 오후 9:00, 이지우 : 기억나?', div, '', '그날 비 왔잖아', '2019년 3월 1일 오후 9:05, 박서진 : 응'], want: [['2019-03-01', '21:00', `기억나?\n${div}\n\n그날 비 왔잖아`], ['2019-03-01', '21:05', '응']] },
  midIos: { in: ['2019. 3. 1. 오후 9:00, 이지우 : 기억나?', div, '그날 비 왔잖아', '2019. 3. 1. 오후 9:05, 박서진 : 응'], want: [['2019-03-01', '21:00', `기억나?\n${div}\n그날 비 왔잖아`], ['2019-03-01', '21:05', '응']] },
  midPc: { in: [pcDiv(1), '[이지우] [오후 9:00] 기억나?', div, '그날 비 왔잖아', '[박서진] [오후 9:05] 응'], want: [['2019-03-01', '21:00', `기억나?\n${div}\n그날 비 왔잖아`], ['2019-03-01', '21:05', '응']] },
  // 9) 날짜 모양 줄 뒤에 다른 날짜(더 이른 날)의 메시지 → 본문(구분선 아님), 다음 메시지는 자기 줄 날짜
  midThenOtherDayMsg: { in: ['2019년 3월 1일 오후 9:00, 이지우 : 기억나?', div, '2019년 3월 1일 오후 9:05, 박서진 : 응'], want: [['2019-03-01', '21:00', `기억나?\n${div}`], ['2019-03-01', '21:05', '응']] },
  // 10) 정상 구분선(다음 줄이 같은 날 메시지) 회귀
  normalDivider: { in: [night, div, '2019년 3월 2일 오전 9:00, 박서진 : 안녕'], want: [['2019-03-01', '23:50', '잘 자'], ['2019-03-02', '09:00', '안녕']] },
};
const out = { at: new Date().toISOString(), cases: {}, fixtures: {}, perf: {} };
let fails = 0;
for (const [k, c] of Object.entries(cases)) {
  const got = P(c.in);
  const pass = JSON.stringify(got) === JSON.stringify(c.want);
  if (!pass) fails++;
  out.cases[k] = { pass, input: c.in, got, ...(pass ? {} : { want: c.want }) };
}
// 예시 파일 회귀
for (const f of ['kakao-mobile.txt', 'kakao-pc.txt']) out.fixtures[f] = parseKakao(readFileSync(`${REPO}/pocs/fixtures/analysis/${f}`, 'utf8')).messages.length;
// 성능: 날짜 모양 줄·빈 줄이 많은 30만 자 입력
const big1 = Array.from({ length: 22000 }, () => div).join('\n');
const big2 = [night, ...Array.from({ length: 14000 }, (_, i) => (i % 2 ? '' : div))].join('\n');
const big3 = [night, div, '\n'.repeat(290000)].join('\n');
for (const [k, s] of Object.entries({ manyDividers: big1, dividerBlankAlternating: big2, dividerThenHugeBlank: big3 })) {
  const t = performance.now();
  const n = parseKakao(s).messages.length;
  out.perf[k] = { chars: s.length, messages: n, ms: Math.round(performance.now() - t) };
}
out.summary = { total: Object.keys(cases).length, fails };
writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ summary: out.summary, fixtures: out.fixtures, perf: out.perf, failed: Object.entries(out.cases).filter(([, v]) => !v.pass) }, null, 1));
