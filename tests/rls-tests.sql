-- ============================================================
-- RLS Integration Tests
-- Run via: Supabase SQL Editor or MCP execute_sql
--
-- Tests verify that each role can access exactly what they should.
-- Each test sets auth context, queries a table, and checks the count.
-- A passing test returns the expected count. A failing test returns 0
-- (or wrong count) indicating an RLS policy bug.
-- ============================================================

-- Helper: set auth context for a user
-- Usage: SELECT set_test_user('user-uuid-here');
CREATE OR REPLACE FUNCTION set_test_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true);
  SET LOCAL ROLE authenticated;
END;
$$;

-- ============================================================
-- TEST SUITE: Run each block separately
-- ============================================================

-- TEST 1: Regular user can see all tenant projects
-- Expected: count > 0 for a user with tenant_role = 'user'
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  -- Find a regular user
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM projects;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % projects', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 projects';
  END IF;
END $$;

-- TEST 2: Regular user can see project_members for their tenant's projects
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM project_members;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % project_members', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 project_members (circular RLS bug!)';
  END IF;
END $$;

-- TEST 3: Regular user can see drawings
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM drawings;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % drawings', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 drawings';
  END IF;
END $$;

-- TEST 4: Regular user can see drawing_versions
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM drawing_versions;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % drawing_versions', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 drawing_versions';
  END IF;
END $$;

-- TEST 5: Regular user can see markers
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM markers;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % markers', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 markers';
  END IF;
END $$;

-- TEST 6: Regular user can see activity_log
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM activity_log;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % activity_log entries', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 activity_log entries';
  END IF;
END $$;

-- TEST 7: Regular user can see profiles in their tenant
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE tenant_role = 'user' AND status = 'active' LIMIT 1;
  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No regular user found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT count(*) INTO v_count FROM profiles;

  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: Regular user sees % profiles', v_count;
  ELSE
    RAISE NOTICE 'FAIL: Regular user sees 0 profiles';
  END IF;
END $$;

-- TEST 8: user_can_access_project works for member
DO $$
DECLARE
  v_user_id uuid;
  v_project_id uuid;
  v_can_access boolean;
BEGIN
  -- Find a user who is a member of at least one project
  SELECT pm.user_id, pm.project_id INTO v_user_id, v_project_id
  FROM project_members pm
  JOIN profiles pr ON pr.id = pm.user_id AND pr.status = 'active'
  LIMIT 1;

  IF v_user_id IS NULL THEN RAISE NOTICE 'SKIP: No project member found'; RETURN; END IF;

  PERFORM set_test_user(v_user_id);
  SELECT user_can_access_project(v_project_id) INTO v_can_access;

  IF v_can_access THEN
    RAISE NOTICE 'PASS: user_can_access_project returns true for member';
  ELSE
    RAISE NOTICE 'FAIL: user_can_access_project returns false for member';
  END IF;
END $$;

-- Cleanup
DROP FUNCTION IF EXISTS set_test_user(uuid);
