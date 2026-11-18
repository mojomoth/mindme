'use client';

// localStorage 를 첫 렌더에서 바로 읽으려고 page.tsx 가 ssr: false 로 불러온다.
import { useEffect, useRef, useState } from 'react';
import { PersonaSchema, SAMPLE_PERSONA, type ChatMessage, type Persona } from '@mindme/core';
import styles from './chat.module.css';

// 페르소나 PoC 가 저장한 목록(Persona[] 또는 { persona }[]). 없으면 샘플만 보인다.
const PERSONAS_KEY = 'mindme:personas';
const chatKey = (id: string) => `mindme:chat:${id}`;
const SEND_LIMIT = 40; // 요청 상한(100개)보다 넉넉히 적게 보낸다. 서버가 한 번 더 자른다.

function load<T>(key: string): T | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

function loadPersonas(): Persona[] {
  const raw = load<unknown[]>(PERSONAS_KEY);
  const found = (Array.isArray(raw) ? raw : [])
    .map((x) => PersonaSchema.safeParse((x as { persona?: unknown })?.persona ?? x))
    .flatMap((r) => (r.success ? [r.data] : []));
  return [SAMPLE_PERSONA, ...found.filter((p) => p.id !== SAMPLE_PERSONA.id)];
}

const greet = (p: Persona): ChatMessage[] => [{ role: 'assistant', content: p.greeting }];

export default function Chat() {
  const [personas] = useState(loadPersonas);
  const [persona, setPersona] = useState<Persona>(SAMPLE_PERSONA);
  const [messages, setMessages] = useState<ChatMessage[]>(() => load<ChatMessage[]>(chatKey(SAMPLE_PERSONA.id)) ?? greet(SAMPLE_PERSONA));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [timing, setTiming] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function choose(p: Persona) {
    abortRef.current?.abort();
    setPersona(p);
    setMessages(load<ChatMessage[]>(chatKey(p.id)) ?? greet(p));
    setError('');
    setTiming('');
  }

  function save(p: Persona, ms: ChatMessage[]) {
    try {
      localStorage.setItem(chatKey(p.id), JSON.stringify(ms));
    } catch {
      /* 저장 공간이 없어도 대화는 계속한다 */
    }
  }

  function reset() {
    abortRef.current?.abort();
    try {
      localStorage.removeItem(chatKey(persona.id));
    } catch {}
    setMessages(greet(persona));
    setError('');
    setTiming('');
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const p = persona;
    const history: ChatMessage[] = [...messages, { role: 'user', content }];
    setInput('');
    setError('');
    setTiming('');
    setBusy(true);
    setMessages([...history, { role: 'assistant', content: '' }]);

    const abort = new AbortController();
    abortRef.current = abort;
    const t0 = performance.now();
    let firstMs = 0;
    let reply = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: p, messages: history.slice(-SEND_LIMIT) }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!firstMs) firstMs = performance.now() - t0;
        reply += value;
        setMessages([...history, { role: 'assistant', content: reply }]);
      }
      if (!reply.trim()) throw new Error('빈 답변이 왔어요.');
      const final: ChatMessage[] = [...history, { role: 'assistant', content: reply }];
      setMessages(final);
      save(p, final);
      setTiming(`첫 글자 ${Math.round(firstMs)}ms · 전체 ${Math.round(performance.now() - t0)}ms`);
    } catch (err) {
      if (abort.signal.aborted) return;
      // 실패한 질문은 기록에 남기고 빈 답변 칸만 지운다.
      setMessages(history);
      save(p, history);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === abort) setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>대화 PoC</h1>
        <div className={styles.controls}>
          <select
            className={styles.select}
            aria-label="대화할 페르소나"
            value={persona.id}
            onChange={(e) => choose(personas.find((p) => p.id === e.target.value) ?? SAMPLE_PERSONA)}
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === SAMPLE_PERSONA.id ? ' (샘플)' : ''}
              </option>
            ))}
          </select>
          <button type="button" className={styles.ghost} onClick={reset}>
            초기화
          </button>
        </div>
      </header>

      <div ref={listRef} className={styles.list} aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={m.role === 'user' ? styles.me : styles.them}>
            {m.content || <span className={styles.typing}>입력 중…</span>}
          </p>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {timing && <p className={styles.timing}>{timing}</p>}

      <form className={styles.form} onSubmit={send}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${persona.name}에게 말 걸기`}
          maxLength={4000}
          aria-label="메시지"
        />
        <button className={styles.send} disabled={busy || !input.trim()}>
          보내기
        </button>
      </form>
    </main>
  );
}
