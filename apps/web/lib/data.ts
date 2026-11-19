// 클라이언트 저장(NativeAdapter.storage 경유)과 페르소나 계획(어떤 시점의 나를 만들지).
import { eventAgeOf, personaName, sortByTime, type Persona, type PersonaKind, type Profile, type TimelineEvent } from '@mindme/core';
import { webNative } from '@mindme/ui';

export type StoredMessage = { role: 'user' | 'assistant'; content: string; at: number };
export type MeProfile = Profile & { currentAge: number };

const s = webNative.storage;
function read<T>(key: string, fallback: T): T {
  try {
    const raw = s.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, value: unknown) => s.set(key, JSON.stringify(value));

// 키는 features.md 와 같다. 아바타는 256px WEBP data URL(약 13KB)이라 localStorage 로 충분하다.
// 얼굴 사진은 다음 페르소나의 아바타를 만들 때만 쓰도록 768px JPEG 로 줄여 둔다.
export const store = {
  profile: () => read<MeProfile | null>('mindme:profile', null),
  events: () => read<TimelineEvent[]>('mindme:events', []),
  personas: () => read<Persona[]>('mindme:personas', []),
  photo: () => read<string | null>('mindme:photo', null),
  chat: (id: string) => read<StoredMessage[]>(`mindme:chat:${id}`, []),
  saveSetup(profile: MeProfile, events: TimelineEvent[], photo: string | undefined) {
    write('mindme:profile', profile);
    write('mindme:events', events);
    if (photo) write('mindme:photo', photo);
  },
  savePersonas: (list: Persona[]) => write('mindme:personas', list),
  saveChat: (id: string, messages: StoredMessage[]) => write(`mindme:chat:${id}`, messages),
  removeChat: (id: string) => s.remove(`mindme:chat:${id}`),
};

export const kindOf = (age: number, currentAge: number): PersonaKind =>
  age < currentAge ? 'past' : age === currentAge ? 'present' : 'future';

// 목록(personas)은 새로 만든 것이 앞에 온다(createFirst·createFromModal 이 앞에 붙인다).

/**
 * 아바타 배경(tokens.css). 드래프트처럼 카드마다 다른 옅은 색을 만든 순서대로 돌려 쓴다.
 * 뒤(먼저 만든 것)부터 세므로 새로 만들어도 기존 페르소나 색은 바뀌지 않는다. 처음 만든 3개는 위에서부터 파랑·노랑·복숭아다.
 */
const AVATAR_BGS = ['var(--mm-avatar-peach)', 'var(--mm-avatar-yellow)', 'var(--mm-avatar-blue)'];
export const avatarBgAt = (index: number, count: number) => AVATAR_BGS[(count - 1 - index) % AVATAR_BGS.length]!;

/** '새로운 페르소나' 표시는 방금 만든 것(newIds) 가운데 가장 최근에 만든 하나, 곧 목록 맨 앞에만 붙인다. */
export const isNewest = (personas: Pick<Persona, 'id'>[], newIds: string[], id: string) =>
  personas[0]?.id === id && newIds.includes(id);

/**
 * core 가 40자에 맞추려고 사건 제목을 '…'로 자른 이름('졸업하며 서진과 헤어짐을 아쉬워…의 홍길동')은 '17살의 홍길동'으로 바꾼다.
 * 화면이 긴 이름 끝을 한 번 더 말줄임하면 '…'가 두 번 보이기 때문이다.
 */
export const plainName = (p: Pick<Persona, 'name' | 'kind' | 'age'>, me: string) =>
  p.name.includes('…의 ') ? personaName(p.kind, p.age, me) : p.name;

const weight = (e: TimelineEvent) => e.emotions.length + (e.selfAtTime?.quotes.length ?? 0) + (e.people.length ? 1 : 0);

/**
 * 처음 만들 '그때의 나' 후보: 나이를 아는 지난 사건 중 감정·대사 단서가 많은 것부터 최대 max 개.
 * 같은 나이만 몰리지 않게 나이가 다른 사건을 먼저 고르고, 결과는 시간순으로 돌려준다.
 */
export function pickEvents(events: TimelineEvent[], profile: MeProfile, max = 3): { event: TimelineEvent; age: number }[] {
  const known = events
    .map((event, i) => ({ event, i, age: eventAgeOf(event, profile) ?? 0 }))
    .filter((x) => x.age >= 1 && x.age <= profile.currentAge)
    .sort((a, b) => weight(b.event) - weight(a.event));
  // 이름이 같은 페르소나('15살의 홍길동' 둘)는 만들지 않는다. 모자라면 createFirst 가 '지금의 나'로 채운다.
  const nameOf = (x: (typeof known)[number]) =>
    plainName({ name: personaName('past', x.age, profile.name, x.event.title), kind: 'past', age: x.age }, profile.name);
  const picked: typeof known = [];
  const clash = (x: (typeof known)[number]) => picked.some((p) => nameOf(p) === nameOf(x));
  for (const x of known) if (picked.length < max && !picked.some((p) => p.age === x.age) && !clash(x)) picked.push(x);
  for (const x of known) if (picked.length < max && !clash(x)) picked.push(x);
  return picked.sort((a, b) => a.i - b.i);
}

const bigrams = (s: string) => {
  const t = s.replace(/\s+/g, '');
  return new Set(Array.from({ length: Math.max(t.length - 1, 0) }, (_, i) => t.slice(i, i + 2)));
};

/**
 * 모달의 '과거의 나'에 이어 줄 사건. 그 나이 또는 1년 전 사건(core personaRequestError 의 ±1살 규칙과 같다) 중 상황 설명과 글자(2글자 묶음)가 가장 많이 겹치는 것.
 * 상황이 비어 있으면 같은 나이의 사건. 마땅한 게 없으면 undefined(자유 대화).
 */
export function nearestEvent(situation: string, age: number, events: TimelineEvent[], profile: MeProfile): TimelineEvent | undefined {
  const want = bigrams(situation);
  let best: { event: TimelineEvent; score: number } | undefined;
  for (const event of events) {
    const at = eventAgeOf(event, profile);
    if (at === undefined || at > age || at < age - 1) continue;
    const text = bigrams([event.title, event.summary, event.context, ...event.emotions, ...event.people].join(' '));
    const overlap = [...want].filter((g) => text.has(g)).length;
    const ok = want.size ? overlap >= 2 : at === age;
    const score = overlap + (at === age ? 0.5 : 0) + weight(event) / 100;
    if (ok && (!best || score > best.score)) best = { event, score };
  }
  return best?.event;
}

/** 여러 기록의 사건을 합쳐 시간순으로 다시 번호를 매긴다. */
export function mergeEvents(lists: TimelineEvent[][]): TimelineEvent[] {
  return sortByTime(lists.flat())
    .slice(0, 100)
    .map((e, i) => ({ ...e, id: `evt_${String(i + 1).padStart(2, '0')}` }));
}
