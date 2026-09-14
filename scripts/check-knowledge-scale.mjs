import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CAMPUS_BROWSER_DEPS, 'playwright'));
const fixture = JSON.parse(await fs.readFile('outputs/education-memory/public-1200.json', 'utf8'));
const output = path.resolve(process.env.CAMPUS_SCALE_OUTPUT || `outputs/education-architecture/knowledge-scale/${Date.now()}`);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/school-day/knowledge?action=browse', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
try {
  await page.goto('http://localhost:3000/?teaching=1');
  await page.locator('.sd-world-canvas').waitFor({ timeout: 45000 });
  await page.getByRole('button', { name: '学情与证据', exact: true }).click();
  await page.getByRole('button', { name: 'APP 判断与路径', exact: true }).click();
  const started = performance.now();
  await page.getByText('公共知识路径', { exact: true }).click();
  const atlas = page.locator('.public-knowledge-atlas');
  await atlas.locator('.knowledge3d-node-label').first().waitFor({ state: 'attached' });
  await atlas.getByRole('button', { name: '展开知识图谱', exact: true }).click();
  const graph = page.getByRole('dialog');
  await graph.locator('.knowledge3d-node-label').first().waitFor({ state: 'attached' });
  assert.equal(await graph.locator('.knowledge3d-node-label').count(), fixture.graph.nodes.length);
  const renderedMs = performance.now() - started;
  const before = await graph.locator('canvas').screenshot();
  await graph.getByRole('button', { name: '旋转知识图谱', exact: true }).click();
  await graph.getByRole('button', { name: '放大知识图谱', exact: true }).click();
  const frames = await page.evaluate(() => new Promise(resolve => {
    const times = []; const start = performance.now(); let last = start;
    const tick = now => { times.push(now - last); last = now; if (now - start >= 1500) resolve(times); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  const after = await graph.locator('canvas').screenshot();
  assert.notDeepEqual(before, after, 'Camera changes actual rendered geometry');
  const target = fixture.graph.nodes.find(node => node.node_kind === 'knowledge_point');
  await graph.getByLabel('搜索知识点', { exact: true }).fill(target.name);
  await graph.locator('.knowledge3d-search-results button').filter({ hasText: target.name }).first().click();
  await graph.locator('.knowledge3d-detail h4').filter({ hasText: target.name }).waitFor();
  await page.screenshot({ path: path.join(output, 'knowledge-1200.png') });
  assert.deepEqual(errors, []);
  const report = { status: 'passed', source: 'fixed_release_real_node_fixture', nodes: fixture.graph.nodes.length,
    edges: fixture.graph.edges.length, rendered_ms: Math.round(renderedMs), frames: frames.length,
    average_frame_ms: frames.reduce((a,b) => a+b, 0)/frames.length, errors,
    scope: 'browser WebGL rendering, rotation, zoom and search; fixture transport does not measure remote paging' };
  await fs.writeFile(path.join(output, 'scale-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
