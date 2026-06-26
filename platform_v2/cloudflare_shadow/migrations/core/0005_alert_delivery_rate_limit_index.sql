CREATE INDEX IF NOT EXISTS idx_alert_deliveries_rate_limit
  ON alert_deliveries(recipient_id, delivery_status, delivered_at);
