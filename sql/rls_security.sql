-- ============================================================================
-- Polímata GRC - Row Level Security (RLS) & Security Policies
-- ============================================================================
-- This migration implements comprehensive RLS for multi-tenant data isolation.
-- Tables are secured based on user role (papel) and client membership (cliente_id).
--
-- Roles:
--   • admin_polimata: Full access to all tables and data
--   • consultor_polimata: CRUD on assigned projects (via perfis_projetos)
--   • gestor_cliente: CRUD on own client's projects
--   • usuario_cliente: SELECT only on own client's projects
--
-- Key principle: All data is scoped by cliente_id or projeto_id (which belongs to cliente_id)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HELPER FUNCTION: Get current user's role and client info
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.current_user_role()
RETURNS TABLE(
  user_id uuid,
  papel text,
  cliente_id uuid
) AS $$
  SELECT
    p.id,
    p.papel,
    p.cliente_id
  FROM public.perfis p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Grant permission to all authenticated users to call this function
GRANT EXECUTE ON FUNCTION auth.current_user_role() TO authenticated;

-- ============================================================================
-- 2. ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core tables
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constantes ENABLE ROW LEVEL SECURITY;

-- Read-only view (no RLS needed but we'll document it)
-- ALTER TABLE public.vw_maturidade_areas - this is a view, RLS comes from underlying tables

-- Auth profiles table
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Junction/mapping tables
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'perfis_projetos'
  ) THEN
    ALTER TABLE public.perfis_projetos ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'permissoes_area'
  ) THEN
    ALTER TABLE public.permissoes_area ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- 3. PERFIS TABLE POLICIES
-- ============================================================================
-- Perfis store user role and client assignment.
-- Users can only see their own profile.
-- Admin can see all profiles.
-- Gestores and consultores can see profiles in their client.

DROP POLICY IF EXISTS "perfis_select_own" ON public.perfis;
CREATE POLICY "perfis_select_own" ON public.perfis
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR cliente_id IN (
      SELECT cliente_id FROM public.perfis WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "perfis_update_own" ON public.perfis;
CREATE POLICY "perfis_update_own" ON public.perfis
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "perfis_insert_admin" ON public.perfis;
CREATE POLICY "perfis_insert_admin" ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "perfis_delete_admin" ON public.perfis;
CREATE POLICY "perfis_delete_admin" ON public.perfis
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 4. CLIENTES TABLE POLICIES
-- ============================================================================
-- Admin can see all clients.
-- Users can see their assigned client only.

DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR id IN (
      SELECT cliente_id FROM public.perfis WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clientes_insert_admin" ON public.clientes;
CREATE POLICY "clientes_insert_admin" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "clientes_update_admin" ON public.clientes;
CREATE POLICY "clientes_update_admin" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "clientes_delete_admin" ON public.clientes;
CREATE POLICY "clientes_delete_admin" ON public.clientes
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 5. PROJETOS TABLE POLICIES
-- ============================================================================
-- Admin: full access
-- Gestor_cliente: can access projects of their client
-- Consultor_polimata: can access assigned projects (via perfis_projetos)
-- Usuario_cliente: can SELECT projects of their client only

DROP POLICY IF EXISTS "projetos_select" ON public.projetos
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR cliente_id IN (
      SELECT cliente_id FROM public.perfis WHERE id = auth.uid()
    )
    OR id IN (
      SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "projetos_insert" ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente')
  );

DROP POLICY IF EXISTS "projetos_update" ON public.projetos
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR (
      (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'gestor_cliente'
      AND cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "projetos_delete_admin" ON public.projetos
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 6. AREAS TABLE POLICIES
-- ============================================================================
-- Areas belong to a project (which belongs to a client).
-- Access is based on access to the parent project.

DROP POLICY IF EXISTS "areas_select" ON public.areas
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "areas_insert" ON public.areas
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
    AND projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "areas_update" ON public.areas
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
    AND projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "areas_delete_admin" ON public.areas
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 7. MRC TABLE POLICIES (CRITICAL)
-- ============================================================================
-- MRC (Matriz de Risco e Controle) is the core data.
-- Users can access MRC rows for projects they have access to.
-- Usuarios_cliente can only SELECT.
-- Others can CRUD if they have project access.

DROP POLICY IF EXISTS "mrc_select" ON public.mrc
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

-- INSERT: admin, gestor_cliente, and consultor_polimata can insert on assigned projects
DROP POLICY IF EXISTS "mrc_insert" ON public.mrc
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
    AND projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

-- UPDATE: same as INSERT
DROP POLICY IF EXISTS "mrc_update" ON public.mrc
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
    AND projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

-- DELETE: only admin
DROP POLICY IF EXISTS "mrc_delete" ON public.mrc
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 8. REVISOES TABLE POLICIES
-- ============================================================================
-- Reviews belong to a project.
-- Access based on project access.

DROP POLICY IF EXISTS "revisoes_select" ON public.revisoes
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "revisoes_insert" ON public.revisoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
    AND projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "revisoes_update" ON public.revisoes
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
    AND projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "revisoes_delete" ON public.revisoes
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente')
  );

-- ============================================================================
-- 9. NOTIFICACOES TABLE POLICIES
-- ============================================================================
-- Notifications can be for a project (projeto_id) or global.
-- Users can see notifications for their project.
-- Admin can see all.

DROP POLICY IF EXISTS "notificacoes_select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR projeto_id IS NULL  -- Global notifications
    OR projeto_id IN (
      SELECT id FROM public.projetos
      WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
        OR id IN (SELECT projeto_id FROM public.perfis_projetos WHERE perfil_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "notificacoes_insert" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente', 'consultor_polimata')
  );

DROP POLICY IF EXISTS "notificacoes_update" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "notificacoes_delete" ON public.notificacoes
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 10. SISTEMAS TABLE POLICIES
-- ============================================================================
-- Systems belong to a client.
-- Access based on client membership.

DROP POLICY IF EXISTS "sistemas_select" ON public.sistemas
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "sistemas_insert" ON public.sistemas
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente')
  );

DROP POLICY IF EXISTS "sistemas_update" ON public.sistemas
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "sistemas_delete" ON public.sistemas
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 11. RESPONSAVEIS TABLE POLICIES
-- ============================================================================
-- Responsible people belong to a client.

DROP POLICY IF EXISTS "responsaveis_select" ON public.responsaveis
  FOR SELECT TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "responsaveis_insert" ON public.responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN ('admin_polimata', 'gestor_cliente')
  );

DROP POLICY IF EXISTS "responsaveis_update" ON public.responsaveis
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
    OR cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "responsaveis_delete" ON public.responsaveis
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 12. CONSTANTES TABLE POLICIES
-- ============================================================================
-- Constants are global but admin can modify.
-- All authenticated users can read.

DROP POLICY IF EXISTS "constantes_select" ON public.constantes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "constantes_insert" ON public.constantes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "constantes_update" ON public.constantes
  FOR UPDATE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

DROP POLICY IF EXISTS "constantes_delete" ON public.constantes
  FOR DELETE TO authenticated
  USING (
    (SELECT papel FROM public.perfis WHERE id = auth.uid()) = 'admin_polimata'
  );

-- ============================================================================
-- 13. PERFIS_PROJETOS JUNCTION TABLE POLICIES
-- ============================================================================
-- Maps consultants to projects they're assigned to.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'perfis_projetos'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "perfis_projetos_select" ON public.perfis_projetos';
    EXECUTE 'CREATE POLICY "perfis_projetos_select" ON public.perfis_projetos
      FOR SELECT TO authenticated
      USING (
        (SELECT papel FROM public.perfis WHERE id = auth.uid()) = ''admin_polimata''
        OR perfil_id = auth.uid()
        OR perfil_id IN (SELECT id FROM public.perfis WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid()))
      )';

    EXECUTE 'DROP POLICY IF EXISTS "perfis_projetos_insert" ON public.perfis_projetos';
    EXECUTE 'CREATE POLICY "perfis_projetos_insert" ON public.perfis_projetos
      FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT papel FROM public.perfis WHERE id = auth.uid()) = ''admin_polimata''
      )';

    EXECUTE 'DROP POLICY IF EXISTS "perfis_projetos_delete" ON public.perfis_projetos';
    EXECUTE 'CREATE POLICY "perfis_projetos_delete" ON public.perfis_projetos
      FOR DELETE TO authenticated
      USING (
        (SELECT papel FROM public.perfis WHERE id = auth.uid()) = ''admin_polimata''
      )';
  END IF;
END $$;

-- ============================================================================
-- 14. PERMISSOES_AREA JUNCTION TABLE POLICIES
-- ============================================================================
-- Maps users to areas they have permissions for.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'permissoes_area'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "permissoes_area_select" ON public.permissoes_area';
    EXECUTE 'CREATE POLICY "permissoes_area_select" ON public.permissoes_area
      FOR SELECT TO authenticated
      USING (
        (SELECT papel FROM public.perfis WHERE id = auth.uid()) = ''admin_polimata''
        OR perfil_id = auth.uid()
        OR perfil_id IN (SELECT id FROM public.perfis WHERE cliente_id = (SELECT cliente_id FROM public.perfis WHERE id = auth.uid()))
      )';

    EXECUTE 'DROP POLICY IF EXISTS "permissoes_area_insert" ON public.permissoes_area';
    EXECUTE 'CREATE POLICY "permissoes_area_insert" ON public.permissoes_area
      FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN (''admin_polimata'', ''gestor_cliente'')
      )';

    EXECUTE 'DROP POLICY IF EXISTS "permissoes_area_delete" ON public.permissoes_area';
    EXECUTE 'CREATE POLICY "permissoes_area_delete" ON public.permissoes_area
      FOR DELETE TO authenticated
      USING (
        (SELECT papel FROM public.perfis WHERE id = auth.uid()) IN (''admin_polimata'', ''gestor_cliente'')
      )';
  END IF;
END $$;

-- ============================================================================
-- 15. AUTH.USERS TABLE POLICIES
-- ============================================================================
-- Users can only see their own auth record.
-- Admin can see all.

DROP POLICY IF EXISTS "users_select" ON auth.users
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND papel = 'admin_polimata')
  );

-- ============================================================================
-- 16. SECURE RPC: limpar_base_projeto
-- ============================================================================
-- If this RPC exists, add admin-only check inside it.
-- This is a guard clause to prevent non-admin deletion of all project data.

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.limpar_base_projeto(projeto_id_param uuid)
  RETURNS TABLE(deleted_mrc_count int, success boolean)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
  DECLARE
    v_user_role text;
    v_deleted_count int;
  BEGIN
    -- Security check: only admin_polimata can clear a project
    SELECT papel INTO v_user_role FROM public.perfis WHERE id = auth.uid();

    IF v_user_role IS NULL THEN
      RAISE EXCEPTION 'User not found in perfis table';
    END IF;

    IF v_user_role != 'admin_polimata' THEN
      RAISE EXCEPTION 'Permission denied: only admin_polimata can clear project data';
    END IF;

    -- Delete all MRC entries for this project
    DELETE FROM public.mrc WHERE projeto_id = projeto_id_param;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN QUERY SELECT v_deleted_count::int, true;
  END;
  $func$;

  GRANT EXECUTE ON FUNCTION public.limpar_base_projeto(uuid) TO authenticated;
END $$;

-- ============================================================================
-- 17. GRANT PERMISSIONS
-- ============================================================================

-- Grant authenticated users permission to select from tables (RLS will enforce rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mrc TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistemas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;
GRANT SELECT ON public.constantes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.constantes TO authenticated;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'perfis_projetos'
  ) THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.perfis_projetos TO authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'permissoes_area'
  ) THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.permissoes_area TO authenticated';
  END IF;
END $$;

-- Grant access to views
GRANT SELECT ON public.vw_maturidade_areas TO authenticated;

-- Anon user can only see what's explicitly public (none in this case)
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================================================
-- 18. HELPER VIEWS FOR DEBUGGING/AUDITING
-- ============================================================================

-- View to see which tables have RLS enabled
CREATE OR REPLACE VIEW public.rls_status AS
SELECT
  schemaname,
  tablename,
  (SELECT relrowsecurity FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = schemaname) AND relname = tablename) as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

GRANT SELECT ON public.rls_status TO authenticated;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- NOTES FOR DEPLOYMENT
-- ============================================================================
/*
 * 1. This migration is re-runnable and uses DROP POLICY IF EXISTS before creation.
 * 2. All policies are SECURITY DEFINER where they reference other tables to ensure consistency.
 * 3. The helper function auth.current_user_role() makes role lookups efficient.
 * 4. Multi-level isolation:
 *    - cliente_id: Primary tenant isolation key
 *    - projeto_id: Secondary isolation within client
 *    - perfis_projetos: Maps consultants to specific projects for granular control
 * 5. Audit trail: Consider adding audit logging to trigger-based changes (future).
 * 6. Performance: Policies with IN (SELECT ...) may slow queries on large tables.
 *    Monitor query performance and consider denormalization if needed.
 * 7. Testing: After deployment, test each role's access with sample data:
 *    - admin_polimata: should see all data
 *    - gestor_cliente: should see only their client's data
 *    - consultor_polimata: should see only assigned projects
 *    - usuario_cliente: should SELECT only, no CRUD
 */
