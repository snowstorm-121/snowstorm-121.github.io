import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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
      return tinyPng;
    },
  });
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  const [assetPath] = Object.values(manifest.remoteAssets);
  assert.deepEqual(await readFile(path.join(output, assetPath)), tinyPng);

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
