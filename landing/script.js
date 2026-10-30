'use strict';

const tablist = document.querySelector('[role="tablist"]');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const narrowLayout = window.matchMedia('(max-width: 760px)');

function updateOrientation() {
  tablist.setAttribute('aria-orientation', narrowLayout.matches ? 'horizontal' : 'vertical');
}
updateOrientation();
narrowLayout.addEventListener('change', updateOrientation);

function activateTab(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
}

for (const tab of tabs) {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    const current = tabs.indexOf(tab);
    let next;
    const horizontal = narrowLayout.matches;
    if (event.key === (horizontal ? 'ArrowRight' : 'ArrowDown')) next = (current + 1) % tabs.length;
    if (event.key === (horizontal ? 'ArrowLeft' : 'ArrowUp')) next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      activateTab(tabs[next], true);
    }
  });
}

const privacy = document.getElementById('privacy-dialog');
let privacyTrigger;
for (const button of document.querySelectorAll('[data-open-privacy]')) {
  button.addEventListener('click', () => {
    privacyTrigger = button;
    privacy.showModal();
    document.body.classList.add('dialog-open');
  });
}
for (const button of document.querySelectorAll('[data-close-privacy]')) {
  button.addEventListener('click', () => privacy.close());
}
privacy.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  privacyTrigger?.focus();
});
privacy.addEventListener('click', event => {
  if (event.target !== privacy) return;
  const bounds = privacy.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) privacy.close();
});
