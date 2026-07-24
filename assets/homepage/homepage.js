const profileAudio = document.querySelector("#profileAudio");

const musicDock = document.querySelector("#music-dock button");
const musicPanel = document.querySelector("#music-panel");
const wechatTrigger = document.querySelector("#wechat-trigger");
const wechatPopover = document.querySelector("#wechat-popover");
const closeWechat = wechatPopover.querySelector("button");

function togglePanel(button, panel) {
  panel.hidden = !panel.hidden;
  button.setAttribute("aria-expanded", String(!panel.hidden));
}

musicDock.addEventListener("click", () => togglePanel(musicDock, musicPanel));
wechatTrigger.addEventListener("click", () => togglePanel(wechatTrigger, wechatPopover));
closeWechat.addEventListener("click", () => togglePanel(wechatTrigger, wechatPopover));

profileAudio.addEventListener("ended", () => {
  profileAudio.currentTime = 0;
});
