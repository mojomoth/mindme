import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Source } from '@mindme/core';
import Analysis from './Loader.tsx';

export const dynamic = 'force-dynamic';

export type Fixture = { label: string; source: Source; me?: string; text: string };

// 합성(가상) 예시. 실존 인물 정보 없음.
const FIXTURES: (Omit<Fixture, 'text'> & { file: string })[] = [
  { file: 'kakao-pc.txt', label: '카톡 PC판 (친구)', source: 'kakao' },
  { file: 'kakao-mobile.txt', label: '카톡 모바일판 (가족)', source: 'kakao', me: '이지우' },
  { file: 'diary.txt', label: '일기', source: 'diary' },
  { file: 'prompt.txt', label: '직접 쓴 이야기', source: 'prompt' },
];

export default async function AnalysisPoc() {
  const dir = path.join(process.cwd(), 'fixtures/analysis');
  const fixtures: Fixture[] = await Promise.all(
    FIXTURES.map(async ({ file, ...f }) => ({ ...f, text: await readFile(path.join(dir, file), 'utf8') })),
  );
  return <Analysis fixtures={fixtures} />;
}
