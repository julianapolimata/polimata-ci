# Polímata GRC - RLS Migration Deployment Guide

## Quick Start

```bash
# 1. Backup production database first
# 2. Run the migration in your Supabase SQL editor:
psql -U postgres -d your_db < sql/rls_security.sql

# Or copy-paste the entire rls_security.sql into Supabase dashboard
# SQL Editor → New Query → Paste content → Run
```

## What This Migration Does

### Security Enablement
- Enables Row Level Security (RLS) on 11 core tables
- Creates role-based access control policies
- Implements multi-tenant isolation via `cliente_id` and `projeto_id`
- Secures RPC functions with admin-only checks

### Tables Protected
- `perfis` - User profiles and roles
- `clientes` - Client/tenant records
- `projetos` - Projects
- `areas` - Business areas
- `mrc` - Risk/Control Matrix (CRITICAL)
- `revisoes` - Reviews
- `notificacoes` - Notifications
- `sistemas` - Systems
- `responsaveis` - Responsible people
- `constantes` - Global constants
- `auth.users` - Supabase authentication records

## Role Access Control

### admin_polimata
- **Access**: All data, all operations
- **Use case**: Polímata administrators
- **Operations**: Full CRUD on all tables

### gestor_cliente
- **Access**: Own client's data only
- **Use case**: Client managers
- **Operations**: CRUD on projects, areas, MRC, reviews, systems, people
- **Isolation**: Scoped by `cliente_id`

### consultor_polimata
- **Access**: Assigned projects only
- **Use case**: Consultants
- **Operations**: CRUD on assigned projects' data
- **Isolation**: Via `perfis_projetos` junction table

### usuario_cliente
- **Access**: Own client's data, read-only
- **Use case**: Client end-users, stakeholders
- **Operations**: SELECT only
- **Isolation**: Scoped by `cliente_id`

## Testing the Migration

### 1. Verify RLS is Enabled
```sql
SELECT * FROM public.rls_status;
-- Should show all tables with rls_enabled = true
```

### 2. Test as Admin
```sql
-- Log in as admin_polimata user
SELECT * FROM public.mrc LIMIT 1;
-- Should return data

SELECT * FROM public.clientes LIMIT 1;
-- Should return all clients
```

### 3. Test as Gestor Cliente
```sql
-- Log in as gestor_cliente user (assigned to one client)
SELECT * FROM public.projetos;
-- Should return only projects for their cliente_id

SELECT * FROM public.clientes;
-- Should return only their assigned client
```

### 4. Test as Consultor Polimata
```sql
-- Log in as consultor_polimata user (assigned to specific projects)
SELECT * FROM public.projetos;
-- Should return only assigned projects

SELECT * FROM public.mrc;
-- Should return MRC rows from assigned projects only
```

### 5. Test as Usuario Cliente
```sql
-- Log in as usuario_cliente user
SELECT * FROM public.mrc;
-- Should work (SELECT)

INSERT INTO public.mrc (...) VALUES (...);
-- Should FAIL with "new row violates row-level security policy"

UPDATE public.mrc SET ...;
-- Should FAIL with "new row violates row-level security policy"
```

## Common Issues & Troubleshooting

### Issue: "Permission denied" after migration
**Cause**: User doesn't have a row in `perfis` table
**Fix**: Add user to `perfis` with correct `papel` and `cliente_id`

### Issue: Queries return no rows when they should
**Cause**: RLS policy is too restrictive
**Fix**: Check the relevant policy in `rls_security.sql` and verify `cliente_id` or `projeto_id` matches

### Issue: Performance degradation
**Cause**: Policies with IN (SELECT ...) subqueries
**Fix**: 
- Add indexes on `cliente_id` and `projeto_id`
- Consider caching user role/client in JWT claims
- Monitor with `EXPLAIN ANALYZE`

### Issue: Junction tables error
**Cause**: Table doesn't exist (e.g., `perfis_projetos`, `permissoes_area`)
**Fix**: Migration handles this gracefully with `IF EXISTS` checks. Create the tables first if needed.

## Performance Optimization

### Recommended Indexes
```sql
-- Add these indexes after migration for better performance
CREATE INDEX idx_perfis_cliente_id ON public.perfis(cliente_id);
CREATE INDEX idx_projetos_cliente_id ON public.projetos(cliente_id);
CREATE INDEX idx_areas_projeto_id ON public.areas(projeto_id);
CREATE INDEX idx_mrc_projeto_id ON public.mrc(projeto_id);
CREATE INDEX idx_revisoes_projeto_id ON public.revisoes(projeto_id);
CREATE INDEX idx_sistemas_cliente_id ON public.sistemas(cliente_id);
CREATE INDEX idx_responsaveis_cliente_id ON public.responsaveis(cliente_id);
CREATE INDEX idx_perfis_projetos_perfil_id ON public.perfis_projetos(perfil_id);
CREATE INDEX idx_perfis_projetos_projeto_id ON public.perfis_projetos(projeto_id);
```

## Migration Safety

### Re-runnable
This migration uses `DROP POLICY IF EXISTS` before creating policies, making it safe to re-run.

### Transaction Safety
All statements are wrapped in a single `BEGIN...COMMIT` transaction.

### Backwards Compatibility
- No existing data is deleted or modified
- Existing user roles and assignments are preserved
- Application code requires no changes (RLS enforced transparently)

## Rollback Plan

If you need to rollback, run:
```sql
-- Disable RLS on all tables
ALTER TABLE public.perfis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrc DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistemas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.constantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
```

## Post-Deployment Checklist

- [ ] Run migration in development first
- [ ] Test all four roles with sample data
- [ ] Add recommended indexes
- [ ] Monitor query performance for 24 hours
- [ ] Review audit logs (if enabled)
- [ ] Update API documentation with RLS info
- [ ] Train team on role assignment best practices
- [ ] Consider enabling additional audit logging

## Support

For questions about:
- **Security policies**: Review corresponding section in `rls_security.sql`
- **Role assignments**: Check `perfis` table structure
- **Performance**: Run `EXPLAIN ANALYZE` on slow queries
- **Debugging**: Use `public.rls_status` view to verify RLS state

---

**Created**: 2026-04-26  
**For**: Polímata GRC System  
**Contact**: juliana@polimatagrc.com.br
