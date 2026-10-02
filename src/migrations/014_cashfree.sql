-- Preserve historical provider references under neutral column names.
DO $$
DECLARE old_name TEXT; new_name TEXT;
BEGIN
  FOREACH old_name IN ARRAY ARRAY['razorpay_payment_id','razorpay_order_id','razorpay_subscription_id'] LOOP
    new_name := replace(old_name,'razorpay_','provider_');
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name=old_name)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name=new_name) THEN
      EXECUTE format('ALTER TABLE subscriptions RENAME COLUMN %I TO %I',old_name,new_name);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name=old_name) THEN
      EXECUTE format('UPDATE subscriptions SET %I=COALESCE(%I,%I)',new_name,new_name,old_name);
      EXECUTE format('ALTER TABLE subscriptions DROP COLUMN %I',old_name);
    END IF;
  END LOOP;
END $$;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(100), ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(100);
CREATE TABLE IF NOT EXISTS customer_payment_checkouts (
  provider_order_id TEXT PRIMARY KEY,
  session JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_payment_unique ON subscriptions(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_order_unique ON subscriptions(provider_order_id) WHERE provider_order_id IS NOT NULL;
