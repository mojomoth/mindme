// 카카오톡 내보내기 TXT · 일기 TXT 파서. 순수 함수만 둔다 (서버·클라이언트 공용).

type KakaoMessage = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24시간) */
  time: string;
  author: string;
  text: string;
};

type KakaoChat = {
  /** 내보내기 첫 줄의 대화방 이름 ('박서진 님과 카카오톡 대화' → '박서진') */
  title?: string;
  /** 처음 말한 순서 */
  participants: string[];
  /** '나'의 대화명. 지정한 이름이 참여자에 없거나 추정할 수 없으면 undefined */
  me?: string;
  messages: KakaoMessage[];
};

type DiaryEntry = { date?: string; text: string };

const pad = (n: number | string) => String(n).padStart(2, '0');

function ymd(y: string, m: string, d: string): string | undefined {
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  return `${y}-${pad(mm)}-${pad(dd)}`;
}

function hm(ampm: string | undefined, h: string, m: string): string {
  let hour = Number(h) % 12;
  if (ampm === '오후') hour += 12;
  else if (!ampm) hour = Number(h); // 24시간 표기
  return `${pad(hour)}:${m}`;
}

// PC(Windows): --------------- 2015년 5월 14일 목요일 ---------------
const PC_DATE = /^-{3,}\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일.*?-{3,}$/;
// PC(Windows): [박서진] [오후 4:12] 메시지
const PC_MSG = /^\[([^\]]+)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ?(.*)$/;
// 모바일: Android '2015년 5월 14일 오후 4:12, 이름 : 메시지' / iOS '2015. 5. 14. 오후 4:12, 이름 : 메시지'
// 이름 : 이 없으면 시스템 메시지('…님이 들어왔습니다.')
const MOBILE_LINE =
  /^(\d{4})(?:년 |\. ?)(\d{1,2})(?:월 |\. ?)(\d{1,2})(?:일|\.) ?(?:(오전|오후) )?(\d{1,2}):(\d{2})[,:]? ?(.*)$/;
// 모바일 날짜 구분선: 2015년 5월 14일 목요일
const MOBILE_DATE = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일$/;
// Mac(CSV): 2015-05-14 16:12:00,"이름","메시지"
const CSV_MSG = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):\d{2},"((?:[^"]|"")*)","(.*)$/;
const TITLE = /^(.+?) 님과 카카오톡 대화$/;
// 줄 하나 전체가 시스템 안내인 경우 (PC 판은 시간 없이 이런 줄만 나온다)
const SYSTEM =
  /^(.+님이 (들어왔습니다|나갔습니다|.+님을 (초대했습니다|내보냈습니다))\.?|채팅방 관리자가 .+|운영정책을 위반한 메시지로 .+)$/;
// 내용이 없는 첨부·삭제 표시. 분석에 쓸 말이 없어 버린다.
const PLACEHOLDER = /^(사진|사진 \d+장|동영상|이모티콘|파일: .+|삭제된 메시지입니다\.?)$/;

/** 카카오톡 내보내기 TXT(PC·Android·iOS·Mac CSV)를 메시지 목록으로 바꾼다. 여러 줄 메시지는 한 메시지로 합친다. */
export function parseKakao(input: string, me?: string): KakaoChat {
  const lines = input.replace(/^﻿/, '').split(/\r?\n/);
  const messages: (KakaoMessage & { csv?: boolean })[] = [];
  let title: string | undefined;
  let day: string | undefined; // PC 판은 메시지 줄에 날짜가 없어 구분선에서 가져온다
  let current: (KakaoMessage & { csv?: boolean }) | undefined;
  let format: 'pc' | 'mobile' | undefined; // 처음 나온 형식으로 정한다. PC 판 구분선은 늘 '---- 날짜 ----' 라서 PC 파일의 맨 날짜 줄은 본문이다

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
    let m: RegExpMatchArray | null;

    if (!title && !messages.length && (m = line.match(TITLE))) {
      title = m[1]!.trim();
      continue;
    }
    if ((m = line.match(PC_DATE)) || (format !== 'pc' && (m = line.match(MOBILE_DATE)) && opensDay(lines, i, m))) {
      format ??= PC_DATE.test(line) ? 'pc' : 'mobile';
      day = ymd(m[1]!, m[2]!, m[3]!);
      current = undefined;
      continue;
    }
    if ((m = line.match(PC_MSG))) {
      format ??= 'pc';
      current = day ? { date: day, time: hm(m[2], m[3]!, m[4]!), author: m[1]!.trim(), text: m[5]! } : undefined;
      if (current) messages.push(current);
      continue;
    }
    if ((m = line.match(CSV_MSG))) {
      const date = ymd(m[1]!, m[2]!, m[3]!);
      current = date
        ? { date, time: `${m[4]}:${m[5]}`, author: m[6]!.replaceAll('""', '"').trim(), text: m[7]!, csv: true }
        : undefined;
      if (current) messages.push(current);
      continue;
    }
    if ((m = line.match(MOBILE_LINE))) {
      format ??= 'mobile';
      const date = ymd(m[1]!, m[2]!, m[3]!);
      const body = m[7]!.match(/^(.+?) : (.*)$/);
      current = date && body ? { date, time: hm(m[4], m[5]!, m[6]!), author: body[1]!.trim(), text: body[2]! } : undefined;
      if (current) messages.push(current);
      continue;
    }
    if (SYSTEM.test(line.trim())) {
      current = undefined;
      continue;
    }
    if (current) current.text += `\n${line}`;
  }

  const kept: KakaoMessage[] = [];
  for (const { csv, ...msg } of messages) {
    let text = msg.text.trim();
    if (csv) text = text.replace(/"$/, '').replaceAll('""', '"').trim();
    if (text && !PLACEHOLDER.test(text)) kept.push({ ...msg, text });
  }

  const participants = [...new Set(kept.map((x) => x.author))];
  return { title, participants, me: resolveMe(participants, title, me), messages: kept };
}

// 모바일 날짜 구분선 모양 줄은 다음 줄이 그날 메시지·시스템 줄·PC 날짜 구분선이거나 파일 끝일 때만 구분선이다.
// 다음 줄이 일반 본문·PC 메시지·다른 날짜 메시지면 여러 줄 메시지의 한 줄이다.
function opensDay(lines: string[], i: number, [, y, mo, d]: RegExpMatchArray): boolean {
  let j = i + 1;
  while (j < lines.length && !lines[j]!.trim()) j++;
  if (j === lines.length) return true;
  const line = lines[j]!.trimEnd();
  const next = line.match(MOBILE_LINE);
  if (next) return ymd(next[1]!, next[2]!, next[3]!) === ymd(y!, mo!, d!);
  return PC_DATE.test(line) || SYSTEM.test(line.trim());
}

function resolveMe(participants: string[], title: string | undefined, me: string | undefined): string | undefined {
  const want = me?.trim();
  if (want) return participants.find((p) => p === want) ?? participants.find((p) => p.includes(want) || want.includes(p));
  // 1:1 대화방 제목은 상대 이름이다. 둘 중 상대가 아닌 쪽이 '나'.
  if (title && participants.length === 2 && participants.includes(title)) return participants.find((p) => p !== title);
  return undefined;
}

// 일기 날짜 머리줄: '2019년 2월 12일 화요일 맑음', '2018.11.15 (목)', '# 2019-08-23', '[2020/3/16]'
const DIARY_DATE = /^[#\s[(]*(\d{4})\s*(?:년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일|[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2}))/;

/** 일기 TXT 를 날짜 머리줄 기준으로 나눈다. 머리줄이 없으면 통째로 한 항목. */
export function splitDiary(input: string): DiaryEntry[] {
  const entries: DiaryEntry[] = [{ text: '' }];
  for (const line of input.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.trim().length <= 30 ? line.match(DIARY_DATE) : null;
    const date = m && ymd(m[1]!, m[2] ?? m[4]!, m[3] ?? m[5]!);
    if (date) entries.push({ date, text: '' });
    else entries.at(-1)!.text += `${line}\n`;
  }
  return entries.map((e) => ({ ...e, text: e.text.trim() })).filter((e) => e.text);
}

/** 카카오 대화를 날짜별 블록('## 2015-05-14' + 'HH:MM 이름: 메시지')으로 만든다. '나'는 '(나)'를 붙인다. */
export function kakaoDayBlocks(chat: KakaoChat): string[] {
  const blocks: string[] = [];
  let day = '';
  for (const msg of chat.messages) {
    if (msg.date !== day) {
      day = msg.date;
      blocks.push(`## ${day}`);
    }
    const who = msg.author === chat.me ? `${msg.author}(나)` : msg.author;
    blocks[blocks.length - 1] += `\n${msg.time} ${who}: ${msg.text.replace(/\n+/g, ' / ')}`;
  }
  return blocks;
}

/**
 * 블록을 순서대로 max 글자 이하 묶음으로 담는다.
 * 블록 하나가 max 보다 크면 줄 단위로 나누고 조각마다 날짜 머리줄('## …')을 다시 붙인다. 줄 하나도 크면 글자 단위로 자른다.
 */
export function packChunks(blocks: string[], max: number): string[] {
  const chunks: string[] = [];
  for (const piece of blocks.flatMap((b) => splitBlock(b, max))) {
    const last = chunks.at(-1);
    if (last !== undefined && last.length + 1 + piece.length <= max) chunks[chunks.length - 1] = `${last}\n${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

function splitBlock(block: string, max: number): string[] {
  if (block.length <= max) return [block];
  const lines = block.split('\n');
  const head = lines[0]!.startsWith('## ') && lines[0]!.length < max / 2 ? lines.shift()! : '';
  const room = head ? max - head.length - 1 : max;
  const parts = lines.flatMap((l) => (l.length <= room ? [l] : (l.match(new RegExp(`[\\s\\S]{1,${room}}`, 'g')) ?? [])));
  return packChunks(parts, room).map((c) => (head ? `${head}\n${c}` : c));
}
