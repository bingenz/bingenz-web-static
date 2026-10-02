const $ = (s) => document.querySelector(s),
  money = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
let products = [];
let currentOrders = [];
let productDirty = false;
let selectedProductId = "";
let pendingRequests = 0;
let orderSnapshot = "[]";
let savedOrder = [], draftOrder = [];
let orderSaving = false;
const orderDirty = () => JSON.stringify(savedOrder) !== JSON.stringify(draftOrder);
function requireSavedOrder() {
  if (!orderDirty() && !orderSaving) return true;
  say("Hãy lưu thứ tự hoặc Hủy trước khi thay đổi sản phẩm.");
  return false;
}
const statusLabels = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  expired: "Hết hạn",
  expired_pending: "Chờ đã hết hạn",
  not_started: "Chưa bắt đầu",
  active: "Đang sử dụng",
  activation_expired: "Quá hạn bắt đầu",
  revoked: "Đã thu hồi",
  matched: "Đã khớp",
  late: "Đến muộn",
  underpaid: "Thiếu tiền",
  overpaid: "Dư tiền",
  unmatched: "Chưa khớp",
  requested: "Yêu cầu hoàn",
  completed: "Đã hoàn",
};
Object.assign(statusLabels, {
  unknown_code: "Không nhận diện mã đơn",
  wrong_bank: "Sai tài khoản nhận",
  outgoing: "Tiền chuyển ra",
  already_paid: "Đơn đã thanh toán",
  reconciled: "Đã đối soát",
  review: "Cần kiểm tra",
  candidate: "Đang kiểm tra",
});
const displayDate = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
function say(message) {
  $("#message").textContent = message;
}
async function api(path, options) {
  pendingRequests++;
  document
    .querySelectorAll('button[type="submit"],form button:not([type])')
    .forEach((button) => (button.disabled = true));
  try {
    const response = await fetch("/admin/api/" + path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
    const body = await response.json();
    if (!response.ok) {
      const messages = {
        admin_denied:
          "Bạn không có quyền quản trị. Hãy đăng nhập bằng tài khoản được cấp quyền.",
        configuration_required: "Cấu hình quản trị chưa sẵn sàng.",
        product_unavailable: "Sản phẩm chưa sẵn sàng để mở bán.",
        invalid_product: "Thông tin sản phẩm chưa hợp lệ.",
        product_changed: "Danh sách đã thay đổi. Hãy làm mới dữ liệu trước khi lưu thứ tự.",
        invalid_product_order: "Thứ tự sản phẩm không hợp lệ.",
        archive_instead: "Sản phẩm cần được lưu trữ để giữ nội dung và đơn đã mua.",
      };
      throw Error(
        messages[body.error] ||
          "Không thể hoàn tất thao tác. Kiểm tra thông tin và thử lại.",
      );
    }
    return body;
  } finally {
    pendingRequests--;
    if (!pendingRequests)
      document
        .querySelectorAll('button[type="submit"],form button:not([type])')
        .forEach((button) => (button.disabled = false));
  }
}
function cell(row, value, label) {
  const td = row.insertCell();
  td.textContent = value ?? "—";
  if (label) td.dataset.label = label;
  return td;
}
function renderOrders(orders) {
  currentOrders = orders;
  paintOrders();
}
function paintOrders() {
  const filter = $("#order-status-filter").value;
  const orderState = (order) =>
    order.status === "pending" && Date.parse(order.expires_at) <= Date.now()
      ? "expired"
      : order.status;
  const orders = currentOrders.filter(
    (order) =>
      filter === "all" ||
      orderState(order) === filter ||
      (filter === "expired" && order.status === "expired_pending"),
  );
  const body = $("#orders");
  body.replaceChildren();
  for (const o of orders) {
    const tr = body.insertRow();
    const date = cell(tr, displayDate(o.created_at), "Thời gian"),
      open = document.createElement("button");
    open.type = "button";
    open.textContent = "Xem chi tiết";
    open.dataset.order = o.id;
    date.append(" ", open);
    for (const [value, label] of [
      [o.gmail, "Gmail"],
      [o.payment_code, "Mã"],
      [o.products, "Sản phẩm"],
      [money(o.total_vnd), "Tổng"],
      [statusLabels[orderState(o)] || o.status, "Trạng thái"],
    ])
      cell(tr, value, label);
  }
}
function renderPayments(payments) {
  const body = $("#payment-review");
  body.replaceChildren();
  for (const p of payments) {
    const row = body.insertRow();
    for (const [value, label] of [
      [p.external_id, "Giao dịch"],
      [p.reference, "Tham chiếu"],
      [p.payment_code, "BGZ"],
      [money(p.amount_vnd), "Số tiền"],
      [statusLabels[p.status] || p.status, "Trạng thái"],
      [p.order_id || "—", "Đơn liên quan"],
    ])
      cell(row, value, label);
    const action = cell(row, "", "Kiểm tra"),
      button = document.createElement("button");
    button.type = "button";
    button.textContent = "Chọn giao dịch";
    button.dataset.payment = p.id;
    button.dataset.order = p.order_id || "";
    action.append(button);
  }
}
async function refreshPayments(q = "") {
  renderPayments((await api("payments?q=" + encodeURIComponent(q))).payments);
}
$("#payment-review").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-payment]");
  if (!button) return;
  const form = $("#reconcile-form"),
    details = form.closest("details");
  if (details) details.open = true;
  form.elements.payment_id.value = button.dataset.payment;
  form.elements.order_id.value = button.dataset.order;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#payment-search").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await refreshPayments(e.target.elements.q.value);
    say("Đã tải giao dịch cần đối soát.");
  } catch (error) {
    say(error.message);
  }
});
$("#reconcile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    payment = f.elements.payment_id.value,
    order = f.elements.order_id.value.trim();
  if (!payment || !order) return;
  if (
    !confirm(
      "Đã đối chiếu sao kê? Thao tác này đánh dấu đơn đã trả và cấp quyền truy cập.",
    )
  )
    return;
  try {
    await api("payments/" + payment + "/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: order,
        note: f.elements.note.value,
        reviewed: f.elements.reviewed.checked,
        accept_overpayment: f.elements.accept_overpayment.checked,
        accept_code_mismatch: f.elements.accept_code_mismatch.checked,
      }),
    });
    f.reset();
    await refreshPayments($("#payment-search").elements.q.value);
    renderOrders((await api("orders")).orders);
    say("Đã đối soát, cấp quyền và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
async function showOrder(id) {
  try {
    const data = await api("orders/" + id),
      o = data.order;
    if ($("#order-detail").dataset.order !== id) {
      $("#reissue-result").hidden = true;
      $("#reissued-link").value = "";
      document.querySelectorAll("#order-detail details").forEach(d => d.open = false);
    }
    $("#order-detail").dataset.order = id;
    $("#order-detail").hidden = false;
    const summary = $("#order-summary");
    summary.replaceChildren();
    for (const [label, value] of [
      ["Khách hàng", o.gmail],
      ["Mã thanh toán", o.payment_code],
      ["Tổng tiền", money(o.total_vnd)],
      ["Trạng thái", statusLabels[o.status] || o.status],
      ["Tạo đơn (giờ Việt Nam)", displayDate(o.created_at)],
      ["Hạn thanh toán", displayDate(o.expires_at)],
      ["Đã thanh toán lúc", displayDate(o.paid_at)],
      ["Thiết bị", o.device_bound ? "Đã gắn" : "Chưa gắn"],
      ["ID đơn", o.id],
    ]) {
      const item = document.createElement("div"),
        title = document.createElement("span"),
        content = document.createElement("strong");
      title.textContent = label;
      content.textContent = value;
      item.append(title, content);
      summary.append(item);
    }
    const items = $("#order-items");
    items.replaceChildren();
    for (const i of data.items) {
      const row = items.insertRow();
      for (const [value, label] of [
        [i.title, "Sản phẩm"],
        [money(i.price_vnd), "Giá lúc mua"],
        [i.version_id, "Phiên bản"],
        [
          statusLabels[i.entitlement_status] || i.entitlement_status || "—",
          "Quyền",
        ],
        [displayDate(i.started_at), "Bắt đầu"],
        [displayDate(i.expires_at), "Hết hạn"],
      ])
        cell(row, value, label);
      if (i.entitlement_id) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Hỗ trợ quyền";
        button.dataset.entitlement = i.entitlement_id;
        row.cells[3].append(" ", button);
      }
    }
    $("#entitlement-tools").hidden = true;
    const payments = $("#order-payments");
    payments.replaceChildren();
    for (const p of data.payments) {
      const row = payments.insertRow();
      for (const [value, label] of [
        [displayDate(p.transaction_at), "Thời gian"],
        [p.external_id, "Mã SePay"],
        [p.reference, "Tham chiếu"],
        [money(p.amount_vnd), "Số tiền"],
        [statusLabels[p.status] || p.status, "Trạng thái"],
      ])
        cell(row, value, label);
    }
    $("#order-notes").textContent =
      data.notes
        .map((n) => `${displayDate(n.created_at)} · ${n.actor}: ${n.note}`)
        .join("\n") || "Chưa có ghi chú.";
    const refunds = $("#order-refunds");
    refunds.replaceChildren();
    if (!data.refunds.length)
      refunds.textContent = "Chưa có bản ghi hoàn tiền.";
    for (const r of data.refunds) {
      const line = document.createElement("p");
      line.textContent = `${displayDate(r.recorded_at)} · ${r.status} · ${money(r.amount_vnd)} · ${r.note} `;
      if (r.status === "requested") {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Chọn để xác nhận";
        button.dataset.refund = r.id;
        line.append(button);
      }
      refunds.append(line);
    }
    $("#order-detail").scrollIntoView({ behavior: "smooth", block: "start" });
    say("Đã tải chi tiết đơn.");
  } catch (error) {
    say(error.message);
  }
}
$("#orders").addEventListener("click", (e) => {
  const id = e.target.closest("button[data-order]")?.dataset.order;
  if (id) showOrder(id);
});
$("#order-items").addEventListener("click", (e) => {
  const id = e.target.closest("button[data-entitlement]")?.dataset.entitlement;
  if (!id) return;
  const form = $("#entitlement-form");
  form.elements.entitlement_id.value = id;
  $("#entitlement-tools").hidden = false;
  $("#entitlement-tools").closest("details")?.setAttribute("open", "");
  $("#entitlement-tools").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});
$("#entitlement-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    id = f.elements.entitlement_id.value,
    action = f.elements.action.value,
    order = $("#order-detail").dataset.order;
  if (!id || !order) return;
  const body = { action, note: f.elements.note.value };
  if (action === "extend_activation" || action === "reopen")
    body.days = Number(f.elements.days.value);
  if (action === "extend_active")
    body.seconds = Number(f.elements.seconds.value);
  if (action === "revoke" && !confirm("Thu hồi quyền truy cập này ngay?"))
    return;
  try {
    await api("entitlements/" + id + "/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    f.reset();
    await showOrder(order);
    say("Đã cập nhật quyền và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
$("#support-note-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#order-detail").dataset.order,
    note = e.target.elements.note.value;
  if (!id) return;
  try {
    await api("orders/" + id + "/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    e.target.reset();
    await showOrder(id);
    say("Đã lưu ghi chú và nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
$("#reissue-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#order-detail").dataset.order,
    f = e.target;
  if (!id) return;
  if (
    !confirm(
      "Liên kết và phiên đăng nhập cũ sẽ hết hiệu lực ngay. Bạn đã xác minh khách hàng?",
    )
  )
    return;
  try {
    const result = await api("orders/" + id + "/reissue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: f.elements.note.value,
        reset_device: f.elements.reset_device.checked,
        customer_verified: f.elements.verified.checked,
      }),
    });
    $("#reissued-link").value = result.access_url;
    $("#reissue-result").hidden = false;
    f.reset();
    say(
      "Đã cấp liên kết mới. Sao chép ngay; liên kết này không được lưu dạng thô.",
    );
  } catch (error) {
    say(error.message);
  }
});
$("#copy-reissued").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#reissued-link").value);
    say("Đã sao chép liên kết mới.");
  } catch {
    say("Không sao chép được; hãy chọn và sao chép liên kết thủ công.");
  }
});
$("#order-refunds").addEventListener("click", (e) => {
  const id = e.target.closest("button[data-refund]")?.dataset.refund;
  if (!id) return;
  const form = $("#refund-complete-form");
  form.elements.refund_id.value = id;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#refund-request-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#order-detail").dataset.order,
    f = e.target;
  if (!id) return;
  try {
    await api("orders/" + id + "/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_vnd: Number(f.elements.amount_vnd.value),
        note: f.elements.note.value,
      }),
    });
    f.reset();
    await showOrder(id);
    say("Đã ghi nhận yêu cầu hoàn tiền; chưa chuyển tiền.");
  } catch (error) {
    say(error.message);
  }
});
$("#refund-complete-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#order-detail").dataset.order,
    f = e.target,
    refund = f.elements.refund_id.value;
  if (!id || !refund) return;
  if (
    !confirm(
      "Xác nhận tiền đã được chuyển ngoài hệ thống? Thao tác chỉ ghi sổ, không thực hiện chuyển khoản.",
    )
  )
    return;
  try {
    await api("orders/" + id + "/refunds/" + refund + "/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: f.elements.note.value,
        manual_transfer_confirmed: f.elements.manual_transfer_confirmed.checked,
        revoke_entitlements: f.elements.revoke_entitlements.checked,
      }),
    });
    f.reset();
    await showOrder(id);
    say("Đã ghi nhận hoàn tiền thủ công và nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
async function showProduct() {
  paintProductCards();
  const p = products.find((x) => x.id === $("#product-list").value);
  selectedProductId = p?.id || "";
  $("#versions").replaceChildren();
  if (!p) {
    $("#product-form").hidden = true;
    $(".product-tools").hidden = true;
    $("#preview-version").hidden = true;
    $("#product-selection-status").textContent =
      "Chưa có sản phẩm. Hãy tạo bản nháp mới.";
    $("#versions").replaceChildren();
    return;
  }
  $("#product-form").hidden = false;
  $(".product-tools").hidden = false;
  $("#preview-version").hidden = false;
  productDirty = false;
  const f = $("#product-form");
  for (const key of [
    "title",
    "slug",
    "description",
    "category",
    "price_vnd",
    "duration_seconds",
    "activation_days",
  ])
    f.elements[key].value = p[key] ?? "";
  f.elements.duration_minutes.value = p.duration_seconds / 60;
  f.elements.active.checked = !!p.active;
  f.elements.archived.checked = !!p.archived;
  const state = p.archived ? "Đã lưu trữ" : p.active ? "Đang bán" : "Bản nháp";
  $("#product-selection-status").textContent =
    `${state} · ${money(p.price_vnd)} · ${p.category || "Chưa có danh mục"}`;
  try {
    const data = await api("products/" + p.id + "/versions");
    if ($("#product-list").value !== p.id) return;
    const select = $("#versions");
    select.replaceChildren();
    for (const v of data.versions) {
      const option = document.createElement("option");
      option.value = v.id;
      option.textContent = `${displayDate(v.created_at)} · ${v.sha256.slice(0, 12)} · ${Math.ceil(v.bytes / 1024)} KB${v.id === data.current_version_id ? " (hiện tại)" : ""}`;
      select.append(option);
    }
    select.value = data.current_version_id;
  } catch (error) {
    say(error.message);
  }
}
async function refreshProducts() {
  const list = await api("products");
  products = list.products;
  orderSnapshot = list.snapshot;
  savedOrder = products.filter(p => !p.archived).map(p => p.id);
  draftOrder = [...savedOrder];
  const select = $("#product-list");
  select.replaceChildren();
  for (const p of products) {
    const option = document.createElement("option");
    option.value = p.id; option.textContent = p.title; select.append(option);
  }
  if (products.some(p => p.id === selectedProductId)) select.value = selectedProductId;
  await showProduct();
}
async function load() {
  const [orders, payments, settings] = await Promise.all([api("orders"),api("payments"),api("settings")]);
  renderOrders(orders.orders); renderPayments(payments.payments);
  $("#settings-form").elements.activation_days.value = settings.activation_days;
  await refreshProducts(); say("Đã tải dữ liệu.");
}
$("#product-list").addEventListener("change", () => {
  if (
    productDirty &&
    !confirm("Bạn có thay đổi chưa lưu. Chuyển sang sản phẩm khác?")
  ) {
    $("#product-list").value = selectedProductId;
    return;
  }
  showProduct();
});
$("#product-form").addEventListener("input", () => (productDirty = true));
$("#settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = Number(e.target.elements.activation_days.value);
  try {
    const result = await api("settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activation_days: value }),
    });
    say(
      result.unchanged
        ? "Mặc định không thay đổi."
        : "Đã lưu hạn kích hoạt mặc định cho đơn mới và ghi nhật ký.",
    );
  } catch (error) {
    say(error.message);
  }
});
$("#create-product").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSavedOrder()) return;
  const f = e.target;
  try {
    const result = await api("products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.elements.title.value.trim(),
        slug: f.elements.slug.value.trim(),
        description: f.elements.description.value.trim(),
        price_vnd: Number(f.elements.price_vnd.value),
      }),
    });
    const p = result.product;
    products.push(p);
    selectedProductId = p.id;
    for (const target of [$("#product-list")]) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.title;
      target.append(option);
    }
    $("#product-list").value = p.id;
    await refreshProducts();
    f.reset();
    $("#create-product-panel").open = false;
    showView("products-section");
    say("Đã tạo bản nháp (chưa mở bán) và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSavedOrder()) return;
  const p = products.find((x) => x.id === $("#product-list").value),
    file = e.target.elements.package.files[0];
  if (!p || !file) return;
  if (file.size > 6e6) {
    say("Gói tải lên quá lớn.");
    return;
  }
  if (
    !confirm(
      `Tải phiên bản HTML mới cho ${p.title}? Đơn mua mới sẽ dùng phiên bản này.`,
    )
  )
    return;
  try {
    const result = await api("products/" + p.id + "/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await file.text(),
    });
    p.current_version_id = result.version_id;
    await refreshProducts();
    e.target.reset();
    say(
      result.unchanged
        ? "Phiên bản này đã có."
        : "Đã lưu riêng tư phiên bản mới và ghi nhật ký.",
    );
  } catch (error) {
    say(error.message);
  }
});
$("#thumbnail-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSavedOrder()) return;
  const p = products.find((x) => x.id === $("#product-list").value),
    file = e.target.elements.image.files[0];
  if (!p || !file) return;
  if (file.size > 1048576 || file.type !== "image/webp") {
    say("Cần ảnh WebP tối đa 1 MiB.");
    return;
  }
  try {
    const result = await api("products/" + p.id + "/thumbnail", {
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
      body: file,
    });
    p.thumbnail = result.thumbnail;
    await refreshProducts();
    e.target.reset();
    say(
      result.unchanged
        ? "Ảnh này đã được chọn."
        : "Đã thay ảnh và ghi nhật ký.",
    );
  } catch (error) {
    say(error.message);
  }
});
$("#versions-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSavedOrder()) return;
  const p = products.find((x) => x.id === $("#product-list").value),
    version = $("#versions").value;
  if (!p || !version) return;
  if (
    !confirm(
      "Khôi phục HTML đã chọn cho các đơn mua mới? Các đơn cũ giữ nguyên phiên bản.",
    )
  )
    return;
  try {
    const result = await api("products/" + p.id + "/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: version }),
    });
    p.current_version_id = result.current_version_id;
    await refreshProducts();
    say(
      result.unchanged
        ? "Đây đã là phiên bản hiện tại."
        : "Đã khôi phục phiên bản và ghi nhật ký.",
    );
  } catch (error) {
    say(error.message);
  }
});
$("#preview-version").addEventListener("click", () => {
  const product = $("#product-list").value,
    version = $("#versions").value;
  if (!product || !version) {
    say("Chọn phiên bản HTML trước khi xem thử.");
    return;
  }
  $("#preview-frame").src =
    "/admin/api/products/" +
    encodeURIComponent(product) +
    "/versions/" +
    encodeURIComponent(version) +
    "/preview";
  $("#preview-dialog").showModal();
});
$("#close-preview").addEventListener("click", () =>
  $("#preview-dialog").close(),
);
$("#preview-dialog").addEventListener("close", () => {
  $("#preview-frame").removeAttribute("src");
});
$("#search").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    renderOrders(
      (
        await api(
          "orders?q=" + encodeURIComponent(new FormData(e.target).get("q")),
        )
      ).orders,
    );
    say("Đã cập nhật danh sách đơn.");
  } catch (error) {
    say(error.message);
  }
});
$("#product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSavedOrder()) return;
  const f = e.target,
    p = products.find((x) => x.id === $("#product-list").value);
  if (!p) return;
  const input = {};
  for (const key of ["title", "slug", "description", "category"])
    input[key] = f.elements[key].value.trim();
  for (const key of ["price_vnd", "duration_seconds"])
    input[key] = Number(f.elements[key].value);
  input.duration_seconds = Math.round(
    Number(f.elements.duration_minutes.value) * 60,
  );
  input.activation_days = f.elements.activation_days.value
    ? Number(f.elements.activation_days.value)
    : null;
  for (const key of ["active", "archived"])
    input[key] = Number(f.elements[key].checked);
  try {
    const result = await api("products/" + p.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    Object.assign(p, result.product);
    $("#product-list").selectedOptions[0].textContent = p.title;
    await refreshProducts();
    say("Đã lưu sản phẩm và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
function showView(id, focus = false) {
  const panels = [...document.querySelectorAll("[data-admin-panel]")];
  if (!panels.some((panel) => panel.id === id)) id = "orders-section";
  for (const panel of panels) panel.hidden = panel.id !== id;
  document.body.dataset.adminView = id;
  document.querySelectorAll(".admin-nav a").forEach((link) => {
    const active = link.hash === "#" + id;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const labels = {
    "orders-section": ["Đơn hàng", "Tra cứu đơn và hỗ trợ khách hàng."],
    "products-section": [
      "Sản phẩm",
      "Chọn sản phẩm để chỉnh sửa, hoặc thêm bản nháp mới.",
    ],
  };
  $("#workspace-title").textContent = labels[id][0];
  $("#workspace-description").textContent = labels[id][1];
  if (focus) $("#workspace-title").focus({ preventScroll: true });
}
function moveProduct(id, position, focusAction = "position") {
  if (orderSaving) return;
  if (productDirty) { say("Hãy lưu thông tin sản phẩm trước khi đổi thứ tự."); paintProductCards(); return; }
  const index = draftOrder.indexOf(id);
  if (index < 0 || !Number.isInteger(position) || position < 1 || position > draftOrder.length) {
    say(`Nhập vị trí từ 1 đến ${draftOrder.length}.`);
    paintProductCards();
    return;
  }
  draftOrder.splice(index, 1);
  draftOrder.splice(position - 1, 0, id);
  paintProductCards();
  $(`[data-product-id="${CSS.escape(id)}"] [data-action="${focusAction}"]`)?.focus();
}
async function removeOrRestoreProduct(product, restore = false) {
  if (!requireSavedOrder()) return;
  if (productDirty && !confirm("Thao tác này sẽ bỏ chỉnh sửa chưa lưu. Tiếp tục?")) return;
  const deleting = !restore && product.can_delete;
  const text = restore ? `Khôi phục “${product.title}” thành bản nháp?` : deleting
    ? `Xóa vĩnh viễn bản nháp trống “${product.title}”?`
    : `Lưu trữ và ngừng bán “${product.title}”? Khách đã mua vẫn truy cập được.`;
  if (!confirm(text)) return;
  try {
    await api("products/" + product.id, deleting ? {method:"DELETE"} : {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({archived:restore ? 0 : 1,active:0})
    });
    await refreshProducts();
    say(restore ? "Đã khôi phục bản nháp." : deleting ? "Đã xóa bản nháp trống và ghi nhật ký." : "Đã lưu trữ sản phẩm và ghi nhật ký.");
  } catch (error) { say(error.message); }
}
function paintProductCards() {
  const root = $("#admin-product-rows");
  const query = $("#admin-product-search").value.trim().toLocaleLowerCase("vi");
  const filter = $("#admin-product-filter").value;
  root.replaceChildren();
  const ordered = [...draftOrder.map(id => products.find(p => p.id === id)),...products.filter(p => p.archived)];
  const visible = ordered.filter(p => (p.title+" "+(p.category||"")).toLocaleLowerCase("vi").includes(query) &&
    (filter === "all" || (filter === "archived" && p.archived) || (filter === "active" && p.active && !p.archived) || (filter === "draft" && !p.active && !p.archived)));
  if (!visible.length) { const row=root.insertRow();const td=cell(row,"Không có sản phẩm phù hợp.");td.colSpan=6; }
  for (const p of visible) {
    const row=root.insertRow(); row.dataset.productId=p.id;
    row.classList.toggle("is-selected",p.id === $("#product-list").value);
    const media=cell(row,"","Ảnh");
    if(p.thumbnail) { const img=document.createElement("img");img.src=p.thumbnail;img.alt="";img.loading="lazy";img.width=72;img.height=45;media.append(img); }
    else media.textContent="Chưa có ảnh";
    cell(row,p.title,"Sản phẩm");cell(row,money(p.price_vnd),"Giá");
    cell(row,p.archived ? "Lưu trữ" : p.active ? "Đang bán" : "Bản nháp","Trạng thái");
    const position=cell(row,"","Vị trí"),actions=cell(row,"","Thao tác");
    const button=(parent,label,action,run,disabled=false)=>{
      const b=document.createElement("button");b.type="button";b.textContent=label;b.dataset.action=action;
      b.className="secondary-button";b.setAttribute("aria-label",`${label}: ${p.title}`);
      b.disabled=disabled||orderSaving;b.onclick=run;parent.append(b);return b;
    };
    if(!p.archived) {
      const index=draftOrder.indexOf(p.id),input=document.createElement("input");
      input.type="number";input.min="1";input.max=String(draftOrder.length);input.step="1";input.value=String(index+1);
      input.dataset.action="position";input.setAttribute("aria-label",`Vị trí: ${p.title}`);input.disabled=orderSaving;
      input.onchange=()=>moveProduct(p.id,Number(input.value));position.append(input);
      button(position,"Lên","up",()=>moveProduct(p.id,index,"up"),index===0);
      button(position,"Xuống","down",()=>moveProduct(p.id,index+2,"down"),index===draftOrder.length-1);
    } else position.textContent="—";
    button(actions,"Sửa","edit",()=>{
      if(productDirty && !confirm("Bạn có thay đổi chưa lưu. Chuyển sang sản phẩm khác?"))return;
      $("#product-list").value=p.id;showProduct();$(".product-picker").scrollIntoView({block:"start"});
    });
    if(p.archived)button(actions,"Khôi phục","restore",()=>removeOrRestoreProduct(p,true));
    if(!p.archived || p.can_delete)button(actions,"Xóa","delete",()=>removeOrRestoreProduct(p));
  }
  $("#save-order").disabled=!orderDirty()||orderSaving;
  $("#cancel-order").disabled=!orderDirty()||orderSaving;
  for (const field of $("#product-form").elements) field.disabled=orderDirty()||orderSaving;
  $("#order-draft-status").textContent=orderSaving ? "Đang lưu thứ tự…" : orderDirty() ? "Thứ tự chưa lưu. Vị trí tính trên toàn bộ sản phẩm chưa lưu trữ." : "Thứ tự đã lưu. Vị trí tính trên toàn bộ sản phẩm chưa lưu trữ.";
}
$("#cancel-order").addEventListener("click",()=>{draftOrder=[...savedOrder];paintProductCards();});
$("#save-order").addEventListener("click",async()=>{
  if(!orderDirty()||orderSaving)return;
  if(productDirty){say("Hãy lưu thông tin sản phẩm trước khi lưu thứ tự.");return;}
  orderSaving=true;paintProductCards();
  try {
    await api("products/reorder",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:draftOrder,snapshot:orderSnapshot})});
    await refreshProducts();say("Đã lưu thứ tự sản phẩm và ghi nhật ký.");
  } catch(error){say(error.message);}
  finally {orderSaving=false;paintProductCards();}
});
$("#admin-product-search").addEventListener("input", paintProductCards);
$("#admin-product-filter").addEventListener("change", paintProductCards);
$("#order-status-filter").addEventListener("change", paintOrders);
$("#new-product").addEventListener("click", () => {
  $("#create-product-panel").open = true;
  $("#create-product input").focus();
});
const createForm = $("#create-product");
let customSlug = false;
createForm.elements.slug.addEventListener("input", () => {
  customSlug = Boolean(createForm.elements.slug.value);
});
createForm.elements.title.addEventListener("input", () => {
  if (customSlug) return;
  createForm.elements.slug.value = createForm.elements.title.value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
    .replace(/-$/, "");
});
createForm.addEventListener("reset", () => {
  customSlug = false;
});
function syncEntitlementFields() {
  const form = $("#entitlement-form");
  const action = form.elements.action.value;
  for (const key of ["days", "seconds"]) {
    const needed =
      key === "seconds"
        ? action === "extend_active"
        : ["extend_activation", "reopen"].includes(action);
    form.elements[key].closest("label").hidden = !needed;
    form.elements[key].required = needed;
  }
}
$("#entitlement-form select[name=action]").addEventListener(
  "change",
  syncEntitlementFields,
);
$("#entitlement-form").addEventListener("reset", () =>
  queueMicrotask(syncEntitlementFields),
);
syncEntitlementFields();
$("#close-order-detail").addEventListener("click", () => {
  $("#order-detail").hidden = true;
  $("#entitlement-tools").hidden = true;
  $("#orders-title").scrollIntoView({ block: "start" });
});
$("#refresh-admin").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (
    (productDirty || orderDirty()) &&
    !confirm("Làm mới sẽ bỏ thay đổi sản phẩm chưa lưu. Tiếp tục?")
  )
    return;
  button.disabled = true;
  try {
    await load();
  } catch (error) {
    say(error.message);
  } finally {
    button.disabled = false;
  }
});
window.addEventListener("hashchange", () =>
  showView(location.hash.slice(1), true),
);
window.addEventListener("beforeunload", (event) => {
  if (productDirty || orderDirty()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
showView(location.hash.slice(1));
load().catch((error) => say(error.message));
