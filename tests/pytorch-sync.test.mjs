import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptUrl = pathToFileURL(path.join(repoRoot, 'scripts/sync-pytorch.mjs')).href;
const realSource = '/Users/yyy/Documents/知识库/Notes/Pytorch学习';
const tinyPng = Buffer.from('89504e470d0a1a0a', 'hex');
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
      '[[#Main|Wiki]]',
      '[[Missing Note|Unavailable]]',
      '![[plot.png]]',
      '[[Day5.py|Download source]]',
      '![[Day5.py]]',
    ].join('\n'),
  );
  return { root, source, output };
}

async function snapshotTree(root) {
  const snapshot = {};
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else snapshot[path.relative(root, absolute)] = (await readFile(absolute)).toString('base64');
    }
  }
  await walk(root);
  return snapshot;
}

async function writePublishOwner(transactionRoot, outputRoot) {
  const owner = {
    version: 1,
    kind: 'snowstorm-pytorch-sync',
    outputRoot: path.resolve(outputRoot),
    transactionId: '00000000-0000-4000-8000-000000000001',
    pid: 2147483647,
  };
  const serialized = `${JSON.stringify(owner, null, 2)}\n`;
  await writeFile(path.join(transactionRoot, 'owner.json'), serialized);
  await writeFile(path.join(path.dirname(transactionRoot), `.${path.basename(outputRoot)}-sync-owner.json`), serialized);
}

async function runInterruptedSync({ source, output, mode, check = false }) {
  const childSource = `
    import path from 'node:path';
    import * as fs from 'node:fs/promises';
    import { mock } from 'node:test';
    const [moduleUrl, sourceRoot, outputRoot, mode, check] = process.argv.slice(1);
    const publicRoot = path.resolve(outputRoot);
    const parent = path.dirname(publicRoot);
    const transactionRoot = path.join(parent, '.' + path.basename(publicRoot) + '-sync-transaction');
    const gcPrefix = '.' + path.basename(publicRoot) + '-sync-gc-';
    const rename = fs.rename;
    const rm = fs.rm;
    const mkdir = fs.mkdir;
    mock.module('node:fs/promises', {
      namedExports: {
        ...fs,
        mkdir: async (target, options) => {
          const result = await mkdir(target, options);
          if (mode === 'acquire' && path.resolve(target) === transactionRoot) {
            process.kill(process.pid, 'SIGKILL');
          }
          return result;
        },
        rename: async (from, to) => {
          await rename(from, to);
          const sourcePath = path.resolve(from);
          const destinationPath = path.resolve(to);
          if (mode === 'publish' && sourcePath.startsWith(path.join(transactionRoot, 'next') + path.sep)
            && destinationPath.startsWith(publicRoot + path.sep)) process.kill(process.pid, 'SIGKILL');
          if (mode === 'rotate' && sourcePath === transactionRoot
            && path.dirname(destinationPath) === parent && path.basename(destinationPath).startsWith(gcPrefix)) {
            process.kill(process.pid, 'SIGKILL');
          }
        },
        rm: async (target, options) => {
          await rm(target, options);
          const targetPath = path.resolve(target);
          if (mode === 'gc-delete' && path.dirname(targetPath).startsWith(path.join(parent, gcPrefix))) {
            process.kill(process.pid, 'SIGKILL');
          }
        },
      },
    });
    const { synchronize } = await import(moduleUrl + '?cleanup=' + Date.now());
    await synchronize({ sourceRoot, outputRoot, check: check === 'true' });
  `;
  const child = spawn(process.execPath, [
    '--experimental-test-module-mocks',
    '--input-type=module',
    '--eval',
    childSource,
    scriptUrl,
    source,
    output,
    mode,
    String(check),
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  return { ...exit, stderr };
}

async function runRemoteAssetReadRace({ source, output, assetPath, mode, replacement }) {
  const childSource = `
    import path from 'node:path';
    import * as fs from 'node:fs/promises';
    import { mock } from 'node:test';
    const [moduleUrl, sourceRoot, outputRoot, assetPath, mode, replacementHex] = process.argv.slice(1);
    const target = path.resolve(assetPath);
    const readFile = fs.readFile;
    const rename = fs.rename;
    const rm = fs.rm;
    const writeFile = fs.writeFile;
    let raced = false;
    mock.module('node:fs/promises', {
      namedExports: {
        ...fs,
        readFile: async (...args) => {
          if (raced || path.resolve(args[0]) !== target) return readFile(...args);
          const data = await readFile(...args);
          raced = true;
          if (mode === 'missing') {
            await rm(target);
            const error = new Error('injected remote asset disappearance');
            error.code = 'ENOENT';
            throw error;
          }
          const pending = target + '.replacement';
          await writeFile(pending, Buffer.from(replacementHex, 'hex'));
          await rename(pending, target);
          return data;
        },
      },
    });
    const { synchronize } = await import(moduleUrl + '?remote-read-race=' + Date.now());
    await synchronize({
      sourceRoot,
      outputRoot,
      fetchRemoteAssets: mode === 'missing',
      fetchAsset: async () => Buffer.from(replacementHex, 'hex'),
    });
  `;
  const child = spawn(process.execPath, [
    '--experimental-test-module-mocks',
    '--input-type=module',
    '--eval',
    childSource,
    scriptUrl,
    source,
    output,
    assetPath,
    mode,
    replacement.toString('hex'),
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  return { ...exit, stderr };
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

test('remote image discovery follows markdown-it image tokens and rejects protocol-relative sources', async (t) => {
  const { findRemoteImageUrls, synchronize } = await loadSyncModule();
  const balancedUrl = 'https://images.example.test/a_(b).png';
  const ignored = 'https://images.example.test/ignored.png';
  const markdown = [
    `![real](${balancedUrl})`,
    `\`![inline](${ignored})\``,
    `\\![escaped](${ignored})`,
    '```md',
    `![fenced](${ignored})`,
    '```',
    `<img src="${ignored}" alt="raw">`,
  ].join('\n');

  assert.deepEqual(findRemoteImageUrls(markdown), [balancedUrl]);

  const fixture = await makeFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await writeFile(path.join(fixture.source, 'Stage1', 'Main.md'), markdown);
  const requested = [];
  await synchronize({
    sourceRoot: fixture.source,
    outputRoot: fixture.output,
    fetchRemoteAssets: true,
    fetchAsset: async (url) => {
      requested.push(url);
      return tinyPng;
    },
  });
  assert.deepEqual(requested, [balancedUrl]);
  const manifest = JSON.parse(await readFile(path.join(fixture.output, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.remoteAssets), [balancedUrl]);

  await writeFile(path.join(fixture.source, 'Stage1', 'Main.md'), '![unsafe](//images.example.test/unsafe.png)\n');
  let fetches = 0;
  await assert.rejects(
    synchronize({
      sourceRoot: fixture.source,
      outputRoot: fixture.output,
      fetchRemoteAssets: true,
      fetchAsset: async () => {
        fetches += 1;
        return tinyPng;
      },
    }),
    /protocol-relative.*image/i,
  );
  assert.equal(fetches, 0);
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
  assert.match(html, /<ul(?: class="task-list")?>/);
  assert.match(html, /<li class="task-list-item"><input type="checkbox" disabled aria-labelledby="[^"]+"> <span id="[^"]+" class="task-description">todo<\/span>/);
  assert.match(html, /type="checkbox" disabled/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code class="language-js">/);
  assert.match(html, /href="\/learning\/pytorch\/notes\/stage-1\/other-note\.html"/);
  assert.match(html, />Markdown<\/a>/);
  assert.match(html, />Wiki<\/a>/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /href="[^"]+">Unavailable<\/a>/);
  assert.match(html, /<img[^>]+src="\/learning\/pytorch\/assets\/stage-1\/plot\.png"/);
  assert.match(html, /<details class="source-attachment">/);
  assert.match(html, /download[^>]*>Download source<\/a>/);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Missing Note/);
});

test('matching source H1 stays verbatim without a duplicate wrapper title', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(source, 'Stage1', 'No Heading.md'), 'Body without a source heading.\n');
  const { synchronize } = await loadSyncModule();
  const sourceMarkdown = await readFile(path.join(source, 'Stage1', 'Main.md'));

  await synchronize({ sourceRoot: source, outputRoot: output });
  const matching = await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8');
  const wrapped = await readFile(path.join(output, 'notes', 'stage-1', 'no-heading.html'), 'utf8');
  const publishedMarkdown = await readFile(path.join(output, 'markdown', 'stage-1', 'main.md'));

  assert.equal((matching.match(/<h1(?:\s[^>]*)?>Main<\/h1>/g) ?? []).length, 1);
  assert.match(matching, /<div class="note-content"><h1>Main<\/h1>/);
  assert.match(wrapped, /<article class="note-article"><h1>No Heading<\/h1><div class="note-content">/);
  assert.deepEqual(publishedMarkdown, sourceMarkdown, 'source Markdown bytes stay unchanged');
});

test('leading source H1 suppresses the filename wrapper for all five Stage 4 titles', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  const stage4 = path.join(source, 'Stage4');
  const cases = [
    [
      'Day 1 学习笔记：Attention 机制原理——Scaled Dot-Product Attention',
      'Attention 机制原理：Scaled Dot-Product Attention',
    ],
    [
      'Day 2 学习笔记：Multi-Head Attention——拆分与合并',
      'Multi-Head Attention：拆分与合并',
    ],
    [
      'Day 3 学习笔记：HuggingFace BERT tokenizer 与 DataLoader',
      'HuggingFace BERT tokenizer 与 DataLoader',
    ],
    [
      'Day 4 学习笔记：BERT 最小微调闭环',
      'BERT 最小微调闭环',
    ],
    [
      'Day 5 学习笔记：阶段四复盘——BERT 全量微调基线与 LoRA 对比准备',
      '阶段四 Day 5 复盘：BERT 全量微调基线与 LoRA 对比准备',
    ],
  ];
  await mkdir(stage4);
  for (const [filenameTitle, sourceHeading] of cases) {
    await writeFile(path.join(stage4, `${filenameTitle}.md`), `# ${sourceHeading}\n\nBody.\n`);
  }

  await synchronize({ sourceRoot: source, outputRoot: output });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  for (const [filenameTitle, sourceHeading] of cases) {
    const note = manifest.notes.find((candidate) => candidate.title === filenameTitle);
    assert.ok(note, `missing generated manifest entry for ${filenameTitle}`);
    const html = await readFile(path.join(output, 'notes', note.stageKey, `${note.slug}.html`), 'utf8');
    const headings = [...html.matchAll(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/g)].map((match) => match[1]);
    assert.deepEqual(headings, [sourceHeading], `${filenameTitle} must render one authoritative H1`);
    assert.equal(
      await readFile(path.join(output, 'markdown', note.stageKey, `${note.slug}.md`), 'utf8'),
      `# ${sourceHeading}\n\nBody.\n`,
      `${filenameTitle} source prose must stay byte-for-byte unchanged`,
    );
  }
});

test('disabled task states are labelled by their adjacent formatted descriptions', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await writeFile(path.join(source, 'Stage1', 'Main.md'), [
    '# Main',
    '',
    '- [ ] Prepare **batch**',
    '- [x] Verify [result](Other Note.md)',
  ].join('\n'));

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8');
  const descriptions = new Map(
    [...html.matchAll(/<span id="([^"]+)" class="task-description">([\s\S]*?)<\/span>/g)]
      .map((match) => [match[1], match[2]]),
  );
  const checkboxes = [...html.matchAll(/<input\b[^>]*\btype="checkbox"[^>]*>/g)].map((match) => match[0]);

  assert.equal(checkboxes.length, 2);
  assert.equal(descriptions.size, 2);
  for (const checkbox of checkboxes) {
    const labelledBy = /\baria-labelledby="([^"]+)"/.exec(checkbox)?.[1];
    assert.ok(labelledBy, `task checkbox has no accessible description: ${checkbox}`);
    assert.ok(descriptions.has(labelledBy), `missing adjacent description ${labelledBy}`);
    assert.ok(descriptions.get(labelledBy).replace(/<[^>]+>/g, '').trim());
    assert.match(checkbox, /\bdisabled\b/);
  }
  assert.match(html, /<span id="[^"]+" class="task-description">Prepare <strong>batch<\/strong><\/span>/);
  assert.match(html, /<span id="[^"]+" class="task-description">Verify <a [^>]*>result<\/a><\/span>/);
  assert.doesNotMatch(checkboxes[0], /\schecked(?:\s|>)/);
  assert.match(checkboxes[1], /\schecked(?:\s|>)/);
});

test('converts only safe raw breaks, hides OCR comments, labels images, and fully decodes TOC entities', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(source, 'Stage1', 'Main.md'),
    [
      '# Main',
      '',
      'Before<br>After',
      '',
      '| A | B |',
      '| --- | --- |',
      '| left<br/>right | value |',
      '',
      '<!-- 这是一张图片，ocr 内容为：OCR secret with',
      '',
      '`inline secret` inside -->',
      '![](attachments/plot.png)',
      '',
      '`<br>`',
      '`multi',
      '<br>',
      'line`',
      'Escaped \\<br>',
      '',
      'PYTORCH_SAFE_HTML_BREAK',
      'PYTORCH_SAFE_<!-- join -->HTML_BREAK',
      '',
      '```text',
      'PYTORCH_SAFE_HTML_BREAK',
      '```',
      '',
      '<!-- ocr 内容为：wiki chart -->',
      '![[plot.png]]',
      '',
      '![](attachments/plot.png)',
      '',
      '<!-- ocr 内容为：reference chart -->',
      '![][plot-ref]',
      '',
      '[plot-ref]: attachments/plot.png',
      '<script>unsafe()</script>',
      '',
      '## Entity &copy; &lt;tag&gt; &#x1F680;',
    ].join('\n'),
  );
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8');

  assert.match(html, /<p>Before<br>After<\/p>/);
  assert.match(html, /<td>left<br>right<\/td>/);
  assert.doesNotMatch(html, /<code>inline secret<\/code>|&lt;!--|<!--/);
  assert.match(html, /<img[^>]+alt="图示：OCR secret with inline secret inside"[^>]*>/);
  assert.match(html, /<code>&lt;br&gt;<\/code>/);
  assert.match(html, /<code>multi &lt;br&gt; line<\/code>/);
  assert.match(html, /Escaped &lt;br&gt;/);
  assert.match(html, /<p>PYTORCH_SAFE_HTML_BREAK\nPYTORCH_SAFE_HTML_BREAK<\/p>/);
  assert.match(html, /<code class="language-text">PYTORCH_SAFE_HTML_BREAK\n<\/code>/);
  assert.match(html, /<img[^>]+alt="图示：wiki chart"[^>]*>/);
  assert.match(html, /<img[^>]+alt="Main 图示"[^>]*>/);
  assert.match(html, /<img[^>]+alt="图示：reference chart"[^>]*>/);
  assert.match(html, /&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
  assert.match(html, /<li class="toc-level-2"><a href="#entity-tag">Entity © &lt;tag&gt; 🚀<\/a><\/li>/);
  assert.doesNotMatch(html, /&amp;lt;tag&amp;gt;/);
});

test('cross-stage article neighbors distinguish identical slugs by stage', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(source, 'Stage2'), { recursive: true });
  await writeFile(path.join(source, 'Stage1', 'Same.md'), '# Stage 1 Same\n');
  await writeFile(path.join(source, 'Stage2', 'Same.md'), '# Stage 2 Same\n');
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'stage-2', 'same.html'), 'utf8');
  const neighbors = html.match(/<nav class="article-neighbors"[\s\S]*?<\/nav>/)?.[0] ?? '';

  assert.match(neighbors, /class="article-neighbor previous" href="\/learning\/pytorch\/notes\/stage-1\/same\.html"/);
  assert.match(neighbors, /class="article-neighbor next" aria-hidden="true"/);
  assert.doesNotMatch(neighbors, /class="article-neighbor next" href="\/learning\/pytorch\/notes\/stage-2\/same\.html"/);
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

test('scans private-key and arbitrary small UTF-8 referenced attachments before writing output', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  const mainPath = path.join(source, 'Stage1', 'Main.md');
  const privatePem = path.join(source, 'Stage1', 'private.pem');
  const privateKey = path.join(source, 'Stage1', 'private.key');
  const script = path.join(source, 'Stage1', 'publish.js');

  await writeFile(privatePem, '-----BEGIN ENCRYPTED PRIVATE KEY-----\nnot-a-real-key\n');
  await writeFile(mainPath, '[[private.pem|Download PEM]]\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /Stage1\/private\.pem:1.*private key/i,
  );
  await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);

  await writeFile(privatePem, 'safe\n');
  await writeFile(privateKey, '-----BEGIN OPENSSH PRIVATE KEY-----\nnot-a-real-key\n');
  await writeFile(mainPath, '[[private.key|Download key]]\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /Stage1\/private\.key:1.*private key/i,
  );
  await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);

  await writeFile(privateKey, 'safe\n');
  await writeFile(script, 'const credential = "AKIAIOSFODNN7EXAMPLE";\n');
  await writeFile(mainPath, '[[publish.js|Download script]]\n');
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /Stage1\/publish\.js:1.*credential/i,
  );
  await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);
});

test('scans every published text attachment or rejects it before writing output', async (t) => {
  const { synchronize } = await loadSyncModule();
  const cases = [
    {
      name: 'large.js',
      content: `const credential = "AKIAIOSFODNN7EXAMPLE";\n${'x'.repeat(1024 * 1024)}`,
      error: /Stage1\/large\.js:1.*credential/i,
    },
    {
      name: 'large.py',
      content: `credential = "AKIAIOSFODNN7EXAMPLE"\n${'x'.repeat(1024 * 1024)}`,
      error: /Stage1\/large\.py:1.*credential/i,
    },
    {
      name: 'invalid-utf8.js',
      content: Buffer.concat([Buffer.from([0xff]), Buffer.from('AKIAIOSFODNN7EXAMPLE')]),
      error: /Stage1\/invalid-utf8\.js:1.*credential/i,
    },
    {
      name: 'nul.py',
      content: Buffer.from('safe\0AKIAIOSFODNN7EXAMPLE'),
      error: /Stage1\/nul\.py:1.*credential/i,
    },
    {
      name: 'payload.log',
      content: Buffer.concat([Buffer.from([0xff, 0x0a]), Buffer.from('AKIAIOSFODNN7EXAMPLE')]),
      error: /Stage1\/payload\.log:2.*credential/i,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async (subtest) => {
      const { root, source, output } = await makeFixture();
      subtest.after(() => rm(root, { recursive: true, force: true }));
      await writeFile(path.join(source, 'Stage1', fixture.name), fixture.content);
      await writeFile(path.join(source, 'Stage1', 'Main.md'), `[[${fixture.name}|Download]]\n`);

      await assert.rejects(
        synchronize({ sourceRoot: source, outputRoot: output }),
        fixture.error,
      );
      await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);
    });
  }
});

test('credential findings in Markdown or pending attachments prevent every remote fetch', async (t) => {
  const { synchronize } = await loadSyncModule();
  for (const location of ['markdown', 'attachment']) {
    await t.test(location, async (subtest) => {
      const { root, source, output } = await makeFixture();
      subtest.after(() => rm(root, { recursive: true, force: true }));
      const remote = 'https://images.example.test/never-requested.png';
      if (location === 'markdown') {
        await writeFile(path.join(source, 'Stage1', 'Main.md'), `AKIAIOSFODNN7EXAMPLE\n![remote](${remote})\n`);
      } else {
        await writeFile(path.join(source, 'Stage1', 'secret.js'), 'const key = "AKIAIOSFODNN7EXAMPLE";\n');
        await writeFile(path.join(source, 'Stage1', 'Main.md'), `[[secret.js|Download]]\n![remote](${remote})\n`);
      }
      let fetches = 0;
      await assert.rejects(
        synchronize({
          sourceRoot: source,
          outputRoot: output,
          fetchRemoteAssets: true,
          fetchAsset: async () => {
            fetches += 1;
            return tinyPng;
          },
        }),
        /credential scan/i,
      );
      assert.equal(fetches, 0, `${location} scanning finishes before remote I/O`);
    });
  }
});

test('same-stage attachments with the same basename cannot overwrite one another', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(source, 'Stage1', 'alpha'), { recursive: true });
  await mkdir(path.join(source, 'Stage1', 'beta'), { recursive: true });
  await writeFile(path.join(source, 'Stage1', 'alpha', 'shared.png'), 'alpha');
  await writeFile(path.join(source, 'Stage1', 'beta', 'shared.png'), 'beta');
  await writeFile(path.join(source, 'Stage1', 'alpha', 'Alpha.md'), '![alpha](shared.png)\n');
  await writeFile(path.join(source, 'Stage1', 'beta', 'Beta.md'), '![beta](shared.png)\n');
  const { synchronize } = await loadSyncModule();

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /attachment destination collision.*shared\.png/i,
  );
  await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);
});

test('case-folded attachment destinations cannot collide during deployment', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Main\n');
  await synchronize({ sourceRoot: source, outputRoot: output });
  const before = await snapshotTree(output);
  await mkdir(path.join(source, 'Stage1', 'alpha'), { recursive: true });
  await mkdir(path.join(source, 'Stage1', 'beta'), { recursive: true });
  await writeFile(path.join(source, 'Stage1', 'alpha', 'Plot.png'), 'alpha');
  await writeFile(path.join(source, 'Stage1', 'beta', 'plot.png'), 'beta');
  await writeFile(path.join(source, 'Stage1', 'alpha', 'Alpha.md'), '![alpha](Plot.png)\n');
  await writeFile(path.join(source, 'Stage1', 'beta', 'Beta.md'), '![beta](plot.png)\n');
  let writes = 0;

  await assert.rejects(
    synchronize({
      sourceRoot: source,
      outputRoot: output,
      writeFileImpl: async (...args) => {
        writes += 1;
        return writeFile(...args);
      },
    }),
    (error) => {
      assert.match(error.message, /attachment destination collision/i);
      assert.match(error.message, /alpha\/Plot\.png/);
      assert.match(error.message, /beta\/plot\.png/);
      return true;
    },
  );

  assert.equal(writes, 0, 'collision validation finishes before deployment staging');
  assert.deepEqual(await snapshotTree(output), before);
});

test('rejects traversal, absolute, and symlinked managed paths for manifest read, check, delete, and write', async (t) => {
  const { synchronize } = await loadSyncModule();

  await t.test('rejects traversal and absolute manifest entries before cleanup', async (subtest) => {
    for (const unsafeKind of ['traversal', 'absolute']) {
      const { root, source, output } = await makeFixture();
      subtest.after(() => rm(root, { recursive: true, force: true }));
      await synchronize({ sourceRoot: source, outputRoot: output });
      const outside = path.join(root, `${unsafeKind}-victim.txt`);
      await writeFile(outside, 'keep');
      const manifestPath = path.join(output, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.generatedFiles.push(unsafeKind === 'traversal' ? `../${unsafeKind}-victim.txt` : outside);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await assert.rejects(
        synchronize({ sourceRoot: source, outputRoot: output }),
        /unsafe generated manifest path/i,
      );
      assert.equal(await readFile(outside, 'utf8'), 'keep');
    }
  });

  await t.test('rejects a symlinked manifest before reading it', async (subtest) => {
    const { root, source, output } = await makeFixture();
    subtest.after(() => rm(root, { recursive: true, force: true }));
    await synchronize({ sourceRoot: source, outputRoot: output });
    const manifestPath = path.join(output, 'manifest.json');
    const outsideManifest = path.join(root, 'outside-manifest.json');
    await writeFile(outsideManifest, await readFile(manifestPath));
    await rm(manifestPath);
    await symlink(outsideManifest, manifestPath);

    await assert.rejects(
      synchronize({ sourceRoot: source, outputRoot: output }),
      /symlink.*manifest\.json/i,
    );
  });

  await t.test('rejects an intermediate symlink before deleting a managed file', async (subtest) => {
    const { root, source, output } = await makeFixture();
    subtest.after(() => rm(root, { recursive: true, force: true }));
    await synchronize({ sourceRoot: source, outputRoot: output });
    const outside = path.join(root, 'outside-delete');
    await mkdir(outside);
    const victim = path.join(outside, 'victim.txt');
    await writeFile(victim, 'keep');
    await symlink(outside, path.join(output, 'escape'));
    const manifestPath = path.join(output, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.generatedFiles.push('escape/victim.txt');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await assert.rejects(
      synchronize({ sourceRoot: source, outputRoot: output }),
      /symlink.*escape/i,
    );
    assert.equal(await readFile(victim, 'utf8'), 'keep');
  });

  await t.test('rejects an intermediate symlink before check reads a cached asset', async (subtest) => {
    const { root, source, output } = await makeFixture();
    subtest.after(() => rm(root, { recursive: true, force: true }));
    await synchronize({ sourceRoot: source, outputRoot: output });
    const remoteUrl = 'https://images.example.test/cached.png';
    await writeFile(path.join(source, 'Stage1', 'Main.md'), `![cached](${remoteUrl})\n`);
    const outside = path.join(root, 'outside-read');
    await mkdir(outside);
    await writeFile(path.join(outside, 'cached.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    await symlink(outside, path.join(output, 'assets', 'escape'));
    const manifestPath = path.join(output, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.remoteAssets[remoteUrl] = 'assets/escape/cached.png';
    manifest.generatedFiles.push('assets/escape/cached.png');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await assert.rejects(
      synchronize({ sourceRoot: source, outputRoot: output, check: true }),
      /symlink.*escape/i,
    );
  });

  await t.test('rejects an intermediate symlink before writing generated notes', async (subtest) => {
    const { root, source, output } = await makeFixture();
    subtest.after(() => rm(root, { recursive: true, force: true }));
    await synchronize({ sourceRoot: source, outputRoot: output });
    const outside = path.join(root, 'outside-write');
    await mkdir(outside);
    await rm(path.join(output, 'notes'), { recursive: true });
    await symlink(outside, path.join(output, 'notes'));

    await assert.rejects(
      synchronize({ sourceRoot: source, outputRoot: output }),
      /symlink.*notes/i,
    );
    await assert.rejects(readFile(path.join(outside, 'stage-1', 'main.html')), /ENOENT/);
  });
});

test('renders space-bearing Markdown note links without touching images or code examples', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(source, 'Stage1', 'Nested (Draft).md'), '# Nested\n');
  await writeFile(
    path.join(source, 'Stage1', 'Main.md'),
    [
      '[Markdown](Other Note.md)',
      '[Nested destination](Nested (Draft).md)',
      '![Local image](attachments/plot.png)',
      '`[Inline](Other Note.md)`',
      '``foo ` [Multi inline](Other Note.md)``',
      '`[Backslash inline](Other Note.md)\\`',
      '```md',
      '[Fenced](Other Note.md)',
      '```',
      '````md',
      '```',
      '[Long fenced](Other Note.md)',
      '~~~',
      '````',
    ].join('\n'),
  );
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8');

  assert.match(html, /href="\/learning\/pytorch\/notes\/stage-1\/other-note\.html">Markdown<\/a>/);
  assert.match(html, /href="\/learning\/pytorch\/notes\/stage-1\/nested-draft\.html">Nested destination<\/a>/);
  assert.match(html, /<img[^>]+src="\/learning\/pytorch\/assets\/stage-1\/plot\.png"/);
  assert.match(html, /<code>\[Inline\]\(Other Note\.md\)<\/code>/);
  assert.match(html, /<code>foo ` \[Multi inline\]\(Other Note\.md\)<\/code>/);
  assert.match(html, /<code>\[Backslash inline\]\(Other Note\.md\)\\<\/code>/);
  assert.match(html, /<code class="language-md">\[Fenced\]\(Other Note\.md\)/);
  assert.match(html, /<code class="language-md">```\n\[Long fenced\]\(Other Note\.md\)\n~~~/);
  assert.doesNotMatch(html, />Inline<\/a>|>Multi inline<\/a>|>Backslash inline<\/a>|>Fenced<\/a>|>Long fenced<\/a>/);
});

test('preserves external and site-absolute Markdown links when a local note shares the basename', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(source, 'Stage1', 'Main.md'),
    [
      '[HTTPS](https://example.test/Other%20Note.md)',
      '[FTP](ftp://example.test/Other%20Note.md)',
      '[Protocol relative](//example.test/Other%20Note.md)',
      '[Site absolute](/Other%20Note.md)',
      '[Mail](mailto:reader@example.test)',
    ].join('\n'),
  );
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8');

  assert.match(html, /href="https:\/\/example\.test\/Other%20Note\.md" rel="noreferrer">HTTPS<\/a>/);
  assert.match(html, /href="ftp:\/\/example\.test\/Other%20Note\.md">FTP<\/a>/);
  assert.match(html, /href="\/\/example\.test\/Other%20Note\.md">Protocol relative<\/a>/);
  assert.match(html, /href="\/Other%20Note\.md">Site absolute<\/a>/);
  assert.match(html, /href="mailto:reader@example\.test">Mail<\/a>/);
  assert.doesNotMatch(html, /other-note\.html">(?:HTTPS|FTP|Protocol relative|Site absolute|Mail)<\/a>/);
});

test('preserves links and task markers inside container fences and indented code', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(source, 'Stage1', 'Main.md'),
    [
      '> ```md',
      '> [Blockquote fenced](Other Note.md)',
      '> - [ ] blockquote task',
      '> ```',
      '',
      '- list item',
      '',
      '    ```md',
      '    [List fenced](Other Note.md)',
      '    - [x] list task',
      '    ```',
      '',
      '> - nested item',
      '>',
      '>   ```md',
      '>   [Nested fenced](Other Note.md)',
      '>   - [ ] nested task',
      '>   ```',
      '',
      '    [Indented](Other Note.md)',
      '    - [x] indented task',
    ].join('\n'),
  );
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const html = await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8');

  assert.match(html, /<code class="language-md">\[Blockquote fenced\]\(Other Note\.md\)\n- \[ \] blockquote task/);
  assert.match(html, /<code class="language-md">\[List fenced\]\(Other Note\.md\)\n- \[x\] list task/);
  assert.match(html, /<code class="language-md">\[Nested fenced\]\(Other Note\.md\)\n- \[ \] nested task/);
  assert.match(html, /<pre><code>\[Indented\]\(Other Note\.md\)\n- \[x\] indented task\n<\/code><\/pre>/);
  assert.doesNotMatch(html, /other-note\.html">(?:Blockquote fenced|List fenced|Nested fenced|Indented)<\/a>/);
});

test('rejects an HTML image response before writing any generated output', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const remoteUrl = 'https://images.example.test/not-an-image.png';
  await writeFile(path.join(source, 'Stage1', 'Main.md'), `![remote](${remoteUrl})\n`);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>login</html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const { synchronize } = await loadSyncModule();

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, fetchRemoteAssets: true }),
    /content-type.*text\/html/i,
  );
  await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);
});

test('validates remote protocols, redirects, timeouts, response types, raster signatures, and size limits', async (t) => {
  const { defaultFetchAsset } = await loadSyncModule();
  assert.equal(typeof defaultFetchAsset, 'function');
  const url = 'https://images.example.test/plot.png';

  await t.test('accepts a bounded PNG response and attaches a timeout signal', async () => {
    const result = await defaultFetchAsset(url, {
      fetchImpl: async (requestedUrl, options) => {
        assert.equal(requestedUrl, url);
        assert.equal(options.redirect, 'manual');
        assert.ok(options.signal);
        return new Response(tinyPng, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-length': String(tinyPng.length),
          },
        });
      },
      timeoutMs: 50,
      maxBytes: 32,
    });
    assert.deepEqual(result.data, tinyPng);
    assert.equal(result.contentType, 'image/png');
    assert.equal(result.finalUrl, url);
  });

  await t.test('rejects HTML and SVG content types', async () => {
    for (const contentType of ['text/html', 'image/svg+xml']) {
      await assert.rejects(
        defaultFetchAsset(url, {
          fetchImpl: async () => new Response('<svg></svg>', {
            status: 200,
            headers: { 'content-type': contentType },
          }),
        }),
        new RegExp(`content-type.*${contentType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      );
    }
  });

  await t.test('rejects content-type, magic, and URL-extension mismatches', async () => {
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response(Buffer.from('ffd8ff', 'hex'), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      }),
      /content-type.*does not match.*signature/i,
    );
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response(Buffer.from('not-raster'), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      }),
      /raster signature/i,
    );
    await assert.rejects(
      defaultFetchAsset('https://images.example.test/plot.jpg', {
        fetchImpl: async () => new Response(tinyPng, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      }),
      /extension.*does not match.*signature/i,
    );
  });

  await t.test('rejects declared and streamed bodies over the size limit', async () => {
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response(tinyPng, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-length': '33',
          },
        }),
        maxBytes: 32,
      }),
      /too large/i,
    );
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response(Buffer.concat([tinyPng, Buffer.alloc(25)]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
        maxBytes: 32,
      }),
      /too large/i,
    );
  });

  await t.test('rejects timeout, HTTP failure, unsafe initial and redirect protocols, and redirect loops', async () => {
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async (_requestedUrl, { signal }) => new Promise((resolve, reject) => {
          if (signal.aborted) reject(signal.reason);
          else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
        timeoutMs: 5,
      }),
      /timed out/i,
    );
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
      }),
      /failed \(503\)/i,
    );
    await assert.rejects(
      defaultFetchAsset('file:///tmp/image.png', { fetchImpl: async () => new Response(tinyPng) }),
      /unsupported remote image protocol/i,
    );
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response(null, {
          status: 302,
          headers: { location: 'file:///tmp/image.png' },
        }),
      }),
      /unsupported remote image protocol/i,
    );
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => new Response(null, {
          status: 302,
          headers: { location: '/again.png' },
        }),
        maxRedirects: 1,
      }),
      /too many redirects/i,
    );
  });
});

test('cancels unused response bodies without masking remote image errors', async (t) => {
  const { defaultFetchAsset } = await loadSyncModule();
  const url = 'https://images.example.test/plot.png';
  const pendingResponse = ({ status = 200, headers = {}, cancel }) => new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel,
    }),
    { status, headers },
  );

  await t.test('cancels a redirect body before following Location', async () => {
    let redirectedBodyCanceled = false;
    let calls = 0;
    const result = await defaultFetchAsset(url, {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return pendingResponse({
            status: 302,
            headers: { location: '/final.png' },
            cancel() {
              redirectedBodyCanceled = true;
            },
          });
        }
        return new Response(tinyPng, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        });
      },
    });

    assert.deepEqual(result.data, tinyPng);
    assert.equal(redirectedBodyCanceled, true);
  });

  await t.test('cancels bodies rejected from status, type, and declared length headers', async () => {
    const cases = [
      { status: 503, headers: {}, error: /failed \(503\)/i },
      { status: 200, headers: { 'content-type': 'text/html' }, error: /content-type.*text\/html/i },
      {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '33' },
        error: /too large/i,
        maxBytes: 32,
      },
    ];
    for (const fixture of cases) {
      let canceled = false;
      await assert.rejects(
        defaultFetchAsset(url, {
          fetchImpl: async () => pendingResponse({
            status: fixture.status,
            headers: fixture.headers,
            cancel() {
              canceled = true;
            },
          }),
          ...(fixture.maxBytes ? { maxBytes: fixture.maxBytes } : {}),
        }),
        fixture.error,
      );
      assert.equal(canceled, true);
    }
  });

  await t.test('keeps the primary validation error when canceling fails', async () => {
    await assert.rejects(
      defaultFetchAsset(url, {
        fetchImpl: async () => pendingResponse({
          headers: { 'content-type': 'text/html' },
          cancel() {
            throw new Error('cancel failed');
          },
        }),
      }),
      /content-type.*text\/html/i,
    );
  });
});

test('fetches new remote images only with opt-in and refetches a missing localized file only with opt-in', async (t) => {
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
      return tinyPng;
    },
  });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const [remoteEntry] = Object.values(manifest.remoteAssets);
  const assetPath = typeof remoteEntry === 'string' ? remoteEntry : remoteEntry.path;
  assert.deepEqual(await readFile(path.join(output, assetPath)), tinyPng);

  await rm(path.join(output, assetPath));
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /missing localized remote image/i,
  );
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /missing localized remote image/i,
  );

  const refetched = Buffer.concat([tinyPng, Buffer.from('refetched')]);
  let refetches = 0;
  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async (url) => {
      refetches += 1;
      assert.equal(url, remoteUrl);
      return refetched;
    },
  });
  const repairedManifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(refetches, 1);
  assert.deepEqual(await readFile(path.join(output, repairedManifest.remoteAssets[remoteUrl].path)), refetched);
  assert.equal(
    repairedManifest.remoteAssets[remoteUrl].sha256,
    createHash('sha256').update(refetched).digest('hex'),
  );
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });
});

test('manifest digests detect valid remote image substitution and normal sync does not bless it', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const remoteUrl = 'https://images.example.test/digest.png';
  const original = Buffer.concat([tinyPng, Buffer.from('original')]);
  const substituted = Buffer.concat([tinyPng, Buffer.from('substituted')]);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), `![remote](${remoteUrl})\n`);
  const { synchronize } = await loadSyncModule();

  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async () => original,
  });
  const manifestPath = path.join(output, 'manifest.json');
  const beforeManifest = await readFile(manifestPath);
  const manifest = JSON.parse(beforeManifest);
  const entry = manifest.remoteAssets[remoteUrl];
  const assetPath = path.join(output, typeof entry === 'string' ? entry : entry.path);
  await writeFile(assetPath, substituted);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /digest|integrity|checksum/i,
  );
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /digest|integrity|checksum/i,
  );
  let fetches = 0;
  await assert.rejects(
    synchronize({
      sourceRoot: source,
      outputRoot: output,
      fetchRemoteAssets: true,
      fetchAsset: async () => {
        fetches += 1;
        return original;
      },
    }),
    /digest|integrity|checksum/i,
  );
  assert.equal(fetches, 0, 'the fetch flag must not replace or bless an existing digest mismatch');
  assert.deepEqual(await readFile(manifestPath), beforeManifest, 'normal sync must not bless substituted bytes');
  assert.deepEqual(await readFile(assetPath), substituted, 'failed sync must leave the public asset untouched');
  assert.deepEqual(entry, {
    path: path.relative(output, assetPath),
    sha256: createHash('sha256').update(original).digest('hex'),
  });
});

test('an opted-in sync refetches a remote asset that disappears during its verified read', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const remoteUrl = 'https://images.example.test/disappearing.png';
  const original = Buffer.concat([tinyPng, Buffer.from('original')]);
  const refetched = Buffer.concat([tinyPng, Buffer.from('refetched')]);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), `![remote](${remoteUrl})\n`);
  const { synchronize } = await loadSyncModule();
  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async () => original,
  });
  const initialManifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const assetPath = path.join(output, initialManifest.remoteAssets[remoteUrl].path);

  const exit = await runRemoteAssetReadRace({
    source,
    output,
    assetPath,
    mode: 'missing',
    replacement: refetched,
  });

  assert.equal(exit.code, 0, exit.stderr);
  assert.equal(exit.signal, null);
  const repairedManifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  assert.deepEqual(await readFile(assetPath), refetched);
  assert.equal(repairedManifest.remoteAssets[remoteUrl].sha256, createHash('sha256').update(refetched).digest('hex'));
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });
});

test('normal sync rejects a structured remote asset swapped before ownership preflight', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const remoteUrl = 'https://images.example.test/preflight-swap.png';
  const original = Buffer.concat([tinyPng, Buffer.from('original')]);
  const substituted = Buffer.concat([tinyPng, Buffer.from('substituted')]);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), `![remote](${remoteUrl})\n`);
  const { synchronize } = await loadSyncModule();
  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async () => original,
  });
  const manifestPath = path.join(output, 'manifest.json');
  const beforeManifest = await readFile(manifestPath);
  const manifest = JSON.parse(beforeManifest);
  const assetPath = path.join(output, manifest.remoteAssets[remoteUrl].path);

  const exit = await runRemoteAssetReadRace({
    source,
    output,
    assetPath,
    mode: 'swap',
    replacement: substituted,
  });

  assert.notEqual(exit.code, 0, 'the late substitution must abort publication');
  assert.equal(exit.signal, null);
  assert.match(exit.stderr, /digest|integrity|checksum/i);
  assert.deepEqual(await readFile(manifestPath), beforeManifest);
  assert.deepEqual(await readFile(assetPath), substituted, 'the failed sync must not overwrite the replacement');
});

test('legacy path-only remote manifest entries upgrade to stable digests without refetching', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const remoteUrl = 'https://images.example.test/legacy.png';
  const original = Buffer.concat([tinyPng, Buffer.from('legacy')]);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), `![remote](${remoteUrl})\n`);
  const { synchronize } = await loadSyncModule();

  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async () => original,
  });
  const manifestPath = path.join(output, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.remoteAssets[remoteUrl];
  manifest.remoteAssets[remoteUrl] = typeof entry === 'string' ? entry : entry.path;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  let fetches = 0;
  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchAsset: async () => {
      fetches += 1;
      return original;
    },
  });
  const upgraded = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(fetches, 0);
  assert.deepEqual(upgraded.remoteAssets[remoteUrl], {
    path: typeof entry === 'string' ? entry : entry.path,
    sha256: createHash('sha256').update(original).digest('hex'),
  });
});

test('manifest loading enforces version, required field types, and unique generated paths', async (t) => {
  const cases = [
    {
      name: 'version',
      mutate(manifest) { manifest.version = 999; },
      error: /manifest.*version/i,
    },
    {
      name: 'missing generatedFiles',
      mutate(manifest) { delete manifest.generatedFiles; },
      error: /manifest.*generatedFiles/i,
    },
    {
      name: 'notes type',
      mutate(manifest) { manifest.notes = {}; },
      error: /manifest.*notes.*array/i,
    },
    {
      name: 'duplicate generated path',
      mutate(manifest) { manifest.generatedFiles.push(manifest.generatedFiles[0]); },
      error: /manifest.*duplicate.*path/i,
    },
    {
      name: 'case-fold duplicate generated path',
      mutate(manifest) { manifest.generatedFiles.push('MANIFEST.JSON'); },
      error: /manifest.*duplicate.*path/i,
    },
    {
      name: 'malformed remote asset digest',
      mutate(manifest) {
        manifest.remoteAssets['https://images.example.test/malformed.png'] = {
          path: 'manifest.json',
          sha256: 'not-a-sha256',
        };
      },
      error: /manifest.*remoteAssets.*sha256/i,
    },
  ];
  const { synchronize } = await loadSyncModule();

  for (const fixture of cases) {
    await t.test(fixture.name, async (subtest) => {
      const { root, source, output } = await makeFixture();
      subtest.after(() => rm(root, { recursive: true, force: true }));
      await synchronize({ sourceRoot: source, outputRoot: output });
      const manifestPath = path.join(output, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      fixture.mutate(manifest);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await assert.rejects(
        synchronize({ sourceRoot: source, outputRoot: output }),
        fixture.error,
      );
    });
  }
});

test('legacy manifest slugs are safe and case-fold unique before network or staging I/O', async (t) => {
  const cases = [
    {
      name: 'unsafe slug format',
      mutate(manifest) { manifest.notes.find((note) => note.title === 'Main').slug = 'bad_slug'; },
      error: /invalid pytorch manifest: notes\[\d+\]\.slug.*format/i,
    },
    {
      name: 'case-folded route collision',
      mutate(manifest) {
        manifest.notes.find((note) => note.title === 'Main').slug = 'Case-Slug';
        manifest.notes.find((note) => note.title === 'Other Note').slug = 'case-slug';
      },
      error: /invalid pytorch manifest:.*duplicate.*slug/i,
    },
  ];
  const { synchronize } = await loadSyncModule();

  for (const fixture of cases) {
    await t.test(fixture.name, async (subtest) => {
      const { root, source, output } = await makeFixture();
      subtest.after(() => rm(root, { recursive: true, force: true }));
      await synchronize({ sourceRoot: source, outputRoot: output });
      const manifestPath = path.join(output, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      fixture.mutate(manifest);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await writeFile(path.join(source, 'Stage1', 'Main.md'), '![remote](https://images.example.test/new.png)\n');
      const before = await snapshotTree(output);
      let fetches = 0;
      let writes = 0;

      await assert.rejects(
        synchronize({
          sourceRoot: source,
          outputRoot: output,
          fetchRemoteAssets: true,
          fetchAsset: async () => {
            fetches += 1;
            return tinyPng;
          },
          writeFileImpl: async (...args) => {
            writes += 1;
            return writeFile(...args);
          },
        }),
        fixture.error,
      );

      assert.equal(fetches, 0, 'manifest validation precedes network I/O');
      assert.equal(writes, 0, 'manifest validation precedes staging writes');
      assert.deepEqual(await snapshotTree(output), before);
      assert.deepEqual(
        (await readdir(root)).filter((entry) => entry.startsWith('.output-sync-')),
        [],
        'manifest validation does not create a staging directory',
      );
    });
  }
});

test('new notes deterministically avoid case-folded legacy routes before network or staging I/O', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { collectSourceNotes, synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  manifest.notes.find((note) => note.title === 'Main').slug = 'Case-Slug';
  manifest.notes.find((note) => note.title === 'Other Note').slug = 'case-slug-2';
  await writeFile(path.join(source, 'Stage1', 'case slug.md'), [
    '# case slug',
    '![remote](https://images.example.test/new.png)',
    '![[missing.png]]',
  ].join('\n'));

  const notes = await collectSourceNotes(source, manifest);
  assert.equal(notes.find((note) => note.title === 'Main').slug, 'Case-Slug');
  assert.equal(notes.find((note) => note.title === 'case slug').slug, 'case-slug-3');
  assert.equal(
    new Set(notes.map((note) => `${note.stageKey}/${note.slug}`.normalize('NFC').toLocaleLowerCase('en-US'))).size,
    notes.length,
  );

  let fetches = 0;
  let writes = 0;
  await assert.rejects(
    synchronize({
      sourceRoot: source,
      outputRoot: output,
      fetchRemoteAssets: true,
      fetchAsset: async () => {
        fetches += 1;
        return tinyPng;
      },
      writeFileImpl: async (...args) => {
        writes += 1;
        return writeFile(...args);
      },
    }),
    /missing image/i,
  );
  assert.equal(fetches, 0, 'route collection and local validation precede remote fetches');
  assert.equal(writes, 0, 'route collection and local validation precede staging writes');
});

test('a staged write failure leaves the complete previous published snapshot intact', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  await writeFile(path.join(output, 'assets', 'keep-me.txt'), 'unmanaged');
  const before = await snapshotTree(output);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Changed\n');
  let writes = 0;

  await assert.rejects(
    synchronize({
      sourceRoot: source,
      outputRoot: output,
      writeFileImpl: async (...args) => {
        writes += 1;
        if (writes === 3) throw new Error('injected staged write failure');
        return writeFile(...args);
      },
    }),
    /injected staged write failure/i,
  );

  assert.ok(writes >= 3, 'failure happened after publication staging began');
  assert.deepEqual(await snapshotTree(output), before);
});

test('next-only publication refuses a case-folded unmanaged target even when bytes match', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  await writeFile(path.join(source, 'Stage1', 'Fresh.md'), '# Fresh\n');

  const reference = path.join(root, 'reference');
  await synchronize({ sourceRoot: source, outputRoot: reference });
  const expected = await readFile(path.join(reference, 'notes', 'stage-1', 'fresh.html'));
  const unmanaged = path.join(output, 'notes', 'STAGE-1', 'FRESH.HTML');
  await mkdir(path.dirname(unmanaged), { recursive: true });
  await writeFile(unmanaged, expected);
  const before = await snapshotTree(output);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /unmanaged.*target|target.*unmanaged|ownership/i,
  );
  assert.deepEqual(await snapshotTree(output), before);
  assert.deepEqual(await readFile(unmanaged), expected);
});

test('a case-fold alias is still unmanaged when it resolves to the managed inode', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const manifestPath = path.join(output, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.generatedFiles = manifest.generatedFiles.map((entry) => (
    entry === 'notes/stage-1/main.html' ? 'notes/stage-1/MAIN.HTML' : entry
  ));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const before = await snapshotTree(output);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output }),
    /unmanaged.*target|target.*unmanaged|ownership/i,
  );
  assert.deepEqual(await snapshotTree(output), before);
});

test('a managed target replaced after preflight is not overwritten even when bytes match', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const target = path.join(output, 'notes', 'stage-1', 'main.html');
  const original = await readFile(target);
  const replacement = path.join(root, 'manual-main.html');
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Changed after preflight\n');
  let replaced = false;

  await assert.rejects(
    synchronize({
      sourceRoot: source,
      outputRoot: output,
      writeFileImpl: async (...args) => {
        if (!replaced) {
          replaced = true;
          await writeFile(replacement, original);
          await rename(replacement, target);
        }
        return writeFile(...args);
      },
    }),
    /ownership|changed after.*preflight|public target/i,
  );
  assert.equal(replaced, true, 'the replacement happened after ownership preflight');
  assert.deepEqual(await readFile(target), original, 'the same-content manual inode is preserved');
});

test('the final ownership revalidation directly precedes a managed replacement', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const target = path.join(output, 'notes', 'stage-1', 'main.html');
  const original = await readFile(target);
  const replacement = path.join(root, 'manual-main.html');
  await writeFile(replacement, original);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Changed after anchor creation\n');
  const childSource = `
    import path from 'node:path';
    import * as fs from 'node:fs/promises';
    import { mock } from 'node:test';
    const [moduleUrl, sourceRoot, outputRoot, replacement, target] = process.argv.slice(1);
    const transactionRoot = path.join(
      path.dirname(path.resolve(outputRoot)),
      '.' + path.basename(path.resolve(outputRoot)) + '-sync-transaction',
    );
    const publishedTarget = path.join(transactionRoot, 'published', 'notes', 'stage-1', 'main.html');
    const link = fs.link;
    const lstat = fs.lstat;
    const rename = fs.rename;
    let armed = false;
    let targetStats = 0;
    mock.module('node:fs/promises', {
      namedExports: {
        ...fs,
        link: async (from, to) => {
          await link(from, to);
          if (path.resolve(to) === publishedTarget) armed = true;
        },
        lstat: async (...args) => {
          const result = await lstat(...args);
          if (armed && path.resolve(args[0]) === path.resolve(target)) {
            targetStats += 1;
            if (targetStats === 2) {
              armed = false;
              await rename(replacement, target);
            }
          }
          return result;
        },
      },
    });
    const { synchronize } = await import(moduleUrl + '?replace-after-anchor=' + Date.now());
    await synchronize({ sourceRoot, outputRoot });
  `;
  const child = spawn(process.execPath, [
    '--experimental-test-module-mocks',
    '--input-type=module',
    '--eval',
    childSource,
    scriptUrl,
    source,
    output,
    replacement,
    target,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));

  assert.notEqual(exit.code, 0, 'the publication must reject the post-anchor replacement');
  assert.match(stderr, /ownership|changed after.*preflight|public target/i);
  assert.deepEqual(await readFile(target), original, 'the same-content manual inode is preserved');
});

test('prepared recovery preserves a same-content manual next-only target it did not publish', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  await writeFile(path.join(source, 'Stage1', 'Fresh.md'), '# Fresh\n');
  const transactionRoot = path.join(root, '.output-sync-transaction');
  const childSource = `
    import path from 'node:path';
    import * as fs from 'node:fs/promises';
    import { mock } from 'node:test';
    const [moduleUrl, sourceRoot, outputRoot, transactionRoot] = process.argv.slice(1);
    const rename = fs.rename;
    mock.module('node:fs/promises', {
      namedExports: {
        ...fs,
        rename: async (from, to) => {
          await rename(from, to);
          if (path.resolve(to) === path.join(path.resolve(transactionRoot), 'journal.json')) {
            const journal = JSON.parse(await fs.readFile(to, 'utf8'));
            if (journal.state === 'prepared') process.kill(process.pid, 'SIGKILL');
          }
        },
      },
    });
    const { synchronize } = await import(moduleUrl + '?prepared=' + Date.now());
    await synchronize({ sourceRoot, outputRoot });
  `;
  const child = spawn(process.execPath, [
    '--experimental-test-module-mocks',
    '--input-type=module',
    '--eval',
    childSource,
    scriptUrl,
    source,
    output,
    transactionRoot,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  assert.equal(exit.signal, 'SIGKILL', `child did not stop at prepared journal: ${stderr}`);

  const staged = await readFile(path.join(transactionRoot, 'next', 'notes', 'stage-1', 'fresh.html'));
  const manual = path.join(output, 'notes', 'stage-1', 'fresh.html');
  await writeFile(manual, staged);
  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /out of date/i,
  );
  assert.deepEqual(await readFile(manual), staged);
});

test('an incomplete publish journal is rejected without touching the public snapshot', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  await writeFile(path.join(output, 'assets', 'keep-me.txt'), 'unmanaged');
  const before = await snapshotTree(output);
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const transactionRoot = path.join(root, '.output-sync-transaction');
  await mkdir(transactionRoot);
  await writePublishOwner(transactionRoot, output);
  await writeFile(path.join(transactionRoot, 'journal.json'), `${JSON.stringify({
    version: 1,
    state: 'prepared',
    previousFiles: manifest.generatedFiles,
    nextFiles: manifest.generatedFiles,
  }, null, 2)}\n`);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /invalid pytorch publish journal.*next manifest/i,
  );
  assert.deepEqual(await snapshotTree(output), before);
});

test('an unowned fixed transaction directory fails closed without deleting its contents', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const before = await snapshotTree(output);
  const transactionRoot = path.join(root, '.output-sync-transaction');
  const foreign = path.join(transactionRoot, 'do-not-delete.txt');
  await mkdir(transactionRoot);
  await writeFile(foreign, 'foreign bytes');

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /unowned|ownership|owner marker/i,
  );
  assert.equal(await readFile(foreign, 'utf8'), 'foreign bytes');
  assert.deepEqual(await snapshotTree(output), before);
});

test('an empty unowned fixed transaction directory also fails closed', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const transactionRoot = path.join(root, '.output-sync-transaction');
  await mkdir(transactionRoot);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /unowned|ownership|owner marker/i,
  );
  assert.deepEqual(await readdir(transactionRoot), []);
});

test('--help states the exclusive-worktree concurrency boundary', async () => {
  const child = spawn(process.execPath, [fileURLToPath(scriptUrl), '--help'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));

  assert.deepEqual(exit, { code: 0, signal: null });
  assert.equal(stderr, '');
  assert.match(stdout, /exclusive worktree/i);
  assert.match(stdout, /owner sidecar excludes only another sync-pytorch process/i);
  assert.match(stdout, /editors, deployers, or other processes must not modify manifest-managed output/i);
  assert.match(stdout, /protection is not guaranteed/i);
});

test('owner acquisition precedes generation so a stale participant cannot orphan newer outputs', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await writeFile(path.join(source, 'Stage1', 'Main.md'), [
    '# Main',
    '![remote](https://images.example.test/paused.png)',
  ].join('\n'));
  await synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async () => tinyPng,
  });
  const initialManifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const remotePath = initialManifest.remoteAssets['https://images.example.test/paused.png'].path;
  await rm(path.join(output, remotePath));

  let announceFetch;
  let releaseFetch;
  const fetchStarted = new Promise((resolve) => { announceFetch = resolve; });
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const staleRun = synchronize({
    sourceRoot: source,
    outputRoot: output,
    fetchRemoteAssets: true,
    fetchAsset: async () => {
      announceFetch();
      await fetchGate;
      return tinyPng;
    },
  });
  await fetchStarted;

  const freshSource = path.join(source, 'Stage1', 'Fresh.md');
  await writeFile(freshSource, '# Fresh\n');
  let competingError;
  try {
    await synchronize({
      sourceRoot: source,
      outputRoot: output,
      fetchRemoteAssets: true,
      fetchAsset: async () => tinyPng,
    });
  } catch (error) {
    competingError = error;
  } finally {
    await rm(freshSource);
    releaseFetch();
  }
  await staleRun;
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });

  assert.match(
    competingError?.message || '',
    /active|busy|in progress|acquire/i,
    'the participant that starts after ownership is held must fail before publishing',
  );
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.notes.some((note) => note.title === 'Fresh'), false);
  await assert.rejects(
    readFile(path.join(output, 'notes', 'stage-1', 'fresh.html')),
    { code: 'ENOENT' },
    'a rejected participant must not leave a generated file outside the winning manifest',
  );
});

test('a live publish transaction is exclusive and a dead owner is recoverable', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const childSource = `
    import * as fs from 'node:fs/promises';
    const [moduleUrl, sourceRoot, outputRoot] = process.argv.slice(1);
    const { synchronize } = await import(moduleUrl + '?active=' + Date.now());
    let announced = false;
    await synchronize({
      sourceRoot,
      outputRoot,
      writeFileImpl: async (...args) => {
        await fs.writeFile(...args);
        if (!announced) {
          announced = true;
          process.stdout.write('READY\\n');
          await new Promise(() => {});
        }
      },
    });
  `;
  const child = spawn(process.execPath, [
    '--input-type=module',
    '--eval',
    childSource,
    scriptUrl,
    source,
    output,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let exited = false;
  child.once('exit', () => { exited = true; });
  t.after(async () => {
    if (!exited) child.kill('SIGKILL');
    if (!exited) await new Promise((resolve) => child.once('exit', resolve));
  });
  await new Promise((resolve, reject) => {
    let stdout = '';
    const timeout = setTimeout(() => reject(new Error('active sync did not reach staging')), 5000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('READY\n')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`active sync exited early (${code ?? signal})`));
    });
  });

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /active|busy|in progress|acquire/i,
  );
  await readFile(path.join(root, '.output-sync-transaction', 'owner.json'));

  child.kill('SIGKILL');
  await new Promise((resolve) => child.once('exit', resolve));
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith('.output-sync-')),
    [],
  );
});

test('SIGKILL after exclusive acquisition but before the inner marker converges', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });

  const exit = await runInterruptedSync({ source, output, mode: 'acquire' });
  assert.equal(exit.signal, 'SIGKILL', `acquisition was not interrupted: ${exit.stderr}`);
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith('.output-sync-')),
    [],
  );
});

test('SIGKILL during publication keeps the public root and every old URL recoverable', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  await writeFile(path.join(output, 'assets', 'keep-me.txt'), 'unmanaged');
  const previousManifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const before = await snapshotTree(output);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Changed after interruption\n');
  const childSource = `
    import path from 'node:path';
    import * as fs from 'node:fs/promises';
    import { mock } from 'node:test';
    const [moduleUrl, sourceRoot, outputRoot] = process.argv.slice(1);
    const publicRoot = path.resolve(outputRoot);
    const rename = fs.rename;
    mock.module('node:fs/promises', {
      namedExports: {
        ...fs,
        rename: async (from, to) => {
          await rename(from, to);
          const sourcePath = path.resolve(from);
          const destinationPath = path.resolve(to);
          if (sourcePath === publicRoot || destinationPath.startsWith(publicRoot + path.sep)) {
            process.kill(process.pid, 'SIGKILL');
          }
        },
      },
    });
    const { synchronize } = await import(moduleUrl + '?sigkill=' + Date.now());
    await synchronize({ sourceRoot, outputRoot });
  `;
  const child = spawn(process.execPath, [
    '--experimental-test-module-mocks',
    '--input-type=module',
    '--eval',
    childSource,
    scriptUrl,
    source,
    output,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  assert.equal(exit.signal, 'SIGKILL', `child was not interrupted during publish: ${stderr}`);
  for (const relativePath of previousManifest.generatedFiles) {
    await readFile(path.join(output, relativePath));
  }
  assert.equal(await readFile(path.join(output, 'assets', 'keep-me.txt'), 'utf8'), 'unmanaged');

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /out of date/i,
  );
  assert.deepEqual(await snapshotTree(output), before, 'the next run recovers the complete old snapshot before checking');
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith('.output-sync-')),
    [],
    'recovery removes the interrupted transaction',
  );

  await synchronize({ sourceRoot: source, outputRoot: output });
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });
  assert.match(
    await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8'),
    /Changed after interruption/,
  );
});

test('SIGKILL during prepared cleanup converges through an owned GC handoff', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  await writeFile(path.join(output, 'assets', 'keep-me.txt'), 'unmanaged');
  const before = await snapshotTree(output);
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Prepared cleanup interruption\n');

  const publishExit = await runInterruptedSync({ source, output, mode: 'publish' });
  assert.equal(publishExit.signal, 'SIGKILL', `publication was not interrupted: ${publishExit.stderr}`);
  const cleanupExit = await runInterruptedSync({ source, output, mode: 'rotate', check: true });
  assert.equal(cleanupExit.signal, 'SIGKILL', `prepared cleanup did not reach GC handoff: ${cleanupExit.stderr}`);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /out of date/i,
  );
  assert.deepEqual(await snapshotTree(output), before);
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith('.output-sync-')),
    [],
  );
});

test('SIGKILL during committed GC deletion converges without touching unmanaged files', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();
  await synchronize({ sourceRoot: source, outputRoot: output });
  const unmanaged = path.join(output, 'assets', 'keep-me.txt');
  await writeFile(unmanaged, 'unmanaged');
  await rm(path.join(source, 'Stage1', 'Other Note.md'));
  await writeFile(path.join(source, 'Stage1', 'Main.md'), '# Committed cleanup interruption\n');

  const exit = await runInterruptedSync({ source, output, mode: 'gc-delete' });
  assert.equal(exit.signal, 'SIGKILL', `committed cleanup was not interrupted: ${exit.stderr}`);
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });

  assert.equal(await readFile(unmanaged, 'utf8'), 'unmanaged');
  await assert.rejects(readFile(path.join(output, 'notes', 'stage-1', 'other-note.html')), /ENOENT/);
  assert.match(await readFile(path.join(output, 'notes', 'stage-1', 'main.html'), 'utf8'), /Committed cleanup interruption/);
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith('.output-sync-')),
    [],
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

test('--check detects a missing managed article and normal sync restores it', async (t) => {
  const { root, source, output } = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { synchronize } = await loadSyncModule();

  await synchronize({ sourceRoot: source, outputRoot: output });
  const article = path.join(output, 'notes', 'stage-1', 'main.html');
  const expected = await readFile(article);
  await rm(article);

  await assert.rejects(
    synchronize({ sourceRoot: source, outputRoot: output, check: true }),
    /out of date/i,
  );
  await synchronize({ sourceRoot: source, outputRoot: output });
  assert.deepEqual(await readFile(article), expected);
  await synchronize({ sourceRoot: source, outputRoot: output, check: true });
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
