import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const published = JSON.parse(await readFile(new URL("../learning/pytorch/atlas-relations.json", import.meta.url), "utf8"));
const sourceUrl = new URL("../assets/learning-directory.js", import.meta.url);
class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.textContent = ""; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  replaceWith(child) { const i = this.parent.children.indexOf(this); child.parent = this.parent; this.parent.children[i] = child; }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  fire(type, key) { const event = { key, preventDefault() {} }; (this.listeners[type] ?? []).forEach(listener => listener(event)); }
}
async function boot(data = structuredClone(published), failure = null) {
  const root = new Element();
  root.dataset.relationsUrl = "/learning/pytorch/atlas-relations.json";
  const index = new Element("nav");
  const anchors = published.stages.map(stage => {
    const anchor = new Element("a");
    anchor.dataset.stageKey = stage.key;
    anchor.textContent = stage.label;
    anchor.setAttribute("href", `/learning/pytorch/${stage.href.slice(2)}`);
    index.append(anchor);
    return anchor;
  });
  const outputs = Object.fromEntries(["articles", "title", "count", "destination", "status"].map(name => [name, new Element(name === "destination" ? "a" : "div")]));
  root.querySelector = selector => outputs[selector.match(/data-directory-(\w+)/)?.[1]] ?? null;
  root.querySelectorAll = () => anchors;
  const created = [];
  const requests = [];
  const document = {
    querySelector: () => root,
    createElement(tag) { created.push(tag); return new Element(tag); },
  };
  const source = await readFile(sourceUrl, "utf8").catch(error => error.code === "ENOENT" ? "" : Promise.reject(error));
  vm.runInNewContext(source, { document, fetch: async url => {
    requests.push(url);
    if (failure === "network") throw new Error("unavailable");
    return { ok: failure !== "http", json: async () => { if (failure === "json") throw new SyntaxError("invalid"); return data; } };
  } });
  await new Promise(resolve => setImmediate(resolve));
  return { root, index, anchors, outputs, created, requests, source };
}
function links(element) { return element.children.flatMap(child => child.tagName === "A" ? [child] : links(child)); }
function assertStage(ui, stageKey) {
  const notes = published.notes.filter(note => note.stageKey === stageKey);
  const rendered = links(ui.outputs.articles);
  assert.deepEqual(rendered.map(link => link.getAttribute("href")), notes.map(note => note.href));
  assert.deepEqual(rendered.map(link => link.textContent), notes.map(note => note.title));
  assert.equal(ui.outputs.title.textContent, published.stages.find(stage => stage.key === stageKey).label);
  assert.equal(ui.outputs.count.textContent, `${notes.length} 篇`);
  assert.equal(ui.outputs.destination.getAttribute("href"), ui.anchors.find(anchor => anchor.dataset.stageKey === stageKey).getAttribute("href"));
  assert.deepEqual(ui.index.children.map(button => button.getAttribute("aria-pressed")), published.stages.map(stage => String(stage.key === stageKey)));
}
test("verified data defaults to the exact ten foundation articles and native buttons", async () => {
  const ui = await boot();
  assertStage(ui, "foundation");
  assert.equal(links(ui.outputs.articles).length, 10);
  assert.deepEqual(ui.index.children.map(button => button.tagName), Array(8).fill("BUTTON"));
  assert.deepEqual(ui.index.children.map(button => button.getAttribute("type")), Array(8).fill("button"));
  assert.deepEqual(ui.requests, [ui.root.dataset.relationsUrl]);
});
test("all eight click selections preserve all 32 published note titles, URLs and order", async () => {
  const ui = await boot();
  const union = [];
  for (const stage of published.stages) {
    ui.index.children.find(button => button.dataset.stageKey === stage.key).fire("click");
    assertStage(ui, stage.key);
    union.push(...links(ui.outputs.articles).map(link => link.getAttribute("href")));
  }
  assert.deepEqual(union, published.notes.map(note => note.href));
  assert.equal(union.length, 32);
});
test("Enter and Space select stages; hover and focus leave the selection alone", async () => {
  const ui = await boot();
  ui.index.children[0].fire("keydown", "Enter");
  assertStage(ui, "overview");
  assert.equal(links(ui.outputs.articles).length, 1);
  ui.index.children[2].fire("keydown", " ");
  assertStage(ui, "stage-1");
  ui.index.children[3].fire("pointerenter");
  ui.index.children[3].fire("focus");
  ui.index.children[3].fire("keydown", "Escape");
  assertStage(ui, "stage-1");
});
const invalidCases = [
  ["version", data => { data.version = 2; }],
  ["missing array", data => { delete data.references; }],
  ["stage order", data => { data.stages.reverse(); }],
  ["stage URL", data => { data.stages[0].href = "https://example.com/"; }],
  ["stage label", data => { data.stages[0].label = ""; }],
  ["duplicate note ID", data => { data.notes[1].id = data.notes[0].id; }],
  ["noncontiguous order", data => { data.notes[1].order = 100; }],
  ["note array order", data => { data.notes.reverse(); }],
  ["stage note order", data => { data.stages[1].noteIds.reverse(); }],
  ["wrong stage ownership", data => { data.notes[1].stageKey = "overview"; }],
  ["missing stage member", data => { data.stages[1].noteIds.pop(); }],
  ["invalid sequence", data => { data.sequence[0].to = "unknown"; }],
  ["invalid reference", data => { data.references.push({ from: data.notes[0].id, to: "unknown" }); }],
  ["self reference", data => { data.references.push({ from: data.notes[0].id, to: data.notes[0].id }); }],
  ["duplicate reference", data => { data.references.push(data.references[0]); }],
  ...["/outside/note.html", "javascript:alert(1)", "/learning/pytorch/notes/../note.html", "/learning/pytorch/notes/%2e%2e/note.html"].map(href => [href, data => { data.notes[0].href = href; }]),
];
for (const [label, mutate] of invalidCases) test(`invalid ${label} preserves all static anchors`, async () => {
  const data = structuredClone(published); mutate(data);
  const ui = await boot(data);
  assert.deepEqual(ui.index.children, ui.anchors);
  assert.equal(ui.outputs.status.textContent, "文章列表暂不可用");
  assert.equal(links(ui.outputs.articles).length, 0);
});
for (const failure of ["network", "http", "json"]) test(`${failure} failure preserves all static anchors`, async () => {
  const ui = await boot(published, failure);
  assert.deepEqual(ui.index.children, ui.anchors);
  assert.equal(ui.outputs.status.textContent, "文章列表暂不可用");
});
test("article titles are text and controller creates no visualization or geometry", async () => {
  const data = structuredClone(published); data.notes[1].title = "<img src=x onerror=alert(1)>";
  const ui = await boot(data);
  assert.equal(links(ui.outputs.articles)[0].textContent, data.notes[1].title);
  assert.ok(ui.created.every(tag => ["button", "li", "a"].includes(tag)));
  assert.doesNotMatch(ui.source, /innerHTML|createElementNS|pointermove|getBoundingClientRect|requestAnimationFrame|window\.[A-Za-z]+\s*=/);
});
