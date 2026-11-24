// GeeChat — GIF discovery via the KLIPY API (search + trending + recents).
import { GIF_API_BASE, GIF_API_KEY } from './firebase.js';
import { el, icon, qs, closePickers } from './ui.js';

const RECENT_GIFS_KEY = 'geechat.recentGifs';

function storeGifUrl(item) {
  // Prefer compact webp, fall back to gif.
  return item?.file?.md?.webp?.url || item?.file?.md?.gif?.url || item?.file?.hd?.webp?.url || item?.file?.hd?.gif?.url || null;
}
function shareGifUrl(item) {
  // Shared GIFs use the standard gif format for universal compatibility.
  return item?.file?.md?.gif?.url || item?.file?.hd?.gif?.url || item?.file?.md?.webp?.url || null;
}

async function klipyFetch(path, params) {
  const url = new URL(`${GIF_API_BASE}/${GIF_API_KEY}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GIF service returned ${res.status}`);
  const json = await res.json();
  if (json?.result !== true) throw new Error(json?.message || 'GIF service error');
  return json.data?.data || [];
}

export async function fetchTrending(page = 1) {
  return klipyFetch('gifs/trending', { page: String(page), page_size: '24' });
}
export async function searchGifs(term, page = 1) {
  return klipyFetch('gifs/search', { q: term, page: String(page), page_size: '24' });
}

export function getRecentGifs() {
  try { return JSON.parse(localStorage.getItem(RECENT_GIFS_KEY)) || []; } catch { return []; }
}
export function rememberGif(item) {
  const entry = { url: shareGifUrl(item), preview: storeGifUrl(item), title: item?.title || '' };
  try {
    const list = getRecentGifs().filter(g => g.url !== entry.url);
    list.unshift(entry);
    localStorage.setItem(RECENT_GIFS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch { /* storage unavailable */ }
}

export function openGifPicker(anchorRect, onPick) {
  closePickers();
  const layer = qs('#pickerLayer');
  layer.classList.remove('hidden');
  const picker = el('div', { class: 'picker' });
  const searchInput = el('input', { type: 'search', placeholder: 'Search GIFs…' });
  const searchWrap = el('div', { class: 'picker-search' }, icon('search', 'ic-16'), searchInput);
  const grid = el('div', { class: 'picker-grid gifs scroll-y' });
  const loading = el('div', { class: 'pk-empty', text: 'Loading GIFs…' });
  grid.append(loading);

  let page = 1;
  let busy = false;
  let term = '';

  const addItem = (item) => {
    const url = storeGifUrl(item);
    if (!url) return;
    const btn = el('button', { type: 'button', 'aria-label': item?.title || 'Select GIF' });
    const img = el('img', { src: url, alt: item?.title || 'GIF', loading: 'lazy' });
    img.addEventListener('load', () => img.classList.add('ready'));
    btn.append(img);
    btn.addEventListener('click', () => {
      rememberGif(item);
      onPick({ url: shareGifUrl(item), preview: url, title: item?.title || '' });
      closePickers();
    });
    grid.append(btn);
  };

  const renderRecents = () => {
    grid.innerHTML = '';
    const recents = getRecentGifs();
    if (recents.length) {
      grid.append(el('div', { class: 'mini-title', text: 'Recently used', style: 'grid-column:1/-1;padding:2px 4px;' }));
      recents.forEach(g => {
        const btn = el('button', { type: 'button' }, el('img', { src: g.preview || g.url, alt: g.title || 'GIF', loading: 'lazy' }));
        btn.addEventListener('click', () => { onPick({ url: g.url, preview: g.preview, title: g.title }); closePickers(); });
        grid.append(btn);
      });
      grid.append(el('div', { class: 'mini-title', text: 'Trending', style: 'grid-column:1/-1;padding:10px 4px 2px;' }));
    }
  };

  const load = async (reset = false) => {
    if (busy) return;
    busy = true;
    try {
      if (reset) { page = 1; if (!term) renderRecents(); }
      const items = term ? await searchGifs(term, page) : await fetchTrending(page);
      if (reset) grid.querySelectorAll('.pk-empty').forEach(n => n.remove());
      loading.textContent = '';
      if (!items.length && reset) {
        grid.append(el('div', { class: 'pk-empty', text: term ? `No GIFs found for “${term}”` : 'No GIFs available right now.' }));
      }
      items.forEach(addItem);
      page += 1;
    } catch (err) {
      if (reset) {
        grid.innerHTML = '';
        grid.append(el('div', { class: 'pk-empty', text: 'GIF search is unavailable right now. Please try again shortly.' }));
      }
    } finally { busy = false; }
  };

  // Infinite scroll
  grid.addEventListener('scroll', () => {
    if (grid.scrollTop + grid.clientHeight > grid.scrollHeight - 260) load(false);
  });

  let deb;
  searchInput.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      term = searchInput.value.trim();
      grid.innerHTML = '';
      grid.append(loading);
      load(true);
    }, 350);
  });

  picker.append(searchWrap, grid);
  layer.append(picker);

  // position near composer
  const pw = Math.min(360, window.innerWidth - 24);
  const ph = Math.min(430, Math.min(window.innerHeight * 0.6, 430));
  let x = anchorRect.left + anchorRect.width / 2 - pw / 2;
  x = Math.max(12, Math.min(x, window.innerWidth - pw - 12));
  let y = anchorRect.top - ph - 10;
  if (y < 10) y = Math.min(anchorRect.bottom + 10, window.innerHeight - ph - 12);
  picker.style.left = x + 'px';
  picker.style.top = Math.max(10, y) + 'px';

  layer.onclick = (e) => { if (e.target === layer) closePickers(); };
  setTimeout(() => searchInput.focus(), 30);
  load(true);
}
