-- SePay transactionDate has second precision while order created_at has milliseconds.
-- Treat the shared second as eligible; receipt time still must be within expiry.
DROP TRIGGER match_payment;
CREATE TRIGGER match_payment AFTER INSERT ON payments WHEN NEW.status='candidate' BEGIN
 UPDATE orders SET status='paid', paid_at=NEW.received_at, paid_payment_id=NEW.id
 WHERE payment_code=NEW.payment_code AND status='pending' AND total_vnd=NEW.amount_vnd
 AND NEW.direction='in' AND NEW.bank_valid=1
 AND substr(NEW.transaction_at,1,19)>=substr(created_at,1,19)
 AND NEW.transaction_at<=expires_at AND NEW.received_at<=expires_at;
 UPDATE payments SET
 order_id=(SELECT id FROM orders WHERE payment_code=NEW.payment_code),
 status = (CASE
 WHEN NEW.direction!='in' THEN 'outgoing'
 WHEN NEW.bank_valid!=1 THEN 'wrong_bank'
 WHEN NOT EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code) THEN 'unknown_code'
 WHEN EXISTS(SELECT 1 FROM orders WHERE paid_payment_id=NEW.id) THEN 'matched'
 WHEN EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code AND (substr(NEW.transaction_at,1,19)<substr(created_at,1,19) OR NEW.transaction_at>expires_at OR NEW.received_at>expires_at OR status='expired')) THEN 'late'
 WHEN EXISTS(SELECT 1 FROM orders WHERE payment_code=NEW.payment_code AND status!='pending') THEN 'already_paid'
 WHEN NEW.amount_vnd<(SELECT total_vnd FROM orders WHERE payment_code=NEW.payment_code) THEN 'underpaid'
 WHEN NEW.amount_vnd>(SELECT total_vnd FROM orders WHERE payment_code=NEW.payment_code) THEN 'overpaid'
 ELSE 'review' END) WHERE id=NEW.id;
END;
