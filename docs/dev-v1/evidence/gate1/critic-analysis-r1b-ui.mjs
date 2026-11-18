// Critic r1b: /pocs/analysis 실조작. 업로드 → 분석 → 추가(검증 오류 포함)·수정·삭제 → 새로고침 유지 → 오류 표시 → 2MB 파일.
// 사용법: node docs/dev-v1/evidence/gate1/critic-analysis-r1b-ui.mjs <업로드 TXT> <2MB TXT> <desktop|mobile>
import { chromium } from '@playwright/test';
import path from 'node:path';

const [file, bigFile, kind = 'desktop'] = process.argv.slice(2);
const OUT = path.dirname(new URL(import.meta.url).pathname);
const shot = (name) => path.join(OUT, `critic-analysis-r1b-${kind}-${name}.png`);
const VP = {
  desktop: { viewport: { width: 1280, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}[kind];
const result = { kind, steps: [], errors: [], checks: {} };
const step = (s, extra) => {
  result.steps.push(extra ? `${s} ${JSON.stringify(extra)}` : s);
  console.log(`[${kind}] ${s}`, extra ?? '');
};
const check = (name, ok, detail) => {
  result.checks[name] = ok ? 'PASS' : `FAIL ${detail ?? ''}`;
  console.log(`[${kind}] CHECK ${name}: ${ok ? 'PASS' : 'FAIL'} ${detail ?? ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext(VP);
const page = await ctx.newPage();
page.on('pageerror', (e) => result.errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && result.errors.push(`console: ${m.text()}`));
page.on('dialog', (d) => d.accept());

const timeline = () =>
  page.$$eval('ol > li', (lis) =>
    lis.map((li) => ({
      when: li.querySelector('div')?.textContent ?? '',
      title: li.querySelector('h3')?.textContent ?? '',
    })),
  );

try {
  await page.goto('http://localhost:3101/pocs/analysis', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 1. 업로드
  await page.locator('input[type=file]').setInputFiles(file);
  await page.waitForFunction(() => (document.querySelector('textarea')?.value.length ?? 0) > 0);
  const len = await page.locator('textarea').first().evaluate((t) => t.value.length);
  step('업로드', { len });

  // 2. 분석
  const t0 = Date.now();
  await page.getByRole('button', { name: '분석하기' }).click();
  await page.getByRole('button', { name: '분석하는 중…' }).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: '분석하기' }).waitFor({ timeout: 180_000 });
  const analyzed = await timeline();
  step('분석 완료', { sec: (Date.now() - t0) / 1000, n: analyzed.length, analyzed });
  check('분석 결과 1개 이상', analyzed.length > 0);
  await page.screenshot({ path: shot('analyzed'), fullPage: true });

  // 3. 추가 — 검증 오류 먼저 (나이에 글자)
  await page.getByRole('button', { name: '사건 추가' }).click();
  const form = page.locator('form').first();
  await form.getByLabel('제목').fill('고등학교 입학');
  await form.getByLabel('시점', { exact: false }).first().fill('2018-03');
  await form.getByLabel('나이').fill('열일곱');
  await form.getByRole('button', { name: '저장' }).click();
  const ageErr = await form.locator('p').last().textContent();
  step('잘못된 나이 저장 시도', { ageErr });
  check('잘못된 나이는 저장 거부', (await timeline()).length === analyzed.length && !!ageErr);
  await form.getByLabel('나이').fill('17');
  await form.getByLabel('감정 (쉼표로 구분)').fill('설렘, 긴장');
  await form.getByLabel('인물 (쉼표로 구분)').fill('한유진');
  await form.getByLabel('무슨 일이 있었나요').fill('유진이와 같은 고등학교에 입학했다.');
  await form.getByRole('button', { name: '저장' }).click();
  const added = await timeline();
  step('추가 후', added);
  check('추가 + 시간순(2018-03 이 맨 앞)', added.length === analyzed.length + 1 && added[0].title === '고등학교 입학');

  // 4. 수정 — 두 번째 사건 제목·시점을 바꿔 맨 뒤로 가는지
  const target = added[1].title;
  await page.locator('ol > li').nth(1).getByRole('button', { name: '수정' }).click();
  const ef = page.locator('ol > li form');
  await ef.getByLabel('제목').fill(`${target} (수정)`);
  await ef.getByLabel('시점', { exact: false }).first().fill('2023-01-05');
  await ef.getByRole('button', { name: '저장' }).click();
  const edited = await timeline();
  step('수정 후', edited);
  check('수정 반영 + 재정렬(맨 뒤)', edited.at(-1).title === `${target} (수정)` && edited.at(-1).when.includes('2023-01-05'));

  // 5. 삭제 — 원래 AI 사건 하나(현재 두 번째)
  const delTitle = edited[1].title;
  await page.locator('ol > li').nth(1).getByRole('button', { name: '삭제' }).click();
  const deleted = await timeline();
  step('삭제 후', deleted);
  check('삭제', deleted.length === edited.length - 1 && !deleted.some((x) => x.title === delTitle));

  // 6. 새로고침 유지
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('ol > li').first().waitFor();
  const reloaded = await timeline();
  step('새로고침 후', reloaded);
  check('새로고침 후 동일', JSON.stringify(reloaded) === JSON.stringify(deleted));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:events') ?? '[]').map((e) => e.title));
  check('localStorage 와 화면 일치', JSON.stringify(stored) === JSON.stringify(reloaded.map((x) => x.title)));
  await page.screenshot({ path: shot('reloaded'), fullPage: true });

  // 7. 서버 오류 표시 — 카카오톡인데 형식 아님
  await page.locator('textarea').first().fill('그냥 메모입니다\n두 번째 줄');
  await page.getByRole('button', { name: '분석하기' }).click();
  await page.getByRole('button', { name: '분석하기' }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
  const errText = await page.locator('section[aria-label="입력"] p').last().textContent();
  step('형식 아님 오류', { errText });
  check('오류 문구 표시 + 타임라인 보존', /카카오톡 대화 형식/.test(errText ?? '') && (await timeline()).length === reloaded.length);

  // 8. 2MB 파일
  await page.locator('input[type=file]').setInputFiles(bigFile);
  await page.waitForFunction(() => (document.querySelector('textarea')?.value.length ?? 0) > 300_000, null, { timeout: 15_000 });
  const disabled = await page.getByRole('button', { name: '분석하기' }).isDisabled();
  const count = await page.locator('section[aria-label="입력"] span').last().textContent();
  step('2MB 업로드', { disabled, count });
  check('2MB: 분석 버튼 비활성 + 글자 수 초과 표시', disabled);
  await page.screenshot({ path: shot('2mb'), fullPage: false });

  // 9. 클라이언트 번들/HTML 에 키 흔적
  const html = await page.content();
  check('HTML 에 키 이름/접두사 없음', !/OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|sk-[A-Za-z0-9_-]{20,}/.test(html));
} catch (e) {
  result.errors.push(`script: ${e.message}`);
  await page.screenshot({ path: shot('fail'), fullPage: true }).catch(() => {});
} finally {
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
