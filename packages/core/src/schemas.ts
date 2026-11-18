// 최소 API 계약. docs/dev-v1/api.md 와 1:1 로 맞춘다 (한쪽을 바꾸면 다른 쪽도 바꾼다).
import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);

// ── 공용 도메인 ─────────────────────────────────────────────

export const SourceSchema = z.enum(['kakao', 'diary', 'prompt']);
export const PersonaKindSchema = z.enum(['past', 'present', 'future']);
export const PhaseSchema = z.enum(['before', 'during', 'after']);
export const AgeSchema = z.int().min(1).max(120);

/** 그 시점의 '나' 단서. 페르소나 생성(/api/persona)이 성격·말투를 잡을 때 쓴다. */
export const SelfAtTimeSchema = z.object({
  traits: z.array(text(40)).max(10),
  speechStyle: z.string().max(300),
  /** '나'가 실제로 한 말(원문). 기록에 없으면 빈 배열 */
  quotes: z.array(text(200)).max(5),
});

/** 타임라인의 사건 하나. date 는 'YYYY', 'YYYY-MM', 'YYYY-MM-DD' 또는 추정 표현. */
export const EventSchema = z.object({
  id: text(64),
  title: text(80),
  date: text(40),
  dateEstimated: z.boolean().default(false),
  age: AgeSchema.optional(),
  emotions: z.array(text(20)).max(10),
  context: z.string().max(1000),
  people: z.array(text(40)).max(20),
  summary: z.string().max(1000),
  selfAtTime: SelfAtTimeSchema.optional(),
});

/** 사용자 기본 정보. 페르소나 이름('15살의 홍길동')을 만들 때 쓴다. */
export const ProfileSchema = z.object({
  name: text(20),
  currentAge: AgeSchema.optional(),
  story: z.string().max(2000).optional(),
});

export const PersonaSchema = z.object({
  id: text(64),
  name: text(40),
  kind: PersonaKindSchema,
  age: AgeSchema,
  eventId: text(64).optional(),
  phase: PhaseSchema.optional(),
  traits: z.array(text(40)).max(10),
  speechStyle: z.string().max(500),
  memories: z.array(text(300)).max(20),
  emotions: z.array(text(20)).max(10),
  greeting: text(300),
  avatar: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: text(4000),
});

export const ErrorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

// ── POST /api/analyze ──────────────────────────────────────

export const AnalyzeRequestSchema = z.object({
  source: SourceSchema,
  text: text(300_000),
  /** 카카오톡 대화에서 '나'에 해당하는 대화명. 없으면 AI 가 추정한다. */
  me: text(40).optional(),
});
/** 입출력 검증용 부가 정보. 클라이언트 동작에는 필요 없다. */
export const AnalyzeMetaSchema = z.object({
  /** direct: 한 번에 분석, summarized: 날짜 단위 구간 요약 후 분석 */
  mode: z.enum(['direct', 'summarized']),
  chunks: z.int().min(0),
  /** kakao: 메시지 수, diary: 일기 항목 수, prompt: 문단 수 */
  units: z.int().min(0),
  participants: z.array(z.string()),
  me: z.string().optional(),
  /** 마지막 AI 호출의 원시 출력 */
  llm: z.unknown(),
});
export const AnalyzeResponseSchema = z.object({
  events: z.array(EventSchema).max(100),
  meta: AnalyzeMetaSchema.optional(),
});

// ── POST /api/persona ──────────────────────────────────────

export const PersonaRequestSchema = z.object({
  kind: PersonaKindSchema,
  age: AgeSchema,
  eventId: text(64).optional(),
  phase: PhaseSchema.optional(),
  situation: z.string().max(2000).default(''),
  events: z.array(EventSchema).max(100).default([]),
  profile: ProfileSchema,
});
export const PersonaResponseSchema = z.object({ persona: PersonaSchema });

// ── POST /api/persona/avatar ───────────────────────────────

/** data URL (image/jpeg|png|webp, base64). Vercel 요청 본문 4.5MB 제한을 고려해 약 4MB 로 자른다. */
const ImageDataUrlSchema = z
  .string()
  .max(5_600_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);

export const AvatarRequestSchema = z.object({
  age: AgeSchema,
  kind: PersonaKindSchema,
  photo: ImageDataUrlSchema.optional(),
});
export const AvatarResponseSchema = z.object({
  /** 생성된 이미지(data URL) 또는 기본 캐릭터 이미지 경로 */
  avatar: z.string(),
  source: z.enum(['generated', 'default']),
});

// ── POST /api/chat ─────────────────────────────────────────
// 응답은 JSON 이 아니라 text/plain; charset=utf-8 스트림이다.

export const ChatRequestSchema = z.object({
  persona: PersonaSchema,
  messages: z
    .array(ChatMessageSchema)
    .min(1)
    .max(100)
    .refine((m) => m.at(-1)?.role === 'user', '마지막 메시지는 user 여야 합니다.'),
});

// ── 타입 ──────────────────────────────────────────────────

export type Source = z.infer<typeof SourceSchema>;
export type PersonaKind = z.infer<typeof PersonaKindSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type TimelineEvent = z.infer<typeof EventSchema>;
export type SelfAtTime = z.infer<typeof SelfAtTimeSchema>;
export type AnalyzeMeta = z.infer<typeof AnalyzeMetaSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type AnalyzeRequest = z.input<typeof AnalyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type PersonaRequest = z.input<typeof PersonaRequestSchema>;
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;
export type AvatarRequest = z.infer<typeof AvatarRequestSchema>;
export type AvatarResponse = z.infer<typeof AvatarResponseSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
