const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const dateTime = value => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

const iconPaths = {
  arrowLeft: '<path d="M19 12H5m6 6-6-6 6-6"/>',
  arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  cart: '<path d="M6 7h15l-1.5 8.5H8L6 4H3"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 21h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/><path d="M10 11v6m4-6v6"/>',
  warning: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  empty: '<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>'
};
const icon = (name, className = '') => `<svg class="ui-icon${className ? ` ${className}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;

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
  const syncLabel = () => button.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  syncLabel();
  button.onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    if (meta) meta.content = next === 'dark' ? '#09090c' : '#f8fafc';
    try { localStorage.setItem('theme', next); } catch {}
    syncLabel();
  };
}

function createDialog(title, body, className = 'shop-dialog') {
  const returnFocus = document.activeElement;
  const modal = document.createElement('dialog');
  const titleId = `dialog-title-${crypto.randomUUID()}`;
  modal.className = `commerce-dialog ${className}`;
  modal.setAttribute('aria-labelledby', titleId);
  modal.innerHTML = `<header class="dialog-header"><h2 id="${titleId}">${esc(title)}</h2><button class="dialog-close icon-action" type="button" aria-label="Đóng">${icon('close')}</button></header>${body}`;
  document.body.append(modal);
  $('.dialog-close', modal).onclick = () => modal.close();
  modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
  modal.addEventListener('close', () => {
    modal.remove();
    if (!$('dialog[open]')) document.body.classList.remove('scroll-locked');
    if (returnFocus?.isConnected) returnFocus.focus();
  });
  document.body.classList.add('scroll-locked');
  modal.showModal();
  return modal;
}

async function copy(value, button) {
  const original = button.innerHTML;
  const originalLabel = button.getAttribute('aria-label');
  try {
    await navigator.clipboard.writeText(String(value));
    button.innerHTML = icon('check');
    button.classList.add('is-copied');
    button.setAttribute('aria-label', 'Đã sao chép');
    announce('Đã sao chép thông tin chuyển khoản.');
    setTimeout(() => {
      if (!button.isConnected) return;
      button.innerHTML = original;
      button.classList.remove('is-copied');
      if (originalLabel) button.setAttribute('aria-label', originalLabel);
    }, 1600);
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
let disposeCheckoutChallenge;
try {
  const saved = JSON.parse(localStorage.getItem('bgz-cart') || '[]');
  if (Array.isArray(saved)) cart = new Set(saved.filter(value => typeof value === 'string'));
} catch {}

function productCategory(product) {
  return product.category?.trim() || 'Mô phỏng tương tác';
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
    const product = products.find(item => item.id === button.dataset.add);
    button.innerHTML = selected ? `${icon('check')}<span>Đã thêm</span>` : `<span>Thêm vào giỏ</span>`;
    button.disabled = selected;
    button.classList.toggle('is-added', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', selected ? `Đã thêm ${product?.title || 'sản phẩm'} vào giỏ` : `Thêm ${product?.title || 'sản phẩm'} vào giỏ`);
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

function productCard(product) {
  return `<article class="product-card">
    <div class="product-media">
      <img src="${esc(product.thumbnail)}" alt="Mô phỏng ${esc(product.title)}" loading="lazy" width="600" height="375">
      <button class="product-inspect" type="button" data-detail="${esc(product.id)}" aria-label="Xem chi tiết ${esc(product.title)}">Chi tiết ${icon('arrowRight')}</button>
    </div>
    <div class="product-body">
      <span class="product-category">${esc(productCategory(product))}</span>
      <h3>${esc(product.title)}</h3>
      <p class="product-runtime">${Math.round(product.duration_seconds / 60)} phút trải nghiệm</p>
      <div class="product-price">${money(product.price_vnd)}</div>
      <div class="product-actions">
        <button class="gold" type="button" data-add="${esc(product.id)}" aria-label="Thêm ${esc(product.title)} vào giỏ">Thêm vào giỏ</button>
      </div>
    </div>
  </article>`;
}

function bindAddButtons(root = document) {
  $$('[data-detail]', root).forEach(button => {
    button.onclick = () => openProduct(button.dataset.detail);
  });
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

function openProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const modal = createDialog(product.title, `<div class="product-detail-content">
    <img src="${esc(product.thumbnail)}" alt="Mô phỏng ${esc(product.title)}">
    <span class="product-category">${esc(productCategory(product))}</span>
    <p class="detail-description">${esc(product.description || 'Khám phá cách hoạt động qua mô phỏng tương tác trực tiếp trên trình duyệt.')}</p>
    <div class="detail-facts"><span><strong>${Math.round(product.duration_seconds / 60)} phút</strong>Thời gian sử dụng</span><span><strong>${product.activation_days || 7} ngày</strong>Hạn bắt đầu sau thanh toán</span></div>
    <p class="shop-note">Thời gian tính liên tục từ lúc bấm Bắt đầu, kể cả khi đóng tab. Mỗi mô phỏng bắt đầu riêng.</p>
    <div class="detail-purchase"><strong>${money(product.price_vnd)}</strong><button class="gold" type="button" data-add="${esc(product.id)}">Thêm vào giỏ</button></div>
  </div>`, 'product-detail-dialog');
  bindAddButtons(modal);
}

function purchaseSteps(current) {
  return `<ol class="purchase-steps" aria-label="Tiến trình mua hàng">${['Giỏ hàng', 'Thanh toán QR', 'Sử dụng'].map((label, index) => `<li class="${index + 1 === current ? 'is-current' : index + 1 < current ? 'is-complete' : ''}"${index + 1 === current ? ' aria-current="step"' : ''}><span>${index + 1 < current ? icon('check') : index + 1}</span>${label}</li>`).join('')}</ol>`;
}

function updateFloatingCart() {
  const canFloat = Boolean($('#store'));
  let floating = $('#floating-cart');
  if (!canFloat || !cart.size) {
    floating?.remove();
    document.body.classList.remove('has-floating-cart');
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
    <strong>Xem giỏ ${icon('arrowRight')}</strong>
  </button>`;
  document.body.classList.add('has-floating-cart');
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
      content.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon" aria-hidden="true">${icon('empty')}</span><h3>Giỏ hàng đang trống</h3><p>Chọn sản phẩm bạn muốn khám phá rồi thêm vào giỏ.</p><a class="shop-button gold" href="/#store">Xem sản phẩm</a></div>`;
      summary.hidden = true;
      return;
    }
    summary.hidden = false;
    content.innerHTML = items.map(product => `<article class="cart-line">
      <img src="${esc(product.thumbnail)}" alt="" width="82" height="62">
      <div class="cart-line-copy"><strong>${esc(product.title)}</strong><span>${money(product.price_vnd)}</span></div>
      <button class="cart-remove icon-action" type="button" data-remove="${esc(product.id)}" aria-label="Xóa ${esc(product.title)} khỏi giỏ">${icon('trash')}</button>
    </article>`).join('');
    summary.innerHTML = `<div class="cart-total"><span>Tổng cộng · ${items.length} mô phỏng</span><span>${money(cartTotal())}</span></div>
      <p>Thanh toán QR · Không cần tài khoản. Hạn bắt đầu và thời lượng được ghi riêng trong chi tiết từng sản phẩm.</p>
      <div class="cart-summary-actions"><button class="text-button" id="clear-cart" type="button">Xóa giỏ</button><a class="shop-button cart-checkout-action" href="/checkout"><span>Tiếp tục thanh toán</span>${icon('arrowRight')}</a></div>`;
    $$('[data-remove]', modal).forEach(button => {
      button.onclick = () => {
        cart.delete(button.dataset.remove);
        saveCart();
        paint();
    announce('Đã xóa sản phẩm khỏi giỏ hàng.');
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

async function renderHomeCatalog() {
  const store = $('#store');
  const container = $('.container', store);
  if (!container) return;
  try { await loadCatalog(); }
  catch {
    container.innerHTML = '<p class="shop-status">Sản phẩm tạm thời chưa khả dụng. Vui lòng quay lại sau.</p>';
    return;
  }
  const categories = [...new Set(products.map(product => product.category?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  container.innerHTML = `<div class="shop-heading home-store-heading"><div><span class="section-label">BINGENZ / SIMULATION LAB</span><h2 class="section-title" id="catalog-title">Hiểu công nghệ.<br>Qua từng trải nghiệm.</h2><p>Khám phá thuật toán và hệ thống bằng mô phỏng tương tác. Chọn chủ đề bạn thích, bắt đầu khi sẵn sàng.</p></div><div class="catalog-signature"><strong>${products.length}</strong><span>mô phỏng<br>để khám phá</span></div></div>
    <div class="store-benefits"><span>${icon('check')} Chạy trên trình duyệt</span><span>${icon('check')} Thanh toán QR tự động</span><span>${icon('check')} Bắt đầu từng sản phẩm riêng</span></div>
    <section class="shop-catalog home-catalog" aria-labelledby="catalog-title">
      <div class="shop-controls">
        <label class="shop-search-wrap"><span aria-hidden="true">${icon('search')}</span><span class="sr-only">Tìm mô phỏng</span><input id="shop-search" type="search" placeholder="Tìm sản phẩm…" autocomplete="off"></label>
        <label><span class="sr-only">Sắp xếp sản phẩm</span><select class="shop-sort" id="shop-sort"><option value="featured">Nổi bật</option><option value="name">Tên A–Z</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label>
        <div class="category-filters" id="category-filters" aria-label="Lọc theo danh mục">
          <button class="filter-chip is-active" type="button" data-category="" aria-pressed="true">Tất cả</button>
          ${categories.map(category => `<button class="filter-chip" type="button" data-category="${esc(category)}" aria-pressed="false">${esc(category)}</button>`).join('')}
        </div>
      </div>
      <div class="catalog-meta"><span class="catalog-result-count" id="catalog-count"></span></div>
      <div class="product-grid" id="product-grid"></div>
      <div class="catalog-more"><button class="shop-button" id="catalog-more" type="button">Xem thêm sản phẩm ${icon('arrowRight')}</button></div>
      <p class="store-help">Chưa biết chọn mô phỏng nào? <a href="/#contact">Liên hệ BinGenZ để được tư vấn</a></p>
    </section>`;
  let category = '';
  let visibleCount = 8;
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
    const visible = list.slice(0, visibleCount);
    $('#catalog-count').textContent = list.length ? `Đang hiển thị ${visible.length}/${list.length} sản phẩm` : '0 sản phẩm';
    $('#product-grid').innerHTML = visible.length ? visible.map(product => productCard(product)).join('') : '<div class="catalog-empty"><strong>Không tìm thấy sản phẩm phù hợp.</strong><p>Thử từ khóa hoặc danh mục khác.</p></div>';
    $('#catalog-more').hidden = visible.length >= list.length;
    bindAddButtons($('#product-grid'));
  };
  const resetAndPaint = () => { visibleCount = 8; paint(); };
  $('#shop-search').oninput = resetAndPaint;
  $('#shop-sort').onchange = resetAndPaint;
  $('#catalog-more').onclick = () => { visibleCount += 8; paint(); };
  $$('[data-category]', store).forEach(button => {
    button.onclick = () => {
      category = button.dataset.category;
      $$('[data-category]', store).forEach(item => { item.classList.toggle('is-active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
      resetAndPaint();
    };
  });
  paint();
  bindCartOpeners();
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
  const reset = () => { if (widget !== undefined && window.turnstile) window.turnstile.reset(widget); };
  reset.dispose = () => { if (widget !== undefined && window.turnstile) window.turnstile.remove(widget); };
  return reset;
}

async function renderCheckout() {
  disposeCheckoutChallenge?.();
  const page = $('#shop-page');
  document.body.classList.add('checkout-mode');
  await loadCatalog();
  const items = cartItems();
  document.title = 'Thanh toán • BinGenZ';
  if (!items.length) {
    page.innerHTML = `<section class="recovery-state"><div class="state-icon" aria-hidden="true">${icon('empty')}</div><h1>Giỏ hàng đang trống</h1><p>Hãy chọn ít nhất một mô phỏng trước khi thanh toán.</p><div class="shop-actions"><a class="shop-button gold" href="/#store">Xem sản phẩm</a></div></section>`;
    return;
  }
  page.innerHTML = `${purchaseSteps(1)}<section class="checkout-page checkout-single">
      <section class="commerce-panel checkout-entry-panel">
        <span class="shop-kicker">Thanh toán an toàn</span>
        <h1>Chỉ còn một bước nhỏ.</h1>
        <p class="checkout-entry-intro">Nhập Gmail để tra cứu đơn và hỗ trợ khi cần. Liên kết sử dụng sẽ xuất hiện ngay tại đây sau thanh toán.</p>
        <form class="checkout-form" id="checkout-form">
          <label for="buyer-gmail">Địa chỉ Gmail</label>
          <input id="buyer-gmail" name="gmail" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="ban@gmail.com" pattern="[^@\\s]+@gmail\\.com" required>
          <p class="field-help">BinGenZ chỉ dùng Gmail để tra cứu đơn khi bạn cần hỗ trợ. Website không tạo tài khoản và không yêu cầu mật khẩu.</p>
          <div id="checkout-challenge"></div>
          <button class="primary-action" type="submit" disabled><span>Tạo mã QR thanh toán</span>${icon('arrowRight')}</button>
        </form>
        <p class="checkout-note">Mã QR có hiệu lực 15 phút. Quyền truy cập được cấp tự động sau khi ngân hàng xác nhận.</p>
      </section>
      <aside class="commerce-panel checkout-review" aria-label="Kiểm tra giỏ hàng"><span class="shop-kicker">Bạn đã chọn</span><h2>${items.length} mô phỏng</h2><div class="checkout-review-items">${items.map(item => `<div class="checkout-review-line"><img src="${esc(item.thumbnail)}" alt="" width="64" height="48"><div><strong>${esc(item.title)}</strong><small>${Math.round(item.duration_seconds / 60)} phút · bắt đầu trong ${item.activation_days || 7} ngày</small></div><span>${money(item.price_vnd)}</span></div>`).join('')}</div><div class="cart-total"><span>Tổng thanh toán</span><strong>${money(cartTotal())}</strong></div><button type="button" id="checkout-edit-cart" class="text-button">Chỉnh sửa giỏ hàng</button></aside>
  </section>`;
  $('#checkout-edit-cart').onclick = () => {
    openCart();
    const modal = $('dialog.cart-drawer');
    modal.addEventListener('close', () => renderCheckout().catch(error => showError(page, error)), { once: true });
  };
  const form = $('#checkout-form');
  const submit = $('button[type="submit"]', form);
  let token = '';
  const resetTurnstile = mountTurnstile($('#checkout-challenge'), submit, value => { token = value; });
  disposeCheckoutChallenge = resetTurnstile.dispose;
  form.onsubmit = async event => {
    event.preventDefault();
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>Đang tạo mã thanh toán…</span>';
    try {
      const order = await api('/api/orders', { gmail: $('#buyer-gmail').value, product_ids: [...cart], turnstile_token: token });
      if (!order.claimable) throw new Error('Đơn này đang chờ ở trình duyệt đã tạo đơn. Hãy quay lại trình duyệt đó hoặc đợi đơn hết hạn.');
      location.href = `/checkout/${order.id}`;
    } catch (error) {
      showError($('.commerce-panel', page), error);
      token = '';
      submit.removeAttribute('aria-busy');
      submit.innerHTML = `<span>Tạo mã QR thanh toán</span>${icon('arrowRight')}`;
      resetTurnstile();
    }
  };
}

function recovery() {
  document.title = 'Khôi phục quyền truy cập • BinGenZ';
  $('#commerce-content').innerHTML = `<section class="recovery-state"><div class="state-icon" aria-hidden="true">${icon('warning')}</div><h1>Không thể mở liên kết truy cập</h1><p>Liên kết có thể đã hết hiệu lực, bị thay thế hoặc đang được mở trên thiết bị khác. BinGenZ không tạo tài khoản hay tự động gửi lại liên kết.</p><p>Nếu đã thanh toán, hãy cung cấp mã BGZ hoặc thông tin giao dịch cho bộ phận hỗ trợ; không gửi mật khẩu hay mã xác thực.</p><div class="shop-actions"><a class="shop-button gold" href="/#contact">Liên hệ hỗ trợ</a><a class="shop-button" href="/#store">Xem sản phẩm</a></div></section>`;
}

async function paidAccess(link) {
  const data = await api('/api/access');
  document.title = 'Mô phỏng của bạn • BinGenZ';
  const content = $('#commerce-content');
  content.innerHTML = `${purchaseSteps(3)}<section class="access-hero"><span class="commerce-kicker">Đơn ${esc(data.order_code)}</span><h1>Mô phỏng của bạn</h1><p class="intro">Bắt đầu từng mô phỏng khi bạn sẵn sàng. Đồng hồ không tạm dừng sau khi đã bắt đầu.</p></section>
    ${link ? `<div class="license-link"><strong>Lưu liên kết truy cập này</strong><p>Không có tài khoản đăng nhập. Liên kết chỉ dùng trên thiết bị đã gắn với đơn hàng.</p><p>${esc(link)}</p><button id="copy-access" type="button">Sao chép liên kết</button></div>` : '<p class="shop-note">Giữ liên kết truy cập đã được cấp. Nếu mất liên kết hoặc cần đổi thiết bị, hãy liên hệ BinGenZ và cung cấp mã đơn.</p>'}
    <div class="access-grid"></div>`;
  if (link) $('#copy-access').onclick = event => copy(link, event.currentTarget);
  const labels = { not_started: 'Chưa bắt đầu', active: 'Đang chạy', expired: 'Đã hết hạn', activation_expired: 'Quá hạn kích hoạt', revoked: 'Đã thu hồi' };
  $('.access-grid').innerHTML = data.items.map(item => `<article class="product-card">
    <img src="${esc(item.thumbnail)}" alt="${esc(item.title)}">
    <div class="product-body"><h3>${esc(item.title)}</h3><span class="access-state">${labels[item.status]}</span><p class="product-meta">${Math.round(item.duration_seconds / 60)} phút sử dụng riêng</p>
    ${item.status === 'not_started' ? `<p class="product-meta">Bắt đầu trước ${dateTime(item.activation_deadline)}</p><button class="gold" data-start="${item.id}">Bắt đầu</button>` : item.status === 'active' ? `<p class="commerce-clock" id="clock-${item.id}"></p><a class="shop-button gold" href="/play/${item.id}">Mở mô phỏng</a>` : `<a class="shop-button" href="/#store">Mua lại</a>`}</div>
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
    content.innerHTML = `<section class="success-state"><div class="state-icon" aria-hidden="true">${icon('check')}</div><h1>Thanh toán thành công</h1><p>Ngân hàng đã xác nhận giao dịch. BinGenZ đang chuẩn bị quyền truy cập cho bạn…</p></section>`;
    const claimed = await api(`/api/orders/${id}/claim`, {});
    cart.clear();
    saveCart();
    await new Promise(resolve => setTimeout(resolve, 550));
    history.replaceState(null, '', '/access');
    await paidAccess(claimed.access_url);
    return;
  }
  if (order.status !== 'pending') {
    content.innerHTML = `<section class="expired-state"><div class="state-icon" aria-hidden="true">${icon('warning')}</div><h1>Mã thanh toán đã hết hạn</h1><p>Không chuyển khoản theo mã cũ. Nếu bạn đã chuyển tiền, hãy liên hệ BinGenZ để được kiểm tra thủ công.</p><div class="shop-actions"><a class="shop-button gold" href="/checkout">Tạo mã thanh toán mới</a><a class="shop-button" href="/#contact">Liên hệ hỗ trợ</a></div></section>`;
    return;
  }
  document.title = 'Quét QR thanh toán • BinGenZ';
  const destination = order.payment_destination;
  content.innerHTML = `${purchaseSteps(2)}<header class="payment-header"><span class="commerce-kicker">Thanh toán qua SePay</span><h1>Quét mã. Bắt đầu khám phá.</h1><p class="intro">Chuyển đúng số tiền và nội dung. Trang sẽ tự cập nhật khi ngân hàng xác nhận.</p></header>
    <div class="payment-layout">
      <section class="commerce-panel payment-qr-card">
        <div class="payment-card-heading"><div><span class="payment-eyebrow">Thanh toán ngân hàng</span><h2>Quét QR để thanh toán</h2></div><div class="payment-timer"><span>Còn lại</span><strong class="commerce-clock" id="pay-clock"></strong></div></div>
        <div class="payment-qr-wrap"><img class="payment-qr" src="/api/orders/${id}/qr" alt="QR chuyển khoản đúng số tiền và mã đơn"></div>
        <p class="payment-qr-help">Mở ứng dụng ngân hàng và quét mã. Số tiền cùng nội dung chuyển khoản đã được điền sẵn.</p>
        <a class="shop-button qr-download-action" href="/api/orders/${id}/qr" download="bingenz-${esc(order.payment_code)}-qr">${icon('download')}<span>Tải mã QR</span></a>
        <ol class="payment-instructions"><li>Quét mã bằng ứng dụng ngân hàng.</li><li>Kiểm tra đúng số tiền rồi xác nhận.</li><li>Giữ trang mở và không chuyển khoản lần hai.</li></ol>
        <p id="payment-state" role="status">Đang kết nối với hệ thống thanh toán…</p>
      </section>
      <section class="commerce-panel payment-detail-card">
        <div class="payment-detail-heading"><div><h2>Thông tin chuyển khoản</h2><p>Dùng khi bạn cần nhập thủ công.</p></div></div>
        <div class="payment-detail-list">
          <div class="payment-detail-row"><span class="payment-field-label">Ngân hàng</span><strong class="payment-field-value">${esc(destination.bank_code)}</strong></div>
          <div class="payment-detail-row"><span class="payment-field-label">Số tài khoản</span><strong class="payment-field-value payment-account">${esc(destination.account_number)}</strong><button class="copy-button icon-action" id="copy-account" type="button" aria-label="Sao chép số tài khoản">${icon('copy')}</button></div>
          <div class="payment-detail-row"><span class="payment-field-label">Tên người nhận</span><strong class="payment-field-value payment-recipient">${esc(destination.account_name)}</strong><button class="copy-button icon-action" id="copy-recipient" type="button" aria-label="Sao chép tên người nhận">${icon('copy')}</button></div>
          <div class="payment-detail-row payment-detail-emphasis"><span class="payment-field-label">Số tiền</span><strong class="payment-field-value">${money(order.total_vnd)}</strong><button class="copy-button icon-action" id="copy-amount" type="button" aria-label="Sao chép số tiền">${icon('copy')}</button></div>
          <div class="payment-detail-row payment-detail-emphasis"><span class="payment-field-label">Nội dung</span><strong class="payment-field-value payment-code">${esc(order.payment_code)}</strong><button class="copy-button icon-action" id="copy-code" type="button" aria-label="Sao chép nội dung chuyển khoản">${icon('copy')}</button></div>
        </div>
        ${paymentOrderSummary(order)}
        <p class="checkout-note">Cần trợ giúp? <a href="/#contact">Liên hệ BinGenZ</a> và cung cấp mã ${esc(order.payment_code)}.</p>
        <a class="text-button payment-back" href="/#store">${icon('arrowLeft')} Quay lại cửa hàng</a><p class="field-help">Đơn này vẫn chờ đến khi hết hạn. Quay lại giỏ không hủy giao dịch đã chuyển.</p>
      </section>
    </div>`;
  $('#copy-account').onclick = event => copy(destination.account_number, event.currentTarget);
  $('#copy-recipient').onclick = event => copy(destination.account_name, event.currentTarget);
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
  main.innerHTML = `<header><a href="/access">${icon('arrowLeft')}<span>Mô phỏng của bạn</span></a><strong class="commerce-clock" id="runtime-clock"></strong></header><iframe title="${esc(item.title)}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>`;
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
  if ($('#store')) await renderHomeCatalog();
  const shopPage = $('#shop-page');
  if (shopPage && location.pathname === '/checkout') await renderCheckout();
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
