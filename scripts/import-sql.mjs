const q=s=>"'"+String(s).replaceAll("'","''")+"'";
export function importSQL(item,now){
 const v=q(item.version),id=q(item.id);
 return [
 `INSERT INTO products(id,source_key,slug,title,thumbnail,created_at,updated_at) VALUES (${id},${q(item.source_key)},${q(item.slug)},${q(item.title)},${q(item.thumbnail)},${q(now)},${q(now)}) ON CONFLICT(source_key) DO NOTHING;`,
 `INSERT INTO product_versions(id,product_id,sha256,original_key,delivery_key,bytes,created_at) VALUES (${v},${id},${q(item.sha256)},${q(item.original_key)},${q(item.delivery_key)},${item.bytes},${q(now)}) ON CONFLICT(product_id,sha256) DO NOTHING;`,
 // A rerun of the same source preserves admin rollback; new source bytes select a new version.
 `UPDATE products SET current_version_id=${v},updated_at=${q(now)} WHERE id=${id} AND (current_version_id IS NULL OR NOT EXISTS(SELECT 1 FROM product_imports WHERE product_id=${id} AND version_id=${v}));`,
 `INSERT INTO product_imports VALUES (${id},${v},${q(now)}) ON CONFLICT(product_id) DO UPDATE SET version_id=excluded.version_id,imported_at=excluded.imported_at;`
 ].join('\n');
}
