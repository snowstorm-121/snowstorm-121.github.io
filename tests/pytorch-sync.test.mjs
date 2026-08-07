import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptUrl = pathToFileURL(path.join(repoRoot, 'scripts/sync-pytorch.mjs')).href;
const realSource = '/Users/yyy/Documents/知识库/Notes/Pytorch学习';
const legacyRoutes = [
  'notes/overview/pytorch-暑期详细学习计划.html',
  'notes/foundation/day-1-学习笔记-python-进阶语法.html',
  'notes/foundation/day-2-学习笔记-文件操作-异常处理-综合小项目.html',
  'notes/foundation/day-3-学习笔记-numpy-数组基础.html',
  'notes/foundation/day-4-学习笔记-数组运算-矩阵乘法-转置-广播.html',
  'notes/foundation/day-5-学习笔记-统计函数-random-模块-手写线性回归.html',
  'notes/foundation/day-6-学习笔记-matplotlib学习.html',
  'notes/foundation/day-7-学习笔记-dataframe学习.html',
  'notes/foundation/day-8-学习笔记-pandas进阶与numpy互转.html',
  'notes/foundation/day-9-学习笔记-titanic-综合实战-完整数据分析项目.html',
  'notes/foundation/day-10-学习笔记-查漏补缺-pytorch-预习.html',
  'notes/stage-1/day-1-学习笔记-tensor基本操作.html',
  'notes/stage-1/day-2-学习笔记-pytorch-autograd-自动微分基础.html',
  'notes/stage-1/day-3-学习笔记-手写线性回归-纯-tensor-实现.html',
  'notes/stage-1/day-4-学习笔记-手写-softmax-分类-纯-tensor-实现.html',
  'notes/stage-2/day-1-学习笔记-nn-module-与常用层入门.html',
  'notes/stage-2/day-2-学习笔记-mlp-多层感知机与正则化.html',
  'notes/stage-2/day-3-学习笔记-自定义-dataset-与-dataloader-深入.html',
  'notes/stage-2/day-4-学习笔记-模型保存加载与可视化.html',
  'notes/stage-2/day-5-学习笔记-mnist-综合复盘实验.html',
  'notes/stage-3/day-1-学习笔记-卷积操作基础-shape-与参数量.html',
  'notes/stage-3/day-2-学习笔记-经典-cnn-lenet.html',
  'notes/stage-3/day-3-学习笔记-残差网络-resnet-残差块核心.html',
  'notes/stage-3/day-4-学习笔记-迁移学习最小实战-预训练-resnet18.html',
];

async function loadSyncModule() {
  return import(scriptUrl);
}

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'pytorch-sync-'));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  await mkdir(path.join(source, 'Stage1', 'attachments'), { recursive: true });
  await writeFile(path.join(source, 'Stage1', 'attachments', 'plot.png'), 'png');
  await writeFile(path.join(source, 'Stage1', 'Day5.py'), 'print("safe")\n');
  await writeFile(path.join(source, 'Stage1', 'Other Note.md'), '# Other\n');
  await writeFile(
    path.join(source, 'Stage1', 'Main.md'),
    [
      '# Main',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '- item',
      '- [ ] todo',
      '> quote',
      '```js',
      'const value = 1;',
      '```',
      '[Markdown](Other Note.md)',
      '[[Other Note|Wiki]]',
      '[[Missing Note|Unavailable]]',
      '![[plot.png]]',
      '[[Day5.py|Download source]]',
      '![[Day5.py]]',
    ].join('\n'),
  );
  return { root, source, output };
}

test('discovers the real 32-note, seven-stage archive and preserves all 24 legacy slugs', async () => {
  const { collectSourceNotes, findRemoteImageUrls } = await loadSyncModule();
  const manifest = JSON.parse(await readFile(path.join(repoRoot, 'learning/pytorch/manifest.json'), 'utf8'));
  const notes = await collectSourceNotes(realSource, manifest);
  const stages = new Set(notes.filter((note) => !note.isOverview).map((note) => note.stageKey));
  const urls = new Set(findRemoteImageUrls(notes.map((note) => note.content).join('\n')));

  assert.equal(notes.length, 32);
  assert.equal(stages.size, 7);
  assert.equal(urls.size, 29);
  const routes = new Set(notes.map((note) => `notes/${note.stageKey}/${note.slug}.html`));
  for (const legacyRoute of legacyRoutes) assert.ok(routes.has(legacyRoute), `legacy URL changed: ${legacyRoute}`);
});

test('renders Markdown, wiki links, local images, and Python attachments without dead links', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();

  const result = await synchronize({ sourceRoot: source, outputRoot: output });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const main = manifest.notes.find((note) => note.title === 'Main');
  const html = await readFile(path.join(output, 'notes', main.stageKey, `${main.slug}.html`), 'utf8');

  assert.match(html, /<table>/);
  assert.match(html, /<ul>/);
  assert.match(html, /type="checkbox" disabled/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code class="language-js">/);
  assert.match(html, /href="\/learning\/pytorch\/notes\/stage-1\/other-note\.html"/);
  assert.match(html, />Wiki<\/a>/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /href="[^"]+">Unavailable<\/a>/);
  assert.match(html, /<img[^>]+src="\/learning\/pytorch\/assets\/stage-1\/plot\.png"/);
  assert.match(html, /<details class="source-attachment">/);
  assert.match(html, /download[^>]*>Download source<\/a>/);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Missing Note/);
});

test('stops on secrets and missing local images before writing output', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  const mainPath = path.join(source, 'Stage1', 'Main.md');

  await writeFile(mainPath, 'AKIAIOSFODNN7EXAMPLE\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /Stage1\/Main\.md:1.*credential/i,
  );

  await writeFile(mainPath, '![[Day5.py]]\n');
  await writeFile(path.join(source, 'Stage1', 'Day5.py'), 'AKIAIOSFODNN7EXAMPLE\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /Stage1\/Day5\.py:1.*credential/i,
  );

  await writeFile(path.join(source, 'Stage1', 'Day5.py'), 'print("safe")\n');
  await writeFile(mainPath, '![[does-not-exist.png]]\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /missing image.*does-not-exist\.png/i,
  );
});

test('fetches new remote images only with opt-in and requires the localized file afterward', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const remoteUrl = 'https://images.example.test/plot.png';
  const mainPath = path.join(source, 'Stage1', 'Main.md');
  await writeFile(mainPath, `![remote](${remoteUrl})\n`);
  const { synchronize } = await loadSyncModule();

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /new remote image.*--fetch-remote-assets/i,
  );
  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async (url) => {
      assert.equal(url, remoteUrl);
      return Buffer.from('remote-png');
    },
  });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const [assetPath] = Object.values(manifest.remoteAssets);
  assert.equal(await readFile(path.join(output, assetPath), 'utf8'), 'remote-png');

  await rm(path.join(output, assetPath));
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /missing localized remote image/i,
  );
});

test('--check detects drift and manifest cleanup never removes unmanaged files', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const unmanaged = path.join(output, 'assets', 'keep-me.txt');
  await writeFile(unmanaged, 'unmanaged');
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });

  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Changed\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /out of date/i,
  );
  await rm(path.join(source, 'Stage1', 'Other Note.md'));
  await synchronize({ sourceRoot: source, outputRoot: output });
  assert.equal(await readFile(unmanaged, 'utf8'), 'unmanaged');
  await assert.rejects(readFile(path.join(output, 'notes', 'stage-1', 'other-note.html'), 'utf8'), /ENOENT/);
});

test('overview article breadcrumb links back to the archive instead of a nonexistent stage', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(source, 'Roadmap.md'), '# Roadmap\n');
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'overview', 'roadmap.html'), 'utf8');

  assert.doesNotMatch(html, /href="\.\.\/\.\.\/overview\/"/);
  assert.match(html, /<span>学习路线<\/span>/);
});
