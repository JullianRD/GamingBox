CREATE VIEW v_user_app_events AS
SELECT
  id_event,
  user_id,
  event_category,
  event_type,
  severity,
  message,
  created_at
FROM app_events;

-- Lie un évenement applicatif avec un utilisateur