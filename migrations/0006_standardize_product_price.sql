-- Keep existing order snapshots immutable; only current and future product sales change price.
UPDATE products
SET price_vnd = 9000,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE price_vnd != 9000;
