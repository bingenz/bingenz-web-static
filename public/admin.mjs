const $ = (s) => document.querySelector(s),
  money = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
let products = [];
let currentOrders = [];
let productDirty = false;
let selectedProductId = "";
let pendingRequests = 0;
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
        [p.transaction_at, "Thời gian"],
        [p.external_id, "Mã SePay"],
        [p.reference, "Tham chiếu"],
        [money(p.amount_vnd), "Số tiền"],
        [statusLabels[p.status] || p.status, "Trạng thái"],
      ])
        cell(row, value, label);
    }
    $("#order-notes").textContent =
      data.notes
        .map((n) => `${n.created_at} · ${n.actor}: ${n.note}`)
        .join("\n") || "Chưa có ghi chú.";
    const refunds = $("#order-refunds");
    refunds.replaceChildren();
    if (!data.refunds.length)
      refunds.textContent = "Chưa có bản ghi hoàn tiền.";
    for (const r of data.refunds) {
      const line = document.createElement("p");
      line.textContent = `${r.recorded_at} · ${r.status} · ${money(r.amount_vnd)} · ${r.note} `;
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
    "display_order",
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
async function load() {
  const [dashboard, list, orders, payments, settings] = await Promise.all([
    api("dashboard"),
    api("products"),
    api("orders"),
    api("payments"),
    api("settings"),
  ]);
  const metrics = [
    ["Doanh thu 24 giờ", money(dashboard.revenue.today_vnd)],
    ["Doanh thu 7 ngày", money(dashboard.revenue.week_vnd)],
    ["Doanh thu 30 ngày", money(dashboard.revenue.month_vnd)],
    ["Đơn đã trả", dashboard.orders.paid],
    ["Chờ thanh toán", dashboard.orders.pending],
    ["Chờ đã hết hạn", dashboard.orders.expired_pending],
    ["Thanh toán cần xem", dashboard.manual_review_payments],
    ["Quyền truy cập đang chạy", dashboard.active_entitlements],
  ];
  const target = $("#metrics");
  target.replaceChildren();
  for (const [label, value] of metrics) {
    const article = document.createElement("article"),
      heading = document.createElement("span"),
      number = document.createElement("strong");
    heading.textContent = label;
    number.textContent = value;
    article.append(heading, number);
    target.append(article);
  }
  $("#best").textContent =
    dashboard.best_sellers.map((x) => `${x.title}: ${x.sold}`).join(" · ") ||
    "Chưa có giao dịch.";
  renderOrders(orders.orders);
  renderPayments(payments.payments);
  $("#settings-form").elements.activation_days.value = settings.activation_days;
  products = list.products;
  const select = $("#product-list"),
    bulk = $("#bulk-products");
  select.replaceChildren();
  bulk.replaceChildren();
  for (const p of products) {
    for (const target2 of [select, bulk]) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.title;
      target2.append(option);
    }
  }
  if (products.some((p) => p.id === selectedProductId))
    select.value = selectedProductId;
  await showProduct();
  say("Đã tải dữ liệu.");
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
    for (const target of [$("#product-list"), $("#bulk-products")]) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.title;
      target.append(option);
    }
    $("#product-list").value = p.id;
    await showProduct();
    f.reset();
    $("#create-product-panel").open = false;
    showView("products-section");
    say("Đã tạo bản nháp (chưa mở bán) và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
$("#bulk-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target,
    ids = [...$("#bulk-products").selectedOptions].map((o) => o.value),
    field = f.elements.field.value,
    raw = f.elements.value.value.trim();
  if (!ids.length || ids.length > 25) {
    say("Chọn từ 1 đến 25 sản phẩm.");
    return;
  }
  const value =
    field === "category"
      ? raw
      : field === "activation_days" && !raw
        ? null
        : Number(raw);
  if (!confirm(`Áp dụng ${field} cho ${ids.length} sản phẩm?`)) return;
  try {
    const result = await api("products/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, changes: { [field]: value } }),
    });
    for (const p of products.filter((p2) => result.updated.includes(p2.id)))
      p[field] = value;
    await showProduct();
    say(
      `Đã cập nhật ${result.updated.length}; bỏ qua ${result.skipped.length} (xung đột hoặc chưa có HTML).`,
    );
  } catch (error) {
    say(error.message);
  }
});
$("#metadata-import-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target,
    file = form.elements.metadata.files[0];
  if (!file) return;
  if (file.size > 262144) {
    say("Tệp metadata vượt quá 256 KiB.");
    return;
  }
  try {
    const rows = JSON.parse(await file.text());
    if (!Array.isArray(rows) || !rows.length || rows.length > 250)
      throw Error("Metadata phải là mảng từ 1 đến 250 sản phẩm.");
    const seen = /* @__PURE__ */ new Set();
    for (const row of rows) {
      if (
        !row ||
        Object.keys(row).some(
          (key) =>
            !["slug", "category", "description", "display_order"].includes(key),
        ) ||
        typeof row.slug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ||
        seen.has(row.slug) ||
        typeof row.category !== "string" ||
        !row.category.trim() ||
        row.category.length > 100 ||
        typeof row.description !== "string" ||
        !row.description.trim() ||
        row.description.length > 4e3 ||
        !Number.isInteger(row.display_order) ||
        Math.abs(row.display_order) > 1e5
      )
        throw Error("Tệp metadata có dòng không hợp lệ hoặc trùng slug.");
      seen.add(row.slug);
    }
    const missing = rows
      .filter((row) => !products.some((product) => product.slug === row.slug))
      .map((row) => row.slug);
    if (missing.length)
      throw Error("Không tìm thấy sản phẩm: " + missing.join(", "));
    if (
      !confirm(
        `Cập nhật nội dung cho ${rows.length} sản phẩm và ghi audit riêng?`,
      )
    )
      return;
    let completed = 0;
    for (const row of rows) {
      const product = products.find((item) => item.slug === row.slug),
        changes = {
          category: row.category.trim(),
          description: row.description.trim(),
          display_order: row.display_order,
        };
      const result = await api("products/" + product.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      Object.assign(product, result.product);
      completed++;
      say(`Đang nhập metadata ${completed}/${rows.length}…`);
    }
    await showProduct();
    form.reset();
    say(`Đã cập nhật và ghi audit cho ${completed} sản phẩm.`);
  } catch (error) {
    say(error.message);
  }
});
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
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
    await showProduct();
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
    await showProduct();
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
$("#delete-draft").addEventListener("click", async () => {
  const id = $("#product-list").value,
    p = products.find((x) => x.id === id);
  if (!p) return;
  if (
    !confirm(
      `Xóa vĩnh viễn bản nháp trống “${p.title}”? Sản phẩm có HTML hoặc đơn hàng sẽ không thể xóa.`,
    )
  )
    return;
  try {
    await api("products/" + id, { method: "DELETE" });
    products = products.filter((x) => x.id !== id);
    for (const select of [$("#product-list"), $("#bulk-products")])
      select.querySelector(`option[value="${CSS.escape(id)}"]`)?.remove();
    await showProduct();
    say("Đã xóa bản nháp trống và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
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
  const f = e.target,
    p = products.find((x) => x.id === $("#product-list").value);
  if (!p) return;
  const input = {};
  for (const key of ["title", "slug", "description", "category"])
    input[key] = f.elements[key].value.trim();
  for (const key of ["price_vnd", "duration_seconds", "display_order"])
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
    await showProduct();
    say("Đã lưu sản phẩm và ghi nhật ký.");
  } catch (error) {
    say(error.message);
  }
});
function showView(id, focus = false) {
  const panels = [...document.querySelectorAll("[data-admin-panel]")];
  if (!panels.some((panel) => panel.id === id)) id = "overview";
  for (const panel of panels) panel.hidden = panel.id !== id;
  document.body.dataset.adminView = id;
  document.querySelectorAll(".admin-nav a").forEach((link) => {
    const active = link.hash === "#" + id;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const labels = {
    overview: ["Tổng quan", "Theo dõi doanh thu và những việc cần xử lý."],
    "orders-section": ["Đơn hàng", "Tra cứu đơn và hỗ trợ khách hàng."],
    "payments-section": ["Đối soát", "Kiểm tra giao dịch trước khi cấp quyền."],
    "products-section": [
      "Sản phẩm",
      "Chọn sản phẩm để chỉnh sửa, hoặc thêm bản nháp mới.",
    ],
    "tools-section": [
      "Thiết lập",
      "Cấu hình mặc định, xuất dữ liệu và cập nhật hàng loạt.",
    ],
  };
  $("#workspace-title").textContent = labels[id][0];
  $("#workspace-description").textContent = labels[id][1];
  if (focus) $("#workspace-title").focus({ preventScroll: true });
}
function paintProductCards() {
  const root = $("#admin-product-cards"),
    query = $("#admin-product-search").value.trim().toLocaleLowerCase("vi"),
    filter = $("#admin-product-filter").value;
  root.replaceChildren();
  const visible = products.filter(
    (p) =>
      (p.title + " " + (p.category || ""))
        .toLocaleLowerCase("vi")
        .includes(query) &&
      (filter === "all" ||
        (filter === "archived" && p.archived) ||
        (filter === "active" && p.active && !p.archived) ||
        (filter === "draft" && !p.active && !p.archived)),
  );
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "Không có sản phẩm phù hợp.";
    root.append(empty);
  }
  for (const product of visible) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-product-card";
    button.classList.toggle(
      "is-selected",
      product.id === $("#product-list").value,
    );
    button.setAttribute(
      "aria-pressed",
      String(product.id === $("#product-list").value),
    );
    const title = document.createElement("strong"),
      meta = document.createElement("span");
    title.textContent = product.title;
    meta.textContent =
      money(product.price_vnd) +
      " · " +
      (product.archived ? "Lưu trữ" : product.active ? "Đang bán" : "Bản nháp");
    button.append(title, meta);
    button.onclick = () => {
      if (
        productDirty &&
        !confirm("Bạn có thay đổi chưa lưu. Chuyển sang sản phẩm khác?")
      )
        return;
      $("#product-list").value = product.id;
      showProduct();
      $(".product-picker").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    root.append(button);
  }
}
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
    productDirty &&
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
  if (productDirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
showView(location.hash.slice(1));
load().catch((error) => say(error.message));
