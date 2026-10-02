import { HttpError, json, jsonBody, objectShape, requireValue, iso } from './security.mjs';
import { stmt } from './db.mjs';

// This snapshot includes membership and metadata changes, not only positions.
export const orderSnapshotSql = `SELECT json_group_array(json_object('id',id,'display_order',display_order,'updated_at',updated_at)) snapshot FROM (SELECT id,display_order,updated_at FROM products WHERE archived=0 ORDER BY id)`;

export async function reorderProducts(request, env, actor) {
 const input = await jsonBody(request, 262144);
 objectShape(input, ['ids', 'snapshot']);
 requireValue(Array.isArray(input.ids) && input.ids.length > 0 && input.ids.length <= 1000 &&
  input.ids.every(id => typeof id === 'string' && /^[a-z0-9_-]{1,64}$/.test(id)) &&
  new Set(input.ids).size === input.ids.length && typeof input.snapshot === 'string', 400, 'invalid_product_order');
 const current = await env.DB.prepare(orderSnapshotSql).first();
 if (current.snapshot !== input.snapshot) throw new HttpError(409, 'product_changed');
 const before = JSON.parse(current.snapshot);
 requireValue(before.length === input.ids.length && before.every(p => input.ids.includes(p.id)), 400, 'invalid_product_order');
 const now = iso(), ids = JSON.stringify(input.ids);
 // Materialize the guard before updating any row. A concurrent edit invalidates
 // the whole UPDATE, and batch keeps the order and its audit entry atomic.
 const results = await env.DB.batch([
  stmt(env.DB, `WITH guard AS MATERIALIZED (SELECT (${orderSnapshotSql})=? ok), positions AS (SELECT value id,CAST(key AS INTEGER)+1 position FROM json_each(?))
   UPDATE products SET display_order=(SELECT position FROM positions WHERE positions.id=products.id),updated_at=?
   WHERE archived=0 AND (SELECT ok FROM guard) RETURNING id`, input.snapshot, ids, now),
  stmt(env.DB, `INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata)
   SELECT ?,?,'product.reorder','catalog','products',?,? WHERE changes()=?`, crypto.randomUUID(), actor, now, JSON.stringify({before, ids:input.ids}), input.ids.length)
 ]);
 if (results[0].results.length !== input.ids.length) throw new HttpError(409, 'product_changed');
 return json({updated:input.ids});
}
