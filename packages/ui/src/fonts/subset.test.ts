// @ts-nocheck -- ui 패키지 tsconfig 에 node 타입이 없어요. 루트 pnpm test 로만 돌아가는 파일 검사 테스트예요.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const dir = new URL('./subset/', import.meta.url);
const manifest: Record<string, { count: number; unicodeRange: string }> = JSON.parse(
  readFileSync(new URL('manifest.json', dir), 'utf8'),
);
const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

function expand(range: string) {
  const out: number[] = [];
  for (const part of range.split(', ')) {
    const [a, b = a] = part.slice(2).split('-U+').join('-').split('-');
    for (let cp = parseInt(a, 16); cp <= parseInt(b, 16); cp++) out.push(cp);
  }
  return out;
}

test('Pretendard 조각: tokens.css 의 @font-face 가 조각 파일·unicode-range 와 일치한다', () => {
  const faces = [...css.matchAll(/url\('\.\.\/fonts\/subset\/([\w-]+)\.woff2'\)[^}]*?unicode-range: ([^;]+);[^}]*?font-weight: 45 920;[^}]*?font-display: swap;/g)];
  assert.deepEqual(faces.map((f) => f[1]), Object.keys(manifest));
  for (const [, name, range] of faces) {
    assert.ok(existsSync(new URL(`${name}.woff2`, dir)), name);
    assert.equal(range, manifest[name].unicodeRange);
    assert.equal(expand(range).length, manifest[name].count, name);
  }
  assert.doesNotMatch(css, /fonts\/pretendard\.woff2/);
});

test('Pretendard 조각: 코드포인트가 겹치지 않고 희귀 음절도 조각에 들어 있다', () => {
  const owner = new Map<number, string>();
  for (const [name, { unicodeRange }] of Object.entries(manifest)) {
    for (const cp of expand(unicodeRange)) {
      assert.equal(owner.get(cp), undefined, `U+${cp.toString(16)} 중복`);
      owner.set(cp, name);
    }
  }
  assert.equal(owner.get('가'.codePointAt(0)!), 'hangul-common');
  for (const ch of '똠쀍햏') assert.match(owner.get(ch.codePointAt(0)!) ?? '', /^hangul-rest-/);
  assert.equal(manifest['hangul-common'].count, 2350);
});
