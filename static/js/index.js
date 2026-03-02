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

function renderCard(item) {
  const manufacturer = item.manufacturer ?? '';
  const productName = item.productName ?? '';
  const displayName = [manufacturer, productName].filter(Boolean).join(' / ') || (item.id ?? '（名称未設定）');

  const image = item.image ?? '';
  const thumbHtml = image
    ? `<img class="thumb" src="${escapeHtml(image)}" alt="${escapeHtml(displayName)}" loading="lazy" />`
    : `<div class="thumb" role="img" aria-label="画像なし"></div>`;

  const tags = [
    formatTag('サイズ', item.size),
    formatTag('号', item.go),
    formatTag('重さ', item.weight),
    formatTag('カラー', item.color),
  ].filter(Boolean);

  const metaLines = [
    manufacturer ? `メーカー: ${manufacturer}` : '',
    productName ? `商品名: ${productName}` : '',
    item.series ? `シリーズ: ${item.series}` : '',
  ].filter(Boolean);

  const note = item.note ?? '';

  return `
    <article class="card">
      ${thumbHtml}
      <div class="card-body">
        <h3 class="name">${escapeHtml(displayName)}</h3>
        <p class="meta">${metaLines.map((l) => escapeHtml(l)).join('<br />')}</p>
        <div class="tags">${tags.join('')}</div>
        ${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}
      </div>
    </article>
  `.trim();
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

    container.innerHTML = list.map(renderCard).join('');
    setStatus('');
  } catch (e) {
    console.error(e);
    setStatus('読み込みに失敗しました。ブラウザのコンソールも確認してください。');
  }
}

window.addEventListener('load', main);
