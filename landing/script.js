'use strict';

const platformCards = [...document.querySelectorAll('[data-platform]')];
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

const PLATFORM_LABELS = {'mac-arm64':'Mac · Apple Silicon','mac-x64':'Mac · Intel','windows-x64':'Windows'};
const FILE_SUFFIXES = {'mac-arm64':['arm64.dmg'],'mac-x64':['x64.dmg'],'windows-x64':['x64.exe','x64.msi']};
function validPlatformRelease(key, entry) {
  if (!entry || !['experimental-local-legacy','experimental','published'].includes(entry.status)
      || !/^\d+\.\d+\.\d+$/.test(entry.version || '')
      || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !entry.requirements || typeof entry.requirements !== 'object' || Array.isArray(entry.requirements)
      || !Number.isFinite(entry.requirements.minimumMemoryGB) || entry.requirements.minimumMemoryGB <= 0
      || !Number.isFinite(entry.requirements.minimumFreeDiskGB) || entry.requirements.minimumFreeDiskGB <= 0
      || typeof entry.downloadUrl !== 'string' || !FILE_SUFFIXES[key]) return false;
  // Literal canonical URLs only: no userinfo, query, fragment, encoding or redirects.
  return FILE_SUFFIXES[key].some(suffix => entry.downloadUrl ===
    `https://github.com/santirosado21-spec/lex-ai-descargas/releases/download/v${entry.version}/LEX-AI-${entry.version}-${suffix}`);
}
function renderPlatform(card, entry) {
  const key=card.dataset.platform, label=PLATFORM_LABELS[key];
  const field=name=>card.querySelector(`[data-field="${name}"]`);
  const button=field('download'), copy=field('copy');
  button.removeAttribute('href');button.removeAttribute('download');
  button.setAttribute('aria-disabled','true');button.setAttribute('tabindex','-1');
  button.textContent='Pendiente de publicación';copy.disabled=true;
  field('version').textContent='Versión pendiente';field('size').textContent='Tamaño pendiente';
  field('sha').textContent='Pendiente de publicación';field('copy-status').textContent='';
  field('state').textContent='No hay un instalador verificado para esta opción.';
  if (!validPlatformRelease(key,entry)) return;
  button.href=entry.downloadUrl;button.setAttribute('download','');
  button.setAttribute('aria-disabled','false');button.removeAttribute('tabindex');
  button.textContent=`Descargar para ${label}`;
  field('version').textContent=`Versión ${entry.version}`;
  field('state').textContent=entry.status==='experimental-local-legacy'
    ? 'Versión anterior local experimental; no incluye el nuevo flujo híbrido.'
    : 'Instalador publicado; revisa los requisitos y límites de esta versión.';
  field('size').textContent=formatBytes(entry.bytes);field('sha').textContent=entry.sha256;copy.disabled=false;
}
async function loadCatalogue() {
  try {
    const response=await fetch('catalogue.json',{credentials:'same-origin'});
    if (!response.ok) throw new Error('Catálogo no disponible.');
    const catalogue=await response.json();
    if (catalogue.schemaVersion!==3 || !catalogue.platforms || typeof catalogue.platforms!=='object') throw new Error('Catálogo no admitido.');
    platformCards.forEach(card=>renderPlatform(card,catalogue.platforms[card.dataset.platform]));
    const arm=catalogue.platforms['mac-arm64'];
    setIntegrationsStatus(validPlatformRelease('mac-arm64',arm)?arm.version:'0');
  } catch {
    platformCards.forEach(card=>renderPlatform(card,null));setIntegrationsStatus('0');
  }
}
platformCards.forEach(card=>{
  const download=card.querySelector('[data-field="download"]');
  download.addEventListener('click',event=>{if(download.getAttribute('aria-disabled')==='true')event.preventDefault();});
  download.addEventListener('keydown',event=>{if(download.getAttribute('aria-disabled')==='true' && ['Enter',' '].includes(event.key))event.preventDefault();});
  const copy=card.querySelector('[data-field="copy"]');
  copy.addEventListener('click',async()=>{
    if(copy.disabled)return;
    const version=card.querySelector('[data-field="version"]').textContent;
    const status=card.querySelector('[data-field="copy-status"]');
    try {
      await navigator.clipboard.writeText(card.querySelector('[data-field="sha"]').textContent);
      status.textContent=`SHA-256 copiado: ${PLATFORM_LABELS[card.dataset.platform]}, ${version}.`;
    } catch {status.textContent='No se pudo copiar; selecciona el SHA-256 manualmente.';}
  });
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
