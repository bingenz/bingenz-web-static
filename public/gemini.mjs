const $ = (s, root = document) => root.querySelector(s);
const money = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const plans = new Map([
 ['account-1', {id:'account-1', months:1, price_vnd:79000, title:'Gemini Pro · Cấp tài khoản · 1 tháng'}],
 ['account-3', {id:'account-3', months:3, price_vnd:219000, title:'Gemini Pro · Cấp tài khoản · 3 tháng'}],
 ['account-6', {id:'account-6', months:6, price_vnd:399000, title:'Gemini Pro · Cấp tài khoản · 6 tháng'}],
 ['personal-12', {id:'personal-12', months:12, price_vnd:995000, title:'Gemini Pro · Nâng chính chủ · 12 tháng'}],
 ['personal-18', {id:'personal-18', months:18, price_vnd:1299000, title:'Gemini Pro · Nâng chính chủ · 18 tháng'}]
]);
const dialog = $('#gemini-dialog'), content = $('#gemini-dialog-content');
const errors = {
 gmail_required:'Vui lòng nhập địa chỉ @gmail.com hợp lệ.',
 turnstile_failed:'Xác minh đã hết hạn. Vui lòng xác minh lại.',
 turnstile_required:'Vui lòng hoàn tất xác minh.',
 checkout_rate_limit:'Bạn đã thử nhiều lần. Vui lòng thử lại sau 10 phút hoặc liên hệ Zalo.',
 pending_limit:'Bạn có nhiều đơn chờ thanh toán. Vui lòng xem lại đơn hoặc liên hệ Zalo.',
 product_unavailable:'Gói này tạm chưa có sẵn. Vui lòng liên hệ Zalo.',
 catalog_changed:'Thông tin gói đã thay đổi. Vui lòng đóng và chọn lại.',
 payment_configuration_required:'Thanh toán tạm chưa sẵn sàng. Vui lòng liên hệ Zalo.',
 configuration_required:'Thanh toán tạm chưa sẵn sàng. Vui lòng liên hệ Zalo.',
 order_unavailable:'Không mở được đơn trên trình duyệt này. Vui lòng liên hệ Zalo nếu bạn đã chuyển khoản.',
 order_expired:'QR đã hết hạn. Không chuyển khoản vào mã này.',
 service_unavailable:'Chưa kết nối được hệ thống. Vui lòng thử lại hoặc liên hệ Zalo.'
};
let generation = 0, pollTimer, clockTimer, widget, trigger;
let lastOrder;
try { lastOrder = localStorage.getItem('bgz-gemini-order'); } catch {}
const validId = id => /^[a-f0-9-]{36}$/.test(id || '');
$('#gemini-resume').hidden = !validId(lastOrder);
async function api(path, body) {
 const response = await fetch(path, {method:body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000), ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})});
 const data = await response.json();
 if (!response.ok) throw new Error(errors[data.error] || 'Không thể xử lý yêu cầu. Vui lòng thử lại hoặc liên hệ Zalo.');
 return data;
}
function notice(text) { $('#gemini-dialog-notice').textContent = text; }
function clearWork() {
 clearTimeout(pollTimer); clearInterval(clockTimer);
 if (widget !== undefined && window.turnstile) window.turnstile.remove(widget);
 widget = undefined;
}
function openDialog(opener) {
 clearWork(); ++generation; trigger = opener; notice(''); content.replaceChildren();
 $('#gemini-dialog-title').textContent = 'Thanh toán';
 if (!dialog.open) dialog.showModal();
 return generation;
}
$('#gemini-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { ++generation; clearWork(); trigger?.focus(); });
dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close(); } });
async function copy(value, button) {
 try {
  if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
  else {
   const input=document.createElement('textarea'); input.value=value; input.style.position='fixed'; input.style.opacity='0';
   (dialog.open?dialog:document.body).append(input); input.select(); const ok=document.execCommand('copy'); input.remove(); if(!ok)throw new Error('copy');
  }
  const old=button.textContent;button.textContent='Đã sao chép';setTimeout(()=>{if(button.isConnected)button.textContent=old;},1800);
 } catch { (dialog.open ? $('#gemini-dialog-notice') : $('#gemini-notice')).textContent='Không thể sao chép tự động. Bạn có thể chọn và sao chép: '+value; }
}
document.addEventListener('click', e => { const button=e.target.closest('[data-gemini-copy]'); if(button)copy(button.dataset.geminiCopy,button); });
for (const card of document.querySelectorAll('[data-gemini-category]')) {
 card.addEventListener('change', () => {
  const plan=plans.get($('input:checked',card).value);
  $('[data-gemini-price]',card).textContent=money(plan.price_vnd);
  $('[data-gemini-term]',card).textContent='/ '+plan.months+' tháng';
  $('[data-gemini-monthly]',card).textContent=(plan.price_vnd%plan.months?'≈ ':'')+money(Math.round(plan.price_vnd/plan.months))+' / tháng';
 });
 $('[data-gemini-buy]',card).addEventListener('click',e=>checkout($('input:checked',card).value,e.currentTarget));
}
let turnstileLoading;
function loadTurnstile() {
 if(window.turnstile)return Promise.resolve();
 if(turnstileLoading)return turnstileLoading;
 turnstileLoading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  window.bgzGeminiTurnstileReady=()=>{clearTimeout(timeout);resolve();};
  const timeout=setTimeout(()=>{script.remove();reject(new Error('Không tải được xác minh. Vui lòng đóng hộp thanh toán và thử lại.'));},15000);
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=bgzGeminiTurnstileReady&render=explicit';script.async=true;
  script.onerror=()=>{clearTimeout(timeout);script.remove();reject(new Error('Không tải được xác minh. Vui lòng kiểm tra kết nối và thử lại.'));};
  document.head.append(script);
 }).catch(error=>{turnstileLoading=undefined;throw error;});
 return turnstileLoading;
}
async function checkout(planId, opener) {
 const run=openDialog(opener);content.textContent='Đang chuẩn bị thanh toán…';
 try {
  const data=await api('/api/gemini/plans');if(run!==generation)return;
  const plan=data.plans.find(p=>p.id===planId);
  if(!plan)throw new Error(errors.product_unavailable);
  if(!data.turnstile_site_key)throw new Error(errors.configuration_required);
  content.innerHTML='<div class="gemini-checkout-summary"><p id="gemini-selected-title"></p><strong id="gemini-selected-price"></strong></div><form class="gemini-form"><label for="gemini-email">Gmail liên hệ / nâng cấp</label><input id="gemini-email" name="gmail" type="email" autocomplete="email" maxlength="254" placeholder="ban@gmail.com" required><p class="gemini-help">Dùng Gmail này để tra cứu đơn. Sau thanh toán, liên hệ Zalo kèm mã đơn để nhận tài khoản hoặc được hỗ trợ nâng chính chủ. Không nhập mật khẩu tại đây.</p><div class="gemini-verification" id="gemini-verification"></div><button class="gemini-buy" type="submit" disabled>Tạo mã QR thanh toán</button></form>';
  $('#gemini-selected-title').textContent=plan.title;$('#gemini-selected-price').textContent=money(plan.price_vnd);
  const form=$('form',content),button=$('button[type=submit]',form);let token='',busy=false;
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(!token||busy)return;busy=true;button.disabled=true;button.textContent='Đang tạo đơn…';notice('');
   try {
    const order=await api('/api/orders',{gmail:$('#gemini-email').value,plan_id:plan.id,turnstile_token:token});
    // Persist non-secret order ID even if the customer closed the dialog during the request.
    if(order.claimable){lastOrder=order.id;try{localStorage.setItem('bgz-gemini-order',lastOrder);}catch{}$('#gemini-resume').hidden=false;}
    if(run!==generation)return;
    if(!order.claimable)throw new Error('Gmail này có đơn đang chờ ở trình duyệt khác. Hãy mở lại trình duyệt đã tạo đơn hoặc liên hệ Zalo.');
    clearWork();await showOrder(order.id,run);
   } catch(error) { if(run===generation){notice(error.message);token='';if(widget!==undefined)window.turnstile.reset(widget);button.textContent='Tạo mã QR thanh toán';} }
   finally{busy=false;}
  });
  await loadTurnstile();if(run!==generation)return;
  widget=window.turnstile.render($('#gemini-verification'),{sitekey:data.turnstile_site_key,action:'checkout',theme:document.documentElement.dataset.theme==='dark'?'dark':'light',size:'flexible',callback:value=>{token=value;button.disabled=busy;},'expired-callback':()=>{token='';button.disabled=true;},'error-callback':()=>{token='';button.disabled=true;notice('Xác minh gặp lỗi. Vui lòng thử lại hoặc liên hệ Zalo.');}});
 } catch(error) { if(run===generation){content.textContent='Chưa thể tạo thanh toán.';notice(error.message);} }
}
function row(label,value,copyable=false) {
 const el=document.createElement('div');el.className='gemini-payment-row';
 const block=document.createElement('div'),title=document.createElement('span'),text=document.createElement('strong');title.textContent=label;text.textContent=value;block.append(title,text);el.append(block);
 if(copyable){const button=document.createElement('button');button.className='gemini-copy';button.type='button';button.textContent='Sao chép';button.dataset.geminiCopy=value;el.append(button);}return el;
}
async function showOrder(id,run) {
 const order=await api('/api/orders/'+id);if(run!==generation)return;
 if(order.kind!=='gemini')throw new Error(errors.order_unavailable);
 content.innerHTML='<div class="gemini-checkout-summary"><p id="gemini-selected-title"></p><strong id="gemini-selected-price"></strong></div><p class="gemini-payment-state" id="gemini-payment-state" role="status"></p><div id="gemini-payment-body"></div><div class="gemini-payment-details" id="gemini-order-code"></div>';
 $('#gemini-selected-title').textContent=order.items[0].title;$('#gemini-selected-price').textContent=money(order.total_vnd);
 $('#gemini-order-code').append(row('Mã đơn / nội dung chuyển khoản',order.payment_code,true));
 let current=order,offset=Date.parse(order.server_now)-Date.now(),previous='';
 const update=()=>{
  const state=$('#gemini-payment-state');if(!state)return;
  const remaining=Math.max(0,Math.ceil((Date.parse(current.expires_at)-(Date.now()+offset))/1000));
  const status=current.status==='pending'&&!remaining?'expired':current.status;
  if(status===previous&&status!=='pending')return;
  state.classList.toggle('gemini-success',status==='paid');
  if(status==='pending')state.textContent='Chờ thanh toán · '+String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  else state.textContent=({paid:'Đã thanh toán thành công',expired:'Đã hết thời gian thanh toán',cancelled:'Đơn đã hủy',refunded:'Đơn đã hoàn tiền'})[status]||'Liên hệ Zalo để được hỗ trợ';
  if(status===previous)return;previous=status;
  const body=$('#gemini-payment-body');body.replaceChildren();
  if(status==='pending'){
   const qr=document.createElement('img');qr.className='gemini-qr';qr.alt='QR thanh toán '+current.payment_code;qr.src='/api/orders/'+id+'/qr';
   qr.addEventListener('error',()=>{qr.hidden=true;notice('Chưa tải được QR. Bạn có thể chuyển khoản theo thông tin bên dưới hoặc tải lại QR.');});body.append(qr);
   const retry=document.createElement('button');retry.type='button';retry.textContent='Tải lại QR';retry.addEventListener('click',()=>{qr.hidden=false;qr.src='/api/orders/'+id+'/qr?t='+Date.now();notice('');});
   const actions=document.createElement('div');actions.className='gemini-payment-actions';actions.append(retry);body.append(actions);
   const bank=current.payment_destination;
   body.append(row('Ngân hàng',bank.bank_code),row('Chủ tài khoản',bank.account_name),row('Số tài khoản',bank.account_number,true),row('Số tiền (VNĐ)',String(current.total_vnd),true));
   const help=document.createElement('p');help.className='gemini-help';help.textContent='Chuyển đúng số tiền và giữ nguyên nội dung. Hệ thống tự xác nhận thanh toán; sau đó bạn liên hệ Zalo để nhận tài khoản / nâng cấp.';body.append(help);
  }else{
   const help=document.createElement('p');help.className='gemini-help';
   help.textContent=status==='paid'?'Gửi mã đơn bên dưới qua Zalo để nhận tài khoản hoặc được hỗ trợ nâng chính chủ. Bảo hành toàn bộ thời gian sử dụng.':status==='expired'?'Không chuyển khoản vào QR cũ. Nếu đã thanh toán, hãy giữ mã đơn và liên hệ Zalo để kiểm tra.':'Gửi mã đơn qua Zalo để được hỗ trợ.';
   const link=document.createElement('a');link.href='https://zalo.me/0898908101';link.target='_blank';link.rel='noopener';link.className='gemini-buy gemini-zalo-link';link.textContent=status==='paid'?'Liên hệ Zalo để nhận / nâng cấp':'Liên hệ Zalo hỗ trợ';body.append(help,link);
  }
 };
 update();clockTimer=setInterval(update,1000);
 const poll=async()=>{
  if(run!==generation)return;
  try { const next=await api('/api/orders/'+id);if(run!==generation)return;current=next;offset=Date.parse(next.server_now)-Date.now();notice('');update(); }
  catch(error){if(run===generation)notice('Chưa cập nhật được trạng thái. Đừng chuyển khoản lại. '+error.message);}
  if(run===generation&&!['paid','cancelled','refunded'].includes(current.status))pollTimer=setTimeout(poll,5000);
 };
 if(!['paid','cancelled','refunded'].includes(current.status))pollTimer=setTimeout(poll,4000);
}
$('#gemini-resume').addEventListener('click',async e=>{
 const run=openDialog(e.currentTarget);content.textContent='Đang tra cứu đơn…';
 try{await showOrder(lastOrder,run);}catch(error){if(run===generation){content.textContent='Chưa thể mở đơn.';notice(error.message);}}
});
