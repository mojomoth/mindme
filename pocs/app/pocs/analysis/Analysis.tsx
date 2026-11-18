'use client';

import { useState } from 'react';
import { EventSchema, MAX_INPUT_CHARS, sortByTime, type Source, type TimelineEvent } from '@mindme/core';
import type { Fixture } from './page.tsx';
import styles from './analysis.module.css';

// /pocs/persona 가 같은 키에서 타임라인을 읽는다.
const EVENTS_KEY = 'mindme:events';
const LAST_KEY = 'mindme:analysis:last';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'kakao', label: '카카오톡' },
  { value: 'diary', label: '일기' },
  { value: 'prompt', label: '직접 쓰기' },
];

type Last = { request: { source: Source; me?: string; text: string }; response: unknown; ms: number };

function load<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간이 없거나 막혀 있어도 화면은 그대로 쓴다.
  }
}

function loadEvents(): TimelineEvent[] {
  const parsed = EventSchema.array().safeParse(load(EVENTS_KEY));
  return parsed.success ? parsed.data : [];
}

// ── 수정 폼 ───────────────────────────────────────────────

type Draft = Record<'title' | 'date' | 'age' | 'emotions' | 'people' | 'context' | 'summary' | 'traits' | 'speechStyle' | 'quotes', string> & {
  dateEstimated: boolean;
};

const list = (s: string, sep = /[,\n]/) => s.split(sep).map((x) => x.trim()).filter(Boolean);

const toDraft = (e?: TimelineEvent): Draft => ({
  title: e?.title ?? '',
  date: e?.date ?? '',
  dateEstimated: e?.dateEstimated ?? false,
  age: e?.age ? String(e.age) : '',
  emotions: e?.emotions.join(', ') ?? '',
  people: e?.people.join(', ') ?? '',
  context: e?.context ?? '',
  summary: e?.summary ?? '',
  traits: e?.selfAtTime?.traits.join(', ') ?? '',
  speechStyle: e?.selfAtTime?.speechStyle ?? '',
  quotes: e?.selfAtTime?.quotes.join('\n') ?? '',
});

const fromDraft = (id: string, d: Draft) =>
  EventSchema.safeParse({
    id,
    title: d.title,
    date: d.date,
    dateEstimated: d.dateEstimated,
    age: d.age.trim() ? Number(d.age) : undefined,
    emotions: list(d.emotions),
    people: list(d.people),
    context: d.context,
    summary: d.summary,
    selfAtTime: { traits: list(d.traits), speechStyle: d.speechStyle, quotes: list(d.quotes, /\n/) },
  });

const FIELD_LABEL: Record<string, string> = { title: '제목', date: '시점', age: '나이', emotions: '감정', people: '인물' };

function EventForm({ initial, onSave, onCancel }: { initial: Draft; onSave: (d: Draft) => string | void; onCancel: () => void }) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState('');
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        setError(onSave(d) ?? '');
      }}
    >
      <label className={styles.wide}>
        제목 <input value={d.title} onChange={set('title')} placeholder="친구와 다툰 날" required />
      </label>
      <label>
        시점 <input value={d.date} onChange={set('date')} placeholder="2015-05-14 또는 중학교 2학년 봄" required />
      </label>
      <label>
        나이 <input value={d.age} onChange={set('age')} inputMode="numeric" placeholder="15" />
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={d.dateEstimated} onChange={(e) => setD({ ...d, dateEstimated: e.target.checked })} /> 시점을 추정했어요
      </label>
      <label>
        감정 (쉼표로 구분) <input value={d.emotions} onChange={set('emotions')} placeholder="서운함, 후회" />
      </label>
      <label>
        인물 (쉼표로 구분) <input value={d.people} onChange={set('people')} placeholder="민수" />
      </label>
      <label className={styles.wide}>
        무슨 일이 있었나요 <textarea rows={3} value={d.summary} onChange={set('summary')} />
      </label>
      <label className={styles.wide}>
        대화 맥락 <textarea rows={2} value={d.context} onChange={set('context')} />
      </label>
      <label>
        그때의 내 성격 (쉼표로 구분) <input value={d.traits} onChange={set('traits')} />
      </label>
      <label>
        그때의 내 말투 <input value={d.speechStyle} onChange={set('speechStyle')} />
      </label>
      <label className={styles.wide}>
        그때 내가 한 말 (한 줄에 하나) <textarea rows={2} value={d.quotes} onChange={set('quotes')} />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.row}>
        <button type="submit" className={styles.primary}>
          저장
        </button>
        <button type="button" className={styles.ghost} onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}

// ── 화면 ──────────────────────────────────────────────────

export default function Analysis({ fixtures }: { fixtures: Fixture[] }) {
  const [source, setSource] = useState<Source>('kakao');
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [events, setEventsState] = useState<TimelineEvent[]>(loadEvents);
  const [last, setLast] = useState<Last | undefined>(() => load<Last>(LAST_KEY));
  const [editing, setEditing] = useState<string | null>(null); // 사건 id, 새 사건은 'new'

  const setEvents = (next: TimelineEvent[]) => {
    const sorted = sortByTime(next);
    setEventsState(sorted);
    save(EVENTS_KEY, sorted);
  };

  async function readFile(file: File | undefined) {
    if (!file) return;
    setText((await file.text()).replace(/^﻿/, ''));
  }

  function pickFixture(i: number) {
    const f = fixtures[i];
    if (!f) return;
    setSource(f.source);
    setMe(f.me ?? '');
    setText(f.text);
  }

  async function analyze() {
    const request = { source, text, ...(source === 'kakao' && me.trim() ? { me: me.trim() } : {}) };
    setBusy(true);
    setError('');
    const t0 = performance.now();
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const json = await res.json();
      const next: Last = { request, response: json, ms: Math.round(performance.now() - t0) };
      setLast(next);
      save(LAST_KEY, next);
      if (!res.ok) {
        setError(json?.error?.message ?? `요청이 실패했어요 (HTTP ${res.status}).`);
        return;
      }
      setEvents(EventSchema.array().parse(json.events));
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청이 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  function saveDraft(id: string, d: Draft): string | void {
    const r = fromDraft(id, d);
    if (!r.success) {
      const issue = r.error.issues[0];
      const field = FIELD_LABEL[String(issue?.path[0])] ?? String(issue?.path.join('.'));
      return `${field} 값을 확인해 주세요. (${issue?.message})`;
    }
    setEvents(id === 'new' ? [...events, { ...r.data, id: `evt_u${Date.now()}` }] : events.map((e) => (e.id === id ? r.data : e)));
    setEditing(null);
  }

  const meta = (last?.response as { meta?: { mode: string; chunks: number; units: number; me?: string } } | undefined)?.meta;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>기록 분석</h1>
      <p className={styles.lead}>카카오톡 대화, 일기, 직접 쓴 이야기에서 사건을 골라 시간순으로 정리해요.</p>

      <section className={styles.card} aria-label="입력">
        <div className={styles.row}>
          <div className={styles.segment} role="radiogroup" aria-label="기록 종류">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={source === s.value}
                className={source === s.value ? styles.segOn : styles.seg}
                onClick={() => setSource(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select
            className={styles.select}
            value=""
            onChange={(e) => pickFixture(Number(e.target.value))}
            aria-label="예시 불러오기"
          >
            <option value="" disabled>
              예시 불러오기
            </option>
            {fixtures.map((f, i) => (
              <option key={f.label} value={i}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {source === 'kakao' && (
          <label className={styles.field}>
            카톡에서 쓰는 내 이름
            <input value={me} onChange={(e) => setMe(e.target.value)} maxLength={40} placeholder="비워 두면 대화를 보고 짐작해요" />
          </label>
        )}

        <label className={styles.field}>
          TXT 파일
          <input type="file" accept=".txt,.csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} />
        </label>

        <label className={styles.field}>
          내용 붙여넣기
          <textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              source === 'kakao'
                ? '카카오톡 대화방 > 설정 > 대화 내용 내보내기로 받은 TXT 내용을 붙여 넣어 주세요.'
                : source === 'diary'
                  ? '날짜로 시작하는 줄(2019년 2월 12일, 2019-02-12 등)이 있으면 그 기준으로 나눠 읽어요.'
                  : '기억에 남는 일을 편하게 적어 주세요. 몇 살 때였는지 적으면 더 정확해져요.'
            }
          />
        </label>

        <div className={styles.row}>
          <span className={text.length > MAX_INPUT_CHARS ? styles.over : styles.count}>
            {text.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}자
          </span>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || !text.trim() || text.length > MAX_INPUT_CHARS}
            onClick={analyze}
          >
            {busy ? '분석하는 중…' : '분석하기'}
          </button>
        </div>
        {busy && <p className={styles.note}>길이에 따라 20초에서 몇 분까지 걸려요.</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section aria-label="타임라인">
        <div className={styles.head}>
          <h2 className={styles.h2}>타임라인 {events.length > 0 && <span className={styles.count}>{events.length}개</span>}</h2>
          <div className={styles.row}>
            {events.length > 0 && (
              <button type="button" className={styles.ghost} onClick={() => confirm('타임라인을 모두 지울까요?') && setEvents([])}>
                모두 지우기
              </button>
            )}
            <button type="button" className={styles.ghost} onClick={() => setEditing('new')} disabled={editing === 'new'}>
              사건 추가
            </button>
          </div>
        </div>
        {meta && (
          <p className={styles.note}>
            {meta.mode === 'summarized' ? `긴 기록이라 ${meta.chunks}개 구간으로 나눠 요약한 뒤 분석했어요.` : '한 번에 분석했어요.'}{' '}
            단위 {meta.units}개{meta.me ? ` · 나: ${meta.me}` : ''}
            {last ? ` · ${(last.ms / 1000).toFixed(1)}초` : ''}
          </p>
        )}

        {editing === 'new' && (
          <div className={styles.card}>
            <EventForm initial={toDraft()} onSave={(d) => saveDraft('new', d)} onCancel={() => setEditing(null)} />
          </div>
        )}
        {events.length === 0 && editing !== 'new' && <p className={styles.empty}>아직 사건이 없어요. 기록을 분석하거나 직접 추가해 주세요.</p>}

        <ol className={styles.timeline}>
          {events.map((e) => (
            <li key={e.id} className={styles.event}>
              {editing === e.id ? (
                <EventForm initial={toDraft(e)} onSave={(d) => saveDraft(e.id, d)} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <div className={styles.when}>
                    <span>{e.date}</span>
                    {e.age && <span>{e.age}살</span>}
                    {e.dateEstimated && <span className={styles.badge}>추정</span>}
                  </div>
                  <h3 className={styles.h3}>{e.title}</h3>
                  {e.emotions.length > 0 && (
                    <ul className={styles.chips}>
                      {e.emotions.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  )}
                  <p>{e.summary}</p>
                  <dl className={styles.dl}>
                    {e.people.length > 0 && (
                      <>
                        <dt>인물</dt>
                        <dd>{e.people.join(', ')}</dd>
                      </>
                    )}
                    {e.context && (
                      <>
                        <dt>맥락</dt>
                        <dd>{e.context}</dd>
                      </>
                    )}
                    {e.selfAtTime && e.selfAtTime.traits.length > 0 && (
                      <>
                        <dt>그때의 나</dt>
                        <dd>{e.selfAtTime.traits.join(' · ')}</dd>
                      </>
                    )}
                    {e.selfAtTime?.speechStyle && (
                      <>
                        <dt>말투</dt>
                        <dd>{e.selfAtTime.speechStyle}</dd>
                      </>
                    )}
                    {e.selfAtTime && e.selfAtTime.quotes.length > 0 && (
                      <>
                        <dt>한 말</dt>
                        <dd>
                          {e.selfAtTime.quotes.map((q) => (
                            <q key={q} className={styles.quote}>
                              {q}
                            </q>
                          ))}
                        </dd>
                      </>
                    )}
                  </dl>
                  <div className={styles.row}>
                    <button type="button" className={styles.ghost} onClick={() => setEditing(e.id)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => confirm('이 사건을 지울까요?') && setEvents(events.filter((x) => x.id !== e.id))}
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.panels} aria-label="입출력 확인">
        <details>
          <summary>원본 입력 {last ? `(${last.request.source}, ${last.request.text.length.toLocaleString()}자)` : ''}</summary>
          <pre>{last ? last.request.text : '아직 분석한 기록이 없어요.'}</pre>
        </details>
        <details>
          <summary>AI 원시 응답 (/api/analyze 응답 JSON, meta.llm 이 AI 출력 그대로)</summary>
          <pre>{last ? JSON.stringify(last.response, null, 2) : '아직 응답이 없어요.'}</pre>
        </details>
      </section>
    </main>
  );
}
