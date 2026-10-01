import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import vm from "node:vm";
const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [learning,living,research,styles,script,json] = await Promise.all([
  read("../learning/index.html"),read("../living/index.html"),read("../research/index.html"),
  read("../assets/archive-directory.css").catch(()=>""),read("../assets/learning-directory.js"),read("../learning/pytorch/atlas-relations.json")
]);
const data=JSON.parse(json);
const pages={learning,living,research};
const attr=(tag,name)=>tag?.match(new RegExp(name+'="([^"]*)"'))?.[1];
const anchors=[...learning.matchAll(/<a\b[^>]*data-directory-stage[^>]*>[\s\S]*?<\/a>/g)].map(m=>m[0]);
const checks=[
 ["semantic main", /<main class="archive-shell"/],
 ["same-surface header", /<header class="archive-header">/],
 ["home link", /href="\.\.\/index.html">← 返回主页/],
 ["archive navigation", /<nav class="archive-switcher" aria-label="档案分类">/],
 ["current page", /aria-current="page"/],
 ["early theme", /<script src="\.\.\/assets\/reading-theme.js"><\/script>/],
 ["theme stylesheet", /href="\.\.\/assets\/reading-theme.css"/],
 ["directory stylesheet", /href="\.\.\/assets\/archive-directory.css"/],
 ["native theme toggle", /<button type="button" data-reading-theme-toggle[\s\S]*?昼[\s\S]*?reading-theme-tide[\s\S]*?夜[\s\S]*?<\/button>/],
 ["photo strip", /<section class="archive-photo"[\s\S]*?<h1>/],
 ["editorial body", /class="archive-layout"/],
 ["no old visualization", null]
];
for(const [page,html] of Object.entries(pages)) for(const [name,pattern] of checks) test(page+": "+name,()=>{
 if(pattern) assert.match(html,pattern); else assert.doesNotMatch(html,/archive-atlas\.(?:css|js)|cursor-shoal\.(?:css|js)|<svg\b|data-orbit-role|data-atlas-|data-moon-scale-shoal/);
 if(name==="early theme") assert.ok(html.indexOf("reading-theme.js")<html.indexOf('rel="stylesheet"'));
 if(name==="current page") assert.equal((html.match(/aria-current="page"/g)??[]).length,1);
 if(name==="archive navigation") for(const href of ["../learning/","../living/","../research/"]) assert.ok(html.includes('href="'+href+'"'));
});
for(const [i,stage] of data.stages.entries()){
 test(stage.key+": canonical static anchor order",()=>{assert.equal(attr(anchors[i],"data-stage-key"),stage.key);assert.equal(attr(anchors[i],"href"),stage.key==="overview"?"./pytorch/":"./pytorch/"+stage.key+"/");});
 test(stage.key+": real static destination",async()=>{const href=attr(anchors[i],"href");assert.ok(href);await access(new URL("../learning/"+href+"index.html",import.meta.url));});
 test(stage.key+": published stage label",()=>assert.ok(anchors[i]?.includes(stage.label)));
}
for(const [page,names] of Object.entries({living:["长夜微澜","纸上星河","山河来信","岁序留痕"],research:["问题航标","实验潮汐","工程舱图","结论星屿"]})) names.forEach((name,i)=>test(page+": unpublished "+name,()=>{
 const items=[...pages[page].matchAll(/<li class="archive-category">([\s\S]*?)<\/li>/g)].map(m=>m[1]);
 assert.equal(items.length,4);assert.match(items[i],new RegExp("<h2>"+name+"</h2>"));assert.match(items[i],/<span class="archive-status">尚未发布<\/span>/);assert.doesNotMatch(items[i],/<a\b|<button\b|href=/);
}));
class Element{
 constructor(tag="div"){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.textContent="";}
 get parentNode(){return this.parent;}
 insertBefore(child,anchor){child.parent=this;this.children.splice(this.children.indexOf(anchor),0,child);}
 setAttribute(n,v){this.attributes[n]=String(v);} getAttribute(n){return this.attributes[n]??null;}
 append(...children){children.forEach(c=>{c.parent=this;this.children.push(c);});}
 replaceChildren(...children){this.children=[];this.append(...children);}
 replaceWith(child){const i=this.parent.children.indexOf(this);child.parent=this.parent;this.parent.children[i]=child;}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
 fire(t,key){(this.listeners[t]??[]).forEach(f=>f({key,preventDefault(){}}));}
}
async function boot(payload=structuredClone(data),failure){
 const root=new Element();root.dataset.relationsUrl="./pytorch/atlas-relations.json";
 const index=new Element("ol");const staticAnchors=anchors.map(tag=>{const a=new Element("a");a.dataset.stageKey=attr(tag,"data-stage-key");a.setAttribute("href",attr(tag,"href"));index.append(a);return a;});
 const outputs=Object.fromEntries(["articles","title","count","destination","status"].map(n=>[n,new Element(n==="articles"?"ol":"div")]));
 root.querySelectorAll=()=>staticAnchors;root.querySelector=s=>outputs[s.match(/data-directory-(\w+)/)?.[1]]??null;
 vm.runInNewContext(script,{document:{querySelector:()=>root,createElement:tag=>new Element(tag)},fetch:async()=>{if(failure==="network")throw Error("offline");return{ok:failure!=="http",json:async()=>{if(failure==="json")throw SyntaxError("json");return payload;}};}});
 await new Promise(r=>setImmediate(r));return{index,staticAnchors,outputs};
}
const links=ui=>ui.outputs.articles.children.map(li=>li.children[0]);
test("learning supplies complete controller contract and visible fallback",()=>{
 assert.match(learning,/data-learning-directory data-relations-url=".\/pytorch\/atlas-relations.json"/);
 for(const s of ["title","count","destination","status"]) assert.ok(learning.includes("data-directory-"+s));
 assert.match(learning,/<ol[^>]*data-directory-articles[^>]*><\/ol>/);
 assert.match(learning,/data-directory-status[^>]*>文章列表暂不可用/);
 assert.match(learning,/data-directory-destination href=".\/pytorch\/foundation\/"/);
});
test("only learning loads enhancement",()=>{assert.match(learning,/src="\.\.\/assets\/learning-directory.js" defer/);for(const html of [living,research])assert.doesNotMatch(html,/learning-directory.js|data-relations-url/);});
test("all 32 published article titles and URLs render through real page anchors in order",async()=>{
 const ui=await boot();const actual=[];assert.equal(ui.outputs.title.textContent,"基础阶段");assert.equal(links(ui).length,10);
 for(const stage of data.stages){ui.index.children.filter(b=>b.tagName==="BUTTON").find(b=>b.dataset.stageKey===stage.key).fire("click");assert.equal(ui.outputs.destination.getAttribute("href"),stage.key==="overview"?"./pytorch/":"./pytorch/"+stage.key+"/");actual.push(...links(ui).map(a=>[a.getAttribute("href"),a.textContent]));}
 assert.deepEqual(actual,data.notes.map(n=>[n.href,n.title]));assert.equal(actual.length,32);
});
test("invalid or unavailable JSON preserves all eight static page anchors",async()=>{
 const invalid=[null,{}, {...data,version:2},{...data,notes:[...data.notes].reverse()},{...data,stages:[...data.stages].reverse()}];
 for(const payload of invalid){const ui=await boot(payload);assert.deepEqual(ui.index.children,ui.staticAnchors);assert.equal(ui.outputs.status.textContent,"文章列表暂不可用");assert.equal(links(ui).length,0);}
 for(const failure of ["network","http","json"]){const ui=await boot(data,failure);assert.deepEqual(ui.index.children,ui.staticAnchors);assert.equal(ui.outputs.status.textContent,"文章列表暂不可用");}
});
test("unsafe note URLs and stage order remain rejected",async()=>{
 for(const href of ["javascript:alert(1)","/outside/a.html","/learning/pytorch/notes/%2e%2e/a.html","https://example.invalid/note.html","./notes/overview/pytorch.html","/learning/pytorch/stage-1/"]){const payload=structuredClone(data);payload.notes[0].href=href;const ui=await boot(payload);assert.deepEqual(ui.index.children,ui.staticAnchors);assert.equal(links(ui).length,0);}
 for(const mutate of [value=>{value.stages[0].href="https://example.invalid/stage";},value=>{value.stages[0].key="untrusted-stage";value.notes[0].stageKey="untrusted-stage";}]){const payload=structuredClone(data);mutate(payload);const ui=await boot(payload);assert.deepEqual(ui.index.children,ui.staticAnchors);assert.equal(links(ui).length,0);}
 const payload=structuredClone(data);payload.stages[1].noteIds.reverse();const ui=await boot(payload);assert.deepEqual(ui.index.children,ui.staticAnchors);
});
test("keyboard selection retains native links and hover never selects",async()=>{
 const ui=await boot();assert.equal(ui.index.children.filter(b=>b.tagName==="BUTTON").length,8);ui.index.children.filter(b=>b.tagName==="BUTTON")[0].fire("keydown","Enter");assert.equal(links(ui).length,1);ui.index.children.filter(b=>b.tagName==="BUTTON")[1].fire("keydown"," ");assert.equal(links(ui).length,10);ui.index.children.filter(b=>b.tagName==="BUTTON")[2].fire("pointerenter");ui.index.children.filter(b=>b.tagName==="BUTTON")[2].fire("focus");assert.equal(links(ui).length,10);
});
test("photo sources remain local with solid and gradient fallback layers",async()=>{
 for(const image of ["coast-background.png","archive-living.jpg","archive-research.jpg"]){assert.ok(styles.includes(image));await access(new URL("../assets/homepage/"+image,import.meta.url));}
 assert.match(styles,/\.archive-photo\s*\{[^}]*background-color:\s*#0a1623;[^}]*background-image:\s*linear-gradient/);assert.doesNotMatch(styles,/background-attachment:\s*fixed/);
 // Every text-bearing photo has a >=76% dark veil even over a white image pixel.
 const veils=[...styles.matchAll(/background-image:\s*linear-gradient\(90deg, rgba\(10,22,35,([\d.]+)\), rgba\(10,22,35,([\d.]+)\)\)/g)];
 assert.equal(veils.length,3);for(const veil of veils)assert.ok(Number(veil[1])>=.76&&Number(veil[2])>=.76);
});
test("theme surfaces use opaque paper and native focus",()=>{
 assert.match(styles,/\.archive-header\s*\{[^}]*background:\s*var\(--reading-surface\)/);
 assert.match(styles,/\.archive-page\s*\{[^}]*color:\s*var\(--reading-ink\);[^}]*background:\s*var\(--reading-surface\)/);
 assert.match(styles,/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--reading-accent\)/);
 assert.doesNotMatch(styles+script,/cursor:\s*none|url\([^)]*\.svg|createElementNS|pointermove|atlas-threads|orbit-ring/);
});
test("720px stack stays readable and fluid at 320px",()=>{
 assert.match(styles,/grid-template-columns:\s*minmax\(0, 260px\) minmax\(0, 1fr\)/);
 assert.match(styles,/@media\s*\(max-width:\s*720px\)[\s\S]*?\.archive-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
 assert.match(styles,/overflow-wrap:\s*anywhere/);assert.match(styles,/min-width:\s*0/);assert.match(styles,/font-size:\s*16px/);assert.doesNotMatch(styles,/min-width:\s*(?:[4-9]\d{2}|\d{4})px|user-select:\s*none|animation:/);
});
test("unused atlas resources remain preserved without live page references",async()=>{for(const path of ["../assets/archive-atlas.css","../assets/archive-atlas.js"])await access(new URL(path,import.meta.url));for(const html of Object.values(pages))assert.doesNotMatch(html,/archive-atlas\.(?:css|js)/);});

// Retain the old nested validation coverage as explicit page-integration cases.
const invalidPageData = [
 ["missing references", value => { delete value.references; }],
 ["missing stage", value => { value.stages.pop(); }],
 ["blank stage label", value => { value.stages[0].label = ""; }],
 ["duplicate stage member", value => { value.stages[1].noteIds.push(value.stages[1].noteIds[0]); }],
 ["missing stage member", value => { value.stages[1].noteIds.pop(); }],
 ["wrong note ownership", value => { value.notes[1].stageKey = "overview"; }],
 ["duplicate note ID", value => { value.notes[1].id = value.notes[0].id; }],
 ["noncontiguous note order", value => { value.notes[1].order = 100; }],
 ["wrong sequence endpoint", value => { value.sequence[0].to = value.notes[2].id; }],
 ["unknown reference target", value => { value.references.push({from:value.notes[0].id,to:"unknown"}); }],
 ["self reference", value => { value.references.push({from:value.notes[0].id,to:value.notes[0].id}); }],
 ["duplicate reference", value => { const edge={from:value.notes[0].id,to:value.notes[1].id};value.references.push(edge,edge); }],
];
for(const [name,mutate] of invalidPageData) test("page-integrated fallback: "+name,async()=>{
 const payload=structuredClone(data);mutate(payload);const ui=await boot(payload);
 assert.equal(ui.staticAnchors.length,8);
 assert.deepEqual(ui.index.children,ui.staticAnchors);
 assert.equal(ui.outputs.status.textContent,"文章列表暂不可用");
 assert.equal(links(ui).length,0);
 assert.deepEqual(ui.staticAnchors.map(a=>a.getAttribute("href")),data.stages.map(s=>s.key==="overview"?"./pytorch/":"./pytorch/"+s.key+"/"));
});

test("page enhancement keeps all eight native stage links visible with distinct controls",async()=>{
 const ui=await boot();const direct=ui.index.children.filter(child=>child.tagName==="A");
 assert.deepEqual(direct,ui.staticAnchors);
 for(const stage of data.stages){const anchor=direct.find(a=>a.dataset.stageKey===stage.key);assert.equal(anchor.getAttribute("aria-label"),`进入${stage.label}`);}
});
const luminance=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
const contrast=hex=>(luminance("#f4f0e9")+.05)/(luminance(hex)+.05);
test("archive accent text meets AA without a theme dataset",()=>{
 const color=styles.match(/--archive-accent-text:\s*(#[a-f0-9]{6})/i)?.[1];assert.ok(color,"default text accent must have a safe light fallback");assert.ok(contrast(color)>=4.5);
});
test("overview ordinary hover text meets AA on day paper",async()=>{
 const css=await read("../assets/library.css");const token=css.match(/\.note-list a:hover\s*\{[^}]*color:\s*var\((--[\w-]+)\)/)?.[1];
 const color=css.match(new RegExp(token+":\\s*(#[a-f0-9]{6})","i"))?.[1];assert.ok(color,"hover text uses a safe default text accent");assert.ok(contrast(color)>=4.5);
});
