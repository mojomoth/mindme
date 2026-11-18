// 기록 분석 파이프라인: 입력 정리 → (길면 날짜 단위 구간 요약) → 사건 추출 → 정규화·시간순 정렬.
// AI 호출은 인자로 받는다. 서버에서는 @mindme/core/server 의 generateObject 를 넘기고, 테스트에서는 가짜를 넘긴다.
import { z } from 'zod';
import { EventSchema, type AnalyzeMeta, type AnalyzeResponse, type Owner, type Source, type TimelineEvent } from '../schemas.ts';
import { kakaoDayBlocks, packChunks, parseKakao, splitDiary } from './parse.ts';

export type Generate = <T>(opts: { schema: z.ZodType<T>; system: string; input: string }) => Promise<T>;

// 토큰 예산 (한국어는 대략 1글자 ≈ 1토큰).
// 입력 상한은 api.md 의 text 1~300,000자와 같다. 정리한 본문이 DIRECT_CHARS 이하면 한 번에 분석하고,
// 넘으면 날짜 경계를 지키며 CHUNK_CHARS 묶음으로 잘라 구간별로 요약한 뒤 요약본을 분석한다.
// 300,000자 → 약 10구간. 구간 요약은 모두 동시에 보낸다: 최악 지연 = 요약 1회 + 최종 1회
// (호출당 타임아웃 60초 x 재시도 1회, llm.ts) ≈ 250초 < apps/web maxDuration 300초. 근거는 logs/gate3-server.md.
export const MAX_INPUT_CHARS = 300_000;
export const DIRECT_CHARS = 40_000;
export const CHUNK_CHARS = 30_000;

/** 입력이 분석할 수 없는 형식일 때 (Route Handler 에서 400) */
export class AnalyzeInputError extends Error {}

// ── AI 출력 스키마 ─────────────────────────────────────────
// OpenAI structured output(strict)은 모든 필드가 필수라서 선택값은 nullable 로 받는다.
// 길이 제한은 여기 두지 않고 normalizeEvents 에서 계약(EventSchema) 길이로 자른다.

const LlmEventSchema = z.object({
  title: z.string(),
  date: z.string(),
  dateEstimated: z.boolean(),
  age: z.number().nullable(),
  emotions: z.array(z.string()),
  context: z.string(),
  people: z.array(z.string()),
  summary: z.string(),
  selfAtTime: z.object({
    traits: z.array(z.string()),
    speechStyle: z.string(),
    quotes: z.array(z.string()),
  }),
});
export const LlmAnalysisSchema = z.object({
  events: z.array(LlmEventSchema),
  owner: z.object({ name: z.string().nullable(), currentAge: z.number().nullable() }),
});
export type LlmEvent = z.infer<typeof LlmEventSchema>;

const DigestSchema = z.object({
  moments: z.array(
    z.object({
      date: z.string(),
      what: z.string(),
      people: z.array(z.string()),
      emotions: z.array(z.string()),
      myWords: z.array(z.string()),
    }),
  ),
});

// ── 프롬프트 ──────────────────────────────────────────────

const SOURCE_LABEL: Record<Source, string> = {
  kakao: '카카오톡 대화 내보내기',
  diary: '일기',
  prompt: '사용자가 직접 쓴 자기 이야기',
};

export const ANALYZE_SYSTEM = `너는 한 사람의 기록에서 인생의 사건을 골라 타임라인을 만든다. 결과는 '그 시점의 나'를 페르소나로 되살려 대화하는 데 쓰인다.

사건 고르기
- '나'에게 의미가 있었던 일만 고른다: 관계가 달라진 일(다툼·화해·이별), 진학·졸업·입사·이사 같은 전환점, 감정이 크게 움직인 날.
- 인사, 약속 잡기, 별일 없는 잡담은 사건이 아니다. 기록이 짧으면 사건이 1~2개뿐이어도 된다. 없는 사건을 만들지 않는다.
- 여러 날에 걸쳐 이어진 같은 일(다툼과 다음 날의 화해 등)은 성격이 다르면 나누고, 같은 일의 연속이면 하나로 묶는다.
- 카카오톡에서 '(나)'가 붙은 사람이 '나'다. '나'가 지정되지 않았으면 대화 흐름으로 '나'를 추정하고, 그 사람 시점으로 쓴다.

필드
- title: 20자 안팎. '친구와 다툰 날', '첫 출근 날', '수능 끝난 날'처럼 '~한 날'(밤·아침 등 때를 나타내는 말도 됨)로 끝낸다. 앱이 '친구와 다툰 날의 지우'처럼 이름을 붙여 쓰므로 '민수와 크게 다툼', '이직 결심' 같은 명사형으로 끝내지 않는다.
- date: 기록에 날짜가 있으면 'YYYY-MM-DD'. 일이나 월을 모르면 'YYYY-MM', 'YYYY'. 연도도 알 수 없으면 '중학교 2학년 봄'처럼 짧은 표현.
- dateEstimated: 기록에 그 날짜가 그대로 없고 나이·'작년' 같은 단서로 계산했으면 true.
- age: 그때 '나'의 나이(연 나이 = 그해 연도 - 출생연도). 기록에 나이가 나오면 그 숫자를 따르고, 학년만 있으면 중1=13살, 고1=16살, 대학 1학년=19살로 센다. 단서가 없으면 null.
- emotions: 그때 '나'의 감정 1~4개, 한두 단어씩 ('서운함', '설렘').
- context: 무슨 대화·상황에서 일어났는지 2~3문장.
- people: 관련 인물 이름(기록에 나온 호칭 그대로). '나'는 넣지 않는다.
- summary: 무슨 일이 있었고 '나'가 어떻게 반응했는지 2~3문장.
- selfAtTime: 그 시점의 '나'. traits 는 성격 2~5개, speechStyle 은 말투(반말·존댓말, 자주 쓰는 표현, ㅋㅋ·이모티콘 습관 등) 한두 문장, quotes 는 '나'가 실제로 한 말 원문 1~3개(기록에 '나'의 말이 없으면 빈 배열). 기록에서 보이는 만큼만 쓰고 지어내지 않는다.

owner: 기록을 남긴 '나'.
- name: 기록에 나온 '나'의 이름. 카카오톡이면 '나'의 대화명, 일기·글이면 스스로 밝힌 이름이나 남이 부른 이름. 기록에 없으면 null.
- currentAge: 오늘 기준 '나'의 나이(연 나이). 출생연도, '올해 서른', 학년, 사건 당시 나이 같은 단서로 계산한다. 단서가 없으면 null. 짐작으로 채우지 않는다.

모든 값은 한국어로 쓰고, 사건은 일어난 순서대로 나열한다.`;

const DIGEST_SYSTEM = `너는 긴 기록의 한 구간을 읽고, 나중에 인생 사건 타임라인을 만들 수 있도록 사건 후보만 추린다.
- '나'에게 의미 있는 일(관계 변화, 진학·졸업·입사·이사, 감정이 크게 움직인 일)만 남기고 잡담은 버린다. 없으면 빈 배열.
- date 는 'YYYY-MM-DD'(구간의 '## 날짜' 머리줄 기준), what 은 무슨 일이었는지 한두 문장, myWords 는 '나'가 실제로 한 말 원문 최대 3개.
- 카카오톡에서 '(나)'가 붙은 사람이 '나'다. 모든 값은 한국어로 쓴다.`;

// ── 파이프라인 ─────────────────────────────────────────────

type Prepared = { blocks: string[]; header: string; units: number; participants: string[]; me?: string };

function prepare(source: Source, text: string, me: string | undefined, today: string): Prepared {
  const base = `오늘: ${today}\n기록 종류: ${SOURCE_LABEL[source]}`;
  if (source === 'kakao') {
    const chat = parseKakao(text, me);
    if (!chat.messages.length) {
      throw new AnalyzeInputError('카카오톡 대화 형식을 찾지 못했어요. 카카오톡에서 내보낸 TXT 파일인지 확인해 주세요.');
    }
    const meLine = chat.me
      ? `나: ${chat.me}`
      : me
        ? `나: '${me}'(이 이름이 대화에 없어 대화 흐름으로 추정)`
        : '나: 지정 안 됨(대화 흐름으로 추정)';
    return {
      blocks: kakaoDayBlocks(chat),
      header: `${base}\n참여자: ${chat.participants.join(', ')}\n${meLine}`,
      units: chat.messages.length,
      participants: chat.participants,
      me: chat.me,
    };
  }
  if (source === 'diary') {
    const entries = splitDiary(text);
    return {
      blocks: entries.map((e) => (e.date ? `## ${e.date}\n${e.text}` : e.text)),
      header: base,
      units: entries.length,
      participants: [],
    };
  }
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return { blocks: paragraphs, header: base, units: paragraphs.length, participants: [] };
}

export async function analyzeRecords(
  req: { source: Source; text: string; me?: string },
  generate: Generate,
  today = new Date().toISOString().slice(0, 10),
): Promise<AnalyzeResponse & { meta: AnalyzeMeta }> {
  const text = req.text.slice(0, MAX_INPUT_CHARS);
  const p = prepare(req.source, text, req.me, today);
  const body = p.blocks.join('\n\n');

  let input: string;
  let mode: AnalyzeMeta['mode'] = 'direct';
  let chunks = 1;
  if (body.length <= DIRECT_CHARS) {
    input = `${p.header}\n\n${body}`;
  } else {
    mode = 'summarized';
    const parts = packChunks(p.blocks, CHUNK_CHARS);
    chunks = parts.length;
    const digests = await Promise.all(
      parts.map((part) => generate({ schema: DigestSchema, system: DIGEST_SYSTEM, input: `${p.header}\n\n${part}` })),
    );
    const lines = digests.flatMap((d) =>
      d.moments.map(
        (m) =>
          `## ${m.date} | ${m.what} | 인물: ${m.people.join(', ') || '-'} | 감정: ${m.emotions.join(', ') || '-'}` +
          (m.myWords.length ? ` | 나의 말: ${m.myWords.map((w) => `"${w}"`).join(' ')}` : ''),
      ),
    );
    input = `${p.header}\n(긴 기록을 ${chunks}개 구간으로 나눠 사건 후보만 요약한 것이다)\n\n${lines.join('\n')}`;
  }

  const llm = await generate({ schema: LlmAnalysisSchema, system: ANALYZE_SYSTEM, input });
  const events = normalizeEvents(llm.events);
  return {
    events,
    owner: normalizeOwner(llm.owner, events, p.me, today),
    meta: { mode, chunks, units: p.units, participants: p.participants, me: p.me, llm },
  };
}

// ── 정규화 · 정렬 ─────────────────────────────────────────

const clip = (s: string, n: number) => s.trim().slice(0, n);
const clipList = (xs: string[], each: number, max: number) =>
  xs.map((x) => clip(x, each)).filter(Boolean).slice(0, max);

/** AI 출력을 계약(EventSchema) 길이에 맞추고, 시간순으로 정렬한 뒤 id 를 매긴다. */
export function normalizeEvents(raw: LlmEvent[]): TimelineEvent[] {
  const events = raw.slice(0, 100).map((e) => {
    const age = e.age === null ? undefined : Math.round(e.age);
    return {
      title: clip(e.title, 80) || '제목 없는 사건',
      date: clip(e.date, 40) || '시점 모름',
      dateEstimated: e.dateEstimated,
      age: age !== undefined && age >= 1 && age <= 120 ? age : undefined,
      emotions: clipList(e.emotions, 20, 10),
      context: clip(e.context, 1000),
      people: clipList(e.people, 40, 20),
      summary: clip(e.summary, 1000),
      selfAtTime: {
        traits: clipList(e.selfAtTime.traits, 40, 10),
        speechStyle: clip(e.selfAtTime.speechStyle, 300),
        quotes: clipList(e.selfAtTime.quotes, 200, 5),
      },
    };
  });
  return sortByTime(events).map((e, i) => EventSchema.parse({ id: `evt_${String(i + 1).padStart(2, '0')}`, ...e }));
}

/**
 * AI 가 추정한 '나'를 계약 모양으로. 이름이 없으면 카카오톡에서 찾은 '나', 나이가 없으면 사건(연도·나이)으로 계산한다.
 * 현재 나이는 사건 당시 나이보다 어릴 수 없다.
 */
export function normalizeOwner(raw: { name: string | null; currentAge: number | null }, events: TimelineEvent[], me: string | undefined, today: string): Owner {
  const name = clip((raw.name ?? me ?? '').replace(/["'“”‘’\s]+/g, ' '), 20) || null;
  const birth = birthYearOf(events);
  let age = raw.currentAge !== null ? Math.round(raw.currentAge) : birth !== undefined ? Number(today.slice(0, 4)) - birth : undefined;
  const oldest = Math.max(0, ...events.map((e) => e.age ?? 0));
  if (age !== undefined && age < oldest) age = oldest;
  return { name, currentAge: age !== undefined && age >= 1 && age <= 120 ? age : null };
}

/** 'YYYY-MM-DD', 'YYYY-MM', 'YYYY', '2015년 5월' 등에서 YYYYMMDD 정렬 키를 만든다. 연도가 없으면 undefined. */
export function dateKey(date: string): number | undefined {
  const m = date.match(/((?:19|20)\d{2})(?:\D{1,3}(\d{1,2})(?!\d))?(?:\D{1,3}(\d{1,2})(?!\d))?/);
  if (!m) return undefined;
  const month = Math.min(Number(m[2] ?? 0), 12);
  const day = Math.min(Number(m[3] ?? 0), 31);
  return Number(m[1]) * 10000 + month * 100 + day;
}

/**
 * 시간순 안정 정렬. 날짜에 연도가 없으면 (출생연도 추정 + 나이)로, 그것도 없으면 바로 앞 사건의 위치를 따른다.
 * 출생연도는 연도와 나이가 둘 다 있는 사건들의 (연도 - 나이) 중앙값.
 */
export function sortByTime<T extends { date: string; age?: number }>(events: T[]): T[] {
  const birth = birthYearOf(events);
  let prev = 0;
  const keyed = events.map((e) => {
    let k = dateKey(e.date);
    if (k === undefined && birth !== undefined && e.age !== undefined) k = (birth + e.age) * 10000;
    prev = k ?? prev;
    return { e, k: prev };
  });
  return keyed.sort((a, b) => a.k - b.k).map((x) => x.e);
}

/** 출생연도 추정: 연도와 나이가 둘 다 있는 사건들의 (연도 - 나이) 중앙값. 없으면 undefined. */
function birthYearOf(events: { date: string; age?: number }[]): number | undefined {
  const births = events
    .flatMap((e) => {
      const k = dateKey(e.date);
      return k !== undefined && e.age !== undefined ? [Math.floor(k / 10000) - e.age] : [];
    })
    .sort((a, b) => a - b);
  return births[Math.floor(births.length / 2)];
}
