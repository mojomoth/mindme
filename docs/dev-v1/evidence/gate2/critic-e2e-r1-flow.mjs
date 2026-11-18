#!/usr/bin/env node
// Gate 2 Critic E2E r1 (독립 작성, 실제 AI). 사용법: node docs/dev-v1/evidence/gate2/critic-e2e-r1-flow.mjs <desktop|mobile|photo>
// desktop: 1440x900, 사진 없음, 전체 플로우 + 대화 500 오류·다시 받기
// mobile : 390x844, 사진 없음, 전체 플로우 + 첫 분석 500 오류·다시 시도 + 대화 네트워크 끊김
// photo  : 1440x900, 합성 얼굴 사진, 첫 생성 → 아바타 반영(목록·대화 헤더) + 모달 persona 500 → 다시 시도
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = 'docs/dev-v1/evidence/gate2';
const run = process.argv[2];
const VP = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  photo: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}[run];
if (!VP) throw new Error('desktop | mobile | photo');

// 키 값(값은 출력하지 않음): 루트 .env 의 *_KEY 값
const keyVals = readFileSync('.env', 'utf8')
  .split('\n')
  .map((l) => l.match(/^\s*([A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*["']?([^"'\s]+)/))
  .filter((m) => m && m[2].length >= 8)
  .map((m) => ({ name: m[1], value: m[2] }));

const log = { run, steps: [], checks: {}, console: [], errors: [], keyScan: { names: keyVals.map((k) => k.name), bodies: 0, hits: [] } };
const t0 = Date.now();
const mark = (step, extra = {}) => {
  const e = { step, t: +((Date.now() - t0) / 1000).toFixed(1), ...extra };
  log.steps.push(e);
  console.log(JSON.stringify(e));
};
const check = (k, v) => {
  log.checks[k] = v;
  console.log(`CHECK ${k} = ${JSON.stringify(v)}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext(VP);
const page = await ctx.newPage();
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
// 응답 본문 키 검사 (이미지 제외)
const bodyChecks = [];
page.on('response', (res) => {
  const ct = res.headers()['content-type'] ?? '';
  if (/image|font/.test(ct)) return;
  bodyChecks.push(
    res
      .text()
      .then((body) => {
        log.keyScan.bodies++;
        for (const k of keyVals) if (body.includes(k.value)) log.keyScan.hits.push(`${k.name} in ${res.url()}`);
        if (/sk-(proj-)?[A-Za-z0-9_-]{24,}/.test(body)) log.keyScan.hits.push(`sk- pattern in ${res.url()}`);
        if (/OPENAI_API_KEY|NEXT_PUBLIC_/.test(body) && /\.js/.test(res.url())) log.keyScan.hits.push(`env name in ${res.url()}`);
      })
      .catch(() => {}),
  );
});

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(250);
  const path = `${OUT}/critic-e2e-r1-${run}-${String(++n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path });
  mark(`shot ${name}`);
};
const pick = async (button, file) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles(file);
};
const ls = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
const listNames = () => page.locator('ul li strong').allTextContents();
const LIST = () => page.getByRole('heading', { name: '나의 페르소나' });
const WORKING = () => page.getByRole('heading', { name: '페르소나를 만들고 있어요' });

async function setSlider(target) {
  const slider = page.getByLabel('그때의 나이');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 5; i < target; i++) await page.keyboard.press('ArrowRight');
  return Number(await slider.inputValue());
}

async function modalCreate(situation, age, tag) {
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('상황 설명').fill(situation);
  const got = await setSlider(age);
  const note = await page.locator('[role=dialog] p[aria-live]').textContent();
  const pill = await page.locator('[role=dialog] output').textContent();
  check(`modal_${tag}`, { slider: got, pill, note });
  await page.waitForTimeout(500);
  await shot(`modal-${tag}`);
  const before = await listNames();
  const tm = Date.now();
  await page.getByRole('button', { name: '생성하기' }).click();
  await WORKING().waitFor();
  await shot(`working-${tag}`);
  await LIST().waitFor({ timeout: 240_000 });
  const after = await listNames();
  const personas = await ls('mindme:personas');
  const made = personas[0];
  check(`modal_${tag}_result`, { ms: Date.now() - tm, newName: after[0], kind: made.kind, age: made.age, eventId: made.eventId ?? null, count: [before.length, after.length] });
  await shot(`list-after-${tag}`);
  return made;
}

/** 대화 화면에서 메시지 보내고 스트리밍 관찰 */
async function sendAndWatch(text, tag) {
  const box = page.getByLabel('메시지');
  await box.fill(text);
  const bubbles = page.locator('main section p[class*="bubbleIn"]:not([aria-label])');
  const startCount = await bubbles.count();
  await page.keyboard.press('Enter');
  check(`${tag}_draftClearedOnEnter`, (await box.inputValue()) === '');
  const lengths = [];
  const atBottom = [];
  let typingSeen = false;
  let changedAt = Date.now();
  const tEnd = Date.now() + 90_000;
  while (Date.now() < tEnd) {
    const typing = (await page.getByLabel('입력 중').count()) > 0;
    if (typing) typingSeen = true;
    if ((await page.locator('main [role=alert]').count()) > 0) break;
    const c = await bubbles.count();
    if (c > startCount) {
      const len = ((await bubbles.last().textContent()) ?? '').length;
      if (lengths.at(-1) !== len) {
        lengths.push(len);
        atBottom.push(await scrolledToBottom());
        changedAt = Date.now();
      } else if (!typing && Date.now() - changedAt > 2000 && (await page.getByRole('button', { name: '보내기' }).isDisabled()) && !(await box.inputValue())) {
        // 보내기 버튼은 draft 가 비면 늘 disabled 이므로 길이 정체 2초로 끝을 판단
        break;
      }
    }
    await page.waitForTimeout(80);
  }
  const reply = c2text(await bubbles.last().textContent());
  const final = await scrolledToBottom();
  check(`${tag}_stream`, { typingSeen, lengthSamples: lengths.length, firstLens: lengths.slice(0, 6), finalLen: lengths.at(-1), bottomDuring: atBottom.filter(Boolean).length + '/' + atBottom.length, bottomFinal: final });
  check(`${tag}_reply`, reply);
  return reply;
}
const c2text = (s) => (s ?? '').trim();
const scrolledToBottom = () =>
  page.evaluate(() => {
    let el = document.querySelector('main section');
    while (el && !(el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (!el) return 'no-scroller';
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  });

const story =
  '사람들 앞에서는 말수가 적지만 그림 얘기만 나오면 신이 나. 어릴 때 할머니 집 마당에서 그림을 그리던 기억이 제일 따뜻해. 요즘은 회사를 그만두고 망원동 작업실에서 전업 화가로 버티는 중이고, 언젠가 내 이름으로 개인전을 여는 게 꿈이야.';

try {
  // ── 01 랜딩 → 3초 자동 이동
  const tg = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await shot('landing');
  await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 8000 });
  check('landingAutoMs', Date.now() - tg);
  check('noHorizontalScroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // ── 02 만들기
  check('submitDisabledEmpty', await page.getByRole('button', { name: '페르소나 생성하기' }).isDisabled());
  await pick(page.getByRole('button', { name: /TXT 파일 업로드/ }), `${OUT}/critic-e2e-r1-kakao.txt`);
  await page.getByLabel('나의 이야기').fill(story);
  await page.getByLabel('이름').fill('한도윤');
  await page.getByLabel(/지금 나이/).fill('28');
  if (run === 'photo') await pick(page.getByRole('button', { name: '사진 업로드' }), 'pocs/fixtures/persona/synthetic-face.jpg');
  await page.waitForTimeout(400);
  check('fileNameShown', await page.getByText('critic-e2e-r1-kakao.txt').isVisible());
  await shot('create');

  if (run === 'mobile') {
    // 오류 경로: 분석 500 (비JSON 본문) → 안내·다시 시도
    await page.route('**/api/analyze', (r) => r.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' }));
  }

  // ── 진행 → 03 목록
  const tc = Date.now();
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await WORKING().waitFor();
  await page.waitForTimeout(600);
  await shot('working');

  if (run === 'mobile') {
    await page.getByRole('heading', { name: '페르소나를 만들지 못했어요' }).waitFor({ timeout: 20_000 });
    check('analyzeErrorText', await page.locator('main [role=alert]').textContent());
    check('analyzeErrorButtons', await page.locator('main button').allTextContents());
    await shot('error-analyze');
    await page.unroute('**/api/analyze');
    await page.getByRole('button', { name: '다시 시도' }).click();
    await WORKING().waitFor();
  }

  await LIST().waitFor({ timeout: 360_000 });
  check('firstCreateMs', Date.now() - tc);
  await page.waitForTimeout(500);
  const firstNames = await listNames();
  const firstPersonas = await ls('mindme:personas');
  check('firstPersonas', firstPersonas.map((p) => ({ name: p.name, kind: p.kind, age: p.age, eventId: p.eventId ?? null, avatar: p.avatar ? p.avatar.slice(0, 22) : null })));
  check('events', (await ls('mindme:events')).map((e) => `${e.id} ${e.date} age=${e.age ?? '-'} ${e.title}`));
  check('readyPill', await page.getByText('페르소나가 준비됐어요').isVisible().catch(() => false));
  check('firstNamesUi', firstNames);
  await shot('list');

  if (run === 'photo') {
    const imgs = await page.locator('ul li img').evaluateAll((els) => els.map((e) => e.getAttribute('src')?.slice(0, 30)));
    check('photoListAvatars', imgs);
    // 모달 과거 생성: persona 500 → 다시 시도
    await page.route('**/api/persona', (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream_error', message: 'upstream failed' } }) }),
    );
    await page.getByRole('button', { name: '페르소나 생성' }).click();
    await page.getByLabel('상황 설명').fill('수능 가채점하고 재수를 고민하던 밤');
    await setSlider(18);
    await page.getByRole('button', { name: '생성하기' }).click();
    await page.getByRole('heading', { name: '페르소나를 만들지 못했어요' }).waitFor({ timeout: 120_000 });
    check('personaErrorText', await page.locator('main [role=alert]').textContent());
    await shot('error-persona');
    await page.unroute('**/api/persona');
    const tr = Date.now();
    await page.getByRole('button', { name: '다시 시도' }).click();
    await LIST().waitFor({ timeout: 240_000 });
    const made = (await ls('mindme:personas'))[0];
    check('personaRetry', { ms: Date.now() - tr, name: made.name, kind: made.kind, age: made.age, eventId: made.eventId ?? null, avatar: made.avatar?.slice(0, 22) ?? null });
    await shot('list-after-retry');
    // 대화 헤더 아바타
    await page.locator('ul li button').first().click();
    await page.getByRole('button', { name: '프로필 보기' }).waitFor();
    const headerSrc = await page.locator('button[aria-label="프로필 보기"] img').getAttribute('src');
    const bubbleSrc = await page.locator('main section img').first().getAttribute('src');
    check('chatHeaderAvatar', { header: headerSrc?.slice(0, 22), bubble: bubbleSrc?.slice(0, 22), sameAsStored: headerSrc === made.avatar });
    await shot('chat-photo');
    await page.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('dialog').waitFor();
    check('sheetAvatar', (await page.locator('[role=dialog] img').first().getAttribute('src'))?.slice(0, 22));
    await shot('profile-photo');
    await page.keyboard.press('Escape');
    // 새로고침 후 아바타 유지
    await page.reload();
    await LIST().waitFor({ timeout: 8000 });
    check('photoAvatarsAfterReload', await page.locator('ul li img').evaluateAll((els) => els.map((e) => e.getAttribute('src')?.slice(0, 22))));
    check('photoStored', Boolean(await ls('mindme:photo')));
    await shot('list-reloaded');
  } else {
    // ── 04 모달: 과거 15살 / 미래 35살
    const past = await modalCreate('엄마랑 예고 진학 문제로 크게 싸우고 방문을 쾅 닫았던 날', 14, 'past');
    const future = await modalCreate('내 이름으로 첫 개인전을 열고 할머니 마당 그림을 걸고 싶어', 35, 'future');
    check('kinds', { past: past.kind, future: future.kind });

    // ── 05 대화 (과거 14살 페르소나)
    const idx = (await ls('mindme:personas')).findIndex((p) => p.id === past.id);
    await page.locator('ul li button').nth(idx).click();
    await page.getByRole('heading', { name: past.name }).waitFor();
    check('chatHeader', { title: await page.locator('main header h1').textContent(), status: await page.locator('main header p').textContent() });
    check('greeting', c2text(await page.locator('main section p[class*="bubbleIn"]').first().textContent()));
    await shot('chat');

    // Shift+Enter 줄바꿈
    const box = page.getByLabel('메시지');
    await box.click();
    await box.pressSequentially('첫 줄');
    await page.keyboard.press('Shift+Enter');
    await box.pressSequentially('둘째 줄');
    check('shiftEnterNewline', (await box.inputValue()) === '첫 줄\n둘째 줄');
    await box.fill('');

    await sendAndWatch('엄마한테 소리 지르고 나서 지금 기분이 어때? 엄마한테 뭐라고 말하고 싶어?', 'msg1');
    await shot('chat-reply1');
    // 시점 이후 질문
    await sendAndWatch('그럼 너 수능 끝나고 재수했던 거랑, 할머니 장례식 끝난 날은 어땠어? 회사 그만두고 망원동 작업실 구한 건?', 'later');
    await shot('chat-later');
    await sendAndWatch('그래, 지금 네 마음을 조금 더 듣고 싶어. 그림 그릴 때 제일 좋은 순간은 언제야? 길게 얘기해 줘.', 'msg3');
    await shot('chat-reply3');

    if (run === 'desktop') {
      // 오류 경로: /api/chat 500 → 안내·다시 받기
      await page.route('**/api/chat', (r) => r.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' }));
      await box.fill('혹시 내 말 들려?');
      await page.keyboard.press('Enter');
      await page.locator('main [role=alert]').waitFor({ timeout: 15_000 });
      check('chatErrorText', await page.locator('main [role=alert]').textContent());
      check('chatErrorKeepsUserMsg', (await page.locator('main section p[class*="bubbleOut"]').last().textContent())?.includes('혹시 내 말 들려'));
      await shot('chat-error');
      await page.unroute('**/api/chat');
      await page.getByRole('button', { name: '다시 받기' }).click();
      await page.locator('main [role=alert]').waitFor({ state: 'detached', timeout: 10_000 });
      await page.waitForTimeout(6000);
      check('chatRetryReply', c2text(await page.locator('main section p[class*="bubbleIn"]:not([aria-label])').last().textContent()).slice(0, 200));
      check('chatRetryAlertGone', (await page.locator('main [role=alert]').count()) === 0);
      await shot('chat-retried');
    } else {
      // 오류 경로: 네트워크 끊김(abort) → 안내·다시 받기
      await page.route('**/api/chat', (r) => r.abort('internetdisconnected'));
      await box.fill('혹시 내 말 들려?');
      await page.keyboard.press('Enter');
      await page.locator('main [role=alert]').waitFor({ timeout: 15_000 });
      check('chatOfflineText', await page.locator('main [role=alert]').textContent());
      await shot('chat-offline');
      await page.unroute('**/api/chat');
      await page.getByRole('button', { name: '다시 받기' }).click();
      await page.locator('main [role=alert]').waitFor({ state: 'detached', timeout: 10_000 });
      await page.waitForTimeout(6000);
      check('chatRetryReply', c2text(await page.locator('main section p[class*="bubbleIn"]:not([aria-label])').last().textContent()).slice(0, 200));
      await shot('chat-retried');
    }

    // ── 프로필 수정 저장
    await page.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(500);
    await shot('profile');
    const newName = '열네 살 도윤이';
    await page.getByLabel('이름').fill(newName);
    const emo = page.getByLabel(/^감정/);
    await emo.fill(`${await emo.inputValue()}, 후회`);
    await page.getByRole('button', { name: '저장' }).click();
    check('sheetClosedOnSave', (await page.getByRole('dialog').count()) === 0);
    check('headerAfterSave', await page.locator('main header h1').textContent());
    await shot('chat-after-save');

    // 나가기
    await page.getByRole('button', { name: '나가기' }).click();
    await LIST().waitFor();
    check('listAfterExit', await listNames());
    await shot('list-after-exit');

    // ── 새로고침 후 유지
    await page.reload();
    await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
    const trl = Date.now();
    await LIST().waitFor({ timeout: 8000 });
    check('reloadLandingToListMs', Date.now() - trl);
    const names = await listNames();
    check('listAfterReload', names);
    check('editedNamePersisted', names.includes(newName));
    await shot('list-reloaded');
    await page.locator('ul li button').nth(names.indexOf(newName)).click();
    await page.getByRole('heading', { name: newName }).waitFor();
    const restored = await page.locator('main section p[class*="bubble"]').count();
    check('chatRestoredBubbles', restored);
    await page.getByRole('button', { name: '프로필 보기' }).click();
    check('emotionPersisted', (await page.getByLabel(/^감정/).inputValue()).includes('후회'));
    await page.keyboard.press('Escape');
    check('restoredScrollBottom', await scrolledToBottom());
    await shot('chat-restored');

    // 스트리밍 중 나가기
    await box.fill('마지막으로 하나만 더, 열네 살의 너한테 제일 무서운 게 뭐야?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: '나가기' }).click();
    await LIST().waitFor();
    await page.waitForTimeout(4000);
    check('screenAfterMidStreamExit', await page.locator('h1').first().textContent());
    await shot('list-after-midstream-exit');
    await page.locator('ul li button').nth(names.indexOf(newName)).click();
    await page.getByRole('heading', { name: newName }).waitFor();
    await page.waitForTimeout(500);
    const last = await page.locator('main section p[class*="bubble"]').last();
    check('afterMidStreamReopen', {
      lastIsMine: (await last.getAttribute('class'))?.includes('bubbleOut'),
      alert: await page.locator('main [role=alert]').count(),
      retry: await page.getByRole('button', { name: '다시 받기' }).count(),
    });
    await shot('chat-after-midstream-reopen');
  }
} catch (err) {
  log.errors.push(String(err?.stack ?? err).slice(0, 1500));
  console.error(err);
  await page.screenshot({ path: `${OUT}/critic-e2e-r1-${run}-zz-failure.png` }).catch(() => {});
} finally {
  await Promise.allSettled(bodyChecks);
  log.totalSec = (Date.now() - t0) / 1000;
  writeFileSync(`${OUT}/critic-e2e-r1-${run}.json`, JSON.stringify(log, null, 2));
  await browser.close();
}
