// End-to-end smoke test in demo mode (no LLM), iPad landscape 1180x820.
// Plays one Curious Forest round (incl. a two-views comparison) and all 4 steps of a mission,
// then parent confirmation, unlock, and a reward redemption. Saves screenshots.
//
//   npm run build && npm run serve   (in another terminal)
//   npm run e2e                      (E2E_URL / SHOTS_DIR env optional)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.E2E_URL ?? 'http://localhost:3000/ai-for-future/';
const SHOTS = process.env.SHOTS_DIR ?? path.resolve('e2e/screenshots');
const IMG = path.resolve('e2e/fixtures/drawing.jpg');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: false, locale: 'zh-CN' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|net::/.test(m.text()) && errors.push(m.text()));

const T = (id) => page.getByTestId(id);
const step = (msg) => console.log(`• ${msg}`);
let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failures++;
};
const balance = async () => Number(await T('star-balance').getAttribute('data-balance'));

/** Close a celebration overlay if one popped up (level-ups can appear at any time). */
async function dismiss() {
  await page.waitForTimeout(150);
  if (await T('celebration').isVisible().catch(() => false)) {
    await T('celebration-close').click({ force: true });
    await page.waitForTimeout(250);
  }
}
async function click(id) {
  await dismiss();
  await T(id).click({ force: true });
}
async function typeSay(micId, text) {
  await dismiss();
  await T(`${micId}-input`).waitFor({ state: 'visible', timeout: 10000 });
  await T(`${micId}-input`).fill(text);
  await T(`${micId}-send`).click({ force: true });
}
async function upload(id) {
  await dismiss();
  await T(`${id}-input`).setInputFiles(IMG);
}
async function waitPhase(phase) {
  await page.waitForSelector(`[data-testid="forest-actions"][data-phase="${phase}"]`, { timeout: 15000 });
}
async function openParent() {
  await dismiss();
  const box = await T('parent-lock').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await page.mouse.up();
  await T('pinpad').waitFor();
  for (const d of '1234') await T(`pin-${d}`).click({ force: true });
  await T('pin-ok').click({ force: true });
  await T('parent').waitFor();
}
async function settle(ms = 2300) {
  await page.waitForTimeout(ms); // let star bursts finish for clean screenshots
}

try {
  step('Splash → start');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await T('start').click({ force: true });
  await T('go-forest').waitFor();
  await page.waitForTimeout(500);
  check((await balance()) === 1, 'daily first visit gives +1 star');
  await settle();
  await page.screenshot({ path: `${SHOTS}/1-home.png` });

  step('Parent: enable typing assist + force demo, add a reward');
  await openParent();
  if (await T('pin-prompt').isVisible()) await T('pin-skip').click({ force: true });
  check((await T('mode-badge').getAttribute('data-mode')) !== 'llm', 'no LLM reachable → demo mode indicator');
  await T('tab-settings').click({ force: true });
  await T('set-typing').check();
  await T('set-forcedemo').check();
  await T('settings-save').click({ force: true });
  await T('tab-rewards').click({ force: true });
  await T('reward-name').fill('贴纸一张 Sticker');
  await T('reward-cost').fill('3');
  await T('reward-save').click({ force: true });
  await page.waitForTimeout(300);
  await T('parent-exit').click({ force: true });

  step('Curious Forest: question → ask-back → guess → answer');
  await click('go-forest');
  await typeSay('mic-question', '为什么天空是蓝色的？');
  await waitPhase('guess');
  check((await T('qbadge').first().getAttribute('data-qtype')) === 'why', 'question classified as 为什么');
  check((await T('level-L1').getAttribute('data-state')) === 'done', 'level ① unlocked by first question');
  await typeSay('mic-guess', '因为大海是蓝色的');
  await waitPhase('answered');
  check(await T('msg-answer').first().isVisible(), '小星 answered with a try-at-home idea');

  step('Follow-up questions; third answer gives two views');
  await typeSay('mic-followup', '为什么太阳会发光？');
  await waitPhase('guess');
  check((await T('level-L2').getAttribute('data-state')) === 'done', 'level ② passed by a 为什么 question');
  await click('dont-know');
  await waitPhase('answered');
  await typeSay('mic-followup', '如果没有太阳会怎么样？');
  await waitPhase('guess');
  await typeSay('mic-guess', '会很冷');
  await waitPhase('compare');
  check(await T('views').isVisible(), 'dialectic answer shows two views');
  await settle();
  await page.screenshot({ path: `${SHOTS}/2-forest.png` });
  await click('view-1');
  await waitPhase('compareReason');
  const before = await balance();
  await typeSay('mic-reason', '因为我看到地球绕着太阳转');
  await waitPhase('answered');
  await page.waitForTimeout(400);
  check((await balance()) > before, 'giving a reason earns stars');

  step('Mission Base: plant reminder, all 4 steps');
  await click('home-btn');
  await click('go-base');
  await T('mission-plant-water').waitFor();
  check((await T('mission-trash-labels').getAttribute('data-status')) === 'locked', 'mission ② locked before ① is confirmed');
  await click('mission-plant-water');
  await T('step-panel-1').waitFor();
  let b0 = await balance();
  await typeSay('mic-retell', '要给阳台的植物做一个浇水提醒，让家人记得浇水');
  await T('next-step').waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  check((await balance()) === b0 + 1, 'step 1 (understand) +1 star instantly');
  await click('next-step');

  await T('step-panel-2').waitFor();
  b0 = await balance();
  await click('source-observe');
  await typeSay('mic-card', '我摸了摸土，是干干的');
  await T('source-grid').waitFor();
  await click('source-photo');
  await upload('card-photo');
  await T('keep-photo').waitFor({ timeout: 10000 });
  await click('keep-photo');
  await page.waitForSelector('[data-testid="card-strip"][data-count="2"]');
  await page.waitForTimeout(300);
  check((await balance()) === b0 + 2, 'step 2: two info cards, +1 each');
  await click('next-step');

  await T('step-panel-3').waitFor();
  b0 = await balance();
  await upload('plan-photo');
  await T('plan-feedback').waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  const planStars = (await balance()) - b0;
  check(planStars >= 1 && planStars <= 3, `step 3 plan via drawing photo: +${planStars} (1–3)`);
  await settle();
  if (await T('celebration').isVisible().catch(() => false)) await page.screenshot({ path: `${SHOTS}/6-levelup-celebration.png` });
  await dismiss();
  await settle(800);
  await page.screenshot({ path: `${SHOTS}/3-mission-plan.png` });
  b0 = await balance();
  await typeSay('mic-plan', '我把提醒卡贴在冰箱上，每个星期三浇水');
  await page.waitForTimeout(1200);
  check((await balance()) === b0 + 1, 'improving the plan gives +1 bonus');
  await click('next-step');

  await T('step-panel-4').waitFor();
  await upload('result-photo');
  await T('reflect-0').waitFor({ timeout: 10000 });
  await typeSay('mic-reflect-0', '提醒卡画得很好看，因为有水滴');
  await typeSay('mic-reflect-1', '第一次贴歪了');
  await typeSay('mic-reflect-2', '下次我会用胶带贴牢');
  b0 = await balance();
  await click('finish-mission');
  await page.waitForSelector('[data-testid="mission-finished"][data-status="awaiting"]', { timeout: 15000 });
  await page.waitForTimeout(400);
  check((await balance()) > b0, 'step 4 reflection stars credited instantly');
  const pendingBefore = await balance();

  step('Parent confirms big stars → credited + celebration + unlock');
  await openParent();
  await T('pending-big').waitFor();
  await page.screenshot({ path: `${SHOTS}/4-parent.png` });
  await T('confirm-big').click({ force: true });
  await page.waitForTimeout(400);
  await T('parent-exit').click({ force: true });
  await T('celebration').waitFor({ timeout: 8000 });
  check(true, 'mission celebration shown after confirmation');
  const afterConfirm = await balance();
  check(afterConfirm > pendingBefore, `big stars credited (${pendingBefore} → ${afterConfirm})`);
  await dismiss();
  await dismiss();
  await click('go-base');
  await T('mission-trash-labels').waitFor();
  check((await T('mission-plant-water').getAttribute('data-status')) === 'done', 'mission ① done');
  check((await T('mission-trash-labels').getAttribute('data-status')) === 'new', 'mission ② unlocked');

  step('Reward shop: request → parent confirm → stars deducted');
  await click('home-btn');
  await click('go-shop');
  await page.locator('[data-testid^="redeem-W"]').first().click({ force: true });
  await T('redeem-yes').click({ force: true });
  await T('redeem-row').first().waitFor();
  const beforeRedeem = await balance();
  check((await T('redeem-row').first().getAttribute('data-status')) === 'pending', 'redemption pending; balance unchanged until confirmed');
  await openParent();
  await T('pending-redeem').waitFor();
  await T('confirm-redeem').click({ force: true });
  await page.waitForTimeout(400);
  await T('parent-exit').click({ force: true });
  await page.waitForTimeout(300);
  check((await balance()) === beforeRedeem - 3, `redeem deducts 3 (${beforeRedeem} → ${await balance()})`);

  step('Parent backend: daily summary');
  await openParent();
  await T('tab-summary').click({ force: true });
  await T('gen-summary').click({ force: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/5-parent-summary.png` });
} catch (e) {
  failures++;
  console.error('E2E error:', e);
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {});
} finally {
  if (errors.length) {
    console.log('Page errors:', errors);
    failures += errors.length;
  }
  await browser.close();
  console.log(failures ? `\n✘ ${failures} problem(s)` : '\n✔ all e2e checks passed');
  process.exit(failures ? 1 : 0);
}
