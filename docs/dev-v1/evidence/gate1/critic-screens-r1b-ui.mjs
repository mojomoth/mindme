// Critic r1b: /pocs/screens 인터랙션·넘침 검증 (코드 수정 없음, 읽기 전용 실행)
// 실행: node docs/dev-v1/evidence/gate1/critic-screens-r1b-ui.mjs > docs/dev-v1/evidence/gate1/critic-screens-r1b-ui.json
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3101/pocs/screens';
const out = { checks: [], overflow: {}, consoleErrors: [] };
const ok = (name, pass, detail) => out.checks.push({ name, pass: !!pass, detail });

const VP = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};

const browser = await chromium.launch();
async function newPage(kind) {
  const p = await browser.newPage(VP[kind]);
  p.on('console', (m) => m.type() === 'error' && out.consoleErrors.push(`${kind}: ${m.text()}`));
  p.on('pageerror', (e) => out.consoleErrors.push(`${kind} pageerror: ${e.message}`));
  return p;
}

// 넘침 측정: 페이지 가로 스크롤, 잘린 텍스트(scrollWidth>clientWidth), 데스크톱 목업 화면 밖 요소
async function measure(p) {
  return p.evaluate(() => {
    const doc = document.documentElement;
    const res = { hScroll: doc.scrollWidth > doc.clientWidth, docH: doc.scrollHeight, vpH: innerHeight, clipped: [], outsideFrame: [] };
    for (const el of document.querySelectorAll('main *')) {
      const cs = getComputedStyle(el);
      if (!el.childNodes.length || cs.display === 'none') continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText && (el.scrollWidth > el.clientWidth + 1) && el.tagName !== 'TEXTAREA' && cs.overflow !== 'visible')
        res.clipped.push(`${el.tagName}.${el.className}: ${el.textContent.trim().slice(0, 30)}`);
    }
    const screen = document.querySelector('[class*="PhoneFrame"][class*="screen"], [class*="screen"]');
    const content = document.querySelector('[class*="content"]');
    if (content && innerWidth > 600) {
      const fr = content.getBoundingClientRect();
      for (const el of content.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.left < fr.left - 1 || r.right > fr.right + 1)
          res.outsideFrame.push(`${el.tagName}.${String(el.className).slice(0, 40)} x=${Math.round(r.left)}..${Math.round(r.right)} frame=${Math.round(fr.left)}..${Math.round(fr.right)}`);
      }
      res.frame = { left: fr.left, right: fr.right, top: fr.top, bottom: fr.bottom, scrollH: content.scrollHeight, clientH: content.clientHeight };
    }
    return res;
  });
}

try {
  // 1. 랜딩 3초 자동 이동
  {
    const p = await newPage('mobile');
    await p.goto(`${BASE}/landing`, { waitUntil: 'networkidle' });
    const t0 = Date.now();
    await p.waitForURL('**/pocs/screens/create', { timeout: 8000 });
    const dt = Date.now() - t0;
    ok('landing 자동 이동 → create', dt > 2000 && dt < 4500, `${dt}ms (networkidle 이후 측정)`);
    await p.goto(`${BASE}`, { waitUntil: 'networkidle' });
    const t1 = Date.now();
    await p.waitForURL('**/pocs/screens/create', { timeout: 8000 });
    ok('/pocs/screens(루트) 자동 이동 → create', true, `${Date.now() - t1}ms`);
    await p.goto(`${BASE}/landing?hold`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3600);
    ok('?hold 에서는 멈춤', p.url().includes('/landing'), p.url());
    await p.close();
  }

  // 2. 02 글자수 갱신 + 제출 → 목록
  {
    const p = await newPage('mobile');
    await p.goto(`${BASE}/create`, { waitUntil: 'networkidle' });
    const count = () => p.locator('[aria-live="polite"]').first().innerText();
    const c0 = await count();
    await p.fill('#pc-story', '안녕하세요 반가워요');
    const c1 = await count();
    await p.fill('#pc-story', 'ㄱ'.repeat(1500));
    const c2 = await count();
    await p.fill('#pc-story', 'ㄱ'.repeat(2100));
    const c3 = await count();
    ok('02 글자수 0 → 10 → 1,500 → 2,000(상한)', c0 === '0 / 2,000' && c1 === '10 / 2,000' && c2 === '1,500 / 2,000' && c3 === '2,000 / 2,000', [c0, c1, c2, c3].join(' | '));
    out.overflow['create-mobile-after-2000'] = await measure(p);
    await p.getByRole('button', { name: '페르소나 생성하기' }).click();
    await p.waitForURL('**/pocs/screens/list', { timeout: 5000 }).catch(() => {});
    ok('02 페르소나 생성하기 → list', p.url().endsWith('/list'), p.url());
    await p.close();
  }

  // 3. 목록 → 모달 열기/닫기, 슬라이더, 행 → 대화 → 나가기
  for (const kind of ['mobile', 'desktop']) {
    const p = await newPage(kind);
    await p.goto(`${BASE}/list`, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /페르소나 생성$/ }).click();
    await p.waitForURL('**/pocs/screens/modal');
    const dlg = p.getByRole('dialog');
    ok(`${kind} 목록 + 페르소나 생성 → 모달`, await dlg.isVisible(), p.url());

    const pill = () => p.locator('output[for="pm-age"]').innerText();
    const a0 = await pill();
    const slider = p.locator('#pm-age');
    await slider.focus();
    for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
    const a1 = await pill();
    await p.keyboard.press('End');
    const a2 = await pill();
    await p.keyboard.press('Home');
    const a3 = await pill();
    // 마우스(데스크톱)·터치 대신 좌표 클릭: 트랙 중앙 → 약 42~43살
    const box = await slider.boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const a4 = await pill();
    // 드래그: 20% 지점 → 80% 지점
    await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 8 });
    await p.mouse.up();
    const a5 = await pill();
    const fillPct = await slider.evaluate((el) => el.style.getPropertyValue('--pct'));
    ok(`${kind} 슬라이더 → 나이 pill 갱신`, a0 === '15살' && a1 === '20살' && a2 === '80살' && a3 === '5살' && /^4[0-5]살$/.test(a4) && a5 !== a4, `${[a0, a1, a2, a3, a4, a5].join(' → ')} (--pct=${fillPct})`);

    await p.fill('#pm-situation', '고3 수능 전날, 잠 못 들던 나');
    ok(`${kind} 모달 상황 설명 입력`, (await p.inputValue('#pm-situation')) === '고3 수능 전날, 잠 못 들던 나', '');

    await p.getByRole('button', { name: '닫기' }).click();
    await p.waitForURL('**/pocs/screens/list');
    ok(`${kind} 모달 X 닫기 → list`, !(await p.getByRole('dialog').count()), p.url());

    // 스크림 클릭 닫기
    await p.goto(`${BASE}/modal`, { waitUntil: 'networkidle' });
    const dbox = await p.getByRole('dialog').boundingBox();
    await p.mouse.click(dbox.x + dbox.width / 2, dbox.y + dbox.height + 20);
    await p.waitForURL('**/pocs/screens/list', { timeout: 3000 }).catch(() => {});
    ok(`${kind} 스크림 클릭 → 닫힘`, p.url().endsWith('/list'), p.url());

    // Esc 닫기 (요구사항 아님, 참고)
    await p.goto(`${BASE}/modal`, { waitUntil: 'networkidle' });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
    out.checks.push({ name: `${kind} (참고) Esc 로 모달 닫힘`, pass: p.url().endsWith('/list'), detail: p.url(), info: true });

    // 행 → 대화
    await p.goto(`${BASE}/list`, { waitUntil: 'networkidle' });
    await p.getByText('15살의 홍길동').click();
    await p.waitForURL('**/pocs/screens/chat', { timeout: 5000 }).catch(() => {});
    ok(`${kind} 목록 행 → chat`, p.url().endsWith('/chat'), p.url());

    // 메시지 전송
    await p.getByPlaceholder('메시지를 입력하세요').fill('나도 그랬어');
    const sendBtn = p.getByRole('button', { name: /보내기|전송/ });
    if (await sendBtn.count()) await sendBtn.first().click();
    else await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    ok(`${kind} 대화 메시지 전송 → 말풍선 추가`, await p.getByText('나도 그랬어').count(), '');
    out.overflow[`chat-${kind}-after-send`] = await measure(p);

    await p.getByRole('button', { name: '나가기' }).click();
    await p.waitForURL('**/pocs/screens/list', { timeout: 5000 }).catch(() => {});
    ok(`${kind} 나가기 → list`, p.url().endsWith('/list'), p.url());

    await p.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: '뒤로' }).click();
    await p.waitForURL('**/pocs/screens/list', { timeout: 5000 }).catch(() => {});
    ok(`${kind} 대화 뒤로 → list`, p.url().endsWith('/list'), p.url());
    await p.close();
  }

  // 4. 화면별 넘침 (mobile 390x844, se 375x667, desktop)
  for (const kind of ['mobile', 'se', 'desktop']) {
    const p = await newPage(kind);
    for (const s of ['landing?hold', 'create', 'list', 'modal', 'chat']) {
      await p.goto(`${BASE}/${s}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(400);
      out.overflow[`${s}-${kind}`] = await measure(p);
    }
    // SE: create 스크롤 끝에서 주 버튼이 보이고 눌리는가
    if (kind === 'se') {
      await p.goto(`${BASE}/create`, { waitUntil: 'networkidle' });
      const btn = p.getByRole('button', { name: '페르소나 생성하기' });
      await btn.scrollIntoViewIfNeeded();
      const vis = await btn.isVisible();
      await btn.click();
      await p.waitForURL('**/list', { timeout: 3000 }).catch(() => {});
      ok('375x667 create 하단 버튼 도달·클릭', vis && p.url().endsWith('/list'), p.url());
      await p.goto(`${BASE}/modal`, { waitUntil: 'networkidle' });
      const sb = await p.getByRole('button', { name: '생성하기', exact: true }).boundingBox();
      ok('375x667 모달 생성하기 버튼이 뷰포트 안', sb && sb.y + sb.height <= 667, JSON.stringify(sb));
    }
    await p.close();
  }
} finally {
  await browser.close();
}

out.summary = { total: out.checks.filter((c) => !c.info).length, failed: out.checks.filter((c) => !c.pass && !c.info).map((c) => c.name) };
console.log(JSON.stringify(out, null, 2));
