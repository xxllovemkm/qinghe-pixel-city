import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = await readFile(
  path.join(root, 'docs/qinghe-evaluation-design.md'),
  'utf8',
);
const headings = [
  ...doc.matchAll(/^### ((?:S|D|M|P|L)\d+|S-E\d+|M-E\d+|[ms]q_D\d+) (.+)$/gm),
];
const meta = headings.map((match, i) => {
  const id = match[1],
    body = doc.slice(
      match.index + match[0].length,
      headings[i + 1]?.index ?? doc.indexOf('## 10.'),
    );
  const checklist = body.match(/\*\*四项检查\*\*：([^\n]+)/)?.[1] || '';
  const criteria = checklist
    ? checklist
        .split(/[；。]\s*(?=[BCD] )/)
        .map((x) => x.replace(/^[ABCD] /, '').replace(/[。；]$/, ''))
    : [];
  if (criteria.length && criteria.length !== 4)
    throw Error(id + ': four checks required');
  return {
    id,
    name: match[2],
    method: body.match(/\*\*测什么／怎么测\*\*：([^\n]+)/)?.[1] || '',
    criteria,
    calculation: body.match(/\*\*量化\*\*：([^\n]+)/)?.[1] || '',
    group: id.startsWith('S')
      ? id === 'S5' || id === 'S6'
        ? 'dynamics'
        : 'behavior'
      : id.startsWith('mq') || id.startsWith('sq')
        ? 'learnlm'
        : id.startsWith('D')
          ? 'diagnosis'
          : id.startsWith('M')
            ? 'memory'
            : id.startsWith('P')
              ? 'profile'
              : 'effect',
    stage:
      id === 'S6' || id === 'L4'
        ? '后续校准 / 实验'
        : (id.startsWith('P') && Number(id.slice(1)) >= 8) || id.startsWith('L')
          ? '独立作答验证'
          : '情境与证据测试',
  };
});
if (meta.length !== 43) throw Error('Expected 43 rubric metrics');
const fixture = await build({
  absWorkingDir: root,
  entryPoints: ['lib/evaluation-design/examples.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { examples } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(fixture.outputFiles[0].text).toString('base64')
);
for (const metric of meta) {
  const d = examples[metric.id];
  if (!d) throw Error('Missing example ' + metric.id);
  for (const side of ['high', 'low']) {
    const b = d[side];
    if (!b || !['turns', 'records', 'nodes', 'measure'].some((k) => b[k]))
      throw Error('Missing concrete branch ' + metric.id + ':' + side);
    const eventIds = new Set((d.events || []).map((e) => e.split(' · ')[0]));
    eventIds.add('E1');
    for (let i = 0; i < (b.turns || []).length; i++)
      eventIds.add('T' + (i + 1));
    for (const row of [...(b.records || []), ...(b.nodes || [])])
      for (const ref of row.refs) {
        if (!eventIds.has(ref))
          throw Error('Missing evidence ' + metric.id + ':' + side + ':' + ref);
      }
  }
}
const result = await build({
  absWorkingDir: root,
  entryPoints: ['components/evaluation-design.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
  outdir: 'build',
  define: {
    'process.env.NODE_ENV': '"production"',
    __EVALUATION_META__: JSON.stringify(meta),
  },
  plugins: [
    {
      name: 'offline-study-renderer',
      setup(b) {
        b.onLoad({ filter: /study-markdown\.tsx$/ }, async (args) => ({
          contents: (await readFile(args.path, 'utf8')).replace(
            'if (loader) return loader;',
            'if (window.StudyModeViewer) return Promise.resolve();\n  if (loader) return loader;',
          ),
          loader: 'tsx',
        }));
      },
    },
  ],
});
const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text;
let katexCss = await readFile(
  path.join(root, 'public/study-ui/vendor/katex/katex.min.css'),
  'utf8',
);
for (const match of katexCss.matchAll(/url\((fonts\/[^)]+)\)/g)) {
  const data = await readFile(
    path.join(root, 'public/study-ui/vendor/katex', match[1]),
  );
  const ext = path.extname(match[1]).slice(1);
  katexCss = katexCss.replaceAll(
    match[0],
    `url(data:font/${ext};base64,${data.toString('base64')})`,
  );
}
const vendors = [];
for (const file of [
  'vendor/markdown-it/markdown-it.min.js',
  'vendor/katex/katex.min.js',
  'vendor/dompurify/purify.min.js',
  'markdown.js',
])
  vendors.push(
    await readFile(path.join(root, 'public/study-ui', file), 'utf8'),
  );
const script = (s) =>
  `<script>${s.replace(/<\/script/gi, '<\\/script')}</script>`;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>评测设计</title><meta name="description" content="学生与 APP 两大维度的评测设计、交互案例、Memory 与画像证据"><style>${katexCss}\n${css}</style></head><body><div id="root"></div>${vendors.map(script).join('\n')}${script(result.outputFiles.find((f) => f.path.endsWith('.js')).text)}</body></html>`;
await mkdir(path.join(root, 'public'), { recursive: true });
await writeFile(path.join(root, 'public/qinghe-evaluation-design.html'), html);
console.log(
  JSON.stringify(
    {
      file: 'public/qinghe-evaluation-design.html',
      metrics: meta.length,
      branches: meta.length * 2,
      bytes: Buffer.byteLength(html),
      evidenceReferences: 'verified',
      standalone: true,
    },
    null,
    2,
  ),
);
