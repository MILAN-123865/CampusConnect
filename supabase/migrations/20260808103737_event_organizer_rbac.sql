-- Create the role enum
CREATE TYPE club_role AS ENUM (
  'ADMIN',
  'MODERATOR',
  'EDITOR',
  'VIEWER'
);

-- Add role column to club_members
ALTER TABLE club_members
ADD COLUMN role club_role NOT NULL DEFAULT 'VIEWER';

-- Migrate existing admins to ADMIN role
-- Assuming role_id mapped to club_roles table where title = 'Admin'
UPDATE club_members cm
SET role = 'ADMIN'
FROM club_roles cr
WHERE cm.role_id = cr.id AND cr.title = 'Admin';

-- Drop role_id column and foreign key constraint
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS fk_club_members_role;
ALTER TABLE club_members DROP COLUMN IF EXISTS role_id;

-- Drop boolean permission columns added in 20260802000000_club_member_permissions.sql
-- to simplify the RBAC approach and rely on the enum
ALTER TABLE club_members
DROP COLUMN IF EXISTS can_edit_events,
DROP COLUMN IF EXISTS can_manage_finance,
DROP COLUMN IF EXISTS can_remove_members,
DROP COLUMN IF EXISTS can_post_news,
DROP COLUMN IF EXISTS can_manage_permissions;

-- We can also drop the dynamic club_roles table since it's now unused
DROP TABLE IF EXISTS club_roles CASCADE;

-- Create permission helpers
CREATE OR REPLACE FUNCTION public.get_club_role(target_club_id uuid)
RETURNS club_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM club_members
  WHERE club_id = target_club_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_club_role(target_club_id uuid, required_role club_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE required_role
    WHEN 'VIEWER' THEN
      get_club_role(target_club_id) IN ('VIEWER', 'EDITOR', 'MODERATOR', 'ADMIN')
    WHEN 'EDITOR' THEN
      get_club_role(target_club_id) IN ('EDITOR', 'MODERATOR', 'ADMIN')
    WHEN 'MODERATOR' THEN
      get_club_role(target_club_id) IN ('MODERATOR', 'ADMIN')
    WHEN 'ADMIN' THEN
      get_club_role(target_club_id) = 'ADMIN'
  END;
$$;

-- Protect event updates
DROP POLICY IF EXISTS "Club admins can update events." ON events;
CREATE POLICY "Club editors can update events"
ON events
FOR UPDATE
TO authenticated
USING (
  has_club_role(club_id, 'EDITOR')
)
WITH CHECK (
  has_club_role(club_id, 'EDITOR')
);

-- Protect deletion
DROP POLICY IF EXISTS "Club admins can delete events." ON events;
CREATE POLICY "Club admins can delete events"
ON events
FOR DELETE
TO authenticated
USING (
  has_club_role(club_id, 'ADMIN')
);

-- Protect event creation
DROP POLICY IF EXISTS "Club admins can insert events." ON events;
CREATE POLICY "Club editors can create events"
ON events
FOR INSERT
TO authenticated
WITH CHECK (
  has_club_role(club_id, 'EDITOR')
);

-- Prevent the last-admin lockout
CREATE OR REPLACE FUNCTION public.update_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  new_role club_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role club_role;
  target_current_role club_role;
  admin_count int;
BEGIN
  -- Verify current user is ADMIN
  current_user_role := get_club_role(target_club_id);
  IF current_user_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can change roles';
  END IF;

  -- Get target user's current role
  SELECT role INTO target_current_role
  FROM club_members
  WHERE club_id = target_club_id AND user_id = target_user_id;

  -- If target is ADMIN and new role != ADMIN
  IF target_current_role = 'ADMIN' AND new_role IS DISTINCT FROM 'ADMIN' THEN
    -- Count remaining ADMIN users
    SELECT COUNT(*) INTO admin_count
    FROM club_members
    WHERE club_id = target_club_id AND role = 'ADMIN' AND status = 'approved';

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last administrator';
    END IF;
  END IF;

  -- Update role
  UPDATE club_members
  SET role = new_role
  WHERE club_id = target_club_id AND user_id = target_user_id;
END;
$$;
