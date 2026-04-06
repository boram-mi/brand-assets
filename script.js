'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let allAssets = [];
let activeCategory = 'all';
let searchQuery = '';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const grid         = document.getElementById('assetGrid');
const emptyState   = document.getElementById('emptyState');
const resultsCount = document.getElementById('resultsCount');
const searchInput  = document.getElementById('searchInput');
const filterChips  = document.getElementById('filterChips');
const toast        = document.getElementById('toast');
const dosList      = document.getElementById('dosList');
const dontsList    = document.getElementById('dontsList');

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data.json');
    const data = await res.json();
    allAssets = data.assets;
    renderGuidelines(data.logoGuidelines);
    render();
  } catch (err) {
    grid.innerHTML = '<p style="color:#DC2626;padding:20px">data.json을 불러올 수 없습니다.</p>';
    console.error(err);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const filtered = filter(allAssets);

  resultsCount.textContent = filtered.length > 0
    ? `${filtered.length}개 에셋`
    : '';

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // 컬러 카테고리가 포함된 경우 CI/BI 그룹핑 적용
  const hasColors = filtered.some(a => a.category === 'color');
  if (hasColors) {
    grid.innerHTML = buildGroupedHTML(filtered);
  } else {
    grid.innerHTML = filtered.map(buildCard).join('');
  }

  bindCardEvents();
}

function filter(assets) {
  return assets.filter(a => {
    const catMatch = activeCategory === 'all' || a.category === activeCategory;
    if (!catMatch) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
  });
}

// ─── Color Grouping ────────────────────────────────────────────────────────────
// 컬러 에셋은 CI / BI 그룹 헤더를 삽입해 구분.
// 헤더는 grid-column: 1/-1 로 전체 너비를 차지하는 별도 요소.
function buildGroupedHTML(filtered) {
  const nonColors = filtered.filter(a => a.category !== 'color');
  const ciColors  = filtered.filter(a => a.category === 'color' && a.colorGroup === 'CI');
  const biColors  = filtered.filter(a => a.category === 'color' && a.colorGroup === 'BI');
  const ungrouped = filtered.filter(a => a.category === 'color' && !a.colorGroup);

  const parts = [];

  // 비(非)컬러 에셋
  if (nonColors.length) {
    parts.push(nonColors.map(buildCard).join(''));
  }

  // CI 컬러
  if (ciColors.length) {
    parts.push(`<div class="color-group-header">
      <span class="color-group-label ci">CI</span>
      <span class="color-group-title">Corporate Identity 컬러</span>
      <span class="color-group-desc">Shift 9 기업 아이덴티티 공식 컬러</span>
    </div>`);
    parts.push(ciColors.map(buildColorCard).join(''));
  }

  // BI 컬러 — 브랜드별 그룹핑
  if (biColors.length) {
    // brand 기준으로 묶기
    const brands = [...new Set(biColors.map(a => a.brand || 'BI'))];
    brands.forEach(brand => {
      const group = biColors.filter(a => (a.brand || 'BI') === brand);
      parts.push(`<div class="color-group-header">
        <span class="color-group-label bi">BI</span>
        <span class="color-group-title">${escHtml(brand)} Brand Identity 컬러</span>
        <span class="color-group-desc">${escHtml(brand)} 브랜드 공식 컬러</span>
      </div>`);
      parts.push(group.map(buildColorCard).join(''));
    });
  }

  // colorGroup 없는 컬러
  if (ungrouped.length) {
    parts.push(ungrouped.map(buildColorCard).join(''));
  }

  return parts.join('');
}

// ─── Card Builders ─────────────────────────────────────────────────────────────
function isNew(updatedAt) {
  if (!updatedAt) return false;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return diff <= 14 * 24 * 60 * 60 * 1000;
}

function newBadge(asset) {
  return isNew(asset.updatedAt) ? '<span class="badge-new">NEW</span>' : '';
}

function downloadIcon() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M6 1v7M3 5.5L6 8.5l3-3M1.5 10h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function buildCard(asset) {
  switch (asset.category) {
    case 'company-logo':
    case 'service-logo': return buildLogoCard(asset);
    case 'color':        return buildColorCard(asset);
    case 'typography':   return buildFontCard(asset);
    case 'guide':        return buildGuideCard(asset);
    default:             return '';
  }
}

function buildLogoCard(asset) {
  const thumb = asset.thumbnail
    ? `<img src="${escAttr(asset.thumbnail)}" alt="${escAttr(asset.name)} 로고" loading="lazy" />`
    : `<div class="logo-placeholder">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="4" y="8" width="20" height="14" rx="2" stroke="#CCCCCC" stroke-width="1.5"/>
          <path d="M4 12h20" stroke="#CCCCCC" stroke-width="1.5"/>
        </svg>
       </div>`;

  const buttons = (asset.files || []).map(f =>
    `<a class="btn" href="${escAttr(f.path)}" download>
      ${downloadIcon()} ${escHtml(f.format)}
    </a>`
  ).join('');

  const brandTag = asset.brand
    ? `<span class="brand-tag">${escHtml(asset.brand)}</span>`
    : '';

  return `
    <div class="card" data-id="${escAttr(asset.id)}">
      <div class="logo-thumbnail">${thumb}</div>
      <div class="card-body">
        <div class="card-header">
          <span class="card-name">${escHtml(asset.name)}</span>
          ${newBadge(asset)}
        </div>
        ${brandTag}
        ${asset.description ? `<p class="card-desc">${escHtml(asset.description)}</p>` : ''}
        <div class="card-actions">${buttons}</div>
      </div>
    </div>`;
}

function buildColorCard(asset) {
  const isLight = isLightColor(asset.hex);

  return `
    <div class="card" data-id="${escAttr(asset.id)}">
      <div
        class="color-chip${isLight ? ' light-bg' : ''}"
        style="background:${escAttr(asset.hex)}"
        data-hex="${escAttr(asset.hex)}"
        role="button"
        tabindex="0"
        aria-label="${escAttr(asset.name)} ${escAttr(asset.hex)} 복사"
        title="클릭하여 HEX 코드 복사"
      >
        <div class="color-copy-hint"><span>클릭하여 복사</span></div>
      </div>
      <div class="color-meta">
        <div class="card-header">
          <span class="card-name">${escHtml(asset.name)}</span>
          ${newBadge(asset)}
        </div>
        <span class="color-hex">${escHtml(asset.hex)}</span>
        ${asset.rgb ? `<span class="color-rgb">RGB ${escHtml(asset.rgb)}</span>` : ''}
        ${asset.usage ? `<p class="color-usage">${escHtml(asset.usage)}</p>` : ''}
      </div>
    </div>`;
}

function buildFontCard(asset) {
  const weights = (asset.weights || []).map(w =>
    `<span class="weight-tag">${escHtml(w)}</span>`
  ).join('');

  const buttons = (asset.files || []).map(f =>
    `<a class="btn" href="${escAttr(f.path)}" download>
      ${downloadIcon()} ${escHtml(f.format)} 다운로드
    </a>`
  ).join('');

  const licenseLink = asset.licenseUrl
    ? `<a href="${escAttr(asset.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escHtml(asset.license)}</a>`
    : escHtml(asset.license || '');

  return `
    <div class="card" data-id="${escAttr(asset.id)}">
      <div class="font-preview">
        <div class="font-sample" style="font-family:'${escAttr(asset.name)}',var(--font-base)">
          ${escHtml(asset.sampleText || '가나다라 ABCabc 123')}
        </div>
        <div class="font-weights">${weights}</div>
      </div>
      <div class="card-body">
        <div class="card-header">
          <span class="card-name">${escHtml(asset.name)}</span>
          ${newBadge(asset)}
        </div>
        ${asset.description ? `<p class="card-desc">${escHtml(asset.description)}</p>` : ''}
        ${asset.license ? `<p class="font-license">라이선스: ${licenseLink}</p>` : ''}
        <div class="card-actions">${buttons}</div>
      </div>
    </div>`;
}

function buildGuideCard(asset) {
  const buttons = (asset.files || []).map(f =>
    `<a class="btn" href="${escAttr(f.path)}" download>
      ${downloadIcon()} ${escHtml(f.format)} 다운로드
    </a>`
  ).join('');

  return `
    <div class="card" data-id="${escAttr(asset.id)}">
      <div class="guide-thumbnail">
        <svg class="guide-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="10" y="6" width="28" height="36" rx="3" stroke="#DDDDDD" stroke-width="1.5"/>
          <path d="M16 16h16M16 22h16M16 28h10" stroke="#DDDDDD" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="28" y="30" width="12" height="14" rx="2" fill="#3944FF"/>
          <path d="M31 37h6M34 34v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="card-body">
        <div class="card-header">
          <span class="card-name">${escHtml(asset.name)}</span>
          ${newBadge(asset)}
        </div>
        ${asset.description ? `<p class="card-desc">${escHtml(asset.description)}</p>` : ''}
        <div class="card-actions">${buttons}</div>
      </div>
    </div>`;
}

// ─── Guidelines ───────────────────────────────────────────────────────────────
function renderGuidelines(guidelines) {
  if (!guidelines) return;

  dosList.innerHTML = (guidelines.dos || []).map(item =>
    `<li>${escHtml(item.description)}</li>`
  ).join('');

  dontsList.innerHTML = (guidelines.donts || []).map(item =>
    `<li>${escHtml(item.description)}</li>`
  ).join('');
}

// ─── Events ───────────────────────────────────────────────────────────────────
function bindCardEvents() {
  document.querySelectorAll('.color-chip[data-hex]').forEach(el => {
    el.addEventListener('click', () => copyHex(el.dataset.hex));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyHex(el.dataset.hex);
      }
    });
  });
}

async function copyHex(hex) {
  try {
    await navigator.clipboard.writeText(hex);
    showToast(`${hex} 복사됨!`);
  } catch {
    showToast(`복사 실패 — ${hex} 를 직접 선택하세요`);
  }
}

// Filter chips
filterChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeCategory = chip.dataset.category;
  render();
});

// Search
let searchTimer;
searchInput.addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    render();
  }, 150);
});

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function isLightColor(hex) {
  if (!hex || hex.length < 4) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
