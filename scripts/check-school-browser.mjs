import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const dependencies = process.env.CAMPUS_BROWSER_DEPS;
const { chromium } = require(
  dependencies ? path.join(dependencies, 'playwright') : 'playwright',
);
const sharp = require(
  dependencies ? path.join(dependencies, 'sharp') : 'sharp',
);
const root = process.env.CAMPUS_BASE_URL ?? 'http://localhost:3000';
const out = path.resolve('outputs/campus-browser');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
let context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
let page = await context.newPage();
const errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
const geometry = await import(
  pathToFileURL(path.resolve('outputs/school-check/school-geometry.mjs'))
);
const model = await import(
  pathToFileURL(path.resolve('outputs/school-check/school-model.mjs'))
);
async function ready(kind) {
  await page
    .locator(`.world-canvas[data-ready="true"][data-scene="${kind}"]`)
    .waitFor({ timeout: 45000 });
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.render-error').count(), 0);
}
async function pixels(label) {
  const png = await page.locator('.world-canvas').screenshot();
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set();
  for (let i = 0; i < data.length; i += 3 * 23)
    colors.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
  assert.ok(
    colors.size > 70,
    `${label}: blank or low-detail canvas (${colors.size} colors)`,
  );
  return { data, info, colors: colors.size };
}
function difference(a, b) {
  assert.equal(a.data.length, b.data.length);
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 3)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      20
    )
      changed++;
  return changed;
}
async function screenshot(name) {
  await page.screenshot({ path: path.join(out, name + '.png') });
}
async function closeDetails() {
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
}
async function enter(kind, name, clickModel = false) {
  const school = page.locator('.place-item').filter({ hasText: name });
  if (!(await school.isVisible()))
    await page.getByRole('button', { name: '学校目录', exact: true }).click();
  await school.click();
  await page.getByRole('button', { name: '进入校园', exact: true }).waitFor();
  if (clickModel) {
    await closeDetails();
    const canvas = await page.locator('.world-canvas').boundingBox();
    await page.mouse.click(
      canvas.x + canvas.width / 2,
      canvas.y + canvas.height / 2,
    );
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('.detail-title').first().innerText(), name);
    await screenshot(kind + '-city-entry');
  }
  await page.getByRole('button', { name: '进入校园', exact: true }).click();
  await ready(kind);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.ok((await page.locator('h1').innerText()).startsWith(name));
}
try {
  await page.goto(root);
  await ready('city');
  const initialStats = await page
    .locator('.city-stats strong')
    .allTextContents();
  for (const [kind, name] of [
    ['primary', '青禾小学'],
    ['middle', '明德初中'],
    ['high', '青河一中'],
  ]) {
    await enter(kind, name, true);
    assert.equal(await page.locator('.facility-list .place-item').count(), 15);
    const initial = await pixels(kind);
    await screenshot(kind + '-desktop');
    await page.waitForTimeout(650);
    const moving = await pixels(kind + ' moving');
    assert.ok(difference(initial, moving) > 5, `${kind}: students not moving`);
    await page
      .getByRole('button', { name: '暂停模拟 · 空格', exact: true })
      .click();
    await page.waitForTimeout(400);
    const frozen = await pixels('paused');
    await page.waitForTimeout(700);
    assert.equal(
      difference(frozen, await pixels('paused again')),
      0,
      'Paused world still moving',
    );
    await page
      .getByRole('button', { name: '向左旋转 · Q', exact: true })
      .click();
    await page.waitForTimeout(500);
    assert.ok(
      difference(frozen, await pixels('rotated')) > 2000,
      'Orbit did not change scene',
    );
    await page
      .getByRole('button', { name: '适应校园全景', exact: true })
      .click();
    await page.waitForTimeout(400);
    const zoom = await page
      .locator('.zoom-controls>span')
      .first()
      .textContent();
    await page.getByRole('button', { name: '放大', exact: true }).click();
    await page.waitForTimeout(400);
    assert.notEqual(
      await page.locator('.zoom-controls>span').first().textContent(),
      zoom,
    );
    await page
      .locator('.facility-list .place-item')
      .filter({ hasText: '图书馆' })
      .click();
    await page.getByRole('dialog').waitFor();
    assert.ok((await page.locator('.facility-rooms li').count()) >= 3);
    await page
      .getByRole('button', { name: '在校园中查看', exact: true })
      .click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await screenshot(kind + '-library');
    await page
      .getByRole('button', { name: '适应校园全景', exact: true })
      .click();
    await page.waitForTimeout(400);
    const map = await page.locator('.minimap').boundingBox();
    await page.mouse.click(map.x + map.width * 0.25, map.y + map.height * 0.25);
    await page.waitForTimeout(300);
    const moved = await pixels('minimap moved');
    await page
      .getByRole('button', { name: '适应校园全景', exact: true })
      .click();
    await page.waitForTimeout(300);
    assert.ok(
      difference(moved, await pixels('overview')) > 1500,
      'Minimap did not move camera',
    );
    await page.getByRole('button', { name: '切换夜景', exact: true }).click();
    await page.waitForTimeout(350);
    const night = await pixels('night');
    await screenshot(kind + '-night');
    await page.getByRole('button', { name: '切换夜景', exact: true }).click();
    await page.waitForTimeout(300);
    assert.ok(
      difference(night, await pixels('day')) > 2000,
      'Night mode did not change scene',
    );
    if (kind === 'primary') {
      const campus = model.createCampus(kind),
        box = await page.locator('.world-canvas').boundingBox();
      const camera = new THREE.PerspectiveCamera(
        38,
        box.width / box.height,
        0.1,
        2000,
      );
      camera.position
        .copy(geometry.CAMPUS_DIRECTION)
        .multiplyScalar(geometry.campusDistance(box.width / box.height));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      let target;
      for (let x = -70; x < 70 && !target; x += 2)
        for (let z = -58; z < 58; z += 2)
          if (model.canPlace(campus, 'tree', x, z)) {
            const p = new THREE.Vector3(x, 0, z).project(camera),
              sx = (p.x * 0.5 + 0.5) * box.width + box.x,
              sy = (-p.y * 0.5 + 0.5) * box.height + box.y;
            if (sx > 430 && sx < 980 && sy > 330 && sy < 780) {
              target = { x: sx, y: sy };
              break;
            }
          }
      assert.ok(target);
      const trees = Number(
        await page.locator('.city-stats strong').nth(2).innerText(),
      );
      await page.getByRole('button', { name: '2 种树', exact: true }).click();
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(300);
      assert.equal(
        Number(await page.locator('.city-stats strong').nth(2).innerText()),
        trees + 1,
        'Tree placement failed',
      );
      await page
        .getByRole('button', { name: '返回青河市', exact: true })
        .click();
      await ready('city');
      await enter(kind, name);
      assert.equal(
        Number(await page.locator('.city-stats strong').nth(2).innerText()),
        trees + 1,
        'Campus edits lost on return',
      );
    }
    await page.getByRole('button', { name: '返回青河市', exact: true }).click();
    await ready('city');
    assert.deepEqual(
      await page.locator('.city-stats strong').allTextContents(),
      initialStats,
      'City changed on campus return',
    );
    await page
      .getByRole('button', { name: '继续模拟 · 空格', exact: true })
      .click();
    checks.push({
      kind,
      canvasColors: initial.colors,
      facilities: 15,
      roundTrip: true,
    });
  }
  await context.close();
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(root);
  await ready('city');
  for (const [kind, name] of [
    ['primary', '青禾小学'],
    ['middle', '明德初中'],
    ['high', '青河一中'],
  ]) {
    await enter(kind, name);
    await pixels(kind + ' mobile');
    await screenshot(kind + '-mobile');
    if (kind === 'primary') {
      const beforeTouch = await pixels('before touch orbit');
      const touch = await context.newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 150, y: 450 }],
      });
      for (let x = 160; x <= 230; x += 10)
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: 450 }],
        });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await page.waitForTimeout(500);
      assert.ok(
        difference(beforeTouch, await pixels('after touch orbit')) > 1500,
      );
      assert.equal(
        await page.getByRole('dialog').count(),
        0,
        'Touch orbit opened details',
      );
      await touch.detach();
    }
    assert.ok(
      await page
        .getByRole('button', { name: '返回青河市', exact: true })
        .isVisible(),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Horizontal page overflow',
    );
    await page
      .getByRole('button', { name: '校园设施目录', exact: true })
      .click();
    await page.locator('.facility-list .place-item').first().click();
    await page.getByRole('dialog').waitFor();
    await closeDetails();
    await page.getByRole('button', { name: '返回青河市', exact: true }).click();
    await ready('city');
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  const report = {
    status: 'passed',
    checks,
    viewports: ['1440x1000', '390x844'],
    checksPerformed: [
      'all three enter and return',
      'city school models open campus entry',
      'WebGL canvas color checks',
      'moving and paused students',
      'orbit and zoom',
      'facility details',
      'minimap navigation',
      'day/night',
      'campus construction retained on return',
      'city stats retained',
      'mobile directory and navigation',
      'touch camera orbit',
    ],
    errors,
  };
  await fs.writeFile(
    path.join(out, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await screenshot('failure');
  console.error(error);
  console.error({ errors });
  process.exitCode = 1;
} finally {
  await browser.close();
}
