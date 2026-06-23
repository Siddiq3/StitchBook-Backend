-- Web-managed subscription billing hardening.
-- Keeps mobile entitlement-only and makes Razorpay verification idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_shop_id_unique
  ON subscriptions (shop_id)
  WHERE shop_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment_id_unique
  ON subscriptions (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id_unique
  ON subscriptions (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
