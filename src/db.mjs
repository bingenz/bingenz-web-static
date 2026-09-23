export const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
export const first=(db,sql,...args)=>stmt(db,sql,...args).first();
export const run=(db,sql,...args)=>stmt(db,sql,...args).run();
export async function all(db,sql,...args){return (await stmt(db,sql,...args).all()).results;}
export function audit(db,actor,action,type,id,metadata={}){return stmt(db,'INSERT INTO admin_audit_logs VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),actor,action,type,id,new Date().toISOString(),JSON.stringify(metadata));}
