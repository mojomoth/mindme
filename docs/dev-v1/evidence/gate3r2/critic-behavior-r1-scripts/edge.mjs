const { parseKakao } = await import('/Users/jeongyounglee/work/repo/mindme/packages/core/src/analysis/parse.ts');
const a = parseKakao(['2019년 3월 1일 오후 11:50, 이지우 : 잘 자', '2019년 3월 2일 토요일', '박서진님이 들어왔습니다.', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'].join('\n')).messages;
const b = parseKakao(['2019년 3월 1일 오후 11:50, 이지우 : 잘 자', '2019년 3월 2일 토요일', ''].join('\n')).messages;
const c = parseKakao(['2019년 3월 1일 오후 11:50, 이지우 : 잘 자', '2019년 3월 2일 토요일', '', '2019년 3월 2일 오전 9:00, 박서진 : 안녕'].join('\n')).messages;
console.log(JSON.stringify({ systemOnlyNext: a, eof: b, blankThenMsg: c }));
