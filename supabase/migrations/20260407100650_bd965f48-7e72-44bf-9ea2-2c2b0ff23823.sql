
-- Fix Anne's profile
UPDATE profiles SET onboarding_completed = true, onboarding_step = 99
WHERE id = '5e0b32d6-d3f4-466c-8d4e-f1b8c5116f28';

-- Accept the pending invitation
UPDATE organization_invitations SET accepted_at = now()
WHERE id = 'df8704c6-8bf9-4070-961c-bc2f5b1bdb43';

-- Add her to GROUPE TRADEFLIX org
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  oi.organization_id,
  '5e0b32d6-d3f4-466c-8d4e-f1b8c5116f28',
  oi.role,
  now()
FROM organization_invitations oi
WHERE oi.id = 'df8704c6-8bf9-4070-961c-bc2f5b1bdb43'
ON CONFLICT DO NOTHING;

-- Add her to all companies in GROUPE TRADEFLIX
INSERT INTO company_members (company_id, user_id, invited_by)
SELECT c.id, '5e0b32d6-d3f4-466c-8d4e-f1b8c5116f28', (SELECT invited_by FROM organization_invitations WHERE id = 'df8704c6-8bf9-4070-961c-bc2f5b1bdb43')
FROM companies c
WHERE c.organization_id = (SELECT organization_id FROM organization_invitations WHERE id = 'df8704c6-8bf9-4070-961c-bc2f5b1bdb43')
  AND c.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Clean up: soft-delete the orphan company created by the old trigger
UPDATE companies SET deleted_at = now()
WHERE organization_id = 'b4caf004-eab5-4b57-ad83-4e9df3218861';

-- Clean up: soft-delete the orphan organization
UPDATE organizations SET deleted_at = now()
WHERE id = 'b4caf004-eab5-4b57-ad83-4e9df3218861';
