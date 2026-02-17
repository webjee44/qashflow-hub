
# Fix: "permission denied for table users" blocking all access

## Root Cause

The problem is a **cascading RLS permission failure** across 3 tables:

```text
organizations (SELECT)
  -> "Authenticated users can read org for valid invitation" policy
    -> checks organization_invitations table
      -> "Invited user or org admins can read invitations" policy
        -> SELECT email FROM auth.users WHERE id = auth.uid()
          -> FAILS: authenticated role cannot read auth.users
            -> 403 error propagates up
              -> ALL organizations SELECT blocked
                -> No organizations loaded
                  -> No companies loaded
                    -> Empty dropdowns
```

The `organization_invitations` SELECT policy contains a direct reference to `auth.users` to compare emails. The `authenticated` role does not have permission to query `auth.users`, which causes a `42501` error that cascades up and blocks all organization access.

## Solution

Replace the direct `auth.users` reference in the `organization_invitations` policy with a `SECURITY DEFINER` function that safely retrieves the current user's email.

### Step 1: Create a SECURITY DEFINER function to get current user email

```sql
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid();
$$;
```

This function runs with elevated privileges (SECURITY DEFINER), so it can read `auth.users` even though the `authenticated` role cannot.

### Step 2: Update the organization_invitations SELECT policy

Drop the problematic policy and recreate it using the new function:

```sql
DROP POLICY "Invited user or org admins can read invitations" 
  ON public.organization_invitations;

CREATE POLICY "Invited user or org admins can read invitations"
  ON public.organization_invitations FOR SELECT
  TO authenticated
  USING (
    is_org_admin(auth.uid(), organization_id) 
    OR (
      auth.uid() IS NOT NULL 
      AND lower(email) = lower(public.get_auth_email())
    )
  );
```

### Step 3: Force PostgREST schema cache reload

```sql
NOTIFY pgrst, 'reload schema';
```

## Why this fixes everything

- The `organization_invitations` policy no longer directly queries `auth.users`
- The `organizations` SELECT policies can now evaluate without permission errors
- Organizations load correctly, which means companies load correctly
- Both dropdowns (group and company) will reappear and work for all users

## Technical Details

- No frontend code changes needed
- No data changes needed
- Only 1 migration file with the function + policy update + cache reload
- The fix is backward-compatible with all existing policies
