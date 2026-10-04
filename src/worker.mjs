import { HttpError,json,adminIdentity,originGuard } from './security.mjs';
import { catalog,createOrder,orderStatus,qr,pendingGeminiOrder } from './orders.mjs';
import { webhook } from './payments.mjs';
import { claim,exchange,accessList,start,playPermit,runtime,customer } from './access.mjs';
import { adminRoute } from './admin.mjs';
import { ensureGeminiSchema } from './gemini-schema.mjs';

async function route(request,env) {
 const url=new URL(request.url),path=url.pathname,method=request.method;
 const recoveryRedirect=()=>new Response(null,{status:303,headers:{Location:'/access/recovery','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 const assetShell=async(name,cache='public, max-age=0, must-revalidate')=>{
  const shell=await env.ASSETS.fetch(new Request(new URL('/'+name,url),request));
  const response=new Response(shell.body,shell);
  response.headers.set('Cache-Control',cache);
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy',"frame-ancestors 'self'");
  return response;
 };
 if(path==='/admin'||path.startsWith('/admin/')) {
  const actor=await adminIdentity(request,env);
  await ensureGeminiSchema(env.DB);
  if(!['GET','HEAD'].includes(method))originGuard(request);
  if(path.startsWith('/admin/api/'))return adminRoute(request,env,actor,path);
  if(path==='/admin'&&method==='GET'){
   const shell=await env.ASSETS.fetch(new Request(new URL('/admin',url),request));
   const response=new Response(shell.body,shell);response.headers.set('Cache-Control','private, no-store');response.headers.set('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return response;
  }
  throw new HttpError(404,'not_found');
 }
 if(path==='/api/gemini/plans'||path==='/api/gemini/pending'||path==='/api/orders'||path.startsWith('/api/orders/'))await ensureGeminiSchema(env.DB);
 if(path==='/api/gemini/pending'&&method==='GET')return pendingGeminiOrder(request,env);
 if(path==='/api/gemini/plans'&&method==='GET')return json({plans:(await env.DB.prepare('SELECT id,title,category,months,price_vnd FROM gemini_plans WHERE active=1 ORDER BY months').all()).results,turnstile_site_key:env.TURNSTILE_SITE_KEY||null});
 if(path==='/api/catalog'&&method==='GET')return json({products:await catalog(env),turnstile_site_key:env.TURNSTILE_SITE_KEY||null});
 const thumbnail=path.match(/^\/api\/thumbnails\/([a-z0-9_-]{1,64})\/([a-f0-9]{64})\.webp$/);
 if(thumbnail&&method==='GET'){
  const publicPath=path,p=await env.DB.prepare('SELECT id FROM products WHERE id=? AND thumbnail=?').bind(thumbnail[1],publicPath).first();
  if(!p)throw new HttpError(404,'not_found');
  const object=await env.SIMULATIONS.get(`thumbnails/${p.id}/${thumbnail[2]}.webp`);
  if(!object)throw new HttpError(404,'not_found');
  return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/api/orders'&&method==='POST')return createOrder(request,env);
 const claimRoute=path.match(/^\/api\/orders\/([a-f0-9-]{36})\/claim$/);
 if(claimRoute&&method==='POST')return claim(request,env,claimRoute[1]);
 if(path==='/access/recovery'&&method==='GET'){
  const shell=await env.ASSETS.fetch(new Request(new URL('/commerce',url),request));
  const response=new Response(shell.body,shell);response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Content-Security-Policy',"frame-ancestors 'self'");return response;
 }
 const tokenRoute=path.match(/^\/access\/([A-Za-z0-9_-]{43})$/);
 if(tokenRoute&&method==='GET'){
  try{return await exchange(request,env,tokenRoute[1]);}
  catch(error){if(error instanceof HttpError&&[403,404].includes(error.status))return recoveryRedirect();throw error;}
 }
 if(method==='GET'&&/^\/access\/[^/]{1,512}$/.test(path))return recoveryRedirect();
 if(path==='/api/access'&&method==='GET')return accessList(request,env);
 const entitlement=path.match(/^\/api\/entitlements\/([a-f0-9]{32})\/(start|play)$/);
 if(entitlement&&method==='POST')return entitlement[2]==='start'?start(request,env,entitlement[1]):playPermit(request,env,entitlement[1]);
 const content=path.match(/^\/runtime\/([a-f0-9]{32})$/);
 if(content&&method==='GET')return runtime(request,env,content[1]);
 const order=path.match(/^\/api\/orders\/([a-f0-9-]{36})(\/qr)?$/);
 if(order&&method==='GET')return order[2]?qr(request,env,order[1]):orderStatus(request,env,order[1]);
 if(path==='/api/webhook/sepay'&&method==='POST')return webhook(request,env);
 if(method==='GET'&&path==='/checkout'){
  return assetShell('shop',path==='/checkout'?'private, no-store':undefined);
 }
 if(method==='GET'&&(path==='/access'||/^\/(play\/[a-f0-9]{32}|checkout\/[a-f0-9-]{36})$/.test(path))){
  if(path==='/access'||path.startsWith('/play/')){
   try{await customer(request,env);}catch(error){if(path==='/access'&&error instanceof HttpError&&error.status===401)return recoveryRedirect();throw error;}
  }
  const shell=await env.ASSETS.fetch(new Request(new URL('/commerce',url),request));
  const response=new Response(shell.body,shell);response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Content-Security-Policy',"frame-ancestors 'self'");return response;
 }
 // Reserved routes must never fall through to an asset or SPA fallback.
 if(['/admin.html','/commerce.html','/shop.html'].includes(path))throw new HttpError(404,'not_found');
 if(/^\/(api|access|play|runtime|shop|checkout)(\/|$)/.test(path))throw new HttpError(404,'not_found');
 if(!['GET','HEAD'].includes(method))throw new HttpError(405,'method_not_allowed');
 return env.ASSETS.fetch(request);
}

export default {
 async fetch(request,env) {
  try{return await route(request,env);}
  catch(error) {
   if(error instanceof HttpError)return json({error:error.code},error.status);
   const incident=crypto.randomUUID();
   // Request URLs can contain access credentials; SQL errors can contain private data.
   console.error(JSON.stringify({event:'request_failed',incident}));
   return json({error:'service_unavailable',incident},503);
  }
 }
};
