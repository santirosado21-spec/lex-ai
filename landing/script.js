'use strict';

const downloadButton = document.getElementById('download-button');
const downloadState = document.getElementById('download-state');
const downloadSize = document.getElementById('download-size');
const downloadSha = document.getElementById('download-sha');
const copyButton = document.getElementById('copy-sha');
const copyStatus = document.getElementById('copy-status');
const versionNodes = document.querySelectorAll('[data-release-version]');

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
    versionNodes.forEach(node => { node.textContent = catalogue.version || '0.4.2'; });
    const available = typeof catalogue.downloadUrl === 'string' && isSafeDownloadUrl(catalogue.downloadUrl)
      && Number.isFinite(catalogue.bytes) && catalogue.bytes > 0
      && typeof catalogue.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(catalogue.sha256);
    if (!available) return setUnavailable();
    setAvailable(catalogue);
  } catch {
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

loadCatalogue();
