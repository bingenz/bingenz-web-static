CREATE TABLE product_imports (
 product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES product_versions(id),
 imported_at TEXT NOT NULL
);
