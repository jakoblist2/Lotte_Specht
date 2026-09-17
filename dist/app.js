const frameCount = 274;
const sequenceFps = 12;
const introFrameCount = 122;
const introFps = 24;
const introDuration = introFrameCount / introFps;

const chapters = [
  { from: 0, to: 0.14, era: "1930", label: "Am Rand" },
  { from: 0.14, to: 0.33, era: "1930", label: "Die Idee" },
  { from: 0.33, to: 0.65, era: "1930", label: "Der Anstoß" },
  { from: 0.65, to: 0.94, era: "1930", label: "Das Spiel" },
  { from: 0.94, to: 1, era: "Heute", label: "Fußball gehört allen" },
];

const story = document.querySelector(".scroll-story");
const sequenceFrame = document.querySelector("#sequence-frame");
const sequenceLoader = document.querySelector("#sequence-loader");
const eraLabel = document.querySelector("#era-label");
const frameLabel = document.querySelector("#frame-label");
const progressMilestones = [...document.querySelectorAll(".progress-milestones li")];
const progressFill = document.querySelector("#progress-fill");
const scrollHint = document.querySelector(".scroll-hint");
const copyBlocks = [...document.querySelectorAll(".story-copy")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const frameCache = new Map();
const chapterFrames = new Set([0, 60, 77, 78, 90, 130, 190, 240, 273]);
let activeFrame = 0;
let requestedFrame = 0;
let rafPending = false;
let introPlaying = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function frameSource(index) {
  const number = String(index + 1).padStart(4, "0");
  return `assets/film-sequence/frame-${number}.jpg`;
}

function loadFrame(index) {
  const safeIndex = clamp(index, 0, frameCount - 1);
  if (frameCache.has(safeIndex)) return frameCache.get(safeIndex);

  const image = new Image();
  image.decoding = "async";
  image.src = frameSource(safeIndex);
  frameCache.set(safeIndex, image);
  return image;
}

function commitFrame(index, image) {
  if (index !== requestedFrame || (index === activeFrame && sequenceFrame.src === image.src)) return;
  activeFrame = index;
  sequenceFrame.src = image.src;
}

function prepareTypewriter(block) {
  const heading = block.querySelector("h1, h2");
  if (!heading) return;

  const accessibleText = heading.textContent.replace(/\s+/g, " ").trim();
  const visual = document.createElement("span");
  const characters = [];

  [...heading.childNodes].forEach((node) => {
    if (node.nodeName === "BR") {
      visual.append(document.createElement("br"));
      return;
    }

    [...node.textContent].forEach((character) => {
      const span = document.createElement("span");
      span.className = "type-char";
      span.textContent = character;
      visual.append(span);
      characters.push(span);
    });
  });

  visual.className = "typewriter-visual";
  visual.setAttribute("aria-hidden", "true");
  heading.setAttribute("aria-label", accessibleText);
  heading.replaceChildren(visual);
  block.typewriterCharacters = characters;
  block.typedCharacterCount = -1;
}

function displayFrame(index) {
  requestedFrame = index;
  const image = loadFrame(index);

  if (image.complete && image.naturalWidth) {
    commitFrame(index, image);
    return;
  }

  image.addEventListener("load", () => commitFrame(index, image), { once: true });
}

function preloadAround(index) {
  for (let offset = -8; offset <= 24; offset += 1) {
    loadFrame(index + offset);
  }
}

function pruneCache(index) {
  frameCache.forEach((image, cachedIndex) => {
    if (Math.abs(cachedIndex - index) <= 48 || chapterFrames.has(cachedIndex)) return;
    frameCache.delete(cachedIndex);
  });
}

function updateCopy(progress) {
  copyBlocks.forEach((block) => {
    const from = Number(block.dataset.from);
    const to = Number(block.dataset.to);
    const edge = Math.min(0.025, (to - from) * 0.22);
    const entering = from === 0 ? 1 : clamp((progress - from) / edge, 0, 1);
    const leaving = clamp((to - progress) / edge, 0, 1);
    const opacity = Math.min(entering, leaving);
    const writingProgress = clamp(((progress - from) / (to - from)) * 1.55, 0, 1);
    const characters = block.typewriterCharacters || [];
    const visibleCharacters = Math.round(writingProgress * characters.length);

    if (visibleCharacters !== block.typedCharacterCount) {
      characters.forEach((character, index) => {
        character.classList.toggle("is-typed", index < visibleCharacters);
      });
      block.typedCharacterCount = visibleCharacters;
    }

    block.style.setProperty("--copy-opacity", opacity.toFixed(3));
    block.classList.toggle("is-visible", opacity > 0.02);
    block.setAttribute("aria-hidden", String(opacity <= 0.02));
  });
}

function render() {
  rafPending = false;

  const bounds = story.getBoundingClientRect();
  const scrollRange = Math.max(1, story.offsetHeight - window.innerHeight);
  const progress = introPlaying ? 0 : clamp(-bounds.top / scrollRange, 0, 1);
  const rawFrame = progress * (frameCount - 1);
  const frameIndex = reduceMotion.matches
    ? Math.round(rawFrame / 12) * 12
    : Math.round(rawFrame);
  const safeFrame = clamp(frameIndex, 0, frameCount - 1);

  document.body.classList.toggle("content-mode", bounds.bottom < window.innerHeight * 0.65);
  document.documentElement.style.setProperty("--progress", progress.toFixed(4));

  displayFrame(safeFrame);
  preloadAround(safeFrame);
  pruneCache(safeFrame);
  updateCopy(progress);
  story.style.setProperty("--film-ui-opacity", String(1 - clamp((progress - 0.94) / 0.05, 0, 1)));
  progressMilestones.forEach((milestone, index) => {
    const reached = progress >= Number(milestone.dataset.progress);
    const next = progressMilestones[index + 1];
    milestone.classList.toggle("is-reached", reached);
    const current = reached && (!next || progress < Number(next.dataset.progress));
    milestone.classList.toggle("is-current", current);
    const button = milestone.querySelector("button");
    if (current) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  const chapter = chapters.find(({ from, to }) => progress >= from && progress <= to) || chapters.at(-1);
  eraLabel.textContent = `${chapter.era} · ${chapter.label}`;
  frameLabel.textContent = `${(safeFrame / sequenceFps).toFixed(1)} s`;
  progressFill.title = chapter.label;
  scrollHint.style.opacity = progress > 0.025 ? "0" : "1";
}

function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(render);
}

const firstFrame = loadFrame(0);
const introFrame = document.querySelector("#intro-frame");
const introSkip = document.querySelector("#intro-skip");
const introProgress = document.querySelector("#intro-progress");
const firstFrameReady = sequenceFrame.decode().catch(() => {});
let introScaleFrame = 0;
let introStartTime = 0;

function introFrameSource(index) {
  const number = String(index + 1).padStart(4, "0");
  return `assets/intro-sequence/frame-${number}.jpg`;
}

const introFrameCache = new Map();
function loadIntroFrame(index) {
  const safeIndex = clamp(index, 0, introFrameCount - 1);
  if (introFrameCache.has(safeIndex)) return introFrameCache.get(safeIndex);

  const image = new Image();
  image.decoding = "async";
  image.src = introFrameSource(safeIndex);
  introFrameCache.set(safeIndex, image);
  return image;
}

function updateIntroScale(now) {
  if (!introPlaying) return;
  const elapsed = (now - introStartTime) / 1000;
  const progress = clamp(elapsed / introDuration, 0, 1);
  introProgress.style.setProperty("--intro-progress", String(progress));
  introProgress.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  // Grow gently over most of the intro, then hold for the handoff.
  const scaleProgress = clamp(progress / 0.8, 0, 1);
  introFrame.style.opacity = String(clamp(elapsed / 1.5, 0, 1));
  const eased = scaleProgress * scaleProgress * (3 - 2 * scaleProgress);
  const viewport = introFrame.parentElement;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const naturalWidth = introFrame.naturalWidth;
  const naturalHeight = introFrame.naturalHeight;
  if (naturalWidth && naturalHeight && width && height) {
    const fit = Math.min(width / naturalWidth, height / naturalHeight);
    const fill = Math.max(width / naturalWidth, height / naturalHeight);
    const initialScale = 0.2 * fit / fill;
    introFrame.style.width = `${naturalWidth * fill}px`;
    introFrame.style.height = `${naturalHeight * fill}px`;
    document.documentElement.style.setProperty("--intro-scale", String(initialScale + (1 - initialScale) * eased));
  }
  const frameIndex = clamp(Math.floor(elapsed * introFps), 0, introFrameCount - 1);
  const frame = loadIntroFrame(frameIndex);
  if (frame.complete) introFrame.src = frame.src;
  else frame.addEventListener("load", () => { if (introPlaying) introFrame.src = frame.src; }, { once: true });
  if (progress >= 1) { finishIntro(); return; }
  introScaleFrame = requestAnimationFrame(updateIntroScale);
}

async function finishIntro() {
  if (!introPlaying) return;
  cancelAnimationFrame(introScaleFrame);
  document.documentElement.style.setProperty("--intro-scale", "1");
  // Hold the final intro frame until the matching image underneath is decoded.
  await firstFrameReady;
  if (!introPlaying) return;
  window.scrollTo({ top: 0, behavior: "instant" });
  introPlaying = false;
  document.documentElement.classList.add("presentation-started");
  introFrame.hidden = true;
  introSkip.hidden = true;
  introProgress.hidden = true;
  sequenceLoader.classList.add("is-hidden");
  document.documentElement.classList.remove("intro-playing");
  if (document.activeElement === introSkip) document.querySelector(".site-menu summary").focus();
  requestRender();
}

function startIntro() {
  if (reduceMotion.matches || window.location.hash) {
    document.documentElement.classList.add("presentation-started");
    firstFrameReady.then(() => sequenceLoader.classList.add("is-hidden"));
    return;
  }
  introPlaying = true;
  document.documentElement.style.setProperty("--intro-scale", "0.2");
  document.documentElement.classList.add("intro-playing");
  for (let index = 1; index < introFrameCount; index += 1) loadIntroFrame(index);
  window.scrollTo({ top: 0, behavior: "instant" });
  introFrame.style.opacity = "0";
  introFrame.hidden = false;
  introSkip.hidden = false;
  introProgress.hidden = false;
  introSkip.addEventListener("click", finishIntro);
  const first = loadIntroFrame(0);
  const begin = () => {
    introFrame.src = first.src;
    document.documentElement.classList.add("presentation-started");
    sequenceLoader.classList.add("is-hidden");
    introStartTime = performance.now();
    introScaleFrame = requestAnimationFrame(updateIntroScale);
  };
  if (first.complete) begin();
  else first.addEventListener("load", begin, { once: true });
}

const presentationStart = document.querySelector("#presentation-start");
const presentationButton = document.querySelector("#presentation-start-button");
const presentationContent = [...document.querySelectorAll("body > :not(.presentation-start):not(script)")];
if (document.documentElement.classList.contains("presentation-ready")) {
  presentationStart.hidden = false;
  presentationContent.forEach((element) => { element.inert = true; });
  presentationButton.focus({ preventScroll: true });
  presentationButton.addEventListener("click", () => {
    presentationButton.disabled = true;
    // Set the intro state before removing the white screen to avoid a film flash.
    startIntro();
    presentationContent.forEach((element) => { element.inert = false; });
    presentationStart.hidden = true;
    document.documentElement.classList.remove("presentation-ready");
    if (introPlaying) introSkip.focus({ preventScroll: true });
    else document.querySelector(".site-menu summary").focus({ preventScroll: true });
  }, { once: true });
} else {
  startIntro();
}

copyBlocks.forEach(prepareTypewriter);
for (let index = 0; index < 32; index += 1) loadFrame(index);

const preloadChapterFrames = () => {
  chapterFrames.forEach(loadFrame);
};

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(preloadChapterFrames, { timeout: 2200 });
} else {
  window.setTimeout(preloadChapterFrames, 700);
}

progressMilestones.forEach((milestone) => {
  milestone.querySelector("button").addEventListener("click", () => {
    const storyTop = window.scrollY + story.getBoundingClientRect().top;
    const scrollRange = Math.max(1, story.offsetHeight - window.innerHeight);
    const target = Number(milestone.dataset.progress);
    window.scrollTo({
      top: target === 1 ? document.querySelector("#inhalt").getBoundingClientRect().top + window.scrollY - document.querySelector(".site-header").offsetHeight : Math.ceil(storyTop + target * scrollRange),
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  });
});

window.addEventListener("scroll", requestRender, { passive: true });
window.addEventListener("resize", requestRender);
reduceMotion.addEventListener?.("change", requestRender);
render();
