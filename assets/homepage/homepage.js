const profileAudio = document.querySelector("#profileAudio");

const TRACKS = Object.freeze([
  { title: "The Nights", artist: "Avicii", mood: "OPEN ROAD", accent: "#8fc5d6", src: "./assets/music/the-nights-avicii.mp3", lyrics: "assets/music/lyrics/the-nights-avicii.lrc", cover: "assets/music/covers/the-nights.png" },
  { title: "稻香", artist: "周杰伦", mood: "SUNLIT", accent: "#e4bb83", src: "./assets/music/daoxiang-jay-chou.mp3", lyrics: "assets/music/lyrics/daoxiang-jay-chou.lrc", cover: "assets/music/covers/daoxiang.png" },
  { title: "后来", artist: "刘若英", mood: "AFTERGLOW", accent: "#b38b9f", src: "./assets/music/houlai-rene-liu.mp3", lyrics: "assets/music/lyrics/houlai-rene-liu.lrc", cover: "assets/music/covers/houlai.png" },
  { title: "遇见", artist: "孙燕姿", mood: "WANDER", accent: "#9db5d4", src: "./assets/music/meet-stefanie-sun.mp3", lyrics: "assets/music/lyrics/meet-stefanie-sun.lrc", cover: "assets/music/covers/meet.png" },
  { title: "Viva La Vida", artist: "Coldplay", mood: "ASCENT", accent: "#d8d3a5", src: "./assets/music/viva-la-vida-coldplay.mp3", lyrics: "assets/music/lyrics/viva-la-vida-coldplay.lrc", cover: "assets/music/covers/viva-la-vida.png" },
  { title: "平凡之路", artist: "朴树", mood: "HORIZON", accent: "#8cae9e", src: "./assets/music/ordinary-road-pu-shu.mp3", lyrics: "assets/music/lyrics/ordinary-road-pu-shu.lrc", cover: "assets/music/covers/ordinary-road.png" },
  { title: "倔强", artist: "五月天", mood: "YOUTH", accent: "#d49a82", src: "./assets/music/stubborn-mayday.mp3", lyrics: "assets/music/lyrics/stubborn-mayday.lrc", cover: "assets/music/covers/stubborn.png" },
  { title: "Counting Stars", artist: "OneRepublic", mood: "MOTION", accent: "#a7b9e7", src: "./assets/music/counting-stars-onerepublic.mp3", lyrics: "assets/music/lyrics/counting-stars-onerepublic.lrc", cover: "assets/music/covers/counting-stars.png" },
  { title: "好久不见", artist: "陈奕迅", mood: "MELANCHOLY", accent: "#8d89b8", src: "./assets/music/long-time-no-see-eason-chan.mp3", lyrics: "assets/music/lyrics/long-time-no-see-eason-chan.lrc", cover: "assets/music/covers/long-time-no-see.png" },
].map((track) => Object.freeze(track)));

const musicDock = document.querySelector("#music-dock");
const musicDockCover = document.querySelector("#music-dock-cover");
const musicDockTitle = document.querySelector("#music-dock-title");
const musicDockPlay = document.querySelector("#music-dock-play");
const musicDockExpand = document.querySelector("#music-dock-expand");
const musicPanel = document.querySelector("#music-panel");
const musicClose = document.querySelector("#music-close");
const musicTrackList = document.querySelector("#music-track-list");
const musicCover = document.querySelector("#music-cover");
const musicNowPlaying = document.querySelector("#music-now-playing");
const musicPrevious = document.querySelector("#music-previous");
const musicPlay = document.querySelector("#music-play");
const musicNext = document.querySelector("#music-next");
const musicProgress = document.querySelector("#music-progress");
const previousLyric = document.querySelector("#previous-lyric");
const currentLyric = document.querySelector("#current-lyric");
const nextLyric = document.querySelector("#next-lyric");
const wechatTrigger = document.querySelector("#wechat-trigger");
const wechatPopover = document.querySelector("#wechat-popover");
const wechatCopy = document.querySelector("#wechat-copy");
const closeWechat = document.querySelector("#wechat-close");
const archiveCards = document.querySelectorAll(".archive-card[data-preview]");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
const heroSearchForm = document.querySelector("#hero-search-form");
const heroSearchInput = document.querySelector("#hero-search-input");
const searchStatus = document.querySelector("#search-status");
const moonRipple = document.querySelector("#moon-ripple");
const sectionLinks = document.querySelectorAll("[data-section-link]");
const storySections = document.querySelectorAll(".story-section");
const pointerGlassSurfaces = document.querySelectorAll(".pointer-glass, .archive-card");

let trackIndex = 0;
let lyricLines = [];
let lyricLoad = 0;
let lyricStatus = "";
let renderedLyricKey = "";
let renderedLyricAccentIndex = -1;
let pointerGlassEnabled = false;
let idleTimer;
const lyricCache = new Map();
const lyricAccents = ["#153a5b", "#8fc5d6", "#d7b28a"];

function resetPointerGlass() {
  pointerGlassSurfaces.forEach((surface) => {
    surface.style?.removeProperty("--pointer-x");
    surface.style?.removeProperty("--pointer-y");
    surface.style?.removeProperty("--tilt-x");
    surface.style?.removeProperty("--tilt-y");
  });
}

function syncMotionPreferences() {
  const root = document.documentElement;
  root.dataset.motion = reduceMotionQuery.matches ? "reduced" : "full";
  root.dataset.pointerGlass = "false";
  pointerGlassEnabled = false;
  root.style?.removeProperty("--lyric-accent");
  resetPointerGlass();
  if (reduceMotionQuery.matches) return;
  pointerGlassEnabled = pointerQuery.matches;
  root.dataset.pointerGlass = String(pointerGlassEnabled);
}

function setupPointerGlass() {
  pointerGlassSurfaces.forEach((surface) => {
    surface.addEventListener("pointermove", (event) => {
      if (!pointerGlassEnabled) return;
      const bounds = surface.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      surface.style.setProperty("--pointer-x", `${x * 100}%`);
      surface.style.setProperty("--pointer-y", `${y * 100}%`);
      surface.style.setProperty("--tilt-x", `${(0.5 - y) * 4}deg`);
      surface.style.setProperty("--tilt-y", `${(x - 0.5) * 4}deg`);
    });
    surface.addEventListener("pointerleave", resetPointerGlass);
  });
}

function setActiveSection(id) {
  document.documentElement.dataset.activeSection = id;
  sectionLinks.forEach((link) => {
    if (link.getAttribute("href") === `#${id}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setupSectionObserver() {
  if (typeof IntersectionObserver !== "function") return;
  setActiveSection(storySections[0]?.id ?? "origin");
  const observer = new IntersectionObserver((entries) => {
    const activeEntry = entries.filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (activeEntry) setActiveSection(activeEntry.target.id);
  }, { rootMargin: "-35% 0px -45%", threshold: [0.1, 0.5, 0.9] });
  storySections.forEach((section) => observer.observe(section));
}

function setIdleState(idle) {
  document.documentElement.dataset.idle = String(idle);
}

function resetIdleTimer() {
  window.clearTimeout(idleTimer);
  setIdleState(false);
  idleTimer = window.setTimeout(() => setIdleState(true), 20000);
}

function setupIdleTimer() {
  ["pointerdown", "scroll", "touchstart", "keydown", "focusin"].forEach((eventName) => {
    document.addEventListener(eventName, resetIdleTimer, { passive: eventName !== "keydown" && eventName !== "focusin" });
  });
  resetIdleTimer();
}

function openMusicPanel() {
  musicPanel.hidden = false;
  musicDockExpand.setAttribute("aria-expanded", "true");
  musicClose.focus();
}

function closeMusicPanel({ returnFocus }) {
  musicPanel.hidden = true;
  musicDockExpand.setAttribute("aria-expanded", "false");
  if (returnFocus) musicDockExpand.focus();
}

function setArchivePreview(card, expanded) {
  archiveCards.forEach((archiveCard) => {
    const isExpanded = archiveCard === card && expanded;
    archiveCard.classList.toggle("is-expanded", isExpanded);
    archiveCard.querySelector(".archive-preview-toggle").setAttribute("aria-expanded", String(isExpanded));
  });
}

function closeArchivePreview({ returnFocus }) {
  const expandedCard = [...archiveCards].find((card) => card.classList.contains("is-expanded"));
  if (!expandedCard) return false;
  setArchivePreview(expandedCard, false);
  if (returnFocus) expandedCard.querySelector(".archive-preview-toggle").focus();
  return true;
}

function openWeChatPopover() {
  wechatPopover.hidden = false;
  wechatTrigger.setAttribute("aria-expanded", "true");
  wechatCopy.focus();
}

function closeWeChatPopover({ returnFocus }) {
  wechatPopover.hidden = true;
  wechatTrigger.setAttribute("aria-expanded", "false");
  if (returnFocus) wechatTrigger.focus();
}

function renderTrack() {
  const track = TRACKS[trackIndex];
  document.documentElement.style.setProperty("--track-accent", track.accent);
  document.documentElement.dataset.playing = String(!profileAudio.paused);
  musicCover.src = track.cover;
  musicCover.alt = `${track.title} — ${track.artist} 的封面`;
  musicDockCover.src = track.cover;
  musicDockTitle.textContent = `${track.title} · ${track.artist}`;
  musicNowPlaying.textContent = `${track.title} — ${track.artist}`;
  const action = profileAudio.paused ? "播放" : "暂停";
  [musicPlay, musicDockPlay].forEach((button) => {
    button.textContent = action;
    button.setAttribute("aria-pressed", String(!profileAudio.paused));
    button.setAttribute("aria-label", `${action} ${track.title}`);
  });
  [...musicTrackList.children].forEach((button, index) => button.setAttribute("aria-current", String(index === trackIndex)));
}

function parseLrc(source) {
  return source.split(/\r?\n/).flatMap((line) => {
    const text = line.replace(/^(\[\d{2}:\d{2}(?:\.\d{1,3})?\])+/, "").trim();
    return [...line.matchAll(/\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g)]
      .map((match) => ({ time: Number(match[1]) * 60 + Number(match[2]), text }))
      .filter((entry) => entry.text);
  }).sort((a, b) => a.time - b.time);
}

function renderLyricLines(index) {
  const key = `${trackIndex}:${index}`;
  if (key === renderedLyricKey) return;
  renderedLyricKey = key;
  previousLyric.textContent = lyricLines[index - 1]?.text ?? "—";
  currentLyric.textContent = lyricLines[index]?.text ?? "等待歌词开始";
  nextLyric.textContent = lyricLines[index + 1]?.text ?? "—";
  if (index !== renderedLyricAccentIndex) {
    renderedLyricAccentIndex = index;
    if (!reduceMotionQuery.matches && index >= 0) {
      document.documentElement.style.setProperty("--lyric-accent", lyricAccents[index % lyricAccents.length]);
    }
  }
}

function renderLyricStatus(message) {
  const key = `${trackIndex}:status:${message}`;
  if (key === renderedLyricKey) return;
  renderedLyricKey = key;
  previousLyric.textContent = "—";
  currentLyric.textContent = message;
  nextLyric.textContent = "—";
}

function syncLyrics() {
  if (lyricStatus) {
    renderLyricStatus(lyricStatus);
  } else {
    const activeIndex = lyricLines.reduce((last, line, index) => line.time <= profileAudio.currentTime ? index : last, -1);
    renderLyricLines(activeIndex);
  }
  if (Number.isFinite(profileAudio.duration) && profileAudio.duration > 0) {
    const progress = profileAudio.currentTime / profileAudio.duration;
    musicProgress.value = progress;
    musicDock.style.setProperty("--dock-progress", String(progress));
  }
}

async function loadLyrics(track) {
  const request = ++lyricLoad;
  lyricLines = [];
  lyricStatus = "加载歌词…";
  renderLyricStatus(lyricStatus);
  try {
    let lines = lyricCache.get(track.lyrics);
    if (!lines) {
      const response = await fetch(track.lyrics);
      if (!response.ok) throw new Error("Lyrics could not be loaded.");
      lines = parseLrc(await response.text());
      lyricCache.set(track.lyrics, lines);
    }
    if (request !== lyricLoad) return;
    lyricLines = lines;
    if (!lyricLines.length) {
      lyricStatus = "歌词暂不可用";
      return renderLyricStatus(lyricStatus);
    }
    lyricStatus = "";
    syncLyrics();
  } catch {
    if (request === lyricLoad) {
      lyricStatus = "歌词暂不可用";
      renderLyricStatus(lyricStatus);
    }
  }
}

function loadTrack(index, { autoplay = false } = {}) {
  trackIndex = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIndex];
  profileAudio.pause();
  profileAudio.src = track.src;
  profileAudio.load();
  musicProgress.value = 0;
  musicDock.style.setProperty("--dock-progress", String(0));
  renderedLyricKey = "";
  void loadLyrics(track);
  renderTrack();
  if (autoplay) void playCurrentTrack();
}

async function playCurrentTrack() {
  if (!profileAudio.src) loadTrack(trackIndex);
  try {
    await profileAudio.play();
  } catch {
    renderLyricStatus("此浏览器无法播放");
    renderTrack();
  }
}

function selectTrack(index) {
  loadTrack(index, { autoplay: true });
}

async function toggleNativePlayback() {
  if (profileAudio.paused) await playCurrentTrack();
  else profileAudio.pause();
}

function createTrackList() {
  TRACKS.forEach((track, index) => {
    const trackButton = document.createElement("button");
    trackButton.type = "button";
    trackButton.className = "music-track";
    trackButton.dataset.trackIndex = String(index);
    trackButton.textContent = `${track.title} — ${track.artist}`;
    trackButton.addEventListener("click", () => void selectTrack(index));
    musicTrackList.append(trackButton);
  });
}

profileAudio.addEventListener("play", renderTrack);
profileAudio.addEventListener("pause", renderTrack);
profileAudio.addEventListener("timeupdate", syncLyrics);
profileAudio.addEventListener("ended", () => void selectTrack(trackIndex + 1));
profileAudio.addEventListener("loadedmetadata", syncLyrics);
musicDockExpand.addEventListener("click", openMusicPanel);
musicClose.addEventListener("click", () => closeMusicPanel({ returnFocus: true }));
musicPlay.addEventListener("click", () => void toggleNativePlayback());
musicDockPlay.addEventListener("click", () => void toggleNativePlayback());
musicPrevious.addEventListener("click", () => void selectTrack(trackIndex - 1));
musicNext.addEventListener("click", () => void selectTrack(trackIndex + 1));
archiveCards.forEach((card) => {
  const previewToggle = card.querySelector(".archive-preview-toggle");
  previewToggle.addEventListener("click", () => setArchivePreview(card, !card.classList.contains("is-expanded")));
});
wechatTrigger.addEventListener("click", openWeChatPopover);
closeWechat.addEventListener("click", () => closeWeChatPopover({ returnFocus: true }));
wechatCopy.addEventListener("click", async () => {
  const wechatId = wechatPopover.querySelector("[data-wechat-id]").textContent;
  if (typeof navigator.clipboard?.writeText !== "function") {
    wechatCopy.textContent = "请手动复制";
    return;
  }
  try {
    await navigator.clipboard.writeText(wechatId);
    wechatCopy.textContent = "已复制";
  } catch {
    wechatCopy.textContent = "请手动复制";
  }
});
document.addEventListener("click", (event) => {
  if (!musicPanel.hidden && !musicPanel.contains(event.target) && !musicDock.contains(event.target)) {
    closeMusicPanel({ returnFocus: true });
  }
  if (!wechatPopover.hidden && !wechatPopover.contains(event.target) && !wechatTrigger.contains(event.target)) {
    closeWeChatPopover({ returnFocus: true });
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && !wechatPopover.hidden) {
    if (event.shiftKey && document.activeElement === wechatCopy) {
      event.preventDefault();
      closeWechat.focus();
    } else if (!event.shiftKey && document.activeElement === closeWechat) {
      event.preventDefault();
      wechatCopy.focus();
    }
  }
  if (event.key === "Escape") {
    if (closeArchivePreview({ returnFocus: true })) return;
    if (!wechatPopover.hidden) {
      closeWeChatPopover({ returnFocus: true });
      return;
    }
    if (!musicPanel.hidden) closeMusicPanel({ returnFocus: true });
  }
});
heroSearchForm.addEventListener("submit", (event) => {
  if (heroSearchInput.value.trim()) {
    heroSearchInput.removeAttribute("aria-invalid");
    searchStatus.textContent = "";
    return;
  }
  event.preventDefault();
  heroSearchInput.setAttribute("aria-invalid", "true");
  searchStatus.textContent = "请输入搜索内容。";
  heroSearchInput.focus();
});
moonRipple.addEventListener("click", () => {
  if (reduceMotionQuery.matches) return;
  moonRipple.classList.remove("is-rippling");
  void moonRipple.offsetWidth;
  moonRipple.classList.add("is-rippling");
});
moonRipple.addEventListener("animationend", () => moonRipple.classList.remove("is-rippling"));

const phrases = [
  { tone: "NOTES ON LIFE", lines: ["人生并不总在向前，", "许多看似停滞的时刻，也在悄然校正方向。"] },
  { tone: "KEEP MOVING", lines: ["真正的勇气，不是忽略代价，", "而是在看清代价之后，仍愿意承担。"] },
  { tone: "NOTES ON LIFE", lines: ["失败很少给出答案，", "却会逐渐排除那些并不适合的道路。"] },
  { tone: "KEEP MOVING", lines: ["路途漫长，走得慢并不妨碍抵达；", "比迟缓更值得警惕的，是在喧嚣中失去方向。"] },
  { tone: "NOTES ON LIFE", lines: ["成长并非得到所有答案，", "而是能够与暂时无解的问题共同生活。"] },
  { tone: "KEEP MOVING", lines: ["热望不必始终沸腾，", "能够安静地经受平淡，才可能走得长久。"] },
  { tone: "NOTES ON LIFE", lines: ["世界习惯用结果衡量价值，", "时间却会保留每一次不被看见的坚持。"] },
  { tone: "KEEP MOVING", lines: ["清醒不是告别理想，", "而是让理想离开想象，开始承受现实的重量。"] },
  { tone: "NOTES ON LIFE", lines: ["选择未必通向预期的结局，", "愿意承担选择，过程便有了意义。"] },
  { tone: "KEEP MOVING", lines: ["所谓向上，并非永远站在高处，", "而是在每次低落之后，重新整理生活的秩序。"] },
];

const TIMING = { character: 115, comma: 280, semicolon: 360, period: 520, lineBreak: 360, hold: 3400, deleteCharacter: 28, deleteLineBreak: 120, between: 460 };
const lineNodes = [...document.querySelectorAll(".sentence-line")];
const quoteMeta = document.querySelector("#quote-meta");
const quoteProgress = document.querySelector("#quote-progress");
const caret = document.createElement("span");
caret.className = "caret";
const marks = phrases.map(() => {
  const mark = document.createElement("span");
  quoteProgress.append(mark);
  return mark;
});
let phraseIndex = 0;
let quoteRun = 0;
let quoteTimer;
const wait = (duration) => new Promise((resolve) => { quoteTimer = window.setTimeout(resolve, duration); });
const isQuoteRunCurrent = (run) => run === quoteRun && !reduceMotionQuery.matches;

function updateQuoteMeta() {
  const current = phrases[phraseIndex];
  quoteMeta.textContent = `${current.tone} · ${String(phraseIndex + 1).padStart(2, "0")} / ${phrases.length}`;
  marks.forEach((mark, index) => mark.classList.toggle("active", index === phraseIndex));
}

function delayFor(character) {
  if (character === "，") return TIMING.comma;
  if (character === "；") return TIMING.semicolon;
  if (character === "。") return TIMING.period;
  return TIMING.character;
}

async function typeLine(lineNode, text, run) {
  let visibleText = "";
  for (const character of text) {
    if (!isQuoteRunCurrent(run)) return false;
    visibleText += character;
    lineNode.textContent = visibleText;
    lineNode.append(caret);
    await wait(delayFor(character));
  }
  return true;
}

async function deleteLine(lineNode, run) {
  let visibleText = lineNode.textContent;
  while (visibleText.length > 0) {
    if (!isQuoteRunCurrent(run)) return false;
    visibleText = visibleText.slice(0, -1);
    lineNode.textContent = visibleText;
    lineNode.append(caret);
    await wait(TIMING.deleteCharacter);
  }
  return true;
}

async function deleteVisibleLines(run) {
  for (let lineIndex = lineNodes.length - 1; lineIndex >= 0; lineIndex -= 1) {
    if (!(await deleteLine(lineNodes[lineIndex], run))) return false;
    if (lineIndex) await wait(TIMING.deleteLineBreak);
  }
  return true;
}

function renderStaticPhrase() {
  const current = phrases[phraseIndex];
  lineNodes.forEach((lineNode, index) => { lineNode.textContent = current.lines[index] ?? ""; });
  updateQuoteMeta();
}

function scheduleStaticPhrase(run) {
  renderStaticPhrase();
  quoteTimer = window.setTimeout(() => {
    if (run !== quoteRun || !reduceMotionQuery.matches) return;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    scheduleStaticPhrase(run);
  }, TIMING.hold);
}

async function play(run) {
  while (run === quoteRun && !reduceMotionQuery.matches) {
    if (!(await deleteVisibleLines(run))) return;
    const current = phrases[phraseIndex];
    updateQuoteMeta();
    await wait(TIMING.between);
    for (let index = 0; index < current.lines.length; index += 1) {
      if (index) await wait(TIMING.lineBreak);
      if (!(await typeLine(lineNodes[index], current.lines[index], run))) return;
    }
    await wait(TIMING.hold);
    phraseIndex = (phraseIndex + 1) % phrases.length;
  }
}

function syncQuoteMotion() {
  quoteRun += 1;
  window.clearTimeout(quoteTimer);
  if (reduceMotionQuery.matches) {
    scheduleStaticPhrase(quoteRun);
    return;
  }
  void play(quoteRun);
}

reduceMotionQuery.addEventListener("change", syncQuoteMotion);
reduceMotionQuery.addEventListener("change", syncMotionPreferences);
pointerQuery.addEventListener("change", syncMotionPreferences);
createTrackList();
loadTrack(0, { autoplay: false });
syncQuoteMotion();
syncMotionPreferences();
setupPointerGlass();
setupSectionObserver();
setupIdleTimer();
