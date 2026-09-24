const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const dateTime = value => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

const errors = {
  gmail_required: 'Vui lòng nhập địa chỉ @gmail.com hợp lệ.',
  turnstile_required: 'Vui lòng hoàn tất bước xác minh.',
  turnstile_failed: 'Phiên xác minh đã hết hạn. Vui lòng thử lại.',
  checkout_rate_limit: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau 10 phút.',
  pending_limit: 'Bạn đã có 3 đơn đang chờ thanh toán. Hãy hoàn tất hoặc chờ đơn hết hạn.',
  product_unavailable: 'Một mô phỏng trong giỏ không còn được bán. Giỏ hàng đã được cập nhật.',
  catalog_changed: 'Thông tin sản phẩm vừa thay đổi. Vui lòng kiểm tra lại giỏ hàng.',
  origin_denied: 'Yêu cầu không hợp lệ. Vui lòng mở lại trang.',
  device_mismatch: 'Đơn hàng đã gắn với trình duyệt khác. Hãy liên hệ BinGenZ để được hỗ trợ.',
  access_required: 'Hãy mở liên kết truy cập đã lưu trên thiết bị mua hàng.',
  entitlement_expired: 'Mô phỏng đã hết hạn hoặc bị thu hồi.',
  order_unavailable: 'Không thể mở đơn hàng trên trình duyệt này.',
  configuration_required: 'Thanh toán tạm thời chưa khả dụng. Vui lòng quay lại sau.',
  payment_configuration_required: 'Mã QR tạm thời chưa khả dụng. Vui lòng liên hệ hỗ trợ.',
  qr_unavailable: 'Không tải được mã QR. Vui lòng thử tải lại trang.',
  service_unavailable: 'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại.'
};

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(errors[data.error] || 'Không thể hoàn tất. Vui lòng thử lại hoặc liên hệ BinGenZ.');
  return data;
}

function showError(root, error) {
  let box = $('.shop-error', root);
  if (!box) {
    box = document.createElement('p');
    box.className = 'shop-error';
    box.setAttribute('role', 'alert');
    root.append(box);
  }
  box.textContent = error.message;
}

function initTheme() {
  let theme = document.documentElement.dataset.theme || 'light';
  try { theme = localStorage.getItem('theme') || theme; } catch {}
  document.documentElement.dataset.theme = theme;
  const meta = $('#metaThemeColor');
  if (meta) meta.content = theme === 'dark' ? '#09090c' : '#f8fafc';
  const button = $('#commerce-theme');
  if (!button) return;
  button.onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    if (meta) meta.content = next === 'dark' ? '#09090c' : '#f8fafc';
    try { localStorage.setItem('theme', next); } catch {}
  };
}

function createDialog(title, body, className = 'shop-dialog') {
  const modal = document.createElement('dialog');
  modal.className = `commerce-dialog ${className}`;
  modal.setAttribute('aria-label', title);
  modal.innerHTML = `<header class="dialog-header"><h2>${esc(title)}</h2><button class="dialog-close" type="button" aria-label="Đóng">×</button></header>${body}`;
  document.body.append(modal);
  $('.dialog-close', modal).onclick = () => modal.close();
  modal.addEventListener('close', () => modal.remove());
  modal.showModal();
  return modal;
}

async function copy(value, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(String(value));
    button.textContent = 'Đã sao chép';
    setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1600);
  } catch {
    const modal = createDialog('Sao chép nội dung', `<label class="sr-only" for="copy-fallback">Nội dung cần sao chép</label><input id="copy-fallback" readonly value="${esc(value)}">`);
    $('#copy-fallback', modal).select();
  }
}

function timer(node, deadline, serverNow, onEnd) {
  const started = performance.now();
  const duration = Date.parse(deadline) - Date.parse(serverNow);
  const tick = () => {
    const seconds = Math.max(0, Math.ceil((duration - (performance.now() - started)) / 1000));
    node.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (seconds <= 0) {
      clearInterval(handle);
      onEnd?.();
    }
  };
  const handle = setInterval(tick, 1000);
  tick();
  return () => clearInterval(handle);
}

let products = [];
let sitekey = null;
let catalogPromise;
let toastHandle;
let cart = new Set();
try {
  const saved = JSON.parse(localStorage.getItem('bgz-cart') || '[]');
  if (Array.isArray(saved)) cart = new Set(saved.filter(value => typeof value === 'string'));
} catch {}

function productCategory(product) {
  return product.category?.trim() || 'Mô phỏng tương tác';
}

function productDescription(product) {
  return product.description?.trim() || `Quan sát ${product.title} hoạt động từng bước qua mô phỏng trực quan và có thể tương tác.`;
}

function cartItems() {
  return products.filter(product => cart.has(product.id));
}

function cartTotal() {
  return cartItems().reduce((total, product) => total + product.price_vnd, 0);
}

function announce(message) {
  let toast = $('#shop-announcement');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shop-announcement';
    toast.className = 'commerce-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function saveCart() {
  try { localStorage.setItem('bgz-cart', JSON.stringify([...cart])); } catch {}
  $$('[data-cart-count]').forEach(node => { node.textContent = String(cart.size); });
  $$('[data-add]').forEach(button => {
    const selected = cart.has(button.dataset.add);
    button.textContent = selected ? 'Đã thêm ✓' : 'Thêm vào giỏ';
    button.disabled = selected;
    button.classList.toggle('is-added', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  updateFloatingCart();
}

async function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = api('/api/catalog').then(data => {
      products = data.products;
      sitekey = data.turnstile_site_key;
      cart = new Set([...cart].filter(id => products.some(product => product.id === id)));
      saveCart();
      return data;
    });
  }
  return catalogPromise;
}

function productCard(product, { featured = false, allowAdd = true } = {}) {
  const detailUrl = `/shop/${encodeURIComponent(product.slug)}`;
  return `<article class="product-card${featured ? ' featured-product-card' : ''}">
    <a class="product-media" href="${detailUrl}" aria-label="Xem ${esc(product.title)}">
      <img src="${esc(product.thumbnail)}" alt="Mô phỏng ${esc(product.title)}" loading="lazy" width="600" height="375">
      <span class="product-category">${esc(productCategory(product))}</span>
    </a>
    <div class="product-body">
      <h3><a href="${detailUrl}">${esc(product.title)}</a></h3>
      <p class="product-description">${esc(productDescription(product))}</p>
      <div class="product-facts">
        <span class="product-price">${money(product.price_vnd)}</span>
        <span class="product-meta">${Math.round(product.duration_seconds / 60)} phút</span>
      </div>
      <div class="product-actions">
        <a class="shop-button" href="${detailUrl}">Chi tiết</a>
        ${allowAdd ? `<button class="gold" type="button" data-add="${esc(product.id)}" aria-label="Thêm ${esc(product.title)} vào giỏ">Thêm vào giỏ</button>` : ''}
      </div>
    </div>
  </article>`;
}

function bindAddButtons(root = document) {
  $$('[data-add]', root).forEach(button => {
    button.onclick = () => {
      const product = products.find(item => item.id === button.dataset.add);
      if (!product || cart.has(product.id)) return;
      cart.add(product.id);
      saveCart();
      announce(`Đã thêm “${product.title}” vào giỏ hàng.`);
    };
  });
  saveCart();
}

function updateFloatingCart() {
  const page = $('#shop-page');
  const canFloat = page && location.pathname.startsWith('/shop');
  let floating = $('#floating-cart');
  if (!canFloat || !cart.size) {
    floating?.remove();
    return;
  }
  if (!floating) {
    floating = document.createElement('div');
    floating.id = 'floating-cart';
    floating.className = 'floating-cart commerce';
    document.body.append(floating);
  }
  floating.innerHTML = `<button class="floating-cart-button" type="button" data-open-cart>
    <span>${cart.size} mô phỏng<small>${money(cartTotal())}</small></span>
    <strong>Xem giỏ →</strong>
  </button>`;
  $('[data-open-cart]', floating).onclick = openCart;
}

function openCart() {
  const modal = createDialog('Giỏ hàng', '<div class="cart-drawer-shell"><div class="cart-content"></div><div class="cart-summary"></div></div>', 'cart-drawer');
  const header = $('.dialog-header', modal);
  $('.cart-drawer-shell', modal).prepend(header);
  const paint = () => {
    const items = cartItems();
    const content = $('.cart-content', modal);
    const summary = $('.cart-summary', modal);
    if (!items.length) {
      content.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon" aria-hidden="true">◇</span><h3>Giỏ hàng đang trống</h3><p>Chọn mô phỏng bạn muốn khám phá, sau đó quay lại đây để thanh toán.</p><a class="shop-button gold" href="/shop">Khám phá cửa hàng</a></div>`;
      summary.hidden = true;
      return;
    }
    summary.hidden = false;
    content.innerHTML = items.map(product => `<article class="cart-line">
      <img src="${esc(product.thumbnail)}" alt="" width="82" height="62">
      <div class="cart-line-copy"><strong>${esc(product.title)}</strong><span>${Math.round(product.duration_seconds / 60)} phút · ${money(product.price_vnd)}</span></div>
      <button class="cart-remove" type="button" data-remove="${esc(product.id)}" aria-label="Bỏ ${esc(product.title)} khỏi giỏ">Bỏ</button>
    </article>`).join('');
    summary.innerHTML = `<div class="cart-total"><span>Tổng cộng</span><span>${money(cartTotal())}</span></div>
      <p>Không cần tài khoản. Mỗi mô phỏng bắt đầu riêng trong ${Math.max(...items.map(item => item.activation_days || 7))} ngày sau thanh toán.</p>
      <div class="cart-summary-actions"><button class="text-button" id="clear-cart" type="button">Xóa giỏ</button><a class="shop-button gold" href="/checkout">Tiếp tục thanh toán →</a></div>`;
    $$('[data-remove]', modal).forEach(button => {
      button.onclick = () => {
        cart.delete(button.dataset.remove);
        saveCart();
        paint();
        announce('Đã bỏ sản phẩm khỏi giỏ hàng.');
      };
    });
    $('#clear-cart', modal).onclick = () => {
      cart.clear();
      saveCart();
      paint();
      announce('Đã xóa toàn bộ giỏ hàng.');
    };
  };
  paint();
}

function bindCartOpeners() {
  $$('[data-open-cart]').forEach(button => { button.onclick = openCart; });
}

function syncShopQuery(query, category, sort) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (sort && sort !== 'featured') params.set('sort', sort);
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
}

async function renderShop() {
  const page = $('#shop-page');
  await loadCatalog();
  document.title = 'Cửa hàng mô phỏng • BinGenZ';
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get('q') || '';
  const initialCategory = params.get('category') || '';
  const initialSort = ['featured', 'name', 'price-asc', 'price-desc'].includes(params.get('sort')) ? params.get('sort') : 'featured';
  const categories = [...new Set(products.map(product => product.category?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  page.innerHTML = `<section class="shop-hero">
      <span class="shop-kicker">Khám phá • Tương tác • Hiểu sâu</span>
      <h1>Công nghệ dễ hiểu hơn khi bạn thấy nó vận hành.</h1>
      <p>Khám phá các thuật toán và hệ thống qua mô phỏng trực quan. Chọn điều bạn tò mò, thanh toán bằng QR và bắt đầu khi sẵn sàng.</p>
      <div class="shop-trust-row"><span>✓ Không cần tài khoản</span><span>✓ Cấp quyền tự động</span><span>✓ Thanh toán qua SePay</span></div>
    </section>
    <section class="shop-catalog" aria-labelledby="catalog-title">
      <div class="catalog-heading"><div><span class="shop-kicker">Danh mục mô phỏng</span><h2 id="catalog-title">Chọn chủ đề bạn muốn khám phá</h2></div><span class="catalog-result-count" id="catalog-count"></span></div>
      <div class="shop-controls">
        <label class="shop-search-wrap"><span aria-hidden="true">⌕</span><span class="sr-only">Tìm mô phỏng</span><input id="shop-search" type="search" value="${esc(initialQuery)}" placeholder="Tìm thuật toán, hệ thống…" autocomplete="off"></label>
        <label><span class="sr-only">Sắp xếp sản phẩm</span><select class="shop-sort" id="shop-sort"><option value="featured">Nổi bật</option><option value="name">Tên A–Z</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label>
        <div class="category-filters" id="category-filters" aria-label="Lọc theo danh mục">
          <button class="filter-chip${initialCategory ? '' : ' is-active'}" type="button" data-category="">Tất cả</button>
          ${categories.map(category => `<button class="filter-chip${initialCategory === category ? ' is-active' : ''}" type="button" data-category="${esc(category)}">${esc(category)}</button>`).join('')}
        </div>
      </div>
      <div class="product-grid" id="product-grid"></div>
    </section>`;
  $('#shop-sort').value = initialSort;
  let category = categories.includes(initialCategory) ? initialCategory : '';
  const paint = () => {
    const query = $('#shop-search').value.trim().toLocaleLowerCase('vi');
    const sort = $('#shop-sort').value;
    let list = products.filter(product => {
      const text = `${product.title} ${product.description || ''} ${product.category || ''}`.toLocaleLowerCase('vi');
      return (!query || text.includes(query)) && (!category || product.category === category);
    });
    if (sort === 'name') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price_vnd - b.price_vnd || a.title.localeCompare(b.title, 'vi'));
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price_vnd - a.price_vnd || a.title.localeCompare(b.title, 'vi'));
    $('#catalog-count').textContent = `${list.length} mô phỏng`;
    $('#product-grid').innerHTML = list.length ? list.map(product => productCard(product)).join('') : '<div class="catalog-empty"><strong>Không tìm thấy mô phỏng phù hợp.</strong><p>Thử từ khóa hoặc danh mục khác.</p></div>';
    bindAddButtons($('#product-grid'));
    syncShopQuery($('#shop-search').value.trim(), category, sort);
  };
  $('#shop-search').oninput = paint;
  $('#shop-sort').onchange = paint;
  $$('[data-category]', page).forEach(button => {
    button.onclick = () => {
      category = button.dataset.category;
      $$('[data-category]', page).forEach(item => item.classList.toggle('is-active', item === button));
      paint();
    };
  });
  paint();
  bindCartOpeners();
}

async function renderProductDetail(slug) {
  const page = $('#shop-page');
  await loadCatalog();
  const product = products.find(item => item.slug === slug);
  if (!product) {
    document.title = 'Không tìm thấy mô phỏng • BinGenZ';
    page.innerHTML = `<section class="recovery-state"><div class="state-icon" aria-hidden="true">?</div><h1>Không tìm thấy mô phỏng</h1><p>Sản phẩm có thể đã đổi địa chỉ hoặc tạm ngừng bán.</p><div class="shop-actions"><a class="shop-button gold" href="/shop">Về cửa hàng</a></div></section>`;
    return;
  }
  document.title = `${product.title} • BinGenZ`;
  const meta = $('meta[name="description"]');
  if (meta) meta.content = productDescription(product);
  const related = products.filter(item => item.id !== product.id && item.category && item.category === product.category).slice(0, 3);
  const fallbackRelated = related.length ? related : products.filter(item => item.id !== product.id).slice(0, 3);
  page.innerHTML = `<article class="product-detail">
      <nav class="commerce-breadcrumbs" aria-label="Đường dẫn"><a href="/shop">Cửa hàng</a> / <span>${esc(product.title)}</span></nav>
      <div class="product-detail-grid">
        <div class="product-detail-media"><img src="${esc(product.thumbnail)}" alt="Mô phỏng ${esc(product.title)}" width="960" height="600"></div>
        <div class="product-detail-copy">
          <span class="detail-category">${esc(productCategory(product))}</span>
          <h1>${esc(product.title)}</h1>
          <p class="product-detail-description">${esc(productDescription(product))}</p>
          <div class="detail-price">${money(product.price_vnd)}</div>
          <ul class="detail-facts">
            <li><span>Thời lượng sử dụng</span><strong>${Math.round(product.duration_seconds / 60)} phút riêng</strong></li>
            <li><span>Hạn bắt đầu</span><strong>Trong ${product.activation_days || 7} ngày</strong></li>
            <li><span>Thanh toán</span><strong>QR ngân hàng</strong></li>
            <li><span>Tài khoản</span><strong>Không cần đăng ký</strong></li>
          </ul>
          <div class="detail-actions"><button class="gold" type="button" data-add="${esc(product.id)}">Thêm vào giỏ</button><button type="button" data-open-cart>Xem giỏ</button></div>
          <p class="detail-assurance">Quyền truy cập được cấp tự động sau khi giao dịch được xác nhận. Đồng hồ chỉ bắt đầu khi bạn chủ động mở mô phỏng lần đầu.</p>
        </div>
      </div>
    </article>
    <section class="related-products" aria-labelledby="related-title"><h2 id="related-title">Có thể bạn cũng quan tâm</h2><div class="product-grid">${fallbackRelated.map(item => productCard(item)).join('')}</div></section>`;
  bindAddButtons(page);
  bindCartOpeners();
}

function checkoutSummary(items) {
  return `<div class="checkout-summary-list">${items.map(product => `<div class="checkout-summary-line"><img src="${esc(product.thumbnail)}" alt="" width="58" height="44"><strong>${esc(product.title)}</strong><span>${money(product.price_vnd)}</span></div>`).join('')}</div>
    <div class="checkout-total-line"><span>Tổng cộng</span><span>${money(items.reduce((sum, item) => sum + item.price_vnd, 0))}</span></div>`;
}

function mountTurnstile(container, submit, onToken) {
  let widget;
  const mount = () => {
    if (!container.isConnected || widget !== undefined) return;
    if (!sitekey) {
      showError(container.closest('.commerce-panel') || container, new Error(errors.configuration_required));
      return;
    }
    widget = window.turnstile.render(container, {
      sitekey,
      action: 'checkout',
      theme: document.documentElement.dataset.theme || 'auto',
      size: 'flexible',
      callback: value => { onToken(value); submit.disabled = false; },
      'expired-callback': () => { onToken(''); submit.disabled = true; },
      'error-callback': () => { onToken(''); submit.disabled = true; }
    });
  };
  if (window.turnstile) mount();
  else {
    window.bgzTurnstileReady = mount;
    if (!$('#turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=bgzTurnstileReady&render=explicit';
      script.async = true;
      script.onerror = () => showError(container.closest('.commerce-panel') || container, new Error('Không tải được bước xác minh. Kiểm tra kết nối rồi thử lại.'));
      document.head.append(script);
    }
  }
  return () => { if (widget !== undefined && window.turnstile) window.turnstile.reset(widget); };
}

async function renderCheckout() {
  const page = $('#shop-page');
  await loadCatalog();
  const items = cartItems();
  document.title = 'Thanh toán • BinGenZ';
  if (!items.length) {
    page.innerHTML = `<section class="recovery-state"><div class="state-icon" aria-hidden="true">◇</div><h1>Giỏ hàng đang trống</h1><p>Hãy chọn ít nhất một mô phỏng trước khi thanh toán.</p><div class="shop-actions"><a class="shop-button gold" href="/shop">Khám phá cửa hàng</a></div></section>`;
    return;
  }
  page.innerHTML = `<section class="checkout-page">
    <ol class="checkout-stepper" aria-label="Tiến trình thanh toán"><li class="is-done" data-step="✓">Giỏ hàng</li><li class="is-active" data-step="2">Thông tin</li><li data-step="3">Thanh toán</li></ol>
    <div class="checkout-heading"><span class="shop-kicker">Thanh toán an toàn</span><h1>Xác nhận đơn hàng</h1><p>Kiểm tra sản phẩm và nhập Gmail để tạo mã QR.</p></div>
    <div class="checkout-layout">
      <section class="commerce-panel">
        <h2>Thông tin người mua</h2>
        <form class="checkout-form" id="checkout-form">
          <label for="buyer-gmail">Địa chỉ Gmail</label>
          <input id="buyer-gmail" name="gmail" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="ban@gmail.com" pattern="[^@\\s]+@gmail\\.com" required>
          <p class="field-help">BinGenZ chỉ dùng Gmail để tra cứu đơn khi bạn cần hỗ trợ. Website không tạo tài khoản và không yêu cầu mật khẩu.</p>
          <div id="checkout-challenge"></div>
          <button class="primary-action" type="submit" disabled>Tạo mã QR thanh toán →</button>
        </form>
        <ul class="checkout-assurances"><li>Giá và sản phẩm được máy chủ xác nhận lại</li><li>Mã thanh toán có hiệu lực 15 phút</li><li>Quyền truy cập được cấp tự động sau khi ngân hàng xác nhận</li></ul>
      </section>
      <aside class="commerce-panel checkout-summary-panel"><h2>Đơn hàng của bạn</h2>${checkoutSummary(items)}<a class="shop-button" href="/shop" style="margin-top:18px;width:100%">← Tiếp tục chọn sản phẩm</a></aside>
    </div>
  </section>`;
  const form = $('#checkout-form');
  const submit = $('button[type="submit"]', form);
  let token = '';
  const resetTurnstile = mountTurnstile($('#checkout-challenge'), submit, value => { token = value; });
  form.onsubmit = async event => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Đang tạo mã thanh toán…';
    try {
      const order = await api('/api/orders', { gmail: $('#buyer-gmail').value, product_ids: [...cart], turnstile_token: token });
      if (!order.claimable) throw new Error('Đơn này đang chờ ở trình duyệt đã tạo đơn. Hãy quay lại trình duyệt đó hoặc đợi đơn hết hạn.');
      location.href = `/checkout/${order.id}`;
    } catch (error) {
      showError($('.commerce-panel', page), error);
      token = '';
      submit.textContent = 'Tạo mã QR thanh toán →';
      resetTurnstile();
    }
  };
}

async function renderHomeTeaser() {
  const grid = $('#featured-products') || $('#product-grid');
  if (!grid) return;
  try {
    await loadCatalog();
    grid.innerHTML = products.slice(0, 4).map(product => productCard(product, { featured: true, allowAdd: false })).join('');
    const count = $('#featured-product-count');
    if (count) count.textContent = `${products.length} mô phỏng đang mở bán`;
  } catch {
    grid.innerHTML = '<p class="shop-status">Cửa hàng tạm thời chưa khả dụng. Vui lòng quay lại sau.</p>';
  }
}

function recovery() {
  document.title = 'Khôi phục quyền truy cập • BinGenZ';
  $('#commerce-content').innerHTML = `<section class="recovery-state"><div class="state-icon" aria-hidden="true">!</div><h1>Không thể mở liên kết truy cập</h1><p>Liên kết có thể đã hết hiệu lực, bị thay thế hoặc đang được mở trên thiết bị khác. BinGenZ không tạo tài khoản hay tự động gửi lại liên kết.</p><p>Nếu đã thanh toán, hãy cung cấp mã BGZ hoặc thông tin giao dịch cho bộ phận hỗ trợ; không gửi mật khẩu hay mã xác thực.</p><div class="shop-actions"><a class="shop-button gold" href="/#contact">Liên hệ hỗ trợ</a><a class="shop-button" href="/shop">Xem cửa hàng</a></div></section>`;
}

async function paidAccess(link) {
  const data = await api('/api/access');
  document.title = 'Mô phỏng của bạn • BinGenZ';
  const content = $('#commerce-content');
  content.innerHTML = `<section class="access-hero"><span class="commerce-kicker">Đơn ${esc(data.order_code)}</span><h1>Mô phỏng của bạn</h1><p class="intro">Bắt đầu từng mô phỏng khi bạn sẵn sàng. Đồng hồ không tạm dừng sau khi đã bắt đầu.</p></section>
    ${link ? `<div class="license-link"><strong>Lưu liên kết truy cập này</strong><p>Không có tài khoản đăng nhập. Liên kết chỉ dùng trên thiết bị đã gắn với đơn hàng.</p><p>${esc(link)}</p><button id="copy-access" type="button">Sao chép liên kết</button></div>` : '<p class="shop-note">Giữ liên kết truy cập đã được cấp. Nếu mất liên kết hoặc cần đổi thiết bị, hãy liên hệ BinGenZ và cung cấp mã đơn.</p>'}
    <div class="access-grid"></div>`;
  if (link) $('#copy-access').onclick = event => copy(link, event.currentTarget);
  const labels = { not_started: 'Chưa bắt đầu', active: 'Đang chạy', expired: 'Đã hết hạn', activation_expired: 'Quá hạn kích hoạt', revoked: 'Đã thu hồi' };
  $('.access-grid').innerHTML = data.items.map(item => `<article class="product-card">
    <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}">
    <div class="product-body"><h3>${esc(item.title)}</h3><span class="access-state">${labels[item.status]}</span><p class="product-meta">${Math.round(item.duration_seconds / 60)} phút sử dụng riêng</p>
    ${item.status === 'not_started' ? `<p class="product-meta">Bắt đầu trước ${dateTime(item.activation_deadline)}</p><button class="gold" data-start="${item.id}">Bắt đầu</button>` : item.status === 'active' ? `<p class="commerce-clock" id="clock-${item.id}"></p><a class="shop-button gold" href="/play/${item.id}">Mở mô phỏng</a>` : `<a class="shop-button" href="/shop/${encodeURIComponent(item.slug)}">Mua lại</a>`}</div>
  </article>`).join('');
  for (const item of data.items) {
    if (item.status === 'active') timer($(`#clock-${item.id}`), item.expires_at, data.server_now, () => paidAccess().catch(error => showError(content, error)));
    const start = $(`[data-start="${item.id}"]`);
    if (start) start.onclick = () => {
      const modal = createDialog('Bắt đầu ngay?', `<p><strong>${esc(item.title)}</strong></p><p>Bạn có ${Math.round(item.duration_seconds / 60)} phút kể từ khi xác nhận. Không thể tạm dừng; đóng tab hoặc tải lại trang không đặt lại đồng hồ.</p><div class="shop-actions"><button id="cancel-start" type="button">Để sau</button><button class="gold" id="confirm-start" type="button">Xác nhận bắt đầu</button></div>`);
      $('#cancel-start', modal).onclick = () => modal.close();
      $('#confirm-start', modal).onclick = async event => {
        event.currentTarget.disabled = true;
        try {
          await api(`/api/entitlements/${item.id}/start`, {});
          location.href = `/play/${item.id}`;
        } catch (error) {
          showError(modal, error);
          event.currentTarget.disabled = false;
        }
      };
    };
  }
}

function paymentOrderSummary(order) {
  if (!order.items?.length) return '';
  return `<div class="payment-order-summary"><h3>Đơn hàng (${order.items.length} mô phỏng)</h3><div class="payment-order-list">${order.items.map(item => `<div class="payment-order-line"><strong>${esc(item.title)}</strong><span>${money(item.price_vnd)}</span></div>`).join('')}</div></div>`;
}

async function payment(id) {
  const content = $('#commerce-content');
  const order = await api(`/api/orders/${id}`);
  if (order.status === 'paid') {
    content.innerHTML = `<section class="success-state"><div class="state-icon" aria-hidden="true">✓</div><h1>Thanh toán thành công</h1><p>Ngân hàng đã xác nhận giao dịch. BinGenZ đang chuẩn bị quyền truy cập cho bạn…</p></section>`;
    const claimed = await api(`/api/orders/${id}/claim`, {});
    cart.clear();
    saveCart();
    await new Promise(resolve => setTimeout(resolve, 550));
    history.replaceState(null, '', '/access');
    await paidAccess(claimed.access_url);
    return;
  }
  if (order.status !== 'pending') {
    content.innerHTML = `<section class="expired-state"><div class="state-icon" aria-hidden="true">!</div><h1>Mã thanh toán đã hết hạn</h1><p>Không chuyển khoản theo mã cũ. Nếu bạn đã chuyển tiền, hãy liên hệ BinGenZ để được kiểm tra thủ công.</p><div class="shop-actions"><a class="shop-button gold" href="/checkout">Tạo mã thanh toán mới</a><a class="shop-button" href="/#contact">Liên hệ hỗ trợ</a></div></section>`;
    return;
  }
  document.title = 'Quét QR thanh toán • BinGenZ';
  content.innerHTML = `<ol class="checkout-stepper" aria-label="Tiến trình thanh toán"><li class="is-done" data-step="✓">Giỏ hàng</li><li class="is-done" data-step="✓">Thông tin</li><li class="is-active" data-step="3">Thanh toán</li></ol>
    <header class="payment-header"><span class="commerce-kicker">Thanh toán an toàn qua SePay</span><h1>Quét QR để thanh toán</h1><p class="intro">Giữ trang này mở. Quyền truy cập sẽ được cấp tự động sau khi ngân hàng xác nhận.</p></header>
    <div class="payment-layout">
      <section class="commerce-panel payment-qr-card"><div class="payment-qr-wrap"><img class="payment-qr" src="/api/orders/${id}/qr" alt="QR chuyển khoản đúng số tiền và mã đơn"></div><p>QR đã bao gồm đúng số tiền và nội dung chuyển khoản.</p></section>
      <section class="commerce-panel payment-detail-card">
        <h2 class="sr-only">Thông tin chuyển khoản ${money(order.total_vnd)}</h2>
        <div class="payment-status-bar"><div class="payment-status-copy"><strong>Đang chờ thanh toán</strong><span>Mã QR còn hiệu lực</span></div><span class="commerce-clock" id="pay-clock"></span></div>
        <div class="payment-field"><div class="payment-field-label">Ngân hàng nhận</div><div class="payment-field-row"><p class="payment-field-value">TPBank · qua SePay</p></div></div>
        <div class="payment-field"><div class="payment-field-label">Số tiền chính xác</div><div class="payment-field-row"><p class="payment-field-value">${money(order.total_vnd)}</p><button class="copy-button" id="copy-amount" type="button">Sao chép</button></div></div>
        <div class="payment-field"><div class="payment-field-label">Nội dung chuyển khoản</div><div class="payment-field-row"><p class="payment-field-value payment-code">${esc(order.payment_code)}</p><button class="copy-button" id="copy-code" type="button">Sao chép</button></div></div>
        <ol class="payment-instructions"><li>Quét mã bằng ứng dụng ngân hàng.</li><li>Kiểm tra đúng số tiền và giữ nguyên nội dung BGZ.</li><li>Chờ trang tự động xác nhận; không chuyển khoản lần thứ hai.</li></ol>
        ${paymentOrderSummary(order)}
        <p id="payment-state" role="status">Đang kết nối với hệ thống thanh toán…</p>
      </section>
    </div>`;
  $('#copy-code').onclick = event => copy(order.payment_code, event.currentTarget);
  $('#copy-amount').onclick = event => copy(String(order.total_vnd), event.currentTarget);
  let stopped = false;
  const stopClock = timer($('#pay-clock'), order.expires_at, order.server_now, () => {
    stopped = true;
    payment(id).catch(error => showError(content, error));
  });
  const poll = async () => {
    if (stopped) return;
    try {
      const next = await api(`/api/orders/${id}`);
      if (next.status !== 'pending') {
        stopped = true;
        stopClock();
        await payment(id);
        return;
      }
      $('#payment-state').textContent = 'Đang chờ ngân hàng xác nhận…';
    } catch {
      $('#payment-state').textContent = 'Đang kết nối lại… Không chuyển khoản thêm.';
    }
    if (!stopped) setTimeout(poll, 2500);
  };
  setTimeout(poll, 2500);
}

async function play(id) {
  const data = await api('/api/access');
  const item = data.items.find(product => product.id === id);
  if (!item || item.status !== 'active') throw new Error(errors.entitlement_expired);
  const permit = await api(`/api/entitlements/${id}/play`, {});
  $('.commerce-route-header')?.remove();
  const main = $('#commerce-page');
  main.className = 'commerce play-layout';
  main.innerHTML = `<header><a href="/access">← Mô phỏng của bạn</a><strong class="commerce-clock" id="runtime-clock"></strong></header><iframe title="${esc(item.title)}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>`;
  const frame = $('iframe', main);
  frame.src = permit.url;
  let stopped = false;
  const lock = message => {
    if (stopped) return;
    stopped = true;
    frame.remove();
    const box = document.createElement('div');
    box.className = 'play-message';
    box.innerHTML = `<h1>${esc(message)}</h1><p>Thời gian sử dụng vẫn được tính trên máy chủ.</p><a class="shop-button" href="/access">Về mô phỏng của bạn</a>`;
    main.append(box);
  };
  timer($('#runtime-clock'), permit.expires_at, permit.server_now, () => lock('Đã hết hạn'));
  const heartbeat = async () => {
    if (stopped) return;
    try {
      const current = await api('/api/access');
      if (current.items.find(product => product.id === id)?.status !== 'active') lock('Mô phỏng đã bị khóa');
    } catch { lock('Không thể xác minh quyền truy cập'); }
    if (!stopped) setTimeout(heartbeat, 10000);
  };
  setTimeout(heartbeat, 10000);
}

async function start() {
  initTheme();
  bindCartOpeners();
  if ($('#store')) await renderHomeTeaser();
  const shopPage = $('#shop-page');
  if (shopPage) {
    const path = location.pathname;
    if (path === '/checkout') await renderCheckout();
    else if (path === '/shop' || path === '/shop/') await renderShop();
    else if (path.startsWith('/shop/')) {
      let slug = path.slice('/shop/'.length);
      try { slug = decodeURIComponent(slug); } catch {}
      await renderProductDetail(slug);
    }
  }
  const content = $('#commerce-content');
  if (content) {
    const path = location.pathname;
    const task = path === '/access/recovery' ? (recovery(), Promise.resolve())
      : path.startsWith('/checkout/') ? payment(path.split('/')[2])
      : path.startsWith('/play/') ? play(path.split('/')[2])
      : paidAccess();
    await task;
  }
}

start().catch(error => {
  const root = $('#shop-page') || $('#commerce-content') || $('#store') || document.body;
  showError(root, error);
});
