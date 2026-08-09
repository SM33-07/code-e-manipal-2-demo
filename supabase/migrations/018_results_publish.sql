-- Migration 018: Add results_published and results_publish_time to event_config

INSERT INTO public.event_config (key, value) VALUES 
('results_published', 'false'),
('results_publish_time', '')
ON CONFLICT (key) DO NOTHING;
