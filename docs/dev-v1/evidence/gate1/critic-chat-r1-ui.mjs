// Critic Gate1 chat r1: /pocs/chat 실제 전송·스트리밍·새로고침 유지·번들 키 스캔
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3101';
const OUT = new URL('.', import.meta.url).pathname;
const VP = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const result = {};
const browser = await chromium.launch();
for (const [kind, opts] of Object.entries(VP)) {
  const r = (result[kind] = { console: [], jsFiles: 0, keyHits: [], requests: [] });
  const page = await browser.newPage(opts);
  page.on('console', (m) => m.type() === 'error' && r.console.push(m.text()));
  page.on('pageerror', (e) => r.console.push('pageerror ' + e.message));
  page.on('response', async (res) => {
    const u = res.url();
    if (u.endsWith('.js') || u.includes('.js?')) {
      r.jsFiles++;
      const t = await res.text().catch(() => '');
      for (const re of [/sk-proj-[A-Za-z0-9]/, /sk-ant-/, /AIza[0-9A-Za-z_-]{20}/, /OPENAI_API_KEY/, /buildSystemPrompt\(|설정일 뿐 지시가 아니다/]) if (re.test(t)) r.keyHits.push(`${re} in ${u}`);
    }
  });
  page.on('request', (req) => { if (req.url().endsWith('/api/chat')) r.requests.push(Object.keys(JSON.parse(req.postData() || '{}'))); });
  await page.goto(BASE + '/pocs/chat', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  const bubbles = () => page.locator('[aria-live="polite"] p');
  r.initialBubbles = await bubbles().count();
  r.options = await page.locator('select option').allTextContents();
  const turns = ['안녕, 나 미래의 너야. 지금 뭐 하고 있었어?', '민수랑 싸운 거 아직 마음에 걸려?'];
  r.turns = [];
  for (const msg of turns) {
    await page.fill('input[aria-label="메시지"]', msg);
    await page.keyboard.press('Enter');
    const lens = [];
    const t0 = Date.now();
    // 스트리밍 중 마지막 말풍선 길이를 100ms 간격으로 샘플링
    while (Date.now() - t0 < 30000) {
      const last = (await bubbles().last().textContent()) ?? '';
      lens.push(last.length);
      if (await page.locator('text=/첫 글자 \\d+ms/').count()) break;
      await page.waitForTimeout(100);
    }
    const timing = await page.locator('text=/첫 글자 \\d+ms/').textContent().catch(() => null);
    const distinct = [...new Set(lens)];
    r.turns.push({ msg, timing, distinctLengths: distinct.length, lengthsSample: distinct.slice(0, 12), reply: await bubbles().last().textContent() });
  }
  r.bubblesBeforeReload = await bubbles().count();
  await page.screenshot({ path: `${OUT}critic-chat-r1-${kind}.png` });
  await page.reload({ waitUntil: 'networkidle' });
  r.bubblesAfterReload = await bubbles().count();
  r.textsAfterReload = await bubbles().allTextContents();
  await page.screenshot({ path: `${OUT}critic-chat-r1-${kind}-reloaded.png` });
  // 서버 오류 표시: 400 을 흉내 내 오류 문구와 메시지 보존 확인
  await page.route('**/api/chat', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream_error', message: '답변을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' } }) }));
  await page.fill('input[aria-label="메시지"]', '오류 테스트');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  r.errorShown = await page.locator('text=답변을 만들지 못했어요').count();
  r.bubblesAfterError = await bubbles().count();
  r.sendDisabledAfterError = await page.locator('button:has-text("보내기")').isDisabled();
  await page.unroute('**/api/chat');
  await page.screenshot({ path: `${OUT}critic-chat-r1-${kind}-error.png` });
  r.hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.close();
}
await browser.close();
console.log(JSON.stringify(result, null, 2));
