PRAGMA foreign_keys = ON;

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings VALUES ('activation_days','7');

CREATE TABLE products (
 id TEXT PRIMARY KEY, source_key TEXT UNIQUE, slug TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
 price_vnd INTEGER NOT NULL DEFAULT 10000 CHECK(typeof(price_vnd)='integer' AND price_vnd BETWEEN 1 AND 100000000),
 duration_seconds INTEGER NOT NULL DEFAULT 900 CHECK(duration_seconds BETWEEN 60 AND 86400),
 activation_days INTEGER CHECK(activation_days BETWEEN 1 AND 365),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 display_order INTEGER NOT NULL DEFAULT 0, thumbnail TEXT NOT NULL DEFAULT '',
 current_version_id TEXT REFERENCES product_versions(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE product_versions (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64), original_key TEXT NOT NULL UNIQUE,
 delivery_key TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=2097152),
 created_at TEXT NOT NULL, UNIQUE(product_id,sha256), UNIQUE(id,product_id)
);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, gmail TEXT NOT NULL, gmail_key TEXT NOT NULL, cart_key TEXT NOT NULL,
 cart_json TEXT NOT NULL CHECK(json_valid(cart_json)), checkout_hash TEXT NOT NULL,
 payment_code TEXT NOT NULL UNIQUE CHECK(payment_code GLOB 'BGZ*' AND payment_code NOT GLOB '*[^A-Z0-9]*' AND length(payment_code)=15),
 total_vnd INTEGER NOT NULL CHECK(typeof(total_vnd)='integer' AND total_vnd>0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','cancelled','refunded')),
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, paid_at TEXT,
 paid_payment_id TEXT UNIQUE REFERENCES payments(id),
 access_hash TEXT UNIQUE, device_hash TEXT, generation INTEGER NOT NULL DEFAULT 0,
 access_issued_at TEXT, CHECK(expires_at>created_at)
);
CREATE UNIQUE INDEX pending_order_reuse ON orders(gmail_key,cart_key) WHERE status='pending';
CREATE INDEX order_support ON orders(gmail,created_at);
CREATE INDEX order_pending ON orders(gmail_key,status,expires_at);
CREATE TABLE order_items (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
 product_id TEXT NOT NULL REFERENCES products(id), version_id TEXT NOT NULL,
 title TEXT NOT NULL, price_vnd INTEGER NOT NULL, duration_seconds INTEGER NOT NULL,
 activation_days INTEGER NOT NULL, UNIQUE(order_id,product_id),
 FOREIGN KEY(version_id,product_id) REFERENCES product_versions(id,product_id)
);
CREATE TABLE payments (
 id TEXT PRIMARY KEY, external_id TEXT NOT NULL UNIQUE, reference TEXT NOT NULL,
 payment_code TEXT, amount_vnd INTEGER NOT NULL CHECK(typeof(amount_vnd)='integer' AND amount_vnd>=0),
 transaction_at TEXT NOT NULL, received_at TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('in','out')), bank_valid INTEGER NOT NULL CHECK(bank_valid IN (0,1)),
 status TEXT NOT NULL CHECK(status IN ('candidate','matched','unknown_code','underpaid','overpaid','late','wrong_bank','outgoing','already_paid','reconciled','review')),
 order_id TEXT REFERENCES orders(id), note TEXT NOT NULL DEFAULT '',
 reconciled_at TEXT, reconciled_by TEXT
);
CREATE INDEX payment_support ON payments(reference,payment_code,received_at);
CREATE TABLE entitlements (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
 order_item_id TEXT NOT NULL UNIQUE REFERENCES order_items(id),
 status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','active','expired','activation_expired','revoked')),
 activation_deadline TEXT NOT NULL, started_at TEXT, expires_at TEXT,
 CHECK((started_at IS NULL AND expires_at IS NULL) OR (started_at IS NOT NULL AND expires_at>started_at))
);
CREATE INDEX entitlement_order ON entitlements(order_id);
CREATE TABLE webhook_events (
 id TEXT PRIMARY KEY, external_id TEXT, received_at TEXT NOT NULL, outcome TEXT NOT NULL,
 body_hash TEXT NOT NULL, error_code TEXT
);
CREATE TABLE admin_audit_logs (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, object_type TEXT NOT NULL,
 object_id TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL CHECK(json_valid(metadata))
);
CREATE TABLE support_notes (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE refunds (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
 status TEXT NOT NULL CHECK(status IN ('requested','completed')), amount_vnd INTEGER NOT NULL CHECK(amount_vnd>0),
 recorded_at TEXT NOT NULL, completed_at TEXT, actor TEXT NOT NULL, note TEXT NOT NULL
);
CREATE TABLE checkout_attempts (id TEXT PRIMARY KEY, abuse_key TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX attempts_window ON checkout_attempts(abuse_key,created_at);

-- Validate and snapshot from the same serialized SQL transaction as order insertion.
CREATE TRIGGER validate_order BEFORE INSERT ON orders BEGIN
 SELECT (CASE WHEN json_type(NEW.cart_json)!='array' OR json_array_length(NEW.cart_json)<1 OR json_array_length(NEW.cart_json)>200
 THEN RAISE(ABORT,'invalid_cart') END);
 SELECT (CASE WHEN (SELECT count(DISTINCT value) FROM json_each(NEW.cart_json))!=json_array_length(NEW.cart_json)
 THEN RAISE(ABORT,'duplicate_product') END);
 SELECT (CASE WHEN (SELECT count(*) FROM products WHERE id IN (SELECT value FROM json_each(NEW.cart_json)) AND active=1 AND archived=0 AND current_version_id IS NOT NULL)!=json_array_length(NEW.cart_json)
 THEN RAISE(ABORT,'inactive_product') END);
 SELECT (CASE WHEN NEW.total_vnd!=(SELECT sum(price_vnd) FROM products WHERE id IN (SELECT value FROM json_each(NEW.cart_json))) THEN RAISE(ABORT,'invalid_total') END);
 SELECT (CASE WHEN (SELECT count(*) FROM orders WHERE gmail_key=NEW.gmail_key AND status='pending' AND expires_at>NEW.created_at)>=3 THEN RAISE(ABORT,'pending_limit') END);
END;
CREATE TRIGGER snapshot_order AFTER INSERT ON orders BEGIN
 INSERT INTO order_items(id,order_id,product_id,version_id,title,price_vnd,duration_seconds,activation_days)
 SELECT lower(hex(randomblob(16))),NEW.id,id,current_version_id,title,price_vnd,duration_seconds,coalesce(activation_days,CAST((SELECT value FROM settings WHERE key='activation_days') AS INTEGER))
 FROM products WHERE id IN (SELECT value FROM json_each(NEW.cart_json));
END;
CREATE TRIGGER fulfill_order AFTER UPDATE OF status ON orders WHEN NEW.status='paid' AND OLD.status='pending' BEGIN
 INSERT INTO entitlements(id,order_id,order_item_id,activation_deadline)
 SELECT lower(hex(randomblob(16))),NEW.id,id,strftime('%Y-%m-%dT%H:%M:%fZ',NEW.paid_at,'+'||activation_days||' days')
 FROM order_items WHERE order_id=NEW.id;
END;
CREATE TRIGGER match_payment AFTER INSERT ON payments WHEN NEW.status='candidate' BEGIN
 UPDATE orders SET status='paid', paid_at=NEW.received_at, paid_payment_id=NEW.id
 WHERE payment_code=NEW.payment_code AND status='pending' AND total_vnd=NEW.amount_vnd
 AND NEW.direction='in' AND NEW.bank_valid=1
 AND NEW.transaction_at>=created_at AND NEW.transaction_at<=expires_at AND NEW.received_at<=expires_at;
 UPDATE payments SET
 order_id=(SELECT id FROM orders WHERE payment_code=NEW.payment_code),
 status = (CASE
 WHEN NEW.direction!='in' THEN 'outgoing'
 WHEN NEW.bank_valid!=1 THEN 'wrong_bank'
 WHEN NOT EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code) THEN 'unknown_code'
 WHEN EXISTS(SELECT 1 FROM orders WHERE paid_payment_id=NEW.id) THEN 'matched'
 WHEN EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code AND (NEW.transaction_at<created_at OR NEW.transaction_at>expires_at OR NEW.received_at>expires_at OR status='expired')) THEN 'late'
 WHEN EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code AND status!='pending') THEN 'already_paid'
 WHEN NEW.amount_vnd<(SELECT total_vnd FROM orders WHERE payment_code=NEW.payment_code) THEN 'underpaid'
 WHEN NEW.amount_vnd>(SELECT total_vnd FROM orders WHERE payment_code=NEW.payment_code) THEN 'overpaid'
 ELSE 'review' END) WHERE id=NEW.id;
END;
