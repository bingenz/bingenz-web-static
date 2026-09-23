import { createRemoteJWKSet, jwtVerify } from 'jose';
const enc=new TextEncoder();
export class HttpError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
export function requireValue(ok,status=400,code='invalid_request'){if(!ok)throw new HttpError(status,code);}
export const iso=()=>new Date().toISOString();
export const addSeconds=(date,n)=>new Date(Date.parse(date)+n*1000).toISOString();
export function randomToken(){return base64(crypto.getRandomValues(new Uint8Array(32)));}
export function paymentCode(){const a='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';let s='BGZ';while(s.length<15){const b=crypto.getRandomValues(new Uint8Array(1))[0];if(b<Math.floor(256/a.length)*a.length)s+=a[b%a.length];}return s;}
export function base64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function unbase64(s){return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
export async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function key(secret){requireValue(typeof secret==='string'&&secret.length>=32,503,'configuration_required');return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(data,secret){const body=base64(enc.encode(JSON.stringify(data)));return body+'.'+base64(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(body)));}
export async function verify(token,secret,purpose){
 try{const [body,sig,extra]=String(token).split('.');if(extra||!body||!sig)return null;
 if(!await crypto.subtle.verify('HMAC',await key(secret),unbase64(sig),enc.encode(body)))return null;
 const p=JSON.parse(new TextDecoder().decode(unbase64(body)));
 return p.purpose===purpose&&Number.isFinite(p.exp)&&p.exp>Date.now()?p:null;
 }catch{return null;}
}
export async function verifyWebhook(raw,headers,secret,now=Date.now()){
 const t=headers.get('X-SePay-Timestamp')||'',sig=headers.get('X-SePay-Signature')||'';
 if(!/^\d{10}$/.test(t)||Math.abs(now/1000-Number(t))>300||!/^sha256=[a-f0-9]{64}$/i.test(sig))return false;
 const bytes=Uint8Array.from(sig.slice(7).match(/../g),x=>parseInt(x,16));
 return crypto.subtle.verify('HMAC',await key(secret),bytes,enc.encode(t+'.'+raw));
}
export function cookies(request){return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>x.trim().split(/=(.*)/s)).filter(x=>x[0]).map(([k,v])=>[k,v]));}
export function cookie(name,value,maxAge=2592000){return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;}
export function originGuard(request){requireValue(request.headers.get('Origin')===new URL(request.url).origin,403,'origin_denied');}
export async function readBody(request,max=16384){
 requireValue(Number(request.headers.get('Content-Length')||0)<=max,413,'body_too_large');
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new HttpError(413,'body_too_large');}chunks.push(value);}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
export async function jsonBody(request,max=16384){requireValue((request.headers.get('Content-Type')||'').split(';')[0]==='application/json',415,'json_required');try{return JSON.parse(await readBody(request,max));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'invalid_json');}}
export function objectShape(value,allowed){requireValue(value&&typeof value==='object'&&!Array.isArray(value));requireValue(Object.keys(value).every(k=>allowed.includes(k)));}
export function gmail(value){requireValue(typeof value==='string'&&value.length<=254);const address=value.trim().toLowerCase();requireValue(/^[a-z0-9]+(?:\.?[a-z0-9]+)*(?:\+[a-z0-9._-]+)?@gmail\.com$/.test(address),400,'gmail_required');const local=address.split('@')[0];requireValue(local.length<=64);return {address,canonical:local.split('+')[0].replaceAll('.','')};}
export async function adminIdentity(request,env){
 requireValue(env.ACCESS_TEAM_DOMAIN&&env.ACCESS_AUD,503,'admin_configuration_required');
 const issuer=`https://${env.ACCESS_TEAM_DOMAIN}`;
 requireValue(/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN),503,'admin_configuration_required');
 try{const token=request.headers.get('Cf-Access-Jwt-Assertion');requireValue(token,403,'admin_denied');
 const {payload}=await jwtVerify(token,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')),{issuer,audience:env.ACCESS_AUD,algorithms:['RS256']});
 requireValue(payload.email===env.ADMIN_EMAIL&&env.ADMIN_EMAIL==='lengocthuan09@gmail.com',403,'admin_denied');return payload.email;
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(403,'admin_denied');}
}
export function json(data,status=200,extra={}){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});}
