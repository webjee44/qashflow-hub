
-- Table to track user login events and session time
CREATE TABLE public.user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid,
  event_type text NOT NULL DEFAULT 'login', -- 'login', 'heartbeat', 'logout'
  session_id text, -- to group events in one session
  duration_seconds integer DEFAULT 0, -- cumulative seconds for this session
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_activity_user ON public.user_activity_logs (user_id);
CREATE INDEX idx_user_activity_org ON public.user_activity_logs (organization_id);
CREATE INDEX idx_user_activity_event ON public.user_activity_logs (event_type);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity
CREATE POLICY "Users can insert own activity"
ON public.user_activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own activity (for heartbeat updates)
CREATE POLICY "Users can update own activity"
ON public.user_activity_logs FOR UPDATE
USING (auth.uid() = user_id);

-- Superadmins can view all activity
CREATE POLICY "Superadmins can view all activity"
ON public.user_activity_logs FOR SELECT
USING (is_superadmin(auth.uid()));

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
ON public.user_activity_logs FOR SELECT
USING (auth.uid() = user_id);

-- RPC function for superadmin to get engagement stats per organization
CREATE OR REPLACE FUNCTION public.get_org_engagement_stats(_org_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  total_logins bigint,
  total_time_seconds bigint,
  last_active_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  RETURN QUERY
  SELECT 
    om.user_id,
    au.email::text,
    p.full_name,
    COUNT(DISTINCT CASE WHEN ual.event_type = 'login' THEN ual.id END) as total_logins,
    COALESCE(SUM(CASE WHEN ual.event_type = 'heartbeat' THEN ual.duration_seconds ELSE 0 END), 0)::bigint as total_time_seconds,
    MAX(ual.created_at) as last_active_at
  FROM organization_members om
  JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN profiles p ON p.id = om.user_id
  LEFT JOIN user_activity_logs ual ON ual.user_id = om.user_id
  WHERE om.organization_id = _org_id
  GROUP BY om.user_id, au.email, p.full_name
  ORDER BY total_time_seconds DESC;
END;
$$;
