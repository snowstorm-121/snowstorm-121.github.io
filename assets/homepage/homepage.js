const profileAudio = document.querySelector("#profileAudio");

const TRACKS = [
  { title: "The Nights", artist: "Avicii", mood: "OPEN ROAD", accent: "#8fc5d6", src: "./assets/music/the-nights-avicii.mp3", lyrics: "assets/music/lyrics/the-nights-avicii.lrc", cover: "assets/music/covers/the-nights.png" },
  { title: "稻香", artist: "周杰伦", mood: "SUNLIT", accent: "#e4bb83", src: "./assets/music/daoxiang-jay-chou.mp3", lyrics: "assets/music/lyrics/daoxiang-jay-chou.lrc", cover: "assets/music/covers/daoxiang.png" },
  { title: "后来", artist: "刘若英", mood: "AFTERGLOW", accent: "#b38b9f", src: "./assets/music/houlai-rene-liu.mp3", lyrics: "assets/music/lyrics/houlai-rene-liu.lrc", cover: "assets/music/covers/houlai.png" },
  { title: "遇见", artist: "孙燕姿", mood: "WANDER", accent: "#9db5d4", src: "./assets/music/meet-stefanie-sun.mp3", lyrics: "assets/music/lyrics/meet-stefanie-sun.lrc", cover: "assets/music/covers/meet.png" },
  { title: "Viva La Vida", artist: "Coldplay", mood: "ASCENT", accent: "#d8d3a5", src: "./assets/music/viva-la-vida-coldplay.mp3", lyrics: "assets/music/lyrics/viva-la-vida-coldplay.lrc", cover: "assets/music/covers/viva-la-vida.png" },
  { title: "平凡之路", artist: "朴树", mood: "HORIZON", accent: "#8cae9e", src: "./assets/music/ordinary-road-pu-shu.mp3", lyrics: "assets/music/lyrics/ordinary-road-pu-shu.lrc", cover: "assets/music/covers/ordinary-road.png" },
  { title: "倔强", artist: "五月天", mood: "YOUTH", accent: "#d49a82", src: "./assets/music/stubborn-mayday.mp3", lyrics: "assets/music/lyrics/stubborn-mayday.lrc", cover: "assets/music/covers/stubborn.png" },
  { title: "Counting Stars", artist: "OneRepublic", mood: "MOTION", accent: "#a7b9e7", src: "./assets/music/counting-stars-onerepublic.mp3", lyrics: "assets/music/lyrics/counting-stars-onerepublic.lrc", cover: "assets/music/covers/counting-stars.png" },
  { title: "好久不见", artist: "陈奕迅", mood: "MELANCHOLY", accent: "#8d89b8", src: "./assets/music/long-time-no-see-eason-chan.mp3", lyrics: "assets/music/lyrics/long-time-no-see-eason-chan.lrc", cover: "assets/music/covers/long-time-no-see.png" },
];

const musicDock = document.querySelector("#music-dock button");
const musicPanel = document.querySelector("#music-panel");
const musicTrackList = document.querySelector("#music-track-list");
const musicCover = document.querySelector("#music-cover");
const musicNowPlaying = document.querySelector("#music-now-playing");
const musicLyrics = document.querySelector("#music-lyrics");
const musicPrevious = document.querySelector("#music-previous");
const musicPlay = document.querySelector("#music-play");
const musicNext = document.querySelector("#music-next");
const wechatTrigger = document.querySelector("#wechat-trigger");
const wechatPopover = document.querySelector("#wechat-popover");
const wechatCopy = document.querySelector("#wechat-copy");
const closeWechat = document.querySelector("#wechat-close");
const archiveCards = document.querySelectorAll(".archive-card[data-preview]");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const heroSearchForm = document.querySelector("#hero-search-form");
const heroSearchInput = document.querySelector("#hero-search-input");
const searchStatus = document.querySelector("#search-status");
const moonRipple = document.querySelector("#moon-ripple");

let trackIndex = 0;
let lyricLines = [];
const lyricCache = new Map();

function togglePanel(button, panel) {
  panel.hidden = !panel.hidden;
  button.setAttribute("aria-expanded", String(!panel.hidden));
}

function setArchivePreview(card, expanded) {
  archiveCards.forEach((archiveCard) => {
    const isExpanded = archiveCard === card && expanded;
    archiveCard.classList.toggle("is-expanded", isExpanded);
    archiveCard.querySelector(".archive-preview-toggle").setAttribute("aria-expanded", String(isExpanded));
  });
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
  musicCover.src = track.cover;
  musicCover.alt = `${track.title} — ${track.artist} 的封面`;
  musicNowPlaying.textContent = `${track.title} — ${track.artist}`;
  musicPlay.textContent = profileAudio.paused ? "播放" : "暂停";
  musicPlay.setAttribute("aria-pressed", String(!profileAudio.paused));
  musicPlay.setAttribute("aria-label", `${profileAudio.paused ? "播放" : "暂停"} ${track.title}`);
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

function renderLyricStatus(track, message) {
  musicLyrics.textContent = `${track.title} · ${message}`;
}

function syncLyrics() {
  const track = TRACKS[trackIndex];
  const current = lyricLines.reduce((last, line) => line.time <= profileAudio.currentTime ? line : last, lyricLines[0]);
  if (current) musicLyrics.textContent = `${track.title} · ${current.text}`;
}

async function loadLyrics(track) {
  lyricLines = [];
  renderLyricStatus(track, "加载歌词…");
  try {
    let lines = lyricCache.get(track.lyrics);
    if (!lines) {
      const response = await fetch(track.lyrics);
      if (!response.ok) throw new Error("Lyrics could not be loaded.");
      lines = parseLrc(await response.text());
      lyricCache.set(track.lyrics, lines);
    }
    if (track !== TRACKS[trackIndex]) return;
    lyricLines = lines;
    if (!lyricLines.length) return renderLyricStatus(track, "歌词暂不可用");
    syncLyrics();
  } catch {
    if (track === TRACKS[trackIndex]) renderLyricStatus(track, "歌词暂不可用");
  }
}

function loadTrack(index) {
  trackIndex = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIndex];
  profileAudio.pause();
  profileAudio.src = track.src;
  profileAudio.load();
  void loadLyrics(track);
  renderTrack();
}

async function playCurrentTrack() {
  if (!profileAudio.src) loadTrack(trackIndex);
  try {
    await profileAudio.play();
  } catch {
    renderLyricStatus(TRACKS[trackIndex], "此浏览器无法播放");
  }
}

async function selectTrack(index) {
  loadTrack(index);
  await playCurrentTrack();
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
musicDock.addEventListener("click", () => togglePanel(musicDock, musicPanel));
musicPlay.addEventListener("click", () => void toggleNativePlayback());
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
  if (!wechatPopover.hidden && !wechatPopover.contains(event.target) && event.target !== wechatTrigger) {
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
  if (event.key === "Escape" && !wechatPopover.hidden) closeWeChatPopover({ returnFocus: true });
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
createTrackList();
renderTrack();
syncQuoteMotion();
