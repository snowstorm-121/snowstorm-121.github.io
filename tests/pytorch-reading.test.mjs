import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveRoot = path.join(repoRoot, 'learning', 'pytorch');
const manifest = JSON.parse(await readFile(path.join(archiveRoot, 'manifest.json'), 'utf8'));

const readArchive = (relativePath) => readFile(path.join(archiveRoot, relativePath), 'utf8');
const notePath = (note) => path.join(archiveRoot, 'notes', note.stageKey, `${note.slug}.html`);
const noteUrl = (note) => `/learning/pytorch/notes/${note.stageKey}/${encodeURIComponent(note.slug)}.html`;

test('PyTorch archive presents its seven ordered stages as a tide timeline', async () => {
  const index = await readArchive('index.html');

  assert.match(index, /class="pytorch-tide-timeline"[^>]*data-stage-count="7"/);
  const stageKeys = [...index.matchAll(/class="tide-stage"[^>]*data-stage-key="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(stageKeys, manifest.stages.map((stage) => stage.key));

  for (const stage of manifest.stages) {
    const count = manifest.notes.filter((note) => note.stageKey === stage.key).length;
    assert.match(index, new RegExp(`data-stage-key="${stage.key}"[\\s\\S]*?${count} 篇`));
    assert.match(index, new RegExp(`href="\\./${stage.key}\\/"`));
  }
});

test('stage pages retain manifest article order, counts, and adjacent-stage navigation', async () => {
  for (const [stageIndex, stage] of manifest.stages.entries()) {
    const page = await readArchive(`${stage.key}/index.html`);
    const notes = manifest.notes.filter((note) => note.stageKey === stage.key);

    assert.match(page, new RegExp(`class="stage-note-count"[^>]*>${notes.length} 篇`));
    const orderedUrls = [...page.matchAll(/class="stage-note-link"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(orderedUrls, notes.map(noteUrl));
    if (stageIndex > 0) assert.match(page, new RegExp(`class="stage-neighbor previous"[\\s\\S]*?href="\\.\\./${manifest.stages[stageIndex - 1].key}\\/"`));
    if (stageIndex < manifest.stages.length - 1) assert.match(page, new RegExp(`class="stage-neighbor next"[\\s\\S]*?href="\\.\\./${manifest.stages[stageIndex + 1].key}\\/"`));
  }
});

test('generated archive shells do not add trailing whitespace', async () => {
  for (const relativePath of ['index.html', ...manifest.stages.map((stage) => `${stage.key}/index.html`)]) {
    assert.doesNotMatch(await readArchive(relativePath), /[ \t]+\n/);
  }
});

test('article pages use a narrow reading shell with a collapsible table of contents, progress, and route links', async () => {
  const sample = manifest.notes.find((note) => note.stageKey === 'stage-1');
  const stageNotes = manifest.notes.filter((note) => note.stageKey === sample.stageKey);
  const article = await readFile(notePath(sample), 'utf8');

  assert.match(article, /class="[^"]*pytorch-reading-page(?:\s|\")/);
  assert.match(article, /class="reading-progress"[^>]*data-reading-progress/);
  assert.match(article, /class="reading-layout"/);
  assert.match(article, /class="reading-toc"/);
  assert.match(article, /<details class="reading-toc-details" open>/);
  assert.match(article, /href="\/learning\/"[^>]*>[^<]*返回星图</);
  assert.match(article, /class="article-neighbors"/);
  assert.match(article, new RegExp(`href="${noteUrl(stageNotes[1]).replaceAll('/', '\\/')}"`));

  const rawMarkdown = await readArchive(`markdown/${sample.stageKey}/${sample.slug}.md`);
  assert.match(rawMarkdown, /MacBook Air M5|torch\.tensor/);
  const localPathNote = manifest.notes.find((note) => note.title.includes('matplotlib'));
  const localPathMarkdown = await readArchive(`markdown/${localPathNote.stageKey}/${localPathNote.slug}.md`);
  assert.match(localPathMarkdown, /\/Users\/yyy|\/opt\/miniconda3|pytorch_env/);
});

test('reading styles preserve a still, system-cursor long-form experience and glass treatment for note content', async () => {
  const css = await readFile(path.join(repoRoot, 'assets', 'pytorch-reading.css'), 'utf8');

  assert.match(css, /body\.pytorch-reading-page[\s\S]*?cursor:\s*auto/);
  assert.match(css, /\.reading-layout[\s\S]*?minmax\(0,\s*46rem\)/);
  assert.match(css, /\.note-content table[\s\S]*?backdrop-filter/);
  assert.match(css, /\.note-content pre[\s\S]*?background:/);
  assert.match(css, /\.note-content blockquote[\s\S]*?border-left:/);
  assert.match(css, /\.note-content input\[type="checkbox"\][\s\S]*?accent-color/);
  assert.match(css, /\.note-content img[\s\S]*?border:/);
  assert.match(css, /\.source-attachment[\s\S]*?backdrop-filter/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.reading-toc[\s\S]*?position:\s*static/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*?\.reading-toc-details summary[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none[\s\S]*?transition:\s*none/);
});

test('reading progress updates without animation frames and remains bounded', async () => {
  const script = await readFile(path.join(repoRoot, 'assets', 'pytorch-reading.js'), 'utf8');
  const progress = { style: { setProperty(name, value) { this[name] = value; } } };
  const document = {
    body: { scrollHeight: 1200, scrollTop: 300 },
    documentElement: { scrollHeight: 1200, clientHeight: 600, scrollTop: 300 },
    querySelector(selector) { return selector === '[data-reading-progress]' ? progress : null; },
    querySelectorAll() { return []; },
  };
  const window = { addEventListener() {}, document };
  vm.runInNewContext(script, { window, document });

  window.PyTorchReading.refreshProgress();
  assert.equal(progress.style['--reading-progress'], '50%');
  assert.doesNotMatch(script, /requestAnimationFrame/);
});
