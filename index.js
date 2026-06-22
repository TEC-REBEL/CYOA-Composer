/**
 * CYOA Multi-Choice Combiner — SillyTavern Extension
 *
 * Intercepts CYOA choices (buttons, list items, or custom selectors),
 * allows multi-select with custom text, editing, reordering,
 * and sends combined. Supports side/bottom panel and themes.
 */

import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

/* ═══════════════════════════════════════════════════════════
   Constants & State
   ═══════════════════════════════════════════════════════════ */

const moduleUrl = new URL(import.meta.url);
const pathSegments = moduleUrl.pathname.split('/');
const extIndex = pathSegments.indexOf('extensions');
const EXT_NAME = pathSegments.slice(extIndex + 1, pathSegments.length - 1).join('/');
const LOG = '[CYOA-Combiner]';

const DEFAULT_SETTINGS = {
    enabled: true,
    sendFormat: 'I choose:\n{choices}',
    showNumbers: true,
    joinSeparator: '\n',
    detectionMode: 'buttons',
    customSelector: '',
    panelPosition: 'side-right',
    theme: 'purple',
};

/** Preset CSS selectors for each detection mode */
const DETECTION_PRESETS = {
    'buttons':   '.custom-menu-msg-button',
    'numbered':  'ol > li',
    'bulleted':  'ul > li',
    'all-list':  'li',
    'custom':    null,
};

/**
 * Ordered queue of items.
 * @typedef  {Object} QueueItem
 * @property {string}              id
 * @property {'choice'|'custom'}   type
 * @property {string}              text
 * @property {string}              [mesId]
 * @property {number}              [btnIndex]
 * @property {boolean}             expanded
 * @type {QueueItem[]}
 */
const queue = [];
let nextItemId = 1;
let panel = null;
let isSending = false;
let manualOpen = false;

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const s = () => extension_settings[EXT_NAME];
const uid = () => 'cyoa-' + (nextItemId++);
const escHtml = (str) => { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; };

/**
 * Get the active CSS selector based on settings.
 */
function getSelector() {
    const mode = s().detectionMode || 'buttons';
    if (mode === 'custom') return (s().customSelector || '').trim();
    return DETECTION_PRESETS[mode] || DETECTION_PRESETS['buttons'];
}

/**
 * Check if an element is a "leaf" list item (has no nested sub-list).
 */
function isLeafLi(el) {
    if (el.tagName !== 'LI') return true;
    return !el.querySelector(':scope > ul, :scope > ol');
}

/**
 * Find the choice element in a message given mesId + index.
 */
function findChoiceEl(mesId, btnIndex) {
    const mesEl = document.querySelector(`.mes[mesid="${mesId}"]`);
    if (!mesEl) return null;
    const mesText = mesEl.querySelector('.mes_text');
    if (!mesText) return null;
    const sel = getSelector();
    if (!sel) return null;
    const all = Array.from(mesText.querySelectorAll(sel)).filter(isLeafLi);
    return all[btnIndex] || null;
}

/* ═══════════════════════════════════════════════════════════
   Queue Management
   ═══════════════════════════════════════════════════════════ */

function addChoice(el) {
    const mesEl = el.closest('.mes');
    if (!mesEl) return;
    const mesId = mesEl.getAttribute('mesid') || '';
    const mesText = mesEl.querySelector('.mes_text');
    if (!mesText) return;
    const sel = getSelector();
    if (!sel) return;
    const all = Array.from(mesText.querySelectorAll(sel)).filter(isLeafLi);
    const btnIndex = all.indexOf(el);
    if (btnIndex < 0) return;

    const choiceText = el.textContent.trim();

    // Toggle off if already queued
    const existing = queue.find(q => q.type === 'choice' && q.mesId === mesId && q.btnIndex === btnIndex);
    if (existing) { removeItem(existing.id); return; }

    queue.push({ id: uid(), type: 'choice', text: choiceText, mesId, btnIndex, expanded: false });
    el.classList.add('cyoa-selected');
    refreshBadges();
    renderPanel();
}

function addCustomText(text) {
    if (!text.trim()) return;
    queue.push({ id: uid(), type: 'custom', text: text.trim(), expanded: false });
    renderPanel();
}

function removeItem(itemId) {
    const idx = queue.findIndex(q => q.id === itemId);
    if (idx < 0) return;
    const item = queue[idx];
    if (item.type === 'choice') {
        const el = findChoiceEl(item.mesId, item.btnIndex);
        if (el) { el.classList.remove('cyoa-selected'); el.querySelector('.cyoa-select-number')?.remove(); }
    }
    queue.splice(idx, 1);
    refreshBadges();
    renderPanel();
}

function moveItem(itemId, dir) {
    const idx = queue.findIndex(q => q.id === itemId);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= queue.length) return;
    [queue[idx], queue[swap]] = [queue[swap], queue[idx]];
    refreshBadges();
    renderPanel();
}

function editItemText(itemId, newText) {
    const item = queue.find(q => q.id === itemId);
    if (item && newText.trim()) item.text = newText.trim();
}

function toggleExpand(itemId) {
    const item = queue.find(q => q.id === itemId);
    if (item) { item.expanded = !item.expanded; renderPanel(); }
}

function clearQueue() {
    document.querySelectorAll('.cyoa-selected').forEach(el => {
        el.classList.remove('cyoa-selected');
        el.querySelector('.cyoa-select-number')?.remove();
    });
    queue.length = 0;
    manualOpen = false;
    renderPanel();
    updateToggleButton();
}

function refreshBadges() {
    document.querySelectorAll('.cyoa-select-number').forEach(b => b.remove());
    document.querySelectorAll('.cyoa-selected').forEach(b => b.classList.remove('cyoa-selected'));
    let n = 0;
    for (const item of queue) {
        if (item.type !== 'choice') continue;
        n++;
        const el = findChoiceEl(item.mesId, item.btnIndex);
        if (!el) continue;
        el.classList.add('cyoa-selected');
        const badge = document.createElement('span');
        badge.className = 'cyoa-select-number';
        badge.textContent = String(n);
        el.prepend(badge);
    }
}

/* ═══════════════════════════════════════════════════════════
   Panel Rendering
   ═══════════════════════════════════════════════════════════ */

function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'cyoa-panel';
    document.body.appendChild(panel);
}

function renderPanel() {
    ensurePanel();
    const cfg = s();
    const pos = cfg.panelPosition || 'side-right';
    const theme = cfg.theme || 'purple';
    const count = queue.length;

    // Position & theme classes
    panel.className = `cyoa-panel cyoa-pos-${pos}`;
    panel.dataset.theme = theme;

    // Build items
    let itemsHtml = '';
    queue.forEach((item, i) => {
        const isFirst = i === 0;
        const isLast = i === queue.length - 1;
        const typeLabel = item.type === 'choice' ? '☑' : '✍';
        const typeClass = item.type === 'custom' ? 'cyoa-type-custom' : 'cyoa-type-choice';
        const escaped = escHtml(item.text);
        const trunc = item.text.length > 45 ? escHtml(item.text.substring(0, 42)) + '…' : escaped;

        const expandedContent = item.expanded ? `
            <div class="cyoa-item-expanded">
                <textarea class="cyoa-expand-textarea" data-item-id="${item.id}" rows="2">${escaped}</textarea>
                <div class="cyoa-expand-actions">
                    <button class="cyoa-exp-btn cyoa-exp-save" data-item-id="${item.id}">Save</button>
                    <button class="cyoa-exp-btn cyoa-exp-cancel" data-item-id="${item.id}">Cancel</button>
                </div>
            </div>` : '';

        itemsHtml += `
        <div class="cyoa-queue-item ${item.expanded ? 'cyoa-item-open' : ''}" data-item-id="${item.id}">
            <div class="cyoa-item-row">
                <span class="cyoa-item-order">${i + 1}</span>
                <span class="cyoa-item-type-tag ${typeClass}">${typeLabel}</span>
                <span class="cyoa-item-text" data-item-id="${item.id}" title="${escaped}">${trunc}</span>
                <div class="cyoa-item-actions">
                    <button class="cyoa-item-btn cyoa-item-expand" data-item-id="${item.id}" title="${item.expanded ? 'Collapse' : 'Expand & Edit'}">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">${item.expanded ? '<path d="M18 15l-6-6-6 6"/>' : '<path d="M6 9l6 6 6-6"/>'}</svg>
                    </button>
                    <button class="cyoa-item-btn cyoa-item-up" data-item-id="${item.id}" title="Move up" ${isFirst ? 'disabled' : ''}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    <button class="cyoa-item-btn cyoa-item-down" data-item-id="${item.id}" title="Move down" ${isLast ? 'disabled' : ''}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <button class="cyoa-item-btn cyoa-item-remove" data-item-id="${item.id}" title="Remove">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            ${expandedContent}
        </div>`;
    });

    panel.innerHTML = `
    <div class="cyoa-panel-inner">
        <div class="cyoa-panel-header">
            <div class="cyoa-panel-title">
                <span class="cyoa-panel-title-text">Compose</span>
                <span class="cyoa-count-badge">${count}</span>
            </div>
            <button class="cyoa-header-btn" id="cyoa-collapse-btn" title="Minimize">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
        </div>
        <div class="cyoa-panel-body">
            <div class="cyoa-queue-list" id="cyoa-queue-list">
                ${itemsHtml || '<div class="cyoa-empty-hint">Click choices to add them here</div>'}
            </div>
            <div class="cyoa-add-custom">
                <input type="text" class="cyoa-custom-input" id="cyoa-custom-input" placeholder="✍ Add custom text…" autocomplete="off" />
                <button class="cyoa-add-btn" id="cyoa-add-btn" title="Add">+</button>
            </div>
        </div>
        <div class="cyoa-panel-footer">
            <button class="cyoa-btn cyoa-btn-clear" id="cyoa-clear-btn">Clear</button>
            <button class="cyoa-btn cyoa-btn-send" id="cyoa-send-btn" ${count === 0 ? 'disabled' : ''}>Send Combined</button>
        </div>
    </div>`;

    // Visibility — show if queue has items OR manually opened
    const shouldShow = count > 0 || manualOpen;
    panel.classList.toggle('cyoa-visible', shouldShow);
    if (!shouldShow) panel.classList.remove('cyoa-collapsed');
    updateToggleButton();

    bindPanelEvents();
}

function bindPanelEvents() {
    if (!panel) return;

    panel.querySelector('#cyoa-clear-btn')?.addEventListener('click', clearQueue);
    panel.querySelector('#cyoa-send-btn')?.addEventListener('click', sendCombinedChoices);
    panel.querySelector('#cyoa-collapse-btn')?.addEventListener('click', () => panel.classList.toggle('cyoa-collapsed'));

    const input = panel.querySelector('#cyoa-custom-input');
    const addBtn = panel.querySelector('#cyoa-add-btn');
    function handleAdd() {
        if (!input) return;
        const t = input.value.trim();
        if (t) { addCustomText(t); input.value = ''; }
        input.focus();
    }
    addBtn?.addEventListener('click', handleAdd);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } });

    // Delegated item events
    panel.querySelector('#cyoa-queue-list')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-item-id]');
        if (!btn) return;
        const id = btn.dataset.itemId;

        if (btn.classList.contains('cyoa-item-remove'))  { removeItem(id); }
        else if (btn.classList.contains('cyoa-item-up'))  { moveItem(id, 'up'); }
        else if (btn.classList.contains('cyoa-item-down')){ moveItem(id, 'down'); }
        else if (btn.classList.contains('cyoa-item-expand')) { toggleExpand(id); }
        else if (btn.classList.contains('cyoa-exp-save')) {
            const ta = panel.querySelector(`.cyoa-expand-textarea[data-item-id="${id}"]`);
            if (ta) editItemText(id, ta.value);
            const item = queue.find(q => q.id === id);
            if (item) item.expanded = false;
            renderPanel();
        }
        else if (btn.classList.contains('cyoa-exp-cancel')) {
            const item = queue.find(q => q.id === id);
            if (item) item.expanded = false;
            renderPanel();
        }
    });

    // Stop textarea clicks from bubbling
    panel.querySelectorAll('.cyoa-expand-textarea').forEach(ta => {
        ta.addEventListener('click', e => e.stopPropagation());
        ta.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const item = queue.find(q => q.id === ta.dataset.itemId);
                if (item) { item.expanded = false; renderPanel(); }
            }
        });
    });
}

/* ═══════════════════════════════════════════════════════════
   Message Sending
   ═══════════════════════════════════════════════════════════ */

async function sendCombinedChoices() {
    const cfg = s();
    if (queue.length === 0) return;

    const lines = queue.map((item, i) =>
        cfg.showNumbers ? `${i + 1}. ${item.text}` : item.text,
    );
    const choicesText = lines.join(cfg.joinSeparator || '\n');
    let msg = (cfg.sendFormat || '{choices}').replace('{choices}', choicesText);

    console.log(LOG, 'Sending:', msg);
    clearQueue();
    isSending = true;

    const textarea = document.getElementById('send_textarea');
    if (textarea) {
        $(textarea).val(msg);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        $('#send_but').trigger('click');
    }
    setTimeout(() => { isSending = false; }, 500);
}

/* ═══════════════════════════════════════════════════════════
   Click Interception
   ═══════════════════════════════════════════════════════════ */

function onButtonClick(e) {
    if (isSending) return;
    const cfg = s();
    if (!cfg || !cfg.enabled) return;

    const sel = getSelector();
    if (!sel) return;

    const el = e.target.closest(sel);
    if (!el) return;

    // Must be inside a chat message's text
    const mesText = el.closest('.mes_text');
    if (!mesText) return;

    // Skip non-leaf list items (containers with sub-lists)
    if (!isLeafLi(el)) return;

    // Don't intercept if clicking inside our own edit areas
    if (e.target.closest('.cyoa-expand-textarea, .cyoa-exp-btn')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    addChoice(el);
}

/* ═══════════════════════════════════════════════════════════
   Choice Enhancement (visual indicators on detected elements)
   ═══════════════════════════════════════════════════════════ */

function enhanceChoicesInMessage(mesId) {
    const cfg = s();
    if (!cfg || !cfg.enabled) return;

    const mesEl = document.querySelector(`.mes[mesid="${mesId}"]`);
    if (!mesEl) return;
    const mesText = mesEl.querySelector('.mes_text');
    if (!mesText) return;

    const sel = getSelector();
    if (!sel) return;

    let elements;
    try { elements = mesText.querySelectorAll(sel); }
    catch { return; } // invalid selector

    const filtered = Array.from(elements).filter(isLeafLi);
    if (filtered.length === 0) return;

    console.log(LOG, `Found ${filtered.length} choices in message ${mesId}`);

    filtered.forEach(el => {
        if (!el.classList.contains('cyoa-enhanced')) {
            el.classList.add('cyoa-enhanced');
        }
    });
}

/* ═══════════════════════════════════════════════════════════
   Event Handlers
   ═══════════════════════════════════════════════════════════ */

function onChatChanged()       { clearQueue(); }
function onMessageSwiped()     { clearQueue(); }
function onGenerationStarted() { clearQueue(); }
function onCharacterMessageRendered(mesId) { enhanceChoicesInMessage(mesId); }

/* ═══════════════════════════════════════════════════════════
   Settings UI
   ═══════════════════════════════════════════════════════════ */

async function setupUI() {
    const html = await renderExtensionTemplateAsync(EXT_NAME, 'settings');
    document.getElementById('extensions_settings').append(
        ...new DOMParser().parseFromString(html, 'text/html').body.childNodes,
    );

    const cfg = s();

    // Enable
    const cb = document.getElementById('cyoa_enabled');
    if (cb) { cb.checked = cfg.enabled; cb.addEventListener('change', () => { cfg.enabled = cb.checked; saveSettingsDebounced(); if (!cfg.enabled) clearQueue(); }); }

    // Show numbers
    const sn = document.getElementById('cyoa_show_numbers');
    if (sn) { sn.checked = cfg.showNumbers; sn.addEventListener('change', () => { cfg.showNumbers = sn.checked; saveSettingsDebounced(); }); }

    // Detection mode
    const dm = document.getElementById('cyoa_detection_mode');
    const csRow = document.getElementById('cyoa_custom_selector_row');
    const csInput = document.getElementById('cyoa_custom_selector');
    if (dm) {
        dm.value = cfg.detectionMode;
        csRow.style.display = cfg.detectionMode === 'custom' ? 'block' : 'none';
        dm.addEventListener('change', () => {
            cfg.detectionMode = dm.value;
            csRow.style.display = dm.value === 'custom' ? 'block' : 'none';
            saveSettingsDebounced();
        });
    }
    if (csInput) {
        csInput.value = cfg.customSelector || '';
        csInput.addEventListener('input', () => { cfg.customSelector = csInput.value; saveSettingsDebounced(); });
    }

    // Panel position
    document.querySelectorAll('input[name="cyoa_panel_pos"]').forEach(radio => {
        if (radio.value === cfg.panelPosition) radio.checked = true;
        radio.addEventListener('change', () => {
            cfg.panelPosition = radio.value;
            saveSettingsDebounced();
            renderPanel();
        });
    });

    // Theme
    document.querySelectorAll('input[name="cyoa_theme"]').forEach(radio => {
        if (radio.value === cfg.theme) radio.checked = true;
        radio.addEventListener('change', () => {
            cfg.theme = radio.value;
            saveSettingsDebounced();
            renderPanel();
        });
    });

    // Send format
    const fmt = document.getElementById('cyoa_send_format');
    if (fmt) {
        fmt.value = cfg.sendFormat;
        let t = null;
        fmt.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { cfg.sendFormat = fmt.value; saveSettingsDebounced(); }, 500); });
    }
    document.getElementById('cyoa_reset_format')?.addEventListener('click', () => {
        cfg.sendFormat = DEFAULT_SETTINGS.sendFormat;
        if (fmt) fmt.value = cfg.sendFormat;
        saveSettingsDebounced();
    });
}

/* ═══════════════════════════════════════════════════════════
   Chat Bar Toggle Button
   ═══════════════════════════════════════════════════════════ */

function createToggleButton() {
    const container = document.getElementById('leftSendForm');
    if (!container) { console.warn(LOG, '#leftSendForm not found'); return; }
    // Don't add twice
    if (document.getElementById('cyoa-toggle-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'cyoa-toggle-btn';
    btn.className = 'fa-solid fa-list-check cyoa-chat-toggle interactable';
    btn.title = 'Open CYOA Combiner';
    btn.addEventListener('click', togglePanel);
    container.appendChild(btn);
}

function togglePanel() {
    const isVisible = panel && panel.classList.contains('cyoa-visible');
    if (isVisible) {
        // Close: if queue is empty just hide, if queue has items collapse
        if (queue.length === 0) {
            manualOpen = false;
            renderPanel();
        } else {
            panel.classList.toggle('cyoa-collapsed');
        }
    } else {
        // Open
        manualOpen = true;
        renderPanel();
        // Focus the custom text input
        setTimeout(() => {
            document.getElementById('cyoa-custom-input')?.focus();
        }, 100);
    }
    updateToggleButton();
}

function updateToggleButton() {
    const btn = document.getElementById('cyoa-toggle-btn');
    if (!btn) return;
    const isActive = panel && panel.classList.contains('cyoa-visible') && !panel.classList.contains('cyoa-collapsed');
    btn.classList.toggle('cyoa-toggle-active', isActive);
    // Show badge if queue has items
    let badge = btn.querySelector('.cyoa-toggle-badge');
    if (queue.length > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cyoa-toggle-badge';
            btn.appendChild(badge);
        }
        badge.textContent = String(queue.length);
    } else if (badge) {
        badge.remove();
    }
}

/* ═══════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════ */

(async function init() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = {};
    const cfg = extension_settings[EXT_NAME];
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
        if (cfg[k] === undefined) cfg[k] = typeof v === 'object' && !Array.isArray(v) ? { ...v } : v;
    }

    await setupUI();
    ensurePanel();
    createToggleButton();

    document.addEventListener('click', onButtonClick, true);

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);

    console.log(LOG, 'Loaded — detection:', cfg.detectionMode, '| position:', cfg.panelPosition, '| theme:', cfg.theme);
})();
