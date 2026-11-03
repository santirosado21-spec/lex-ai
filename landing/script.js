'use strict';

const downloadButton = document.getElementById('download-button');
const downloadState = document.getElementById('download-state');
const downloadSize = document.getElementById('download-size');
const downloadSha = document.getElementById('download-sha');
const copyButton = document.getElementById('copy-sha');
const copyStatus = document.getElementById('copy-status');
const versionNodes = document.querySelectorAll('[data-release-version]');
const themeToggle = document.getElementById('theme-toggle');
const themeLabels = {auto:'Automático', light:'Claro', dark:'Oscuro'};
const integrationsStatus = document.getElementById('integrations-status');
const INTEGRATIONS_VERSION = [0, 4, 6];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function versionAtLeast(value, minimum) {
  const parts = String(value || '').split('.').map(part => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < minimum.length; index++) {
    if ((parts[index] || 0) !== minimum[index]) return (parts[index] || 0) > minimum[index];
  }
  return true;
}
const PROJECTS_VERSION = [0, 4, 7];
function setReleasePill(node, version, minimum) {
  if (!node) return;
  const available = versionAtLeast(version, minimum);
  node.textContent = available ? `Incluido desde la versión ${minimum.join('.')}` : 'Próxima versión';
  node.dataset.state = available ? 'available' : 'upcoming';
}
function setIntegrationsStatus(version) {
  setReleasePill(integrationsStatus, version, INTEGRATIONS_VERSION);
  document.querySelectorAll('[data-projects-status]').forEach(node => setReleasePill(node, version, PROJECTS_VERSION));
}

function currentTheme() {
  try { const saved=localStorage.getItem('lex-ai.appearance'); return saved==='light'||saved==='dark'||saved==='auto'?saved:'auto'; }
  catch { return 'auto'; }
}
function setTheme(theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = themeLabels[theme];
    themeToggle.setAttribute('aria-label', `Cambiar apariencia: ${themeLabels[theme]}`);
    themeToggle.title = `Apariencia: ${themeLabels[theme]}`;
  }
  try { localStorage.setItem('lex-ai.appearance', theme); } catch {}
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Tamaño pendiente de publicación';
  const gib = bytes / 1e9;
  return `${gib >= 1 ? gib.toFixed(2) : (bytes / 1e6).toFixed(1)} ${gib >= 1 ? 'GB' : 'MB'}`;
}

function setUnavailable(message = 'La descarga aún no está publicada.') {
  downloadButton.removeAttribute('href');
  downloadButton.setAttribute('aria-disabled', 'true');
  downloadButton.setAttribute('tabindex', '-1');
  downloadButton.textContent = 'Disponible muy pronto';
  downloadState.textContent = message;
  downloadSize.textContent = 'Tamaño pendiente de publicación';
  downloadSha.textContent = 'Pendiente de publicación';
  copyButton.disabled = true;
}

function setAvailable(catalogue) {
  downloadButton.href = catalogue.downloadUrl;
  downloadButton.setAttribute('download', '');
  downloadButton.setAttribute('aria-disabled', 'false');
  downloadButton.removeAttribute('tabindex');
  downloadButton.textContent = `Descargar LEX AI ${catalogue.version}`;
  downloadState.textContent = 'La descarga incluye un archivo DMG para Apple Silicon.';
  downloadSize.textContent = formatBytes(catalogue.bytes);
  downloadSha.textContent = catalogue.sha256;
  copyButton.disabled = false;
}

function isSafeDownloadUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function loadCatalogue() {
  try {
    const response = await fetch('catalogue.json', {credentials: 'same-origin'});
    if (!response.ok) throw new Error('No se pudo leer el catálogo.');
    const catalogue = await response.json();
    versionNodes.forEach(node => { node.textContent = catalogue.version || '0.4.3'; });
    setIntegrationsStatus(catalogue.version);
    const available = typeof catalogue.downloadUrl === 'string' && isSafeDownloadUrl(catalogue.downloadUrl)
      && Number.isFinite(catalogue.bytes) && catalogue.bytes > 0
      && typeof catalogue.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(catalogue.sha256);
    if (!available) return setUnavailable();
    setAvailable(catalogue);
  } catch {
    setIntegrationsStatus('0');
    setUnavailable('La descarga no está disponible en este momento.');
  }
}

copyButton.addEventListener('click', async () => {
  if (copyButton.disabled) return;
  try {
    await navigator.clipboard.writeText(downloadSha.textContent);
    copyStatus.textContent = 'SHA-256 copiado.';
  } catch {
    copyStatus.textContent = 'No se pudo copiar; selecciona el SHA-256 manualmente.';
  }
});

setTheme(currentTheme());
themeToggle?.addEventListener('click', () => {
  const theme=currentTheme();
  setTheme(theme==='auto'?'light':theme==='light'?'dark':'auto');
});
loadCatalogue();

/* ---------- Hero demo: tabs ---------- */
const demo = document.getElementById('demo');
const tabs = demo ? [...demo.querySelectorAll('[role=tab]')] : [];
function selectTab(tab, focus) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
  if (tab.id === 'tab-app') requestAnimationFrame(drawLink);
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab, false));
  tab.addEventListener('keydown', event => {
    const keys = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1};
    if (!(event.key in keys)) return;
    event.preventDefault();
    selectTab(tabs[(keys[event.key] + tabs.length) % tabs.length], true);
  });
});

/* ---------- Hero demo: citation to passage ---------- */
const stage = document.getElementById('link-stage');
const citation = document.getElementById('cite-d1');
const passage = document.getElementById('passage-d1');
const linkPath = document.getElementById('link-path');
let pinned = false;
function drawLink() {
  if (!stage || !citation || !passage || !linkPath || stage.offsetParent === null) return;
  const box = stage.getBoundingClientRect();
  const from = citation.getBoundingClientRect();
  const to = passage.getBoundingClientRect();
  const x1 = from.left + from.width / 2 - box.left;
  const y1 = from.bottom - box.top + 2;
  const x2 = Math.min(Math.max(x1, to.left - box.left + 28), to.right - box.left - 28);
  const y2 = to.top - box.top - 2;
  const bend = Math.max(12, (y2 - y1) / 2);
  linkPath.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`);
}
function setLinked(linked) {
  if (!demo) return;
  demo.dataset.linked = String(linked);
  citation?.setAttribute('aria-pressed', String(linked));
  if (linked) drawLink();
}
if (citation) {
  citation.addEventListener('mouseenter', () => setLinked(true));
  citation.addEventListener('mouseleave', () => setLinked(pinned));
  citation.addEventListener('focus', () => setLinked(true));
  citation.addEventListener('blur', () => setLinked(pinned));
  citation.addEventListener('click', () => { pinned = !pinned; setLinked(pinned); });
  window.addEventListener('resize', drawLink);
  document.fonts?.ready.then(drawLink);
  drawLink();
  // One orchestrated moment: show the link once the page settles.
  setTimeout(() => { pinned = true; setLinked(true); }, reducedMotion.matches ? 0 : 900);
}
