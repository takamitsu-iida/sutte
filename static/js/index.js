const DATA_PATH = './static/data/sutte.json';

// GitHub Pages上で「データ編集」導線を出すための設定。
// 例: "iida/sutte" のように "owner/repo" を入れてください。
const GITHUB_REPO = 'takamitsu-iida/sutte';
const GITHUB_BRANCH = 'main';
const GITHUB_DATA_FILE = 'static/data/sutte.json';

function el(id) {
  return document.getElementById(id);
}

function setStatus(message) {
  const status = el('status');
  if (!status) return;
  status.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEditUrl() {
  if (!GITHUB_REPO) return null;
  return `https://github.com/${GITHUB_REPO}/edit/${GITHUB_BRANCH}/${GITHUB_DATA_FILE}`;
}

function normalizeSutteList(payload) {
  if (!payload) return [];

  // 形式A: { "items": [...] }
  if (Array.isArray(payload.items)) return payload.items;

  // 形式B: [...]
  if (Array.isArray(payload)) return payload;

  return [];
}

function formatTag(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<span class="tag">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
}

function getGroupLabel(item) {
  const manufacturer = item?.manufacturer ?? '';
  const productName = item?.productName ?? '';
  return [manufacturer, productName].filter(Boolean).join(' / ') || String(item?.id ?? '（名称未設定）');
}

function normalizeImagePath(image) {
  let normalized = (image ?? '').toString().trim();
  if (!normalized || normalized.endsWith('/')) return '';
  // GitHub Pages のプロジェクトページでは "/static/..." がドメイン直下を指して壊れるため、
  // 既存データ互換として "./static/..." に寄せます。
  if (normalized.startsWith('/static/')) {
    normalized = `.${normalized}`;
  }
  return normalized;
}

function renderVariantCard(item, groupLabel) {
  const color = item.color ?? '';
  const title = color || String(item.id ?? '（詳細未設定）');
  const alt = [groupLabel, title].filter(Boolean).join(' / ');

  const image = normalizeImagePath(item.image);
  const thumbHtml = image
    ? `<button class="thumb-button" type="button" data-image="${escapeHtml(image)}" data-alt="${escapeHtml(alt)}">
        <img class="thumb" src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" loading="lazy" />
      </button>`
    : `<div class="thumb" role="img" aria-label="画像なし"></div>`;

  const tags = [
    formatTag('サイズ', item.size),
    formatTag('号', item.go),
    formatTag('重さ', item.weight),
  ].filter(Boolean);

  const metaLines = [
    item.series ? `シリーズ: ${item.series}` : '',
  ].filter(Boolean);

  const note = item.note ?? '';

  return `
    <article class="card">
      ${thumbHtml}
      <div class="card-body">
        <h4 class="name">${escapeHtml(title)}</h4>
        ${metaLines.length ? `<p class="meta">${metaLines.map((l) => escapeHtml(l)).join('<br />')}</p>` : ''}
        ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
        ${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}
      </div>
    </article>
  `.trim();
}

function groupByName(list) {
  const groups = new Map();
  for (const item of list) {
    const key = getGroupLabel(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function renderGroupedList(list) {
  const groups = groupByName(list);
  const sections = [];

  for (const [label, items] of groups.entries()) {
    sections.push(`
      <section class="group" aria-label="${escapeHtml(label)}">
        <h3 class="group-title">${escapeHtml(label)} <span class="group-count">(${items.length})</span></h3>
        <div class="grid" aria-label="${escapeHtml(label)} の一覧">
          ${items.map((item) => renderVariantCard(item, label)).join('')}
        </div>
      </section>
    `.trim());
  }

  return sections.join('');
}

function ensureImageDialog() {
  let dialog = document.getElementById('image-dialog');
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.id = 'image-dialog';
  dialog.className = 'image-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="image-dialog-form">
      <button class="image-dialog-close" value="close" aria-label="閉じる">×</button>
      <img class="image-dialog-img" alt="" />
    </form>
  `.trim();

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  document.body.appendChild(dialog);
  return dialog;
}

function openImageInDialog(src, alt) {
  const dialog = ensureImageDialog();
  const img = dialog.querySelector('.image-dialog-img');
  if (!img) return;
  img.src = src;
  img.alt = alt || '';

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

async function loadData() {
  const res = await fetch(DATA_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error(`データ取得に失敗しました (${res.status})`);
  return await res.json();
}

async function main() {
  setStatus('読み込み中...');

  const editUrl = buildEditUrl();
  const editLink = el('github-edit-link');
  const editHint = el('github-edit-hint');
  if (editLink) {
    if (editUrl) {
      editLink.href = editUrl;
      editLink.removeAttribute('aria-disabled');
      if (editHint) editHint.hidden = true;
    } else {
      editLink.href = '#';
      editLink.setAttribute('aria-disabled', 'true');
      if (editHint) editHint.hidden = false;
    }
  }

  try {
    const payload = await loadData();
    const list = normalizeSutteList(payload);

    const countEl = el('sutte-count');
    if (countEl) countEl.textContent = String(list.length);

    const container = el('sutte-list');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '';
      setStatus('データが空です。static/data/sutte.json を編集してください。');
      return;
    }

    container.innerHTML = renderGroupedList(list);
    container.addEventListener('click', (e) => {
      const button = e.target && e.target.closest ? e.target.closest('.thumb-button') : null;
      if (!button) return;
      const src = button.getAttribute('data-image');
      const alt = button.getAttribute('data-alt') || '';
      if (!src) return;
      openImageInDialog(src, alt);
    });
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('読み込みに失敗しました。ブラウザのコンソールも確認してください。');
  }
}

window.addEventListener('load', main);
