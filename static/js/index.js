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

function formatPlainTextHtml(value) {
  if (value === undefined || value === null || value === '') return '';
  return escapeHtml(value).replaceAll('\n', '<br />');
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

function normalizeHttpUrl(url) {
  const raw = (url ?? '').toString().trim();
  if (!raw) return '';
  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
  return '';
}

function renderGroupMeta({ size, url }) {
  const sizeText = (size ?? '').toString().trim();
  const safeUrl = normalizeHttpUrl(url);
  if (!sizeText && !safeUrl) return '';

  const parts = [];
  if (sizeText) parts.push(`<span>サイズ: ${escapeHtml(sizeText)}</span>`);
  if (safeUrl) {
    parts.push(
      `<a class="group-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">商品ページ</a>`,
    );
  }

  return `<p class="group-meta">${parts.join('<span class="group-meta-sep">/</span>')}</p>`;
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
  const title = color || '（カラー未設定）';
  const alt = [groupLabel, title].filter(Boolean).join(' / ');

  const owned = Boolean(variant?.owned ?? product?.owned ?? false);

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
    owned ? '<span class="tag tag-owned">所持</span>' : '',
    formatTag('号', go),
    formatTag('重さ', weight),
  ].filter(Boolean);

  const metaLines = [
    (variant?.series ?? product?.series) ? `シリーズ: ${variant?.series ?? product?.series}` : '',
  ].filter(Boolean);

  const note = variant?.note ?? '';

  return `
    <article class="card" data-owned="${owned ? 'true' : 'false'}">
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
    const groupSize = items.find((x) => x?.size)?.size ?? '';
    const groupUrl = items.find((x) => x?.url)?.url ?? '';
    const groupMetaHtml = renderGroupMeta({ size: groupSize, url: groupUrl });

    sections.push(`
      <section class="group" aria-label="${escapeHtml(label)}">
        <h3 class="group-title">${escapeHtml(label)} <span class="group-count">(${items.length})</span></h3>
        ${groupMetaHtml}
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
    const groupMetaHtml = renderGroupMeta({ size: product?.size, url: product?.url });

    sections.push(`
      <section class="group" aria-label="${escapeHtml(label)}">
        <h3 class="group-title">${escapeHtml(label)} <span class="group-count">(${variants.length})</span></h3>
        ${groupMetaHtml}
        ${description ? `<p class="group-desc">${formatPlainTextHtml(description)}</p>` : ''}
        <div class="grid" aria-label="${escapeHtml(label)} の色一覧">
          ${variants.map((v) => renderVariantCard(v, label, product)).join('')}
        </div>
      </section>
    `.trim());
  }

  return sections.join('');
}

function isOwnedVariant(variant, product = null) {
  return Boolean(variant?.owned ?? product?.owned ?? false);
}

function applyOwnedFilter(normalized, ownedOnly) {
  if (!ownedOnly) return normalized;

  if (normalized.kind === 'products') {
    const filteredProducts = normalized.products
      .map((product) => {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        const ownedVariants = variants.filter((v) => isOwnedVariant(v, product));
        return { ...product, variants: ownedVariants };
      })
      .filter((product) => Array.isArray(product?.variants) && product.variants.length > 0);

    return { kind: 'products', products: filteredProducts };
  }

  const filteredVariants = (normalized.variants ?? []).filter((v) => Boolean(v?.owned ?? false));
  return { kind: 'variants', variants: filteredVariants };
}

function countVariants(normalized) {
  if (!normalized) return 0;
  if (normalized.kind === 'products') {
    return normalized.products.reduce((sum, p) => sum + (Array.isArray(p?.variants) ? p.variants.length : 0), 0);
  }
  return (normalized.variants ?? []).length;
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

    const container = el('sutte-list');
    if (!container) return;

    // 画像拡大はイベント委譲で一度だけ設定
    container.addEventListener('click', (e) => {
      const button = e.target && e.target.closest ? e.target.closest('.thumb-button') : null;
      if (!button) return;
      const src = button.getAttribute('data-image');
      const alt = button.getAttribute('data-alt') || '';
      if (!src) return;
      openImageInDialog(src, alt);
    });

    const filterOwnedEl = el('filter-owned');
    let ownedOnly = Boolean(filterOwnedEl?.checked ?? false);

    const render = () => {
      const filtered = applyOwnedFilter(normalized, ownedOnly);
      const variantsCount = countVariants(filtered);

      const countEl = el('sutte-count');
      if (countEl) countEl.textContent = String(variantsCount);

      const isEmpty = variantsCount === 0;
      if (isEmpty) {
        container.innerHTML = '';
        setStatus(ownedOnly ? '所持しているスッテがありません。' : 'データが空です。static/data/sutte.json を編集してください。');
        return;
      }

      container.innerHTML =
        filtered.kind === 'products' ? renderProductList(filtered.products) : renderGroupedList(filtered.variants);
      setStatus(ownedOnly ? '所持のみ表示中' : '');
    };

    if (filterOwnedEl) {
      filterOwnedEl.addEventListener('change', () => {
        ownedOnly = Boolean(filterOwnedEl.checked);
        render();
      });
    }

    render();
  } catch (e) {
    console.error(e);
    setStatus('読み込みに失敗しました。ブラウザのコンソールも確認してください。');
  }
}

window.addEventListener('load', main);
