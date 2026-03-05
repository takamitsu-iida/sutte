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
  if (!payload) return { kind: 'variants', variants: [] };

  // 新形式: { "products": [...] }
  if (Array.isArray(payload.products)) {
    return { kind: 'products', products: payload.products };
  }

  // 旧形式A: { "items": [...] }
  if (Array.isArray(payload.items)) {
    return { kind: 'variants', variants: payload.items };
  }

  // 旧形式B: [...]
  if (Array.isArray(payload)) {
    return { kind: 'variants', variants: payload };
  }

  return { kind: 'variants', variants: [] };
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

function renderVariantCard(variant, groupLabel, product = null) {
  const color = variant?.color ?? '';
  const title = color || String(variant?.id ?? '（詳細未設定）');
  const alt = [groupLabel, title].filter(Boolean).join(' / ');

  const image = normalizeImagePath(variant?.image);
  const thumbHtml = image
    ? `<button class="thumb-button" type="button" data-image="${escapeHtml(image)}" data-alt="${escapeHtml(alt)}">
        <img class="thumb" src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" loading="lazy" />
      </button>`
    : `<div class="thumb" role="img" aria-label="画像なし"></div>`;

  const size = variant?.size ?? product?.size;
  const go = variant?.go ?? product?.go;
  const weight = variant?.weight ?? product?.weight;

  const tags = [
    formatTag('サイズ', size),
    formatTag('号', go),
    formatTag('重さ', weight),
  ].filter(Boolean);

  const metaLines = [
    (variant?.series ?? product?.series) ? `シリーズ: ${variant?.series ?? product?.series}` : '',
  ].filter(Boolean);

  const note = variant?.note ?? '';

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

function renderGroupedList(variants) {
  const groups = groupByName(variants);
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

function getProductLabel(product) {
  const manufacturer = product?.manufacturer ?? '';
  const productName = product?.productName ?? '';
  return [manufacturer, productName].filter(Boolean).join(' / ') || String(product?.id ?? '（名称未設定）');
}

function renderProductList(products) {
  const sections = [];

  for (const product of products) {
    const label = getProductLabel(product);
    const description = product?.description ?? '';
    const variants = Array.isArray(product?.variants) ? product.variants : [];

    sections.push(`
      <section class="group" aria-label="${escapeHtml(label)}">
        <h3 class="group-title">${escapeHtml(label)} <span class="group-count">(${variants.length})</span></h3>
        ${description ? `<p class="group-desc">${escapeHtml(description)}</p>` : ''}
        <div class="grid" aria-label="${escapeHtml(label)} の色一覧">
          ${variants.map((v) => renderVariantCard(v, label, product)).join('')}
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
    const normalized = normalizeSutteList(payload);

    const variantsCount =
      normalized.kind === 'products'
        ? normalized.products.reduce((sum, p) => sum + (Array.isArray(p?.variants) ? p.variants.length : 0), 0)
        : normalized.variants.length;

    const countEl = el('sutte-count');
    if (countEl) countEl.textContent = String(variantsCount);

    const container = el('sutte-list');
    if (!container) return;

    const isEmpty =
      normalized.kind === 'products'
        ? normalized.products.length === 0
        : normalized.variants.length === 0;

    if (isEmpty) {
      container.innerHTML = '';
      setStatus('データが空です。static/data/sutte.json を編集してください。');
      return;
    }

    container.innerHTML =
      normalized.kind === 'products' ? renderProductList(normalized.products) : renderGroupedList(normalized.variants);
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
