-- Recovered verbatim from the production D1 migration history and live
-- sqlite_master definition on 2026-09-23. This file was applied remotely on
-- 2026-09-19 but was missing from the repository. Keep it immutable so a clean
-- database reproduces the same migration sequence before later fixes run.
DROP TRIGGER match_payment;
CREATE TRIGGER match_payment AFTER INSERT ON payments WHEN NEW.status='candidate' BEGIN
 UPDATE orders SET status='paid', paid_at=NEW.received_at, paid_payment_id=NEW.id
 WHERE payment_code=NEW.payment_code AND status='pending' AND total_vnd=NEW.amount_vnd
 AND NEW.direction='in' AND NEW.bank_valid=1
 AND NEW.received_at<=expires_at;
 UPDATE payments SET
 order_id=(SELECT id FROM orders WHERE payment_code=NEW.payment_code),
 status = (CASE
 WHEN NEW.direction!='in' THEN 'outgoing'
 WHEN NEW.bank_valid!=1 THEN 'wrong_bank'
 WHEN NOT EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code) THEN 'unknown_code'
 WHEN EXISTS(SELECT 1 FROM orders WHERE paid_payment_id=NEW.id) THEN 'matched'
 WHEN EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code AND (NEW.received_at>expires_at OR status='expired')) THEN 'late'
 WHEN EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code AND status!='pending') THEN 'already_paid'
 WHEN NEW.amount_vnd<(SELECT total_vnd FROM orders WHERE payment_code=NEW.payment_code) THEN 'underpaid'
 WHEN NEW.amount_vnd>(SELECT total_vnd FROM orders WHERE payment_code=NEW.payment_code) THEN 'overpaid'
 ELSE 'review' END) WHERE id=NEW.id;
END;
