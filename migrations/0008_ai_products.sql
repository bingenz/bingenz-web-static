-- Keep the legacy Gemini storage/kind for all manually delivered AI orders.
-- Product family is snapshotted separately so old orders retain their identity.
ALTER TABLE gemini_plans ADD COLUMN product_family TEXT NOT NULL DEFAULT 'gemini' CHECK(product_family IN ('gemini','chatgpt'));
ALTER TABLE orders ADD COLUMN product_family TEXT NOT NULL DEFAULT 'gemini' CHECK(product_family IN ('gemini','chatgpt'));
INSERT INTO gemini_plans(id,title,category,months,price_vnd,product_family)
VALUES ('chatgpt-plus-1','ChatGPT Plus · Cấp tài khoản riêng · 1 tháng','account',1,390000,'chatgpt');
CREATE TRIGGER validate_ai_family BEFORE INSERT ON orders WHEN NEW.kind='gemini' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM gemini_plans WHERE id=NEW.gemini_plan_id AND product_family=NEW.product_family)
 THEN RAISE(ABORT,'inactive_product') END;
END;
