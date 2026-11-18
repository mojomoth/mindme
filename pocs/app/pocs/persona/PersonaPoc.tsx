'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  EventSchema,
  eventAgeOf,
  PHASE_LABEL,
  PersonaSchema,
  type Persona,
  type AvatarRequest,
  type AvatarResponse,
  type PersonaGenerateRequest,
  type PersonaKind,
  type Phase,
  type TimelineEvent,
} from '@mindme/core';
import { webNative } from '@mindme/ui';
import sample from '../../../fixtures/persona/sample-events.json';
import styles from './persona.module.css';

// 기록 분석 PoC 가 저장한 타임라인(Event[] 또는 { events }), 대화 PoC 가 읽는 페르소나 목록(Persona[]).
const EVENTS_KEY = 'mindme:events';
const PERSONAS_KEY = 'mindme:personas';

const KINDS: { value: PersonaKind; label: string }[] = [
  { value: 'past', label: '과거의 나' },
  { value: 'present', label: '현재의 나' },
  { value: 'future', label: '미래의 나' },
];
const PHASES = Object.entries(PHASE_LABEL) as [Phase, string][];

function readJson(key: string): unknown {
  try {
    return JSON.parse(webNative.storage.get(key) ?? 'null');
  } catch {
    return null;
  }
}

function loadEvents(): { events: TimelineEvent[]; fromAnalysis: boolean } {
  const raw = readJson(EVENTS_KEY);
  const list = Array.isArray(raw) ? raw : (raw as { events?: unknown } | null)?.events;
  const parsed = EventSchema.array().safeParse(list);
  if (parsed.success && parsed.data.length) return { events: parsed.data, fromAnalysis: true };
  return { events: EventSchema.array().parse(sample.events), fromAnalysis: false };
}

function loadPersonas(): Persona[] {
  const raw = readJson(PERSONAS_KEY);
  return (Array.isArray(raw) ? raw : []).flatMap((x) => {
    const r = PersonaSchema.safeParse(x);
    return r.success ? [r.data] : [];
  });
}

/** 업로드 전에 긴 변을 max 로 줄이고 JPEG 로 바꾼다 (Vercel 요청 4.5MB 제한). */
async function shrink(file: Blob, max: number, type = 'image/jpeg', quality = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 줄이지 못했어요.'))), type, quality),
  );
}

const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(b);
  });

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `요청이 실패했어요 (HTTP ${res.status}).`);
  return data as T;
}

const splitList = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);

// 목록 필드는 입력 중인 글자(끝의 쉼표·줄바꿈·띄어쓰기)를 지우지 않도록 원문으로 들고 있다가 저장할 때 나눈다.
type ListTexts = { traits: string; memories: string; emotions: string };
const toTexts = (p: Persona): ListTexts => ({ traits: p.traits.join(', '), memories: p.memories.join('\n'), emotions: p.emotions.join(', ') });
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

export default function PersonaPoc() {
  const [{ events, fromAnalysis }] = useState(loadEvents);
  const [name, setName] = useState(sample.profile.name);
  const [currentAge, setCurrentAge] = useState(sample.profile.currentAge);
  const [kind, setKind] = useState<PersonaKind>('past');
  const [age, setAge] = useState(15);
  const [eventId, setEventId] = useState('');
  const [phase, setPhase] = useState<Phase>('after');
  const [situation, setSituation] = useState('');
  const [futureGoals, setFutureGoals] = useState('');

  const [persona, setPersona] = useState<Persona | null>(null);
  const [lists, setLists] = useState<ListTexts>({ traits: '', memories: '', emotions: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [took, setTook] = useState('');

  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [avatar, setAvatar] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNote, setAvatarNote] = useState('');

  const [saved, setSaved] = useState(loadPersonas);
  const [notice, setNotice] = useState('');

  // 현재의 나는 언제나 지금 나이다(지금 나이를 바꿔도 따라간다).
  const theAge = kind === 'present' ? currentAge : age;

  const visible = events.filter((e) => {
    const a = eventAgeOf(e, { name, currentAge });
    return a === undefined || a <= currentAge;
  });

  function chooseKind(k: PersonaKind) {
    setKind(k);
    if (k === 'present') setAge(currentAge);
    if (k === 'future' && age <= currentAge) setAge(Math.min(80, currentAge + 4));
    if (k === 'past' && age >= currentAge) setAge(Math.max(5, currentAge - 10));
  }

  function chooseEvent(id: string) {
    setEventId(id);
    const e = events.find((x) => x.id === id);
    const a = e && eventAgeOf(e, { name, currentAge });
    if (a) setAge(a);
  }

  async function generate() {
    setBusy(true);
    setError('');
    setNotice('');
    const started = performance.now();
    const body: PersonaGenerateRequest = {
      kind,
      age: theAge,
      situation,
      events,
      profile: { name, currentAge },
      ...(kind === 'past' && eventId ? { eventId, phase } : {}),
      ...(kind === 'future' ? { futureGoals } : {}),
    };
    try {
      const { persona: p } = await postJson<{ persona: Persona }>('/api/persona', body);
      setPersona(avatar ? { ...p, avatar } : p);
      setLists(toTexts(p));
      setTook(secs(performance.now() - started));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto() {
    const file = await webNative.pickFile('image/jpeg,image/png,image/webp');
    if (!file) return;
    try {
      const blob = await shrink(file, 1024);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setAvatarNote(`${Math.round(file.size / 1024)}KB → ${Math.round(blob.size / 1024)}KB 로 줄였어요.`);
    } catch {
      setAvatarNote('사진을 읽지 못했어요. 다른 사진으로 해 주세요.');
    }
  }

  async function makeAvatar() {
    setAvatarBusy(true);
    setAvatarNote(photo ? '아바타를 그리는 중이에요. 30초쯤 걸려요.' : '');
    const started = performance.now();
    try {
      const body: AvatarRequest = { age: theAge, kind, ...(photo ? { photo: await toDataUrl(photo.blob) } : {}) };
      const res = await postJson<AvatarResponse>('/api/persona/avatar', body);
      // 저장 공간을 아끼려고 생성 이미지는 256px WEBP 로 줄여서 들고 있는다.
      const small = res.source === 'generated' ? await toDataUrl(await shrink(await (await fetch(res.avatar)).blob(), 256, 'image/webp', 0.9)) : res.avatar;
      setAvatar(small);
      setPersona((p) => (p ? { ...p, avatar: small } : p));
      setAvatarNote(res.source === 'generated' ? `${secs(performance.now() - started)} 걸렸어요.` : '사진이 없어서 기본 캐릭터를 넣었어요.');
    } catch (e) {
      setAvatarNote(e instanceof Error ? e.message : String(e));
    } finally {
      setAvatarBusy(false);
    }
  }

  function edit<K extends keyof Persona>(key: K, value: Persona[K]) {
    setPersona((p) => (p ? { ...p, [key]: value } : p));
    setNotice('');
  }

  function editList(key: keyof ListTexts, value: string) {
    setLists((l) => ({ ...l, [key]: value }));
    setNotice('');
  }

  function save() {
    const r = PersonaSchema.safeParse(
      persona && {
        ...persona,
        traits: splitList(lists.traits, /,/),
        memories: splitList(lists.memories, /\n/),
        emotions: splitList(lists.emotions, /,/),
      },
    );
    if (!r.success) {
      const issue = r.error.issues[0];
      setNotice(`저장하지 못했어요: ${issue?.path.join('.')} ${issue?.message}`);
      return;
    }
    const next = [r.data, ...saved.filter((p) => p.id !== r.data.id)];
    webNative.storage.set(PERSONAS_KEY, JSON.stringify(next));
    if (webNative.storage.get(PERSONAS_KEY) === null) {
      setNotice('브라우저 저장 공간에 쓰지 못했어요.');
      return;
    }
    setSaved(next);
    setNotice('저장했어요. 대화 PoC 목록에서 고를 수 있어요.');
  }

  function remove(id: string) {
    const next = saved.filter((p) => p.id !== id);
    webNative.storage.set(PERSONAS_KEY, JSON.stringify(next));
    setSaved(next);
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link href="/pocs" className={styles.back}>PoC 목록</Link>
        <h1 className={styles.title}>페르소나 만들기</h1>
        <p className={styles.lead}>어느 때의 나와 이야기할지 고르면, 기록을 바탕으로 그때의 성격·말투·기억·감정을 만들어요.</p>
      </header>

      <section className={styles.card} aria-labelledby="who">
        <h2 id="who" className={styles.h2}>나</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>이름</span>
            <input className={styles.input} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>지금 나이</span>
            <input
              className={styles.input}
              type="number"
              min={5}
              max={80}
              value={currentAge}
              onChange={(e) => setCurrentAge(Number(e.target.value) || 1)}
            />
          </label>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="when">
        <h2 id="when" className={styles.h2}>언제의 나</h2>
        <div className={styles.segment} role="radiogroup" aria-label="시점">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              className={styles.segBtn}
              onClick={() => chooseKind(k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            나이 <strong className={styles.age}>{theAge}살</strong>
            {kind === 'present' && <span className={styles.hint}> · 현재의 나는 지금 나이로 만들어요</span>}
          </span>
          <input
            className={styles.range}
            type="range"
            min={5}
            max={80}
            value={theAge}
            disabled={kind === 'present'}
            onChange={(e) => setAge(Number(e.target.value))}
          />
        </label>

        {kind === 'past' && (
          <>
            <label className={styles.field}>
              <span className={styles.label}>
                사건 <span className={styles.hint}>· {fromAnalysis ? `기록 분석 결과 ${events.length}개` : '샘플 사건 (기록 분석 결과가 없어요)'}</span>
              </span>
              <select className={styles.input} value={eventId} onChange={(e) => chooseEvent(e.target.value)}>
                <option value="">사건 없이 그 나이의 나와 이야기하기</option>
                {visible.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {e.date}
                    {e.age ? ` (${e.age}살)` : ''}
                  </option>
                ))}
              </select>
            </label>
            {eventId && (
              <div className={styles.segment} role="radiogroup" aria-label="사건 기준 시점">
                {PHASES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={phase === value}
                    className={styles.segBtn}
                    onClick={() => setPhase(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <label className={styles.field}>
          <span className={styles.label}>상황 설명</span>
          <textarea
            className={styles.textarea}
            rows={3}
            maxLength={2000}
            value={situation}
            placeholder={
              kind === 'present' ? '요즘 하는 고민이나 기분을 적어 주세요' : '예: 민수랑 싸우고 집에 돌아온 저녁, 방에 혼자 있어요'
            }
            onChange={(e) => setSituation(e.target.value)}
          />
        </label>

        {kind === 'future' && (
          <label className={styles.field}>
            <span className={styles.label}>목표 · 가치관 · 바라는 삶</span>
            <textarea
              className={styles.textarea}
              rows={3}
              maxLength={2000}
              value={futureGoals}
              placeholder="예: 내 이름으로 된 그림책을 내고 싶어요. 주말엔 가족과 시간을 보내고 싶어요."
              onChange={(e) => setFutureGoals(e.target.value)}
            />
          </label>
        )}
      </section>

      <section className={styles.card} aria-labelledby="face">
        <h2 id="face" className={styles.h2}>프로필 사진</h2>
        <div className={styles.avatarRow}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL·blob 미리보기 */}
          {photo && <img className={styles.photo} src={photo.url} alt="올린 사진" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar && <img className={styles.avatar} src={avatar} alt="만든 아바타" />}
          <div className={styles.avatarActions}>
            <button type="button" className={styles.ghost} onClick={pickPhoto}>
              {photo ? '사진 바꾸기' : '얼굴 사진 올리기'}
            </button>
            <button type="button" className={styles.ghost} onClick={makeAvatar} disabled={avatarBusy}>
              {avatarBusy ? '만드는 중…' : `${theAge}살 아바타 만들기`}
            </button>
          </div>
        </div>
        <p className={styles.hint}>{avatarNote || '사진은 아바타를 만드는 데만 쓰고 서버에 저장하지 않아요. 사진이 없으면 기본 캐릭터를 써요.'}</p>
      </section>

      <button type="button" className={styles.primary} onClick={generate} disabled={busy || !name.trim()}>
        {busy ? '만드는 중…' : '페르소나 만들기'}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {persona && (
        <section className={styles.card} aria-labelledby="result">
          <div className={styles.resultHead}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {persona.avatar && <img className={styles.avatarSm} src={persona.avatar} alt="" />}
            <input
              id="result"
              className={styles.nameInput}
              value={persona.name}
              maxLength={40}
              aria-label="페르소나 이름"
              onChange={(e) => edit('name', e.target.value)}
            />
            <span className={styles.hint}>{took}</span>
          </div>
          <Field label="성격 (쉼표로 구분)">
            <input className={styles.input} value={lists.traits} onChange={(e) => editList('traits', e.target.value)} />
          </Field>
          <Field label="말투">
            <textarea className={styles.textarea} rows={4} value={persona.speechStyle} onChange={(e) => edit('speechStyle', e.target.value)} />
          </Field>
          <Field label="기억 (한 줄에 하나)">
            <textarea className={styles.textarea} rows={5} value={lists.memories} onChange={(e) => editList('memories', e.target.value)} />
          </Field>
          <Field label="감정 (쉼표로 구분)">
            <input className={styles.input} value={lists.emotions} onChange={(e) => editList('emotions', e.target.value)} />
          </Field>
          <Field label="첫 인사">
            <textarea className={styles.textarea} rows={2} value={persona.greeting} onChange={(e) => edit('greeting', e.target.value)} />
          </Field>
          <button type="button" className={styles.primary} onClick={save}>
            확정하고 저장하기
          </button>
          {notice && <p className={styles.hint} role="status">{notice}</p>}
        </section>
      )}

      <section className={styles.card} aria-labelledby="saved">
        <h2 id="saved" className={styles.h2}>저장한 페르소나 {saved.length}명</h2>
        {saved.length === 0 ? (
          <p className={styles.hint}>아직 없어요. 만들고 확정하면 여기와 대화 PoC 목록에 나타나요.</p>
        ) : (
          <ul className={styles.saved}>
            {saved.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <button type="button" className={styles.link} onClick={() => remove(p.id)}>
                  지우기
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link href="/pocs/chat" className={styles.link}>대화 PoC 로 가기</Link>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
