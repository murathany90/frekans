const PACKAGE_BASE = 'docs/raporlar_tr_en/gridfreq_reports_package_12';
const APP_TITLE = 'GridFreq';
const state = { articles: [], loadPromise: null, renderedSlug: null, lightbox: null, lastFocus: null };
const root = () => document.getElementById('reportsApp');
const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const baseMetadata = {
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content || '',
  ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
  ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
  ogImage: document.querySelector('meta[property="og:image"]')?.content || ''
};

function packageUrl(path) { return new URL(path, document.baseURI).href; }
function articleDirectory(item) { return `${PACKAGE_BASE}/agent/${item.id}_${item.slug}`; }
function articleUrl(article, path) { return new URL(path, `${packageUrl(article.directory)}/`).href; }
function reportSlugFromHash() {
  const match = String(window.location.hash || '').split('?')[0].match(/^#\/reports(?:\/([^/]+))?\/?$/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function setMetadata(article = null) {
  const title = article ? `${article.title} | ${APP_TITLE}` : `Raporlar & Makaleler | ${APP_TITLE}`;
  const description = article?.subtitle || 'Şebeke frekansı, güç sistemi dinamikleri, yan hizmetler, enerji depolama ve GridFreq analiz yöntemlerine ilişkin teknik yayınlar.';
  document.title = title;
  const descriptionTag = document.querySelector('meta[name="description"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (descriptionTag) descriptionTag.content = description;
  if (ogTitle) ogTitle.content = title;
  if (ogDescription) ogDescription.content = description;
  if (ogImage && article?.heroUrl) ogImage.content = article.heroUrl;
}
function resetMetadata() {
  document.title = baseMetadata.title;
  const descriptionTag = document.querySelector('meta[name="description"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (descriptionTag) descriptionTag.content = baseMetadata.description;
  if (ogTitle) ogTitle.content = baseMetadata.ogTitle;
  if (ogDescription) ogDescription.content = baseMetadata.ogDescription;
  if (ogImage) ogImage.content = baseMetadata.ogImage;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`İçerik yüklenemedi (${response.status}).`);
  return response.json();
}
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Makale yüklenemedi (${response.status}).`);
  return response.text();
}
async function loadArticles() {
  if (state.loadPromise) return state.loadPromise;
  state.loadPromise = (async () => {
    const manifest = await fetchJson(packageUrl(`${PACKAGE_BASE}/manifest.json`));
    const entries = Array.isArray(manifest.articles) ? manifest.articles : [];
    state.articles = await Promise.all(entries.map(async item => {
      const directory = articleDirectory(item);
      const metadata = await fetchJson(packageUrl(`${directory}/metadata.json`));
      return { ...item, ...metadata, directory, heroUrl: articleUrl({ directory }, 'images/hero_cover.jpg') };
    }));
    return state.articles;
  })();
  return state.loadPromise;
}

function cardTemplate(article) {
  const pdf = article.pdf ? `<a class="reports-action reports-action-secondary" href="${escapeHtml(articleUrl(article, article.pdf))}" target="_blank" rel="noopener">PDF<span class="reports-sr-only">: ${escapeHtml(article.title)}</span></a>` : '';
  return `<article class="reports-card">
    <a class="reports-card-visual" href="#/reports/${encodeURIComponent(article.slug)}" aria-label="${escapeHtml(article.title)} makalesini oku"><img src="${escapeHtml(article.heroUrl)}" alt="${escapeHtml(article.title)} kapak görseli" width="1280" height="720" loading="lazy" decoding="async"></a>
    <div class="reports-card-body"><span class="reports-category">${escapeHtml(article.category)}</span><h3>${escapeHtml(article.title)}</h3><p class="reports-card-summary">${escapeHtml(article.subtitle || '')}</p>
      <div class="reports-card-footer"><span class="reports-reading-time">${escapeHtml(article.reading_time || '')}</span><div class="reports-card-actions"><a class="reports-card-link" href="#/reports/${encodeURIComponent(article.slug)}">Makaleyi Oku</a>${pdf}</div></div>
    </div></article>`;
}

function listTemplate(articles) {
  const categories = [...new Set(articles.map(article => article.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  return `<div class="reports-shell">
    <header class="reports-hero"><span class="reports-eyebrow">GridFreq yayınları</span><h2>Raporlar &amp; Makaleler</h2><p>Şebeke frekansı, güç sistemi dinamikleri, yan hizmetler, enerji depolama ve GridFreq analiz yöntemlerine ilişkin teknik yayınlar.</p></header>
    <div class="reports-toolbar" aria-label="Raporları filtrele"><input id="reportsSearch" class="reports-search" type="search" placeholder="Raporlarda ara..." autocomplete="off" aria-label="Raporlarda ara"><select id="reportsCategory" class="reports-category-filter" aria-label="Kategori filtresi"><option value="">Tüm kategoriler</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select></div>
    <div id="reportsGrid" class="reports-grid">${articles.map(cardTemplate).join('')}</div><p id="reportsEmpty" class="reports-empty" hidden>Aramanızla eşleşen makale bulunamadı.</p>
  </div>`;
}

function enableListFiltering(articles) {
  const search = document.getElementById('reportsSearch');
  const category = document.getElementById('reportsCategory');
  const grid = document.getElementById('reportsGrid');
  const empty = document.getElementById('reportsEmpty');
  if (!search || !category || !grid || !empty) return;
  const update = () => {
    const needle = search.value.trim().toLocaleLowerCase('tr');
    const selected = category.value;
    let visible = 0;
    [...grid.children].forEach((card, index) => {
      const article = articles[index];
      const haystack = [article.title, article.subtitle, article.category, ...(article.keywords || [])].filter(Boolean).join(' ').toLocaleLowerCase('tr');
      const matches = (!needle || haystack.includes(needle)) && (!selected || article.category === selected);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    empty.hidden = visible !== 0;
  };
  search.addEventListener('input', update);
  category.addEventListener('change', update);
}

function stripFrontMatter(markdown) { return String(markdown || '').replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, ''); }
function filterEditorialNotes(markdown) {
  const lines = stripFrontMatter(markdown).replace(/\r\n/g, '\n').split('\n');
  const editorialHeading = /^\s{0,3}#{1,6}\s+(?:kaynaklar(?:\s+ve\s+editoryal\s+not)?|editoryal\s+not|dış\s+doğrulama)\s*#*\s*$/iu;
  const start = lines.findIndex(line => editorialHeading.test(line));
  return (start >= 0 ? lines.slice(0, start) : lines).join('\n').trim();
}
function safeHref(href, article) {
  const raw = String(href || '').trim();
  if (!raw || /^(javascript|data):/i.test(raw)) return '#';
  if (/^(https?:|mailto:|#)/i.test(raw)) return raw;
  return articleUrl(article, raw);
}
function inlineMarkdown(value, article) {
  const tokens = [];
  const placeholder = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, (_, code) => placeholder(`<code>${code}</code>`));
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (_, label, href) => {
    const url = safeHref(href.replace(/&amp;/g, '&'), article);
    return `<a href="${escapeHtml(url)}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>').replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');
  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
}
function imageTemplate(alt, src, article) {
  const url = safeHref(src, article);
  return `<figure class="reports-figure"><button type="button" data-report-lightbox="${escapeHtml(url)}" aria-label="${escapeHtml(alt || 'Görseli büyüt')}"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt || '')}" loading="lazy" decoding="async"></button>${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''}</figure>`;
}
function isTableDivider(line) { return line.trim().replace(/^\||\|$/g, '').split('|').every(cell => /^\s*:?-{3,}:?\s*$/.test(cell)); }
function tableCells(line) { return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()); }

function renderMarkdown(markdown, article) {
  const lines = filterEditorialNotes(markdown).split('\n');
  const output = [];
  let i = 0; let skippedTitle = false;
  const paragraph = values => `<p>${inlineMarkdown(values.join(' ').trim(), article)}</p>`;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const image = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (image) { if (image[2].trim() !== 'images/hero_cover.jpg') output.push(imageTemplate(image[1], image[2].trim(), article)); i += 1; continue; }
    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (heading) { if (heading[1].length === 1 && !skippedTitle) skippedTitle = true; else output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2], article)}</h${heading[1].length}>`); i += 1; continue; }
    if (line.trim().startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      output.push(`<blockquote>${paragraph(quote)}</blockquote>`); continue;
    }
    if (i + 1 < lines.length && line.includes('|') && isTableDivider(lines[i + 1])) {
      const header = tableCells(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { rows.push(tableCells(lines[i])); i += 1; }
      output.push(`<div class="reports-table-wrap"><table><thead><tr>${header.map(cell => `<th>${inlineMarkdown(cell, article)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${header.map((_, index) => `<td>${inlineMarkdown(row[index] || '', article)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/); const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const tag = ordered ? 'ol' : 'ul'; const matcher = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/; const items = [];
      while (i < lines.length) { const match = lines[i].match(matcher); if (!match) break; items.push(`<li>${inlineMarkdown(match[1], article)}</li>`); i += 1; }
      output.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    const text = [];
    while (i < lines.length && lines[i].trim() && !/^\s*!\[/.test(lines[i]) && !/^\s*(#{1,3})\s+/.test(lines[i]) && !lines[i].trim().startsWith('>') && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !(i + 1 < lines.length && lines[i].includes('|') && isTableDivider(lines[i + 1]))) { text.push(lines[i]); i += 1; }
    if (text.length) output.push(paragraph(text)); else i += 1;
  }
  return output.join('\n');
}

function neighborTemplate(article, direction) {
  if (!article) return '<div></div>';
  const label = direction === 'previous' ? '← Önceki makale' : 'Sonraki makale →';
  return `<a class="reports-neighbor ${direction === 'next' ? 'next' : ''}" href="#/reports/${encodeURIComponent(article.slug)}"><span>${label}</span><strong>${escapeHtml(article.title)}</strong></a>`;
}
async function detailTemplate(article) {
  const markdown = await fetchText(articleUrl(article, 'article.md'));
  const index = state.articles.findIndex(item => item.slug === article.slug);
  const pdf = article.pdf ? `<a class="reports-action reports-action-secondary" href="${escapeHtml(articleUrl(article, article.pdf))}" target="_blank" rel="noopener">PDF olarak görüntüle</a>` : '';
  return `<div class="reports-shell">
    <header class="reports-detail-header"><a class="reports-breadcrumb" href="#/reports">Raporlar <span aria-hidden="true">&nbsp;/&nbsp;</span> ${escapeHtml(article.title)}</a><div class="reports-category">${escapeHtml(article.category)}</div><h2>${escapeHtml(article.title)}</h2>${article.subtitle ? `<p class="reports-detail-subtitle">${escapeHtml(article.subtitle)}</p>` : ''}<div class="reports-detail-meta"><span class="reports-reading-time">${escapeHtml(article.reading_time || '')}</span></div><div class="reports-hero-image"><img src="${escapeHtml(article.heroUrl)}" alt="${escapeHtml(article.title)} başlık görseli" decoding="async"></div><div class="reports-detail-actions" style="margin-top:16px">${pdf}</div></header>
    <article class="reports-content-shell"><div class="reports-content">${renderMarkdown(markdown, article)}</div></article><nav class="reports-neighbors" aria-label="Makale gezinme">${neighborTemplate(state.articles[index - 1], 'previous')}${neighborTemplate(state.articles[index + 1], 'next')}</nav><div class="reports-all-row"><a class="reports-all-link" href="#/reports">← Tüm Raporlara Dön</a></div>
  </div>`;
}

function ensureLightbox() {
  if (state.lightbox) return state.lightbox;
  const lightbox = document.createElement('div');
  lightbox.className = 'reports-lightbox'; lightbox.hidden = true; lightbox.setAttribute('role', 'dialog'); lightbox.setAttribute('aria-modal', 'true'); lightbox.setAttribute('aria-label', 'Görsel büyütme penceresi');
  lightbox.innerHTML = '<div class="reports-lightbox-dialog"><button class="reports-lightbox-close" type="button" aria-label="Görseli kapat">×</button><img alt=""></div>';
  document.body.append(lightbox);
  const close = () => { if (!lightbox.hidden) { lightbox.hidden = true; lightbox.querySelector('img').removeAttribute('src'); state.lastFocus?.focus?.(); } };
  lightbox.querySelector('button').addEventListener('click', close);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  state.lightbox = { open(src, alt, trigger) { state.lastFocus = trigger; const image = lightbox.querySelector('img'); image.src = src; image.alt = alt || ''; lightbox.hidden = false; lightbox.querySelector('button').focus(); } };
  return state.lightbox;
}
function enableLightbox() {
  root()?.querySelectorAll('[data-report-lightbox]').forEach(button => button.addEventListener('click', () => {
    const image = button.querySelector('img'); ensureLightbox().open(button.dataset.reportLightbox, image?.alt, button);
  }));
}

async function render() {
  const app = root(); if (!app) return;
  const slug = reportSlugFromHash();
  if (state.renderedSlug === slug && state.articles.length) return;
  state.renderedSlug = slug; app.innerHTML = '<div class="reports-loading">Yayınlar yükleniyor…</div>';
  try {
    const articles = await loadArticles(); if (state.renderedSlug !== slug) return;
    const article = slug ? articles.find(item => item.slug === slug) : null;
    if (slug && !article) { setMetadata(); app.innerHTML = '<div class="reports-error">İstenen makale bulunamadı. <a href="#/reports">Tüm raporlara dönün.</a></div>'; return; }
    if (!article) { setMetadata(); app.innerHTML = listTemplate(articles); enableListFiltering(articles); return; }
    setMetadata(article); app.innerHTML = await detailTemplate(article); if (state.renderedSlug === slug) enableLightbox();
  } catch (error) { if (state.renderedSlug === slug) app.innerHTML = `<div class="reports-error">Raporlar yüklenirken bir sorun oluştu: ${escapeHtml(error.message)}</div>`; }
}
function activateReportsWhenNeeded() {
  if (document.getElementById('tab-reports')?.classList.contains('active') || reportSlugFromHash()) {
    render();
    return;
  }
  if (state.renderedSlug !== undefined) {
    state.renderedSlug = undefined;
    resetMetadata();
  }
}
window.addEventListener('hashchange', activateReportsWhenNeeded);
window.addEventListener('popstate', activateReportsWhenNeeded);
window.addEventListener('gridfreq:tabchange', event => { if (event.detail?.tabId === 'tab-reports') render(); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activateReportsWhenNeeded); else activateReportsWhenNeeded();
