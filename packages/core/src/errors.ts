// zod 검증 오류 → 사용자에게 보여 줄 한국어 문구. zod 기본 메시지(영어)는 내보내지 않는다.
// 비밀이 없어 클라이언트 폼 검증에서도 쓸 수 있다. Route Handler 는 parseRequest(server/http.ts)가 이걸 쓴다.
import type { z } from 'zod';

// 경로(숫자 인덱스 제외)를 먼저 찾고, 없으면 마지막 키로 찾는다.
const LABELS: Record<string, string> = {
  source: '기록 종류',
  text: '기록',
  me: '내 대화명',
  kind: '페르소나 종류',
  age: '나이',
  eventId: '사건',
  event: '사건',
  phase: '시점',
  situation: '상황 설명',
  events: '사건 목록',
  futureGoals: '바라는 삶',
  profile: '프로필',
  'profile.name': '이름',
  currentAge: '지금 나이',
  story: '나의 이야기',
  title: '사건 제목',
  date: '날짜',
  dateEstimated: '날짜 추정 여부',
  emotions: '감정',
  people: '등장인물',
  summary: '요약',
  context: '맥락',
  selfAtTime: '그때의 나',
  quotes: '그때 한 말',
  persona: '페르소나',
  'persona.name': '페르소나 이름',
  traits: '성격',
  speechStyle: '말투',
  memories: '기억',
  greeting: '첫 인사',
  avatar: '아바타',
  messages: '대화',
  content: '메시지',
  role: '메시지 역할',
  photo: '사진',
  id: '아이디',
  name: '이름',
};

/** 받침이 있으면 a, 없으면 b ('나이는' / '이름은'). 한글이 아니면 받침 없음으로 본다. */
const josa = (word: string, a: string, b: string) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 ? a : b;
};

function labelOf(path: PropertyKey[]): string | undefined {
  const keys = path.filter((k): k is string => typeof k === 'string');
  return LABELS[keys.join('.')] ?? LABELS[keys.at(-1) ?? ''];
}

/** zod 이슈 하나 → 한국어 문구. */
function issueMessage(issue: z.core.$ZodIssue): string {
  const label = labelOf(issue.path);
  if (issue.code === 'custom') return /[가-힣]/.test(issue.message) ? issue.message : `${label ?? '요청'} 값을 확인해 주세요.`;
  if (!label) return '요청 형식이 올바르지 않아요.';
  const topic = `${label}${josa(label, '은', '는')}`;
  const object = `${label}${josa(label, '을', '를')}`;
  switch (issue.code) {
    case 'invalid_type':
      // zod 는 기본적으로 input 을 싣지 않아서, 값이 빠졌는지는 기본 메시지 끝('received undefined')으로 가린다.
      return /received undefined$/.test(issue.message) ? `${object} 입력해 주세요.` : `${label} 형식이 올바르지 않아요.`;
    case 'too_small': {
      const min = Number(issue.minimum);
      if (issue.origin === 'string') return min <= 1 ? `${object} 입력해 주세요.` : `${topic} ${min}자 이상이어야 해요.`;
      if (issue.origin === 'array') return min <= 1 ? `${label}${josa(label, '이', '가')} 하나 이상 있어야 해요.` : `${topic} ${min}개 이상이어야 해요.`;
      return `${topic} ${min} 이상이어야 해요.`;
    }
    case 'too_big': {
      const max = Number(issue.maximum).toLocaleString('ko-KR');
      if (issue.origin === 'string') return `${topic} ${max}자 이하로 줄여 주세요.`;
      if (issue.origin === 'array') return `${topic} ${max}개까지만 보낼 수 있어요.`;
      return `${topic} ${max} 이하여야 해요.`;
    }
    default:
      return `${label} 값이 올바르지 않아요.`;
  }
}

/** zod 오류 → 첫 번째 이슈의 한국어 문구. */
export function zodErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? issueMessage(issue) : '요청 형식이 올바르지 않아요.';
}
