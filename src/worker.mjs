import { HttpError,json,adminIdentity,originGuard } from './security.mjs';
import { catalog,createOrder,orderStatus,qr } from './orders.mjs';
import { webhook } from './payments.mjs';

async function route(request,env) {
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/admin'||path.startsWith('/admin/')) {
  await adminIdentity(request,env);
  if(!['GET','HEAD'].includes(method))originGuard(request);
  throw new HttpError(503,'admin_implementation_pending');
 }
 if(path==='/api/catalog'&&method==='GET')return json({products:await catalog(env),turnstile_site_key:env.TURNSTILE_SITE_KEY||null});
 if(path==='/api/orders'&&method==='POST')return createOrder(request,env);
 const order=path.match(/^\/api\/orders\/([a-f0-9-]{36})(\/qr)?$/);
 if(order&&method==='GET')return order[2]?qr(request,env,order[1]):orderStatus(request,env,order[1]);
 if(path==='/api/webhooks/sepay'&&method==='POST')return webhook(request,env);
 // Reserved routes must never fall through to an asset or SPA fallback.
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
