-- Rename legacy stripe_events table to webhook_events.
-- The table was originally created for Stripe webhook idempotency; the project
-- now uses Asaas exclusively.  Preserves all existing rows.
RENAME TABLE `stripe_events` TO `webhook_events`;
