import { HttpError,json,adminIdentity,originGuard } from './security.mjs';
import { catalog,createOrder,orderStatus,qr } from './orders.mjs';
import { webhook } from './payments.mjs';
import { claim,exchange,accessList,start,playPermit,runtime,customer } from './access.mjs';
import { adminRoute } from './admin.mjs';

async function route(request,env) {
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/admin'||path.startsWith('/admin/')) {
  const actor=await adminIdentity(request,env);
  if(!['GET','HEAD'].includes(method))originGuard(request);
  if(path.startsWith('/admin/api/'))return adminRoute(request,env,actor,path);
  if(path==='/admin'&&method==='GET'){
   const shell=await env.ASSETS.fetch(new Request(new URL('/admin.html',url),request));
   const response=new Response(shell.body,shell);response.headers.set('Cache-Control','private, no-store');response.headers.set('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return response;
  }
  throw new HttpError(404,'not_found');
 }
 if(path==='/api/catalog'&&method==='GET')return json({products:await catalog(env),turnstile_site_key:env.TURNSTILE_SITE_KEY||null});
 if(path==='/api/orders'&&method==='POST')return createOrder(request,env);
 const claimRoute=path.match(/^\/api\/orders\/([a-f0-9-]{36})\/claim$/);
 if(claimRoute&&method==='POST')return claim(request,env,claimRoute[1]);
 const tokenRoute=path.match(/^\/access\/([A-Za-z0-9_-]{43})$/);
 if(tokenRoute&&method==='GET')return exchange(request,env,tokenRoute[1]);
 if(path==='/api/access'&&method==='GET')return accessList(request,env);
 const entitlement=path.match(/^\/api\/entitlements\/([a-f0-9]{32})\/(start|play)$/);
 if(entitlement&&method==='POST')return entitlement[2]==='start'?start(request,env,entitlement[1]):playPermit(request,env,entitlement[1]);
 const content=path.match(/^\/runtime\/([a-f0-9]{32})$/);
 if(content&&method==='GET')return runtime(request,env,content[1]);
 const order=path.match(/^\/api\/orders\/([a-f0-9-]{36})(\/qr)?$/);
 if(order&&method==='GET')return order[2]?qr(request,env,order[1]):orderStatus(request,env,order[1]);
 if(path==='/api/webhook/sepay'&&method==='POST')return webhook(request,env);
 if(method==='GET'&&(path==='/access'||/^\/(play\/[a-f0-9]{32}|checkout\/[a-f0-9-]{36})$/.test(path))){
  if(path==='/access'||path.startsWith('/play/'))await customer(request,env);
  const shell=await env.ASSETS.fetch(new Request(new URL('/commerce.html',url),request));
  const response=new Response(shell.body,shell);response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Content-Security-Policy',"frame-ancestors 'self'");return response;
 }
 // Reserved routes must never fall through to an asset or SPA fallback.
 if(path==='/admin.html')throw new HttpError(404,'not_found');
 if(/^\/(api|access|play|runtime)(\/|$)/.test(path))throw new HttpError(404,'not_found');
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
