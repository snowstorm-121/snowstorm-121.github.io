import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const legacyPages = ['archives/index.html', 'archives/2023/index.html', 'archives/2023/12/index.html', '2023/12/22/hello-world/index.html'];

for (const path of legacyPages) {
  test(`removed legacy page is absent: ${path}`, async () => {
    await assert.rejects(access(new URL(path, root)), { code: 'ENOENT' });
  });
}

test('live HTML has no links to removed legacy routes', async () => {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await inspect(url);
      else if (entry.name.endsWith('.html') && !legacyPages.includes(url.href.slice(root.href.length))) {
        assert.doesNotMatch(await readFile(url, 'utf8'), /\/archives(?:\/|")|\/2023\/12\/22\/hello-world\//, url.href);
      }
    }
  }
  await inspect(root);
});

test('all manifest notes and seven stage indexes remain published', async () => {
  const manifest = JSON.parse(await readFile(new URL('learning/pytorch/manifest.json', root), 'utf8'));
  assert.equal(manifest.notes.length, 32);
  assert.equal(manifest.stages.length, 7);
  for (const note of manifest.notes) await access(new URL(`learning/pytorch/notes/${note.stageKey}/${note.slug}.html`, root));
  for (const stage of manifest.stages) await access(new URL(`learning/pytorch/${stage.key}/index.html`, root));
});

test('archive accent text meets AA on light paper while preserving the design accent', async () => {
  const css = await readFile(new URL('assets/archive-directory.css', root), 'utf8');
  assert.match(css, /\.archive-page\s*\{[^}]*--archive-accent-text:\s*#805a35/i);
  assert.match(css, /\[data-reading-theme="dark"\]\s+\.archive-page\s*\{[^}]*--archive-accent-text:\s*var\(--reading-accent\)/);
  assert.doesNotMatch(css, /color:\s*var\(--reading-accent\)/);
  const luminance = (hex) => {
    const rgb = hex.match(/\w\w/g).map((channel) => parseInt(channel, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  assert.ok((luminance('f4f0e9') + .05) / (luminance('805a35') + .05) >= 4.5);
});

test('learning directory introduction applies to every selectable stage', async () => {
  const html = await readFile(new URL('learning/index.html', root), 'utf8');
  assert.match(html, /按学习顺序阅读本阶段的笔记，或进入阶段页查看完整目录。/);
  assert.doesNotMatch(html, /从 Python、NumPy 与数据分析开始/);
});
