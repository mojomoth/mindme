'use client';

// Mindme 앱: 한 화면씩 상태로 바꾼다 (01 랜딩 → 02 만들기 → 진행 → 03 목록(+04 모달) → 05 대화(+프로필 시트)).
// 화면은 @mindme/ui 그대로, 기능은 @mindme/core 와 /api/* 를 쓴다. 저장은 브라우저(NativeAdapter.storage)에만 한다.
import {
  MAX_INPUT_CHARS,
  parseKakao,
  personaName,
  PersonaSchema,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type AvatarResponse,
  type Persona,
  type PersonaGenerateRequest,
  type PersonaKind,
} from '@mindme/core';
import {
  blobToDataUrl,
  characters,
  Conversation,
  Landing,
  PersonaCreate,
  PersonaList,
  PersonaModal,
  PhoneFrame,
  ProfileSheet,
  shrinkImage,
  webNative,
  Working,
  type ProfileValues,
  type WorkingProps,
  type WorkingStep,
} from '@mindme/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { errorText, postJson, streamChat } from '../lib/api.ts';
import { AVATAR_BG, kindOf, mergeEvents, nearestEvent, pickEvents, plainName, store, type MeProfile, type StoredMessage } from '../lib/data.ts';

type Screen = 'landing' | 'create' | 'working' | 'list' | 'chat';

const STATUS: Record<PersonaKind, string> = { past: '그때의 나와 대화 중', present: '지금의 나와 대화 중', future: '미래의 나와 대화 중' };
const KIND_LABEL: Record<PersonaKind, string> = { past: '과거의 나', present: '지금의 나', future: '미래의 나' };
const CALL_STEP: Record<PersonaKind, string> = {
  past: '그때의 나를 불러오는 중',
  present: '지금의 나를 불러오는 중',
  future: '앞으로의 나를 만나러 가는 중',
};
const AGE_NOTE: Record<PersonaKind, string> = {
  past: '과거의 나를 만나요. 상황과 비슷한 기억이 있으면 그 기억에서 시작해요.',
  present: '지금의 나를 만나요. 요즘 마음에 걸리는 일을 적어 주면 좋아요.',
  future: '미래의 나를 만나요. 바라는 모습이나 이루고 싶은 일을 적어 주세요.',
};
const DRAW_STEP = '얼굴을 그리는 중';
const NO_REPLY = '답을 받지 못했어요.';

const clockOf = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
const dayOf = (at: number) => {
  const d = new Date(at);
  return d.toDateString() === new Date().toDateString() ? '오늘' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 얼굴 사진 → 그 나이의 아바타(256px WEBP data URL). 저장 공간을 아끼려고 줄여서 들고 있는다. */
async function drawAvatar(age: number, kind: PersonaKind, photo: string): Promise<string | undefined> {
  const res = await postJson<AvatarResponse>('/api/persona/avatar', { age, kind, photo });
  if (res.source !== 'generated') return undefined;
  const blob = await (await fetch(res.avatar)).blob();
  return blobToDataUrl(await shrinkImage(blob, 256, 'image/webp', 0.9));
}

// 다시 시도할 때 이미 그렸거나 그리는 중인 아바타는 다시 그리지 않는다(약 30초·이미지 비용).
// 페르소나가 만들어지면 지운다. 실패한 그림은 다음 시도에서 다시 그린다.
const avatars = new Map<string, Promise<string | undefined>>();
function avatarFor(age: number, kind: PersonaKind, photo: string) {
  const key = `${kind}:${age}:${photo.length}:${photo.slice(-40)}`;
  let pending = avatars.get(key);
  if (!pending) {
    const p = drawAvatar(age, kind, photo).catch(() => undefined);
    p.then((src) => !src && avatars.get(key) === p && avatars.delete(key));
    avatars.set(key, (pending = p));
  }
  return { key, pending };
}

/** 페르소나와 아바타를 동시에 만든다. 아바타가 실패하면 기본 캐릭터로 둔다. */
async function makePersona(req: PersonaGenerateRequest, photo: string | null, onPersona: () => void, onAvatar: () => void) {
  const draw = photo ? avatarFor(req.age, req.kind, photo) : undefined;
  const avatar = draw?.pending.finally(onAvatar);
  const { persona } = await postJson<{ persona: Persona }>('/api/persona', req).finally(onPersona);
  const src = await avatar;
  if (draw) avatars.delete(draw.key);
  const made = { ...persona, name: plainName(persona, req.profile.name) };
  return src ? { ...made, avatar: src } : made;
}

export default function MindmeApp() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [profile, setProfile] = useState(store.profile);
  const [events, setEvents] = useState(store.events);
  const [personas, setPersonas] = useState(store.personas);
  const [photo, setPhoto] = useState(store.photo);

  // 02 만들기
  const [name, setName] = useState(() => profile?.name ?? '');
  const [age, setAge] = useState(() => (profile ? String(profile.currentAge) : ''));
  const [story, setStory] = useState(() => profile?.story ?? '');
  const [file, setFile] = useState<{ name: string; text: string }>();
  const [notice, setNotice] = useState<string>();
  const analysis = useRef<{ key: string; events: typeof events; owner?: AnalyzeResponse['owner']; me?: string }>(undefined);

  // 진행 화면 · 03 목록 · 04 모달
  const [job, setJob] = useState<WorkingProps>();
  const [newIds, setNewIds] = useState<string[]>([]);
  // existing: 같은 이름의 페르소나가 이미 있을 때 그 id (모달이 이어갈지 묻는다)
  const [modal, setModal] = useState<{ situation: string; age: number; existing?: string }>();
  const jobId = useRef(0);

  // 05 대화
  const [chatId, setChatId] = useState<string>();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string>();
  const [sheet, setSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string>();
  const abort = useRef<AbortController>(undefined);

  const hasPersonas = personas.length > 0;
  useEffect(() => {
    if (screen !== 'landing') return;
    const t = setTimeout(() => setScreen(hasPersonas ? 'list' : 'create'), 3000);
    return () => clearTimeout(t);
  }, [screen, hasPersonas]);

  function savePersonas(list: Persona[]) {
    setPersonas(list);
    store.savePersonas(list);
  }

  /** 진행 화면 표시. states 는 steps 와 같은 순서. */
  function progress(labels: string[], base: Omit<WorkingProps, 'title' | 'steps'>) {
    let states: WorkingStep['state'][] = labels.map(() => 'todo');
    const id = ++jobId.current;
    let failed = false;
    return (next: Partial<Record<number, WorkingStep['state']>>, error?: string) => {
      // 실패 화면이나 다시 시도한 새 진행을, 늦게 끝난 이전 작업(아바타 등)이 덮어쓰지 않게 한다.
      if (id !== jobId.current || failed) return;
      failed = Boolean(error);
      states = states.map((s, i) => next[i] ?? s);
      setJob({
        ...base,
        title: error ? '페르소나를 만들지 못했어요' : '페르소나를 만들고 있어요',
        // 실패하면 돌던 단계는 멈춘 것으로 보여 준다.
        steps: labels.map((label, i) => ({ label, state: error && states[i] === 'active' ? 'todo' : states[i]! })),
        error,
      });
    };
  }

  // ── 02 만들기 ───────────────────────────────────────────

  async function pickFile() {
    const picked = await webNative.pickFile('.txt,text/plain');
    if (!picked) return;
    const text = (await picked.text()).trim();
    if (!text) return setNotice('빈 파일이에요. 다른 파일을 골라 주세요.');
    if (text.length > MAX_INPUT_CHARS) return setNotice('파일이 너무 길어요. 30만 자 이하로 나눠서 올려 주세요.');
    setNotice(undefined);
    setFile({ name: picked.name, text });
  }

  async function pickPhoto() {
    const picked = await webNative.pickPhoto();
    if (!picked) return;
    try {
      setPhoto(await blobToDataUrl(await shrinkImage(picked, 768, 'image/jpeg', 0.86)));
      setNotice(undefined);
    } catch {
      setNotice('사진을 열지 못했어요. JPG나 PNG 사진으로 다시 골라 주세요.');
    }
  }

  async function createFirst() {
    const labels = ['기억을 읽는 중', '그때의 나를 불러오는 중', ...(photo ? [DRAW_STEP] : [])];
    const show = progress(labels, {
      hint: '1~2분쯤 걸려요. 화면을 켜 둔 채 기다려 주세요.',
      onRetry: createFirst,
      onCancel: () => setScreen('create'),
      cancelLabel: '입력 화면으로',
    });
    setScreen('working');
    try {
      // 같은 입력을 다시 시도하면 기록 분석은 건너뛴다.
      const key = JSON.stringify([file?.name, file?.text.length, story, name]);
      let read = analysis.current;
      if (read?.key !== key) {
        show({ 0: 'active' });
        const reqs: AnalyzeRequest[] = [];
        if (file) {
          // 카카오톡 형식 메시지가 하나라도 읽히면 카카오톡, 아니면 일기로 본다.
          const kakao = parseKakao(file.text).messages.length > 0;
          reqs.push({ source: kakao ? 'kakao' : 'diary', text: file.text, ...(kakao && name.trim() ? { me: name.trim() } : {}) });
        }
        if (story.trim()) reqs.push({ source: 'prompt', text: story.trim() });
        const results = await Promise.all(reqs.map((r) => postJson<AnalyzeResponse>('/api/analyze', r)));
        read = {
          key,
          events: mergeEvents(results.map((r) => r.events)),
          // 기록이 둘(파일·이야기)이면 이름·나이를 각각 먼저 찾은 쪽에서 가져온다.
          owner: {
            name: results.map((r) => r.owner?.name).find(Boolean) ?? null,
            currentAge: results.map((r) => r.owner?.currentAge).find(Boolean) ?? null,
          },
          me: results.find((r) => r.meta?.me)?.meta?.me,
        };
        analysis.current = read;
      }

      // 이름·나이를 비워 두었으면 기록에서 읽은 값(owner)을 쓴다. 나이를 끝내 모르면 입력 화면에서 묻는다.
      const currentAge = age ? Number(age) : read.owner?.currentAge;
      if (!currentAge) {
        setNotice('기록에서 지금 나이를 찾지 못했어요. 지금 나이를 적어 주세요.');
        return setScreen('create');
      }
      if (!age) setAge(String(currentAge));
      show({ 0: 'done', 1: 'active', 2: 'active' });

      const me: MeProfile = {
        name: (name.trim() || read.owner?.name || read.me || '나').slice(0, 20),
        currentAge,
        ...(story.trim() ? { story: story.trim() } : {}),
      };
      const targets: PersonaGenerateRequest[] = pickEvents(read.events, me).map(({ event, age }) => ({
        kind: 'past',
        age,
        eventId: event.id,
        phase: 'after',
        events: read.events,
        profile: me,
      }));
      if (targets.length < 3) targets.push({ kind: 'present', age: currentAge, events: read.events, profile: me });

      let personaLeft = targets.length;
      let avatarLeft = targets.length;
      const settled = await Promise.allSettled(
        targets.map((req) =>
          makePersona(
            req,
            photo,
            () => --personaLeft || show({ 1: 'done' }),
            () => --avatarLeft || show({ 2: 'done' }),
          ),
        ),
      );
      const made = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      if (!made.length) throw (settled[0] as PromiseRejectedResult).reason;

      setProfile(me);
      setEvents(read.events);
      store.saveSetup(me, read.events, photo ?? undefined);
      savePersonas([...made, ...personas]);
      setNewIds(made.map((p) => p.id));
      setScreen('list');
    } catch (err) {
      show({}, errorText(err));
    }
  }

  // ── 03 목록 · 04 모달 ───────────────────────────────────

  function openModal() {
    if (!profile) return setScreen('create'); // 지금 나이를 모르면 생성 화면에서 받는다
    setNewIds([]);
    setModal({ situation: '', age: clamp(profile.currentAge - 10, 5, 80) });
  }

  /** 만들 페르소나와 이름이 같은 페르소나. 있으면 새로 만들기 전에 그 대화를 이어갈지 묻는다. */
  function sameNamed(situation: string, at: number) {
    if (!profile) return undefined;
    const kind = kindOf(at, profile.currentAge);
    const event = kind === 'past' ? nearestEvent(situation, at, events, profile) : undefined;
    const name = plainName({ name: personaName(kind, at, profile.name, event?.title), kind, age: at }, profile.name);
    return personas.find((p) => p.name === name);
  }

  async function createFromModal(situation: string, at: number) {
    if (!profile) return setScreen('create');
    const kind = kindOf(at, profile.currentAge);
    const event = kind === 'past' ? nearestEvent(situation, at, events, profile) : undefined;
    const req: PersonaGenerateRequest = {
      kind,
      age: at,
      situation,
      events,
      profile,
      ...(event ? { eventId: event.id, phase: 'after' as const } : {}),
      ...(kind === 'future' && situation.trim() ? { futureGoals: situation.trim() } : {}),
    };
    const show = progress([CALL_STEP[kind], ...(photo ? [DRAW_STEP] : [])], {
      hint: photo ? '30초에서 1분쯤 걸려요.' : '20초쯤 걸려요.',
      onRetry: () => createFromModal(situation, at),
      onCancel: () => setScreen('list'),
      cancelLabel: '목록으로',
    });
    setModal(undefined);
    setScreen('working');
    show({ 0: 'active', 1: 'active' });
    try {
      const made = await makePersona(
        req,
        photo,
        () => show({ 0: 'done' }),
        () => show({ 1: 'done' }),
      );
      savePersonas([made, ...personas]);
      setNewIds([made.id]);
      setScreen('list');
    } catch (err) {
      show({}, errorText(err));
    }
  }

  // ── 05 대화 ─────────────────────────────────────────────

  const persona = personas.find((p) => p.id === chatId);

  function openChat(id: string) {
    const p = personas.find((x) => x.id === id);
    if (!p) return;
    let saved = store.chat(id);
    if (!saved.length) {
      saved = [{ role: 'assistant', content: p.greeting, at: Date.now() }];
      store.saveChat(id, saved);
    }
    setModal(undefined);
    setChatId(id);
    setMessages(saved);
    setDraft('');
    // 답을 받기 전에 나간 질문이면 '다시 받기'를 띄운다.
    setChatError(saved.at(-1)?.role === 'user' ? NO_REPLY : undefined);
    setNewIds((ids) => ids.filter((x) => x !== id));
    setScreen('chat');
  }

  function openRecent() {
    const last = (id: string) => store.chat(id).at(-1)?.at ?? 0;
    const recent = [...personas].sort((a, b) => last(b.id) - last(a.id))[0];
    if (recent) openChat(recent.id);
  }

  async function ask(p: Persona, history: StoredMessage[]) {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    setChatError(undefined);
    setMessages(history);
    store.saveChat(p.id, history);
    const at = Date.now();
    try {
      // 아바타 이미지는 대화에 필요 없어 빼고 보낸다. 서버는 최근 24개만 쓰지만 넉넉히 40개를 보낸다.
      const reply = await streamChat(
        { ...p, avatar: undefined },
        history.slice(-40).map(({ role, content }) => ({ role, content })),
        (text) => setMessages([...history, { role: 'assistant', content: text, at }]),
        ac.signal,
      );
      const done: StoredMessage[] = [...history, { role: 'assistant', content: reply, at }];
      setMessages(done);
      store.saveChat(p.id, done);
    } catch (err) {
      if (ac.signal.aborted) return;
      setMessages(history);
      setChatError(errorText(err));
    } finally {
      if (abort.current === ac) setBusy(false);
    }
  }

  function leaveChat() {
    abort.current?.abort();
    setBusy(false);
    setSheet(false);
    setScreen('list');
  }

  function saveProfile(v: ProfileValues) {
    if (!persona) return;
    const cut = (xs: string[], n: number, len: number) => xs.slice(0, n).map((x) => x.slice(0, len));
    const next: Persona = {
      ...persona,
      name: v.name.slice(0, 40),
      traits: cut(v.traits, 10, 40),
      speechStyle: v.speechStyle.slice(0, 500),
      memories: cut(v.memories, 20, 300),
      emotions: cut(v.emotions, 10, 20),
    };
    if (!PersonaSchema.safeParse(next).success) return setSheetError(next.name ? '입력한 내용을 다시 확인해 주세요.' : '이름을 적어 주세요.');
    savePersonas(personas.map((p) => (p.id === next.id ? next : p)));
    setSheet(false);
  }

  function deletePersona() {
    if (!persona) return;
    store.removeChat(persona.id);
    savePersonas(personas.filter((p) => p.id !== persona.id));
    leaveChat();
  }

  // ── 화면 ────────────────────────────────────────────────

  const ageNum = Number(age);
  // 나이는 비워 둘 수 있다(기록에서 읽는다).
  const canCreate = (Boolean(file) || story.trim().length > 0) && (!age || (Number.isInteger(ageNum) && ageNum >= 1 && ageNum <= 120));
  const avatarOf = (p: Persona) => ({ avatarSrc: p.avatar ?? characters.guideAvatar, avatarBg: AVATAR_BG[p.kind] });

  let view: ReactNode;
  switch (screen) {
    case 'landing':
      view = (
        <Landing
          notice={hasPersonas ? '잠시 후 나의 페르소나로 이동해요' : undefined}
          onSkip={() => setScreen(hasPersonas ? 'list' : 'create')}
        />
      );
      break;
    case 'create':
      view = (
        <PersonaCreate
          story={story}
          onStoryChange={setStory}
          fileName={file?.name}
          onPickFile={pickFile}
          photoSrc={photo ?? undefined}
          onPickPhoto={pickPhoto}
          name={name}
          onNameChange={setName}
          age={age}
          onAgeChange={setAge}
          notice={notice}
          onBack={() => setScreen(hasPersonas ? 'list' : 'landing')}
          onSubmit={() => canCreate && createFirst()}
          submitDisabled={!canCreate}
        />
      );
      break;
    case 'working':
      view = job && <Working {...job} />;
      break;
    case 'list':
      view = (
        <PersonaList
          personas={personas.map((p) => ({
            id: p.id,
            name: p.name,
            description: (store.chat(p.id).at(-1)?.content ?? p.greeting).replace(/\s+/g, ' '),
            isNew: newIds.includes(p.id),
            ...avatarOf(p),
          }))}
          showReady={newIds.length > 0}
          onSelect={openChat}
          onCreate={openModal}
          onChats={hasPersonas ? openRecent : undefined}
        >
          {modal && profile && (
            <PersonaModal
              situation={modal.situation}
              onSituationChange={(situation) => setModal({ situation, age: modal.age })}
              age={modal.age}
              onAgeChange={(a) => setModal({ situation: modal.situation, age: a })}
              ageNote={AGE_NOTE[kindOf(modal.age, profile.currentAge)]}
              existingName={personas.find((p) => p.id === modal.existing)?.name}
              onOpenExisting={() => modal.existing && openChat(modal.existing)}
              onClose={() => setModal(undefined)}
              onSubmit={() => {
                const situation = modal.situation.trim();
                const same = modal.existing ? undefined : sameNamed(situation, modal.age);
                if (same) return setModal({ ...modal, existing: same.id });
                createFromModal(situation, modal.age);
              }}
            />
          )}
        </PersonaList>
      );
      break;
    case 'chat':
      view = persona && (
        <>
          <Conversation
            persona={{ name: persona.name, ...avatarOf(persona) }}
            status={STATUS[persona.kind]}
            dateLabel={dayOf(messages[0]?.at ?? Date.now())}
            startCaption={`${persona.kind === 'present' ? '지금' : `${persona.age}살`}의 나와 대화를 시작했어요`}
            messages={messages.map((m, i) => ({ id: String(i), from: m.role === 'user' ? 'me' : 'persona', text: m.content, time: clockOf(m.at) }))}
            typing={busy && messages.at(-1)?.role === 'user'}
            draft={draft}
            onDraftChange={setDraft}
            sendDisabled={busy}
            onSend={() => {
              const content = draft.trim();
              if (!content || busy) return;
              setDraft('');
              ask(persona, [...messages, { role: 'user', content, at: Date.now() }]);
            }}
            error={chatError}
            onRetry={messages.at(-1)?.role === 'user' ? () => ask(persona, messages) : undefined}
            onBack={leaveChat}
            onExit={leaveChat}
            onProfile={() => {
              setSheetError(undefined);
              setSheet(true);
            }}
          />
          {sheet && (
            <ProfileSheet
              initial={persona}
              {...avatarOf(persona)}
              caption={`${persona.age}살 · ${KIND_LABEL[persona.kind]}`}
              error={sheetError}
              onSave={saveProfile}
              onDelete={deletePersona}
              onClose={() => setSheet(false)}
            />
          )}
        </>
      );
      break;
  }

  return <PhoneFrame>{view}</PhoneFrame>;
}
