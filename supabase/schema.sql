-- ==============================================================================
-- SCHEMA: STRIPE DASHBOARD
-- Single Tenant | Una sucursal | Dashboard de visualización de Stripe
-- Autenticación, control de acceso, registro de transacciones de Stripe,
-- asignación de ventas a vendedores y gestión de comisiones/retiros.
-- Las transacciones se sincronizan desde Stripe (webhooks/API) a la tabla
-- stripe_transactions. Los datos de productos y clientes se leen de la API.
--
-- FLUJO DE REGISTRO:
-- 1. Owner: se crea desde el dashboard de Supabase (primer usuario del sistema)
-- 2. Demás usuarios: invitados por Owner/Admin desde Config Teams
--    → Se crea invitación con rol (status='pending') → Se envía email
--    → Usuario confirma → Se crea perfil (invitación sigue 'pending')
--    → Se redirige a onboarding → Completa datos personales
--    → App marca invitación como 'accepted' al completar onboarding
-- 3. Re-invitación: si el usuario nunca completó onboarding, el admin puede
--    re-invitar eliminando primero el auth.users previo (deleteUser) y
--    creando una nueva invitación (validate_invitation limpia el perfil huérfano)
-- ==============================================================================

-- 1. CONFIGURACIÓN INICIAL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. TABLA DE ROLES
-- Controla quién puede ver qué en el dashboard
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name TEXT NOT NULL UNIQUE CHECK (length(role_name) <= 50),
    display_name TEXT NOT NULL CHECK (length(display_name) <= 100),
    description TEXT CHECK (description IS NULL OR length(description) <= 500),
    permissions JSONB DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(permissions) = 'object'),
    hierarchy_level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles para un dashboard de Stripe
INSERT INTO public.roles (role_name, display_name, description, hierarchy_level) VALUES
('owner', 'Dueño', 'Acceso total al dashboard y configuración de Stripe', 100),
('admin', 'Administrador', 'Gestión completa del dashboard y usuarios', 10),
('seller', 'Vendedor', 'Puede reclamar transacciones como propias y ver el dashboard', 5),
('analyst', 'Analista', 'Acceso a reportes, métricas y transacciones (solo lectura)', 3),
('viewer', 'Visualizador', 'Acceso básico de solo lectura al dashboard', 1);

-- 3. TABLA DE USUARIOS (PERFILES)
-- Extiende auth.users de Supabase
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
        CHECK (length(email) <= 320),
    full_name TEXT CHECK (full_name IS NULL OR length(full_name) <= 200),
    phone TEXT CHECK (phone IS NULL OR length(phone) <= 30),
    avatar_url TEXT CHECK (avatar_url IS NULL OR length(avatar_url) <= 2048),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (commission_rate >= 0 AND commission_rate <= 100),
    preferences JSONB DEFAULT '{
        "theme": "light",
        "language": "es",
        "notifications": {
            "email": true,
            "push": false
        }
    }'::jsonb
        CHECK (pg_column_size(preferences) <= 10240),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id)
);

-- No se crean índices en auth_user_id ni email: los UNIQUE constraints ya los generan
CREATE INDEX idx_users_role_id ON public.users(role_id);
CREATE INDEX idx_users_invited_by ON public.users(invited_by);

-- 4. TABLA DE INVITACIONES
-- Registra las invitaciones enviadas por Owner/Admin para nuevos usuarios.
-- Cada invitación especifica el rol que tendrá el usuario al aceptar.
-- El Owner inicial se crea desde el dashboard de Supabase (sin invitación).
-- Los demás usuarios son invitados desde la página Config Teams.
-- invited_by usa ON DELETE RESTRICT para preservar la trazabilidad:
-- no se puede eliminar un usuario que haya enviado invitaciones.
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
        CHECK (length(email) <= 320),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    invited_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invitations_pending_email
    ON public.invitations(email) WHERE status = 'pending';
CREATE INDEX idx_invitations_role_id ON public.invitations(role_id);
CREATE INDEX idx_invitations_invited_by ON public.invitations(invited_by);
CREATE INDEX idx_invitations_status ON public.invitations(status);
-- No se crea índice en LOWER(email): validate_invitation normaliza a minúsculas
-- antes de insertar, y el UNIQUE parcial idx_invitations_pending_email cubre
-- las búsquedas por email en invitaciones pendientes.
CREATE INDEX idx_invitations_pending_expires ON public.invitations(expires_at)
    WHERE status = 'pending';

-- 5. FUNCIONES Y TRIGGERS

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Los triggers BEFORE UPDATE en public.users se ejecutan en orden alfabético:
-- a_ = validación de privilegios (primero), b_ = protección de owner,
-- c_ = actualizar timestamp (último, solo si las validaciones pasan).
CREATE TRIGGER c_update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON public.invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Validar invitaciones: bloquea si el usuario ya completó onboarding.
-- Si existe un perfil huérfano (onboarding_completed = FALSE), permite re-invitación
-- limpiando el perfil anterior y revocando invitaciones pendientes previas.
-- IMPORTANTE: Al re-invitar, el admin también debe eliminar el auth.users previo
-- via supabase.auth.admin.deleteUser() antes de llamar a inviteUserByEmail().
-- Normaliza el email a minúsculas para evitar inconsistencias case-sensitive.
CREATE OR REPLACE FUNCTION public.validate_invitation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    existing_user RECORD;
    caller_role TEXT;
    target_role_name TEXT;
BEGIN
    NEW.email := LOWER(TRIM(NEW.email));

    SELECT role_name INTO target_role_name
    FROM public.roles WHERE id = NEW.role_id;

    IF target_role_name = 'owner' THEN
        SELECT r.role_name INTO caller_role
        FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid();

        IF caller_role IS DISTINCT FROM 'owner' THEN
            RAISE EXCEPTION 'Solo un owner puede invitar con el rol owner';
        END IF;
    END IF;

    SELECT id, onboarding_completed INTO existing_user
    FROM public.users WHERE LOWER(email) = NEW.email;

    IF existing_user IS NOT NULL THEN
        IF existing_user.onboarding_completed = TRUE THEN
            RAISE EXCEPTION 'El usuario con email "%" ya existe en el sistema', NEW.email;
        END IF;

        -- Perfil huérfano: fue invitado pero nunca completó onboarding.
        -- Limpiar para permitir re-invitación con posible nuevo rol.
        BEGIN
            DELETE FROM public.users WHERE id = existing_user.id;
        EXCEPTION WHEN SQLSTATE 'P0010' THEN
            RAISE EXCEPTION 'No se puede re-invitar a "%": es el último owner activo del sistema. Primero asigne el rol owner a otro usuario.', NEW.email;
        END;
        UPDATE public.invitations
        SET status = 'revoked', updated_at = NOW()
        WHERE LOWER(email) = NEW.email AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Los triggers BEFORE INSERT se ejecutan en orden alfabético por nombre.
-- Prefijo a_ para validación (primero) y b_ para rate-limit (después),
-- así el rate-limit no se consume si la validación rechaza la invitación.
CREATE TRIGGER a_validate_invitation_before_insert
    BEFORE INSERT ON public.invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_invitation();

-- Validar transiciones de estado en invitaciones.
-- Solo se permiten: pending → accepted, pending → expired, pending → revoked.
CREATE OR REPLACE FUNCTION public.validate_invitation_status_transition()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'expired', 'revoked') THEN
        IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN
            NEW.accepted_at := NOW();
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Transición de estado inválida: "%" → "%"', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_invitation_status_change
    BEFORE UPDATE OF status ON public.invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_invitation_status_transition();

-- Rate-limiting: máximo 20 invitaciones por admin por hora.
-- Previene abuso por cuentas admin comprometidas.
CREATE OR REPLACE FUNCTION public.rate_limit_invitations()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    IF NEW.invited_by IS NULL THEN
        RAISE EXCEPTION 'invited_by es obligatorio para crear invitaciones';
    END IF;

    -- Serializa por admin para evitar que inserciones concurrentes excedan el límite horario.
    PERFORM pg_advisory_xact_lock(hashtext('invite_rl_' || NEW.invited_by::text));

    SELECT COUNT(*) INTO recent_count
    FROM public.invitations
    WHERE invited_by = NEW.invited_by
      AND created_at > NOW() - INTERVAL '1 hour';

    IF recent_count >= 20 THEN
        RAISE EXCEPTION 'Límite de invitaciones excedido: máximo 20 por hora';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER b_rate_limit_invitations_trigger
    BEFORE INSERT ON public.invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.rate_limit_invitations();

-- Crear perfil automáticamente cuando un usuario se registra via Supabase Auth.
-- Primer usuario (bootstrap): se asigna rol 'owner' (creado desde Supabase Dashboard).
-- Usuarios siguientes: requieren una invitación pendiente con rol predefinido.
-- Advisory lock previene race condition donde dos registros simultáneos podrían ambos
-- obtener user_count = 0 y convertirse en owner.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_role_id UUID;
    invitation_record RECORD;
    user_count INTEGER;
    new_user_id UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('handle_new_user_bootstrap'));

    SELECT COUNT(*) INTO user_count FROM public.users;

    -- Primer usuario del sistema: bootstrap como Owner (invitado desde Supabase Dashboard)
    IF user_count = 0 THEN
        SELECT id INTO target_role_id FROM public.roles WHERE role_name = 'owner' LIMIT 1;
        IF target_role_id IS NULL THEN
            RAISE EXCEPTION 'Rol "owner" no encontrado en public.roles';
        END IF;

        INSERT INTO public.users (auth_user_id, email, full_name, avatar_url, role_id, onboarding_completed)
        VALUES (NEW.id, LOWER(TRIM(NEW.email)), NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', target_role_id, FALSE)
        RETURNING id INTO new_user_id;

        INSERT INTO public.seller_balance_summary (user_id) VALUES (new_user_id);

        RETURN NEW;
    END IF;

    -- Usuarios siguientes: requieren invitación pendiente y no expirada
    SELECT * INTO invitation_record
    FROM public.invitations
    WHERE LOWER(email) = LOWER(TRIM(NEW.email))
      AND status = 'pending'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF invitation_record IS NULL THEN
        RAISE EXCEPTION 'No se encontró una invitación pendiente para el email "%". El registro solo es posible mediante invitación.', NEW.email;
    END IF;

    target_role_id := invitation_record.role_id;

    INSERT INTO public.users (auth_user_id, email, full_name, avatar_url, role_id, invited_by, onboarding_completed)
    VALUES (
        NEW.id,
        LOWER(TRIM(NEW.email)),
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        target_role_id,
        invitation_record.invited_by,
        FALSE
    )
    RETURNING id INTO new_user_id;

    INSERT INTO public.seller_balance_summary (user_id) VALUES (new_user_id);

    -- NOTA: La invitación permanece como 'pending' hasta que el usuario complete
    -- el onboarding. La app debe ejecutar al completar onboarding:
    -- UPDATE public.invitations SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
    -- WHERE email = <user_email> AND status = 'pending';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sincronizar email y metadata cuando se actualiza en auth.users.
-- Al disparar UPDATE en public.users, prevent_privilege_escalation detecta
-- pg_trigger_depth() > 1 (trigger anidado) y permite el cambio de email.
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.users
    SET
        email = LOWER(TRIM(NEW.email)),
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
        avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url),
        updated_at = NOW()
    WHERE auth_user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email, raw_user_meta_data ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Prevenir escalación de privilegios:
-- - Campos inmutables (auth_user_id, email, created_at) protegidos para TODOS los roles incluyendo admin.
-- - Admin puede gestionar usuarios pero NO puede asignar el rol 'owner' (solo owner puede).
-- - Owner puede gestionar todo excepto campos verdaderamente inmutables (auth_user_id, created_at).
-- - El email solo se permite cambiar desde un trigger anidado (pg_trigger_depth() > 1),
--   lo cual ocurre únicamente cuando handle_user_update sincroniza desde auth.users.
-- - pg_trigger_depth() NO es manipulable por el usuario, a diferencia de session variables.
-- - onboarding_completed solo puede cambiar de FALSE → TRUE (no se puede revertir).
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    caller_role TEXT;
    target_role_name TEXT;
BEGIN
    SELECT r.role_name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid();

    -- Campos verdaderamente inmutables: protegidos para TODOS los roles (incluyendo owner).
    -- auth_user_id es la identidad del usuario; su modificación permitiría secuestro de cuentas.
    -- created_at es un registro histórico que no debe falsificarse.
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'auth_user_id es inmutable y no puede ser modificado';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'created_at es inmutable y no puede ser modificado';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email AND pg_trigger_depth() <= 1 THEN
        RAISE EXCEPTION 'El email se sincroniza desde auth y no se puede cambiar manualmente';
    END IF;
    IF OLD.onboarding_completed = TRUE AND NEW.onboarding_completed = FALSE THEN
        RAISE EXCEPTION 'No se puede revertir el estado de onboarding';
    END IF;

    -- Triggers del sistema (depth > 1 sin sesión de auth): permitir.
    -- Cubre operaciones legítimas de triggers encadenados (ej. handle_user_update)
    -- que no tienen un caller_role porque auth.uid() es NULL en ese contexto.
    IF caller_role IS NULL AND pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Owner: acceso total a campos no-inmutables
    IF caller_role = 'owner' THEN
        RETURN NEW;
    END IF;

    -- Admin: puede gestionar usuarios pero NO puede asignar rol 'owner'
    IF caller_role = 'admin' THEN
        IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
            SELECT role_name INTO target_role_name
            FROM public.roles WHERE id = NEW.role_id;
            IF target_role_name = 'owner' THEN
                RAISE EXCEPTION 'Solo un owner puede asignar el rol owner';
            END IF;
        END IF;
        IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
            RAISE EXCEPTION 'No se puede modificar invited_by';
        END IF;
        RETURN NEW;
    END IF;

    -- Demás roles: campos protegidos
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
        RAISE EXCEPTION 'No tienes permisos para cambiar el rol';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        RAISE EXCEPTION 'No tienes permisos para cambiar el estado activo';
    END IF;
    IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
        RAISE EXCEPTION 'No tienes permisos para cambiar invited_by';
    END IF;
    IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
        RAISE EXCEPTION 'No tienes permisos para cambiar la tasa de comisión';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER a_guard_user_privilege_escalation
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Evitar que el último owner sea degradado, desactivado o eliminado.
-- Cubre tanto UPDATE (cambio de rol / is_active) como DELETE (directo o CASCADE).
-- FOR UPDATE en el SELECT serializa operaciones concurrentes (previene TOCTOU race condition).
CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    owner_role_id UUID;
    owner_count INTEGER;
    owner_row RECORD;
BEGIN
    SELECT id INTO owner_role_id FROM public.roles WHERE role_name = 'owner';

    IF TG_OP = 'DELETE' THEN
        IF OLD.role_id = owner_role_id AND OLD.is_active = TRUE THEN
            owner_count := 0;
            FOR owner_row IN
                SELECT id
                FROM public.users
                WHERE role_id = owner_role_id AND is_active = TRUE
                FOR UPDATE
            LOOP
                owner_count := owner_count + 1;
            END LOOP;

            IF owner_count <= 1 THEN
                RAISE EXCEPTION 'No se puede eliminar al último owner activo'
                    USING ERRCODE = 'P0010';
            END IF;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.role_id = owner_role_id AND (NEW.role_id IS DISTINCT FROM OLD.role_id OR (OLD.is_active = TRUE AND NEW.is_active = FALSE)) THEN
            owner_count := 0;
            FOR owner_row IN
                SELECT id
                FROM public.users
                WHERE role_id = owner_role_id AND is_active = TRUE
                FOR UPDATE
            LOOP
                owner_count := owner_count + 1;
            END LOOP;

            IF owner_count <= 1 THEN
                RAISE EXCEPTION 'No se puede degradar o desactivar al último owner activo'
                    USING ERRCODE = 'P0010';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER b_protect_last_owner_on_update
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_last_owner();

CREATE TRIGGER protect_last_owner_on_delete
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_last_owner();

-- Impedir eliminación o renombrado de roles del sistema.
-- Sin estos roles, las políticas RLS y triggers dejan de funcionar correctamente.
-- Cubre DELETE (no se puede eliminar) y UPDATE de role_name (no se puede renombrar).
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.role_name IN ('owner', 'admin', 'seller', 'analyst', 'viewer') THEN
            RAISE EXCEPTION 'No se puede eliminar el rol de sistema "%"', OLD.role_name;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.role_name IN ('owner', 'admin', 'seller', 'analyst', 'viewer') THEN
            IF NEW.role_name IS DISTINCT FROM OLD.role_name THEN
                RAISE EXCEPTION 'No se puede renombrar el rol de sistema "%"', OLD.role_name;
            END IF;

            IF NEW.permissions IS DISTINCT FROM OLD.permissions
               OR NEW.hierarchy_level IS DISTINCT FROM OLD.hierarchy_level THEN
                SELECT r.role_name INTO caller_role
                FROM public.users u
                JOIN public.roles r ON u.role_id = r.id
                WHERE u.auth_user_id = auth.uid();

                IF caller_role IS DISTINCT FROM 'owner' THEN
                    RAISE EXCEPTION 'Solo el owner puede modificar permissions/hierarchy_level de roles del sistema';
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_system_roles_trigger
    BEFORE DELETE OR UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_system_roles();

-- Solo el owner puede crear roles nuevos.
-- Previene que un admin cree roles con permisos arbitrarios para escalar privilegios.
CREATE OR REPLACE FUNCTION public.restrict_role_creation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    SELECT r.role_name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid();

    IF caller_role IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION 'Solo el owner puede crear nuevos roles';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_role_creation
    BEFORE INSERT ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.restrict_role_creation();

-- 6. POLÍTICAS DE SEGURIDAD (RLS)
-- NOTA: Las políticas FOR ALL solo se usan donde admin necesita CRUD completo
-- (tx_assign_all_admin, seller_pm_all_admin). Todas verifican is_active = TRUE
-- para bloquear el acceso de usuarios desactivados.
--
-- Funciones helper STABLE SECURITY DEFINER para evitar repetir subqueries
-- en cada política. STABLE permite a PostgreSQL cachear el resultado
-- dentro de una misma sentencia/transacción.

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE auth_user_id = auth.uid()
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND u.is_active = TRUE
        AND r.role_name IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_admin_user_id()
RETURNS UUID
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN (
        SELECT u.id FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND u.is_active = TRUE
        AND r.role_name IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_active_seller_or_above()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND u.is_active = TRUE
        AND r.role_name IN ('seller', 'admin', 'owner')
    );
END;
$$ LANGUAGE plpgsql;

-- Usuarios activos de dashboard (incluye roles de solo lectura).
CREATE OR REPLACE FUNCTION public.is_active_dashboard_user()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND u.is_active = TRUE
        AND r.role_name IN ('viewer', 'analyst', 'seller', 'admin', 'owner')
    );
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

-- ROLES: visibles por usuarios autenticados y activos
CREATE POLICY "roles_select_active_users"
    ON public.roles FOR SELECT TO authenticated
    USING (public.is_active_user());

-- ROLES: solo owner puede crear roles nuevos (defensa en profundidad con trigger restrict_role_creation)
CREATE POLICY "roles_insert_owner_only"
    ON public.roles FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
            AND r.role_name = 'owner'
        )
    );

-- ROLES: admin/owner pueden modificar
CREATE POLICY "roles_update_admin_owner"
    ON public.roles FOR UPDATE TO authenticated
    USING (public.is_admin_or_owner());

-- ROLES: admin/owner pueden eliminar (roles no-sistema; protect_system_roles bloquea los del sistema)
CREATE POLICY "roles_delete_admin_owner"
    ON public.roles FOR DELETE TO authenticated
    USING (public.is_admin_or_owner());

-- USUARIOS: cada usuario activo ve su propio perfil
CREATE POLICY "users_select_own_profile"
    ON public.users FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid() AND is_active = TRUE);

-- USUARIOS: cada usuario activo actualiza su propio perfil
CREATE POLICY "users_update_own_profile"
    ON public.users FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid() AND is_active = TRUE)
    WITH CHECK (auth_user_id = auth.uid() AND is_active = TRUE);

-- USUARIOS: admin/owner ven todos los perfiles (incluso inactivos, para gestión)
CREATE POLICY "users_select_all_admin"
    ON public.users FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

-- USUARIOS: admin/owner pueden actualizar perfiles
CREATE POLICY "users_update_all_admin"
    ON public.users FOR UPDATE TO authenticated
    USING (public.is_admin_or_owner());

-- USUARIOS: admin/owner pueden eliminar perfiles
CREATE POLICY "users_delete_admin"
    ON public.users FOR DELETE TO authenticated
    USING (public.is_admin_or_owner());

-- NOTA: NO hay política INSERT en public.users.
-- Los perfiles se crean EXCLUSIVAMENTE via handle_new_user() (trigger en auth.users).
-- Esto impide que un admin cree perfiles directamente eludiendo el flujo de invitación.

-- Función RPC para que sellers activos puedan ver info básica de otros sellers.
-- Útil para leaderboards y vistas de equipo sin abrir una política RLS amplia.
-- SECURITY DEFINER bypasea RLS; la función valida internamente que el caller sea activo.
-- Decisión de producto: se mantiene acceso para cualquier usuario ACTIVO (incluye
-- viewer/analyst), no solo seller/admin/owner, para habilitar vistas colaborativas.
-- Solo retorna id, full_name y avatar_url (sin email, phone u otros datos sensibles).
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    role_name TEXT
)
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no activo';
    END IF;

    RETURN QUERY
    SELECT u.id, u.full_name, u.avatar_url, r.role_name
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.is_active = TRUE
      AND r.role_name = 'seller'
    ORDER BY r.hierarchy_level DESC, u.full_name;
END;
$$ LANGUAGE plpgsql;

-- INVITACIONES: solo owner/admin activos pueden gestionar invitaciones
CREATE POLICY "invitations_select_admin"
    ON public.invitations FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "invitations_insert_admin"
    ON public.invitations FOR INSERT TO authenticated
    WITH CHECK (invited_by = public.get_admin_user_id());

CREATE POLICY "invitations_update_admin"
    ON public.invitations FOR UPDATE TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "invitations_delete_admin"
    ON public.invitations FOR DELETE TO authenticated
    USING (public.is_admin_or_owner());

-- ==============================================================================
-- 7. CUENTAS DE STRIPE (SINGLE-TENANT, MULTI-CUENTA)
-- Catálogo de cuentas Stripe conectadas dentro del mismo tenant.
-- Permite consolidar transacciones de múltiples cuentas en una sola tabla local.
-- ==============================================================================
CREATE TABLE public.stripe_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_account_external_id TEXT NOT NULL UNIQUE
        CHECK (stripe_account_external_id ~ '^acct_.+')
        CHECK (length(stripe_account_external_id) <= 100),
    display_name TEXT NOT NULL
        CHECK (length(display_name) BETWEEN 1 AND 120),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_accounts_active ON public.stripe_accounts(is_active);

CREATE TRIGGER update_stripe_accounts_updated_at
    BEFORE UPDATE ON public.stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "stripe_accounts_select_active_users"
    ON public.stripe_accounts FOR SELECT TO authenticated
    USING (public.is_active_dashboard_user());

CREATE POLICY "stripe_accounts_insert_admin"
    ON public.stripe_accounts FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "stripe_accounts_update_admin"
    ON public.stripe_accounts FOR UPDATE TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "stripe_accounts_delete_admin"
    ON public.stripe_accounts FOR DELETE TO authenticated
    USING (public.is_admin_or_owner());

-- Cuentas Stripe base para operación multi-cuenta.
INSERT INTO public.stripe_accounts (stripe_account_external_id, display_name, is_active)
VALUES
    ('acct_jnode', 'JNode', TRUE),
    ('acct_vascruz', 'Vascruz', TRUE)
ON CONFLICT (stripe_account_external_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_legacy_stripe_account_id()
RETURNS UUID
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT sa.id
    FROM public.stripe_accounts sa
    WHERE sa.stripe_account_external_id = 'acct_jnode'
    LIMIT 1;
$$ LANGUAGE sql;

-- ==============================================================================
-- 8. TRANSACCIONES DE STRIPE
-- Almacena los datos de cada transacción sincronizada desde Stripe (via webhooks o API).
-- Soporta payment intents, charges, checkout sessions, invoices y subscriptions.
-- Montos en centavos USD (la unidad mínima de la moneda).
-- El campo metadata (JSONB) captura datos adicionales de Stripe sin requerir columnas extra.
-- funds_available_at: fecha en que Stripe libera los fondos al balance de la cuenta
-- (obtenido de balance_transaction.available_on). NULL = sin fecha aún.
-- Solo las comisiones de transacciones con fondos liberados son retirables por sellers.
-- Esta tabla es la fuente de verdad local para que los sellers identifiquen y reclamen ventas.
-- ==============================================================================
CREATE TABLE public.stripe_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_account_id UUID
        REFERENCES public.stripe_accounts(id) ON DELETE RESTRICT,
    stripe_id TEXT NOT NULL
        CHECK (stripe_id ~ '^(pi_|ch_|cs_|in_|sub_).+')
        CHECK (length(stripe_id) <= 200),
    transaction_type TEXT NOT NULL
        CHECK (transaction_type IN ('payment_intent', 'charge', 'checkout_session', 'invoice', 'subscription')),
    stripe_status TEXT NOT NULL CHECK (length(stripe_status) <= 50),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
    stripe_fee INTEGER NOT NULL DEFAULT 0 CHECK (stripe_fee >= 0),
    net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
    stripe_customer_id TEXT CHECK (stripe_customer_id IS NULL OR length(stripe_customer_id) <= 100),
    customer_email TEXT CHECK (customer_email IS NULL OR length(customer_email) <= 320),
    customer_name TEXT CHECK (customer_name IS NULL OR length(customer_name) <= 200),
    description TEXT CHECK (description IS NULL OR length(description) <= 500),
    payment_method_type TEXT CHECK (payment_method_type IS NULL OR length(payment_method_type) <= 50),
    stripe_product_id TEXT CHECK (stripe_product_id IS NULL OR length(stripe_product_id) <= 100),
    stripe_created_at TIMESTAMPTZ,
    funds_available_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
        CHECK (pg_column_size(metadata) <= 10240),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stripe_id_type_match CHECK (
        (transaction_type = 'payment_intent' AND stripe_id ~ '^pi_') OR
        (transaction_type = 'charge' AND stripe_id ~ '^ch_') OR
        (transaction_type = 'checkout_session' AND stripe_id ~ '^cs_') OR
        (transaction_type = 'invoice' AND stripe_id ~ '^in_') OR
        (transaction_type = 'subscription' AND stripe_id ~ '^sub_')
    ),
    CONSTRAINT chk_stripe_amount_consistency CHECK (
        stripe_fee <= amount
        AND net_amount = amount - stripe_fee
    ),
    CONSTRAINT uq_stripe_tx_account_and_id UNIQUE (stripe_account_id, stripe_id)
);

-- Backfill de filas existentes hacia la cuenta default (acct_jnode) y endurecimiento de constraint.
UPDATE public.stripe_transactions
SET stripe_account_id = public.get_legacy_stripe_account_id()
WHERE stripe_account_id IS NULL;

ALTER TABLE public.stripe_transactions
    ALTER COLUMN stripe_account_id SET NOT NULL;

CREATE INDEX idx_stripe_tx_type ON public.stripe_transactions(transaction_type);
CREATE INDEX idx_stripe_tx_status ON public.stripe_transactions(stripe_status);
CREATE INDEX idx_stripe_tx_customer ON public.stripe_transactions(stripe_customer_id);
CREATE INDEX idx_stripe_tx_created ON public.stripe_transactions(stripe_created_at DESC);
CREATE INDEX idx_stripe_tx_funds_available ON public.stripe_transactions(funds_available_at)
    WHERE funds_available_at IS NOT NULL;
CREATE INDEX idx_stripe_tx_account ON public.stripe_transactions(stripe_account_id);
CREATE INDEX idx_stripe_tx_account_created
    ON public.stripe_transactions(stripe_account_id, stripe_created_at DESC);
CREATE INDEX idx_stripe_tx_account_status
    ON public.stripe_transactions(stripe_account_id, stripe_status);
CREATE INDEX idx_stripe_tx_account_type
    ON public.stripe_transactions(stripe_account_id, transaction_type);

CREATE TRIGGER update_stripe_tx_updated_at
    BEFORE UPDATE ON public.stripe_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.stripe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_transactions FORCE ROW LEVEL SECURITY;

-- Usuarios activos de dashboard (incluye lectura para analyst/viewer) pueden consultar transacciones.
-- Los campos sensibles se restringen por privilegios de columna en sección 16.
CREATE POLICY "stripe_tx_select_active_users"
    ON public.stripe_transactions FOR SELECT TO authenticated
    USING (public.is_active_dashboard_user());

-- Solo admin/owner pueden sincronizar transacciones desde Stripe
-- (en producción, los webhooks usan service_role que bypasea RLS)
CREATE POLICY "stripe_tx_insert_admin"
    ON public.stripe_transactions FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "stripe_tx_update_admin"
    ON public.stripe_transactions FOR UPDATE TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "stripe_tx_delete_admin"
    ON public.stripe_transactions FOR DELETE TO authenticated
    USING (public.is_admin_or_owner());

-- Vista minimizada para sellers: evita exponer PII y metadata sensible.
CREATE OR REPLACE VIEW public.stripe_transactions_safe
WITH (security_invoker = true)
AS
SELECT
    st.id,
    st.stripe_account_id,
    sa.stripe_account_external_id,
    sa.display_name AS stripe_account_display_name,
    st.stripe_id,
    st.transaction_type,
    st.stripe_status,
    st.amount,
    st.currency,
    st.stripe_fee,
    st.net_amount,
    st.payment_method_type,
    st.stripe_product_id,
    st.stripe_created_at,
    st.funds_available_at,
    st.created_at,
    st.updated_at
FROM public.stripe_transactions st
LEFT JOIN public.stripe_accounts sa ON sa.id = st.stripe_account_id
WHERE public.is_active_dashboard_user();

-- Actualizar seller_balance_summary cuando funds_available_at cambia en una transacción.
-- Mueve la comisión de pending_earned a available_earned si la transacción tiene
-- una asignación y los fondos acaban de volverse disponibles (NOW() >= funds_available_at).
-- Si el nuevo valor es futuro, no hace nada; release_available_funds() lo manejará.
CREATE OR REPLACE FUNCTION public.update_summary_on_funds_release()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    assignment_user_id UUID;
BEGIN
    SELECT ta.user_id INTO assignment_user_id
    FROM public.transaction_assignments ta
    WHERE ta.stripe_transaction_id = NEW.id;

    IF assignment_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM public.recompute_user_balance_by_account(assignment_user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_summary_on_funds_release
    AFTER UPDATE OF funds_available_at ON public.stripe_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_summary_on_funds_release();

-- ==============================================================================
-- 8. ASIGNACIÓN DE TRANSACCIONES A VENDEDORES
-- Vincula una stripe_transaction con el vendedor que la realizó.
-- UNIQUE en stripe_transaction_id: una transacción = un solo vendedor.
-- Al insertar, el trigger auto_populate_assignment_fields obtiene automáticamente:
--   - net_amount_snapshot: del net_amount de stripe_transactions (snapshot inmutable)
--   - commission_rate: del commission_rate del seller en public.users
-- commission_amount es columna generada: ROUND(net_amount_snapshot * commission_rate / 100)
-- El seller solo necesita proporcionar stripe_transaction_id y user_id para reclamar.
-- ==============================================================================
CREATE TABLE public.transaction_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_transaction_id UUID NOT NULL UNIQUE
        REFERENCES public.stripe_transactions(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    net_amount_snapshot INTEGER NOT NULL CHECK (net_amount_snapshot >= 0),
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (commission_rate >= 0 AND commission_rate <= 100),
    commission_amount INTEGER NOT NULL
        GENERATED ALWAYS AS (ROUND(net_amount_snapshot * commission_rate / 100)::INTEGER) STORED,
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 500),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_assignments_date ON public.transaction_assignments(assigned_at DESC);
CREATE INDEX idx_tx_assignments_user_date ON public.transaction_assignments(user_id, assigned_at DESC);
CREATE INDEX idx_tx_assignments_user_commission ON public.transaction_assignments(user_id, commission_amount);
CREATE INDEX idx_tx_assignments_user_covering
    ON public.transaction_assignments(user_id, stripe_transaction_id, commission_amount);

CREATE TRIGGER update_tx_assignments_updated_at
    BEFORE UPDATE ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-poblar campos financieros al reclamar una transacción.
-- net_amount_snapshot se toma de stripe_transactions; commission_rate del perfil del seller.
-- commission_amount se calcula automáticamente (columna generada).
CREATE OR REPLACE FUNCTION public.auto_populate_assignment_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    tx_net INTEGER;
    seller_rate NUMERIC(5,2);
    target_role TEXT;
BEGIN
    SELECT st.net_amount INTO tx_net
    FROM public.stripe_transactions st
    WHERE st.id = NEW.stripe_transaction_id;

    IF tx_net IS NULL THEN
        RAISE EXCEPTION 'Transacción de Stripe no encontrada: %', NEW.stripe_transaction_id;
    END IF;

    SELECT u.commission_rate, r.role_name INTO seller_rate, target_role
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = NEW.user_id;

    IF seller_rate IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado: %', NEW.user_id;
    END IF;

    IF target_role NOT IN ('seller', 'admin', 'owner') THEN
        RAISE EXCEPTION 'Solo se pueden asignar transacciones a usuarios con rol seller, admin u owner (rol actual: "%")', target_role;
    END IF;

    NEW.net_amount_snapshot := tx_net;
    NEW.commission_rate := seller_rate;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_populate_assignment
    BEFORE INSERT ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_populate_assignment_fields();

-- Sellers solo pueden editar notes. Todos los demás campos son inmutables para sellers.
-- Admin/Owner pueden modificar commission_rate (recalcula commission_amount automáticamente).
-- commission_amount es generada y no aparece aquí (no se puede UPDATE directamente).
CREATE OR REPLACE FUNCTION public.protect_assignment_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- Campos inmutables para TODOS los roles (incluyendo admin/owner):
    -- el snapshot financiero y la vinculación no deben alterarse post-creación.
    IF NEW.stripe_transaction_id IS DISTINCT FROM OLD.stripe_transaction_id THEN
        RAISE EXCEPTION 'No se puede cambiar la transacción vinculada';
    END IF;
    IF NEW.net_amount_snapshot IS DISTINCT FROM OLD.net_amount_snapshot THEN
        RAISE EXCEPTION 'No se puede modificar el snapshot del monto neto';
    END IF;
    IF NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
        RAISE EXCEPTION 'No se puede modificar la fecha de asignación';
    END IF;

    SELECT r.role_name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid();

    IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'No se puede reasignar la transacción a otro usuario';
        END IF;
        IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
            RAISE EXCEPTION 'No se puede modificar la tasa de comisión';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_assignment_fields
    BEFORE UPDATE ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_assignment_fields();

-- Impedir des-reclamar una transacción si el seller tiene retiros comprometidos
-- (completed o pending) que quedarían sin respaldo de saldo.
-- Si el admin cancela los retiros primero (status → cancelled/rejected),
-- el seller puede des-reclamar libremente.
CREATE OR REPLACE FUNCTION public.prevent_unclaim_with_payouts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_stripe_account_id UUID;
    remaining_earned INTEGER;
    total_disbursed INTEGER;
BEGIN
    SELECT st.stripe_account_id
    INTO target_stripe_account_id
    FROM public.stripe_transactions st
    WHERE st.id = OLD.stripe_transaction_id;

    IF target_stripe_account_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver stripe_account_id para la transacción %', OLD.stripe_transaction_id;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('payout_balance_' || OLD.user_id::text || '_' || target_stripe_account_id::text)
    );

    SELECT COALESCE(SUM(ta.commission_amount), 0) INTO remaining_earned
    FROM public.transaction_assignments ta
    JOIN public.stripe_transactions st ON st.id = ta.stripe_transaction_id
    WHERE ta.user_id = OLD.user_id
      AND ta.id != OLD.id
      AND st.stripe_account_id = target_stripe_account_id
      AND st.funds_available_at IS NOT NULL
      AND st.funds_available_at <= NOW();

    SELECT COALESCE(SUM(p.amount), 0)::INTEGER INTO total_disbursed
    FROM (
        SELECT spa.allocated_amount AS amount
        FROM public.seller_payout_allocations spa
        JOIN public.seller_payouts sp ON sp.id = spa.payout_id
        WHERE sp.user_id = OLD.user_id
          AND spa.stripe_account_id = target_stripe_account_id
          AND sp.status IN ('completed', 'pending')

        UNION ALL

        SELECT sp.amount AS amount
        FROM public.seller_payouts sp
        WHERE sp.user_id = OLD.user_id
          AND sp.stripe_account_id = target_stripe_account_id
          AND sp.status IN ('completed', 'pending')
          AND NOT EXISTS (
              SELECT 1
              FROM public.seller_payout_allocations spa
              WHERE spa.payout_id = sp.id
          )
    ) p;

    IF total_disbursed > 0 AND remaining_earned < total_disbursed THEN
        RAISE EXCEPTION 'No se puede des-reclamar en la cuenta Stripe %: el saldo restante (% centavos) no cubre los retiros comprometidos (% centavos). Cancele los retiros pendientes primero.',
            target_stripe_account_id, remaining_earned, total_disbursed;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_unclaim_with_payouts_trigger
    BEFORE DELETE ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_unclaim_with_payouts();

ALTER TABLE public.transaction_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_assignments FORCE ROW LEVEL SECURITY;

-- Sellers/admin/owner activos pueden ver todas las asignaciones.
CREATE POLICY "tx_assign_select_active_users"
    ON public.transaction_assignments FOR SELECT TO authenticated
    USING (public.is_active_seller_or_above());

-- Sellers/Admin/Owner activos pueden reclamar transacciones para sí mismos
CREATE POLICY "tx_assign_insert_seller_self"
    ON public.transaction_assignments FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (
            SELECT u.id FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
            AND r.role_name IN ('seller', 'owner', 'admin')
        )
    );

-- Sellers activos solo pueden actualizar sus propias asignaciones (notes)
CREATE POLICY "tx_assign_update_seller_own"
    ON public.transaction_assignments FOR UPDATE TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
            AND r.role_name IN ('seller', 'owner', 'admin')
        )
    )
    WITH CHECK (
        user_id = (
            SELECT u.id FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
            AND r.role_name IN ('seller', 'owner', 'admin')
        )
    );

-- Sellers activos solo pueden quitar sus propias asignaciones
CREATE POLICY "tx_assign_delete_seller_own"
    ON public.transaction_assignments FOR DELETE TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
            AND r.role_name IN ('seller', 'owner', 'admin')
        )
    );

-- Admin/Owner activos pueden gestionar todas las asignaciones
CREATE POLICY "tx_assign_all_admin"
    ON public.transaction_assignments FOR ALL TO authenticated
    USING (public.is_admin_or_owner());

-- Actualizar seller_balance_summary al insertar, actualizar o eliminar asignaciones.
-- AFTER trigger: commission_amount (GENERATED) ya tiene el valor correcto en NEW.
-- SELECT ... FOR UPDATE en la fila del summary serializa actualizaciones concurrentes.
CREATE OR REPLACE FUNCTION public.update_summary_on_assignment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.recompute_user_balance_by_account(NEW.user_id);
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM public.recompute_user_balance_by_account(OLD.user_id);
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        PERFORM public.recompute_user_balance_by_account(NEW.user_id);
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            PERFORM public.recompute_user_balance_by_account(OLD.user_id);
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_summary_on_assignment_insert_delete
    AFTER INSERT OR DELETE ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_summary_on_assignment();

CREATE TRIGGER update_summary_on_assignment_update
    AFTER UPDATE OF user_id, commission_rate ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_summary_on_assignment();

-- ==============================================================================
-- 9. MÉTODOS DE PAGO DE VENDEDORES
-- CIFRADO (AES-256-GCM): Los campos financieros sensibles (ach_account_number,
-- ach_routing_number, binance_id, qr_ci_number,
-- y otros PII) se almacenan cifrados desde la capa de aplicación.
-- Implementación: src/lib/crypto.ts (core) + src/lib/payment-methods/crypto.ts.
-- Clave: env var PAYMENT_ENCRYPTION_KEY (256-bit hex).
-- Cada seller puede registrar hasta 3 métodos de pago para recibir sus comisiones.
-- Un registro por método por usuario (UNIQUE user_id + method_type).
-- Los campos específicos varían según el método:
--   - binance: Transferencia USDC a Binance (ID de Binance + código QR)
--   - airtm: Transferencia ACH a cuenta virtual US de Airtm (routing, account, etc.)
--   - bank_qr: Pago por QR bancario boliviano (banco, CI, cuenta, imagen QR)
-- El seller gestiona sus propios métodos; admin/owner pueden ver y gestionar todos.
-- ==============================================================================
CREATE TABLE public.seller_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL
        CHECK (method_type IN ('binance', 'airtm', 'bank_qr')),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    tutorial_url TEXT CHECK (tutorial_url IS NULL OR length(tutorial_url) <= 500),

    -- CIFRADO: Todos los campos financieros se almacenan cifrados (AES-256-GCM)
    -- desde la capa de aplicación (src/lib/payment-methods/crypto.ts).
    -- Formato almacenado: base64(iv[12] || authTag[16] || ciphertext).
    -- La validación de formato/valores se realiza ANTES del cifrado en la aplicación.
    -- Los CHECK de longitud acomodan el overhead del cifrado (~37 bytes + base64).

    -- Binance: retiro por ID de Binance y código QR
    binance_id TEXT CHECK (binance_id IS NULL OR length(binance_id) <= 512),
    binance_qr_image_url TEXT CHECK (binance_qr_image_url IS NULL OR length(binance_qr_image_url) <= 2048),

    -- Airtm ACH: transferencia a cuenta virtual US del seller
    ach_account_holder TEXT CHECK (ach_account_holder IS NULL OR length(ach_account_holder) <= 512),
    ach_routing_number TEXT CHECK (ach_routing_number IS NULL OR length(ach_routing_number) <= 512),
    ach_account_number TEXT CHECK (ach_account_number IS NULL OR length(ach_account_number) <= 512),
    ach_bank_name TEXT CHECK (ach_bank_name IS NULL OR length(ach_bank_name) <= 512),
    ach_account_type TEXT CHECK (ach_account_type IS NULL OR length(ach_account_type) <= 512),

    -- QR Bancario Boliviano: pago por transferencia QR a banco en Bolivia
    qr_bank_name TEXT CHECK (qr_bank_name IS NULL OR length(qr_bank_name) <= 512),
    qr_account_holder TEXT CHECK (qr_account_holder IS NULL OR length(qr_account_holder) <= 512),
    qr_ci_number TEXT CHECK (qr_ci_number IS NULL OR length(qr_ci_number) <= 512),
    qr_account_number TEXT CHECK (qr_account_number IS NULL OR length(qr_account_number) <= 512),
    qr_image_url TEXT CHECK (qr_image_url IS NULL OR length(qr_image_url) <= 2048),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT one_method_per_user UNIQUE (user_id, method_type),
    CONSTRAINT chk_binance_fields CHECK (
        (method_type = 'binance'
            AND binance_id IS NOT NULL
            AND ach_account_holder IS NULL
            AND ach_routing_number IS NULL
            AND ach_account_number IS NULL
            AND ach_bank_name IS NULL
            AND ach_account_type IS NULL
            AND qr_bank_name IS NULL
            AND qr_account_holder IS NULL
            AND qr_ci_number IS NULL
            AND qr_account_number IS NULL
            AND qr_image_url IS NULL)
        OR method_type != 'binance'
    ),
    CONSTRAINT chk_airtm_fields CHECK (
        (method_type = 'airtm'
            AND ach_account_holder IS NOT NULL
            AND ach_routing_number IS NOT NULL
            AND ach_account_number IS NOT NULL
            AND ach_bank_name IS NOT NULL
            AND ach_account_type IS NOT NULL
            AND binance_id IS NULL
            AND binance_qr_image_url IS NULL
            AND qr_bank_name IS NULL
            AND qr_account_holder IS NULL
            AND qr_ci_number IS NULL
            AND qr_account_number IS NULL
            AND qr_image_url IS NULL)
        OR method_type != 'airtm'
    ),
    CONSTRAINT chk_bank_qr_fields CHECK (
        (method_type = 'bank_qr'
            AND qr_bank_name IS NOT NULL
            AND qr_account_holder IS NOT NULL
            AND qr_ci_number IS NOT NULL
            AND binance_id IS NULL
            AND binance_qr_image_url IS NULL
            AND ach_account_holder IS NULL
            AND ach_routing_number IS NULL
            AND ach_account_number IS NULL
            AND ach_bank_name IS NULL
            AND ach_account_type IS NULL)
        OR method_type != 'bank_qr'
    )
);

-- No se crea índice en (user_id): el UNIQUE constraint one_method_per_user(user_id, method_type)
-- ya genera un índice con user_id como columna líder, cubriendo consultas filtradas por user_id.
CREATE UNIQUE INDEX idx_seller_pm_one_default
    ON public.seller_payment_methods(user_id) WHERE is_default = TRUE;

CREATE TRIGGER update_seller_pm_updated_at
    BEFORE UPDATE ON public.seller_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Gestión del método de pago predeterminado:
-- INSERT: primer método se marca como default automáticamente; si se marca otro, quita el anterior.
-- UPDATE: al marcar un método como default, quita el anterior automáticamente.
--         No se permite quitar is_default manualmente (debe marcarse otro como default).
-- DELETE: no se permite eliminar el método predeterminado. El usuario debe primero
--         marcar otro método como default y luego eliminar el anterior.
--         Patrón estándar de la industria (Stripe, PayPal, Amazon Pay).
CREATE OR REPLACE FUNCTION public.manage_default_payment_method()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT COUNT(*) INTO existing_count
        FROM public.seller_payment_methods
        WHERE user_id = NEW.user_id AND id != NEW.id;

        IF existing_count = 0 THEN
            NEW.is_default := TRUE;
        END IF;

        IF NEW.is_default = TRUE THEN
            UPDATE public.seller_payment_methods
            SET is_default = FALSE
            WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = TRUE;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_default = TRUE AND NEW.is_default = FALSE THEN
            RAISE EXCEPTION 'No se puede quitar el predeterminado manualmente. Marque otro método como predeterminado primero.';
        END IF;

        IF NEW.is_default = TRUE AND OLD.is_default = FALSE THEN
            UPDATE public.seller_payment_methods
            SET is_default = FALSE
            WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = TRUE;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manage_default_pm
    BEFORE INSERT OR UPDATE ON public.seller_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.manage_default_payment_method();

-- Impedir eliminar el método de pago predeterminado.
-- El usuario debe primero marcar otro método como default y luego eliminar este.
-- pg_trigger_depth() > 1 permite eliminación vía CASCADE (ej. al borrar un usuario),
-- donde todos los métodos del usuario se eliminan juntos y no aplica la restricción.
CREATE OR REPLACE FUNCTION public.prevent_default_pm_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD.is_default = TRUE AND pg_trigger_depth() <= 1 THEN
        RAISE EXCEPTION 'No se puede eliminar el método de pago predeterminado. Marque otro método como predeterminado primero.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_default_pm_delete_trigger
    BEFORE DELETE ON public.seller_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_default_pm_delete();

-- Impedir eliminar un método de pago si hay retiros pendientes que lo usan.
CREATE OR REPLACE FUNCTION public.prevent_pm_delete_with_pending_payouts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    pending_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pending_count
    FROM public.seller_payouts
    WHERE user_id = OLD.user_id
      AND payout_method = OLD.method_type
      AND status = 'pending';

    IF pending_count > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar este método de pago: tiene % retiro(s) pendiente(s)', pending_count;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_pm_delete_pending
    BEFORE DELETE ON public.seller_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_pm_delete_with_pending_payouts();

ALTER TABLE public.seller_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payment_methods FORCE ROW LEVEL SECURITY;

-- Sellers activos pueden ver sus propios métodos de pago
CREATE POLICY "seller_pm_select_own"
    ON public.seller_payment_methods FOR SELECT TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "seller_pm_insert_own"
    ON public.seller_payment_methods FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "seller_pm_update_own"
    ON public.seller_payment_methods FOR UPDATE TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    )
    WITH CHECK (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "seller_pm_delete_own"
    ON public.seller_payment_methods FOR DELETE TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "seller_pm_all_admin"
    ON public.seller_payment_methods FOR ALL TO authenticated
    USING (public.is_admin_or_owner());

-- ==============================================================================
-- 10. REGISTRO DE RETIROS A VENDEDORES
-- Registra los retiros solicitados y pagos realizados a sellers por sus comisiones.
-- Solo admin/owner pueden crear, cambiar estado o eliminar retiros.
-- Sellers pueden ver sus propios retiros (solo lectura).
-- Montos en centavos USD (la unidad mínima de la moneda).
-- El pago real se realiza en una plataforma externa; aquí se registra el estado.
--
-- FLUJO DE RETIROS:
-- 1. Admin crea retiro (status='pending') para un seller
-- 2. Admin realiza el pago en la plataforma externa
-- 3. Admin marca como 'completed' (paid_at se auto-establece)
-- 4. Si hay problema: admin puede cancelar ('cancelled') o rechazar ('rejected')
-- Transiciones válidas: pending → completed | cancelled | rejected
-- ==============================================================================
CREATE TABLE public.seller_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    stripe_account_id UUID REFERENCES public.stripe_accounts(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
    payout_method TEXT NOT NULL
        CHECK (payout_method IN ('binance', 'airtm', 'bank_qr')),
    platform_fee INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee >= 0 AND platform_fee <= amount),
    received_amount INTEGER NOT NULL
        GENERATED ALWAYS AS (amount - platform_fee) STORED,
    exchange_rate_bob NUMERIC(12,6) CHECK (exchange_rate_bob IS NULL OR exchange_rate_bob > 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'cancelled', 'rejected')),
    reference TEXT CHECK (reference IS NULL OR length(reference) <= 200),
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 500),
    paid_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payout_method_for_user
        FOREIGN KEY (user_id, payout_method)
        REFERENCES public.seller_payment_methods(user_id, method_type)
        ON DELETE RESTRICT
);

-- No se crea índice simple en (user_id): el compuesto idx_seller_payouts_user_status
-- (user_id, status) ya cubre consultas filtradas solo por user_id.
CREATE INDEX idx_seller_payouts_status ON public.seller_payouts(status);
CREATE INDEX idx_seller_payouts_paid_at ON public.seller_payouts(paid_at DESC);
CREATE INDEX idx_seller_payouts_created_by ON public.seller_payouts(created_by);
CREATE INDEX idx_seller_payouts_user_status ON public.seller_payouts(user_id, status);
CREATE INDEX idx_seller_payouts_account_status ON public.seller_payouts(stripe_account_id, status);
CREATE INDEX idx_seller_payouts_user_account_status
    ON public.seller_payouts(user_id, stripe_account_id, status);
CREATE INDEX idx_seller_payouts_user_account_paid
    ON public.seller_payouts(user_id, stripe_account_id, paid_at DESC);
CREATE INDEX idx_seller_payouts_user_completed
    ON public.seller_payouts(user_id, amount) WHERE status = 'completed';
CREATE INDEX idx_seller_payouts_user_pending
    ON public.seller_payouts(user_id, amount) WHERE status = 'pending';

CREATE TRIGGER update_seller_payouts_updated_at
    BEFORE UPDATE ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Prorratear retiros históricos sin cuenta: distribuye por peso de comisiones
-- disponibles por cuenta y fija stripe_account_id en la cuenta de mayor peso.
CREATE OR REPLACE FUNCTION public.prorate_historical_payouts_by_account()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    payout_rec RECORD;
    legacy_account_id UUID;
    dominant_account_id UUID;
    residual INTEGER;
    base_sum INTEGER;
    affected_count INTEGER := 0;
BEGIN
    SELECT public.get_legacy_stripe_account_id() INTO legacy_account_id;

    FOR payout_rec IN
        SELECT id, user_id, amount
        FROM public.seller_payouts
        WHERE stripe_account_id IS NULL
        ORDER BY created_at, id
    LOOP
        DELETE FROM public.seller_payout_allocations WHERE payout_id = payout_rec.id;

        WITH weights AS (
            SELECT
                st.stripe_account_id,
                SUM(ta.commission_amount)::INTEGER AS available_amount
            FROM public.transaction_assignments ta
            JOIN public.stripe_transactions st ON st.id = ta.stripe_transaction_id
            WHERE ta.user_id = payout_rec.user_id
              AND st.funds_available_at IS NOT NULL
              AND st.funds_available_at <= NOW()
            GROUP BY st.stripe_account_id
        ),
        totals AS (
            SELECT COALESCE(SUM(w.available_amount), 0)::INTEGER AS total_available
            FROM weights w
        ),
        base_alloc AS (
            SELECT
                w.stripe_account_id,
                FLOOR((payout_rec.amount::NUMERIC * w.available_amount::NUMERIC) / NULLIF(t.total_available, 0))::INTEGER AS allocated,
                w.available_amount
            FROM weights w
            CROSS JOIN totals t
            WHERE t.total_available > 0
        ),
        with_residual AS (
            SELECT
                b.stripe_account_id,
                b.allocated,
                b.available_amount,
                ROW_NUMBER() OVER (ORDER BY b.available_amount DESC, b.stripe_account_id) AS rn
            FROM base_alloc b
        )
        SELECT
            COALESCE(SUM(wr.allocated), 0)::INTEGER,
            (
                SELECT wr2.stripe_account_id
                FROM with_residual wr2
                ORDER BY wr2.rn
                LIMIT 1
            )
        INTO base_sum, dominant_account_id
        FROM with_residual wr;

        IF dominant_account_id IS NULL THEN
            dominant_account_id := legacy_account_id;
            INSERT INTO public.seller_payout_allocations (payout_id, stripe_account_id, allocated_amount)
            VALUES (payout_rec.id, dominant_account_id, payout_rec.amount);
        ELSE
            residual := payout_rec.amount - base_sum;

            INSERT INTO public.seller_payout_allocations (payout_id, stripe_account_id, allocated_amount)
            SELECT
                payout_rec.id,
                wr.stripe_account_id,
                CASE
                    WHEN wr.rn = 1 THEN wr.allocated + residual
                    ELSE wr.allocated
                END AS final_allocated
            FROM (
                SELECT
                    w.stripe_account_id,
                    FLOOR((payout_rec.amount::NUMERIC * w.available_amount::NUMERIC) / NULLIF(t.total_available, 0))::INTEGER AS allocated,
                    ROW_NUMBER() OVER (ORDER BY w.available_amount DESC, w.stripe_account_id) AS rn
                FROM (
                    SELECT
                        st.stripe_account_id,
                        SUM(ta.commission_amount)::INTEGER AS available_amount
                    FROM public.transaction_assignments ta
                    JOIN public.stripe_transactions st ON st.id = ta.stripe_transaction_id
                    WHERE ta.user_id = payout_rec.user_id
                      AND st.funds_available_at IS NOT NULL
                      AND st.funds_available_at <= NOW()
                    GROUP BY st.stripe_account_id
                ) w
                CROSS JOIN (
                    SELECT COALESCE(SUM(x.available_amount), 0)::INTEGER AS total_available
                    FROM (
                        SELECT
                            st.stripe_account_id,
                            SUM(ta.commission_amount)::INTEGER AS available_amount
                        FROM public.transaction_assignments ta
                        JOIN public.stripe_transactions st ON st.id = ta.stripe_transaction_id
                        WHERE ta.user_id = payout_rec.user_id
                          AND st.funds_available_at IS NOT NULL
                          AND st.funds_available_at <= NOW()
                        GROUP BY st.stripe_account_id
                    ) x
                ) t
                WHERE t.total_available > 0
            ) wr
            WHERE (CASE WHEN wr.rn = 1 THEN wr.allocated + residual ELSE wr.allocated END) > 0;
        END IF;

        UPDATE public.seller_payouts
        SET stripe_account_id = dominant_account_id
        WHERE id = payout_rec.id;

        affected_count := affected_count + 1;
    END LOOP;

    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_single_payout_allocation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    alloc_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER
    INTO alloc_count
    FROM public.seller_payout_allocations
    WHERE payout_id = NEW.id;

    IF alloc_count <= 1 THEN
        DELETE FROM public.seller_payout_allocations WHERE payout_id = NEW.id;
        INSERT INTO public.seller_payout_allocations (payout_id, stripe_account_id, allocated_amount)
        VALUES (NEW.id, NEW.stripe_account_id, NEW.amount);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_single_payout_allocation_insert
    AFTER INSERT ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_single_payout_allocation();

CREATE TRIGGER sync_single_payout_allocation_update
    AFTER UPDATE OF stripe_account_id, amount ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_single_payout_allocation();

-- Validar transiciones de estado en retiros y auto-establecer paid_at.
-- Solo se permiten: pending → completed, pending → cancelled, pending → rejected.
-- Al completarse, paid_at se establece automáticamente.
CREATE OR REPLACE FUNCTION public.validate_payout_status_transition()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status IN ('completed', 'cancelled', 'rejected') THEN
        IF NEW.status = 'completed' THEN
            NEW.paid_at := NOW();
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Transición de estado inválida para retiro: "%" → "%"', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payout_status_change
    BEFORE UPDATE OF status ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payout_status_transition();

-- Validar que el seller tenga el método de pago configurado y habilitado
-- antes de permitir crear un retiro con ese método.
CREATE OR REPLACE FUNCTION public.validate_payout_method_exists()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.seller_payment_methods
        WHERE user_id = NEW.user_id
          AND method_type = NEW.payout_method
          AND is_enabled = TRUE
        FOR UPDATE
    ) THEN
        RAISE EXCEPTION 'El seller no tiene el método de pago "%" configurado y habilitado', NEW.payout_method;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payout_method
    BEFORE INSERT ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payout_method_exists();

-- Validar que el monto del retiro no exceda el saldo disponible del seller.
-- Solo se consideran comisiones de transacciones cuyos fondos ya fueron liberados
-- por Stripe (funds_available_at IS NOT NULL AND funds_available_at <= NOW()).
-- Saldo disponible = comisiones con fondos liberados - (retiros completados + pendientes).
-- Advisory lock serializa creaciones concurrentes para el mismo seller.
CREATE OR REPLACE FUNCTION public.validate_payout_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    available_earned INTEGER;
    total_disbursed INTEGER;
    available_balance INTEGER;
BEGIN
    IF NEW.stripe_account_id IS NULL THEN
        RAISE EXCEPTION 'stripe_account_id es requerido para registrar retiros';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('payout_balance_' || NEW.user_id::text || '_' || NEW.stripe_account_id::text));

    SELECT COALESCE(SUM(ta.commission_amount), 0) INTO available_earned
    FROM public.transaction_assignments ta
    JOIN public.stripe_transactions st ON st.id = ta.stripe_transaction_id
    WHERE ta.user_id = NEW.user_id
      AND st.stripe_account_id = NEW.stripe_account_id
      AND st.funds_available_at IS NOT NULL
      AND st.funds_available_at <= NOW();

    SELECT COALESCE(SUM(allocated_amount), 0) INTO total_disbursed
    FROM public.seller_payout_allocations spa
    JOIN public.seller_payouts sp ON sp.id = spa.payout_id
    WHERE sp.user_id = NEW.user_id
      AND spa.stripe_account_id = NEW.stripe_account_id
      AND sp.status IN ('completed', 'pending');

    available_balance := available_earned - total_disbursed;

    IF NEW.amount > available_balance THEN
        RAISE EXCEPTION 'Saldo insuficiente: disponible = % centavos (solo fondos liberados), solicitado = % centavos',
            available_balance, NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payout_balance_trigger
    BEFORE INSERT ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payout_balance();

-- Solo admin/owner pueden modificar campos críticos de retiros.
-- amount, user_id, currency, created_by, created_at son inmutables después de creación.
CREATE OR REPLACE FUNCTION public.protect_payout_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
        RAISE EXCEPTION 'No se puede modificar el monto del retiro. Cancele y cree uno nuevo.';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'No se puede cambiar el destinatario del retiro';
    END IF;
    IF NEW.currency IS DISTINCT FROM OLD.currency THEN
        RAISE EXCEPTION 'No se puede modificar la moneda del retiro';
    END IF;
    IF NEW.payout_method IS DISTINCT FROM OLD.payout_method THEN
        RAISE EXCEPTION 'No se puede cambiar el método de retiro';
    END IF;
    IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN
        RAISE EXCEPTION 'No se puede cambiar la cuenta Stripe del retiro';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'No se puede modificar quién registró el retiro';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'No se puede modificar la fecha de creación';
    END IF;
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
        RAISE EXCEPTION 'paid_at se establece automáticamente al completar el retiro';
    END IF;
    IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee AND OLD.status != 'pending' THEN
        RAISE EXCEPTION 'No se puede modificar platform_fee en un retiro que no está pendiente';
    END IF;
    -- status: gestionado por validate_payout_status_change (transiciones válidas)
    -- platform_fee: editable por admin solo cuando el retiro está pendiente
    -- received_amount: columna generada (amount - platform_fee), se actualiza automáticamente
    -- notes, reference: editables por admin en cualquier momento
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_payout_fields
    BEFORE UPDATE ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_payout_fields();

ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts FORCE ROW LEVEL SECURITY;

-- Sellers activos pueden ver sus propios pagos
CREATE POLICY "payouts_select_own"
    ON public.seller_payouts FOR SELECT TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "payouts_select_admin"
    ON public.seller_payouts FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "payouts_insert_admin_or_owner"
    ON public.seller_payouts FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_owner()
        AND created_by = public.get_admin_user_id()
    );

CREATE POLICY "payouts_insert_seller_own"
    ON public.seller_payouts FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
        AND created_by = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "payouts_update_admin_or_owner"
    ON public.seller_payouts FOR UPDATE TO authenticated
    USING (public.is_admin_or_owner())
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "payouts_update_seller_own"
    ON public.seller_payouts FOR UPDATE TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    )
    WITH CHECK (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "payouts_delete_admin_or_owner"
    ON public.seller_payouts FOR DELETE TO authenticated
    USING (public.is_admin_or_owner());

CREATE POLICY "payouts_delete_seller_own"
    ON public.seller_payouts FOR DELETE TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

-- Backfill multi-cuenta para retiros históricos y constraint definitivo.
SELECT public.prorate_historical_payouts_by_account();

ALTER TABLE public.seller_payouts
    ALTER COLUMN stripe_account_id SET NOT NULL;

-- Actualizar seller_balance_summary al insertar, actualizar o eliminar retiros.
-- INSERT siempre crea con status='pending'.
-- UPDATE de status maneja las transiciones pending → completed/cancelled/rejected.
-- DELETE revierte según el status que tenía el retiro eliminado.
CREATE OR REPLACE FUNCTION public.update_summary_on_payout()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.recompute_user_balance_by_account(OLD.user_id);
        RETURN OLD;
    END IF;

    PERFORM public.recompute_user_balance_by_account(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_summary_on_payout
    AFTER INSERT OR UPDATE OR DELETE ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_summary_on_payout();

-- ==============================================================================
-- 11. RESUMEN INCREMENTAL DE SALDOS DE VENDEDORES (LEGADO/COMPATIBILIDAD)
-- Tabla desnormalizada que mantiene los saldos pre-calculados de cada seller.
-- Este objeto se mantiene por compatibilidad con consultas anteriores.
-- El modelo operativo principal para multi-cuenta es seller_balance_by_account
-- y sus vistas derivadas (seller_balances_by_account, seller_balances).
-- Actualizada atómicamente por triggers AFTER en transaction_assignments,
-- seller_payouts y stripe_transactions (funds_available_at).
-- Reemplaza las agregaciones costosas de la vista seller_balances original.
--
-- PRINCIPIO: Esta tabla optimiza LECTURAS del dashboard. Las validaciones
-- financieras críticas (validate_payout_balance, prevent_unclaim_with_payouts)
-- siguen leyendo de las tablas fuente como fuente de verdad autoritativa.
--
-- balance y available_for_payout son columnas GENERATED: siempre consistentes.
-- Funciones de mantenimiento periódico:
--   - release_available_funds(): mueve pending_earned → available_earned (hourly)
--   - reconcile_seller_balances(): recalcula desde tablas fuente (daily)
-- ==============================================================================
CREATE TABLE public.seller_balance_summary (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
    available_earned INTEGER NOT NULL DEFAULT 0 CHECK (available_earned >= 0),
    pending_earned INTEGER NOT NULL DEFAULT 0 CHECK (pending_earned >= 0),
    transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
    total_paid INTEGER NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
    completed_payout_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_payout_count >= 0),
    pending_payouts INTEGER NOT NULL DEFAULT 0 CHECK (pending_payouts >= 0),
    pending_payout_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_payout_count >= 0),
    balance INTEGER NOT NULL
        GENERATED ALWAYS AS (total_earned - total_paid) STORED,
    available_for_payout INTEGER NOT NULL
        GENERATED ALWAYS AS (GREATEST(available_earned - total_paid - pending_payouts, 0)) STORED,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_balance_summary_updated_at
    BEFORE UPDATE ON public.seller_balance_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.seller_balance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_balance_summary FORCE ROW LEVEL SECURITY;

-- Sellers activos pueden ver su propio resumen de saldo
CREATE POLICY "balance_summary_select_own"
    ON public.seller_balance_summary FOR SELECT TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

-- Admin/Owner pueden ver todos los resúmenes
CREATE POLICY "balance_summary_select_admin"
    ON public.seller_balance_summary FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

-- ==============================================================================
-- 11.1 RESUMEN DE SALDOS POR CUENTA STRIPE
-- Modelo financiero por (seller, stripe_account). Reemplaza la lógica global.
-- ==============================================================================
CREATE TABLE public.seller_balance_by_account (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_account_id UUID NOT NULL REFERENCES public.stripe_accounts(id) ON DELETE RESTRICT,
    total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
    available_earned INTEGER NOT NULL DEFAULT 0 CHECK (available_earned >= 0),
    pending_earned INTEGER NOT NULL DEFAULT 0 CHECK (pending_earned >= 0),
    transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
    total_paid INTEGER NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
    completed_payout_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_payout_count >= 0),
    pending_payouts INTEGER NOT NULL DEFAULT 0 CHECK (pending_payouts >= 0),
    pending_payout_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_payout_count >= 0),
    balance INTEGER NOT NULL
        GENERATED ALWAYS AS (total_earned - total_paid) STORED,
    available_for_payout INTEGER NOT NULL
        GENERATED ALWAYS AS (GREATEST(available_earned - total_paid - pending_payouts, 0)) STORED,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, stripe_account_id)
);

CREATE INDEX idx_seller_balance_by_account_account_user
    ON public.seller_balance_by_account(stripe_account_id, user_id);
CREATE INDEX idx_seller_balance_by_account_user_updated
    ON public.seller_balance_by_account(user_id, updated_at DESC);

CREATE TRIGGER update_balance_by_account_updated_at
    BEFORE UPDATE ON public.seller_balance_by_account
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.seller_balance_by_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_balance_by_account FORCE ROW LEVEL SECURITY;

CREATE POLICY "balance_by_account_select_own"
    ON public.seller_balance_by_account FOR SELECT TO authenticated
    USING (
        user_id = (
            SELECT u.id FROM public.users u
            WHERE u.auth_user_id = auth.uid()
            AND u.is_active = TRUE
        )
    );

CREATE POLICY "balance_by_account_select_admin"
    ON public.seller_balance_by_account FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

CREATE TABLE public.seller_payout_allocations (
    payout_id UUID NOT NULL REFERENCES public.seller_payouts(id) ON DELETE CASCADE,
    stripe_account_id UUID NOT NULL REFERENCES public.stripe_accounts(id) ON DELETE RESTRICT,
    allocated_amount INTEGER NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (payout_id, stripe_account_id)
);

CREATE INDEX idx_payout_allocations_account ON public.seller_payout_allocations(stripe_account_id);

ALTER TABLE public.seller_payout_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payout_allocations FORCE ROW LEVEL SECURITY;

CREATE POLICY "payout_allocations_select_own"
    ON public.seller_payout_allocations FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.seller_payouts sp
            JOIN public.users u ON u.id = sp.user_id
            WHERE sp.id = payout_id
              AND u.auth_user_id = auth.uid()
              AND u.is_active = TRUE
        )
    );

CREATE POLICY "payout_allocations_select_admin"
    ON public.seller_payout_allocations FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

CREATE OR REPLACE FUNCTION public.recompute_user_balance_by_account(target_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    DELETE FROM public.seller_balance_by_account
    WHERE user_id = target_user_id;

    WITH earned AS (
        SELECT
            ta.user_id,
            st.stripe_account_id,
            SUM(ta.commission_amount)::INTEGER AS total_earned,
            COALESCE(SUM(ta.commission_amount) FILTER (
                WHERE st.funds_available_at IS NOT NULL AND st.funds_available_at <= NOW()
            ), 0)::INTEGER AS available_earned,
            COALESCE(SUM(ta.commission_amount) FILTER (
                WHERE st.funds_available_at IS NULL OR st.funds_available_at > NOW()
            ), 0)::INTEGER AS pending_earned,
            COUNT(*)::INTEGER AS transaction_count
        FROM public.transaction_assignments ta
        JOIN public.stripe_transactions st ON st.id = ta.stripe_transaction_id
        WHERE ta.user_id = target_user_id
        GROUP BY ta.user_id, st.stripe_account_id
    ),
    payouts_allocated AS (
        SELECT
            sp.user_id,
            spa.stripe_account_id,
            SUM(spa.allocated_amount) FILTER (WHERE sp.status = 'completed')::INTEGER AS completed_amount,
            COUNT(*) FILTER (WHERE sp.status = 'completed')::INTEGER AS completed_count,
            SUM(spa.allocated_amount) FILTER (WHERE sp.status = 'pending')::INTEGER AS pending_amount,
            COUNT(*) FILTER (WHERE sp.status = 'pending')::INTEGER AS pending_count
        FROM public.seller_payouts sp
        JOIN public.seller_payout_allocations spa ON spa.payout_id = sp.id
        WHERE sp.user_id = target_user_id
        GROUP BY sp.user_id, spa.stripe_account_id
    ),
    payouts_direct AS (
        SELECT
            sp.user_id,
            sp.stripe_account_id,
            SUM(sp.amount) FILTER (WHERE sp.status = 'completed')::INTEGER AS completed_amount,
            COUNT(*) FILTER (WHERE sp.status = 'completed')::INTEGER AS completed_count,
            SUM(sp.amount) FILTER (WHERE sp.status = 'pending')::INTEGER AS pending_amount,
            COUNT(*) FILTER (WHERE sp.status = 'pending')::INTEGER AS pending_count
        FROM public.seller_payouts sp
        WHERE sp.user_id = target_user_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.seller_payout_allocations spa
            WHERE spa.payout_id = sp.id
          )
        GROUP BY sp.user_id, sp.stripe_account_id
    ),
    payouts AS (
        SELECT
            p.user_id,
            p.stripe_account_id,
            COALESCE(SUM(p.completed_amount), 0)::INTEGER AS total_paid,
            COALESCE(SUM(p.completed_count), 0)::INTEGER AS completed_payout_count,
            COALESCE(SUM(p.pending_amount), 0)::INTEGER AS pending_payouts,
            COALESCE(SUM(p.pending_count), 0)::INTEGER AS pending_payout_count
        FROM (
            SELECT * FROM payouts_allocated
            UNION ALL
            SELECT * FROM payouts_direct
        ) p
        GROUP BY p.user_id, p.stripe_account_id
    ),
    merged AS (
        SELECT
            COALESCE(e.user_id, p.user_id) AS user_id,
            COALESCE(e.stripe_account_id, p.stripe_account_id) AS stripe_account_id,
            COALESCE(e.total_earned, 0) AS total_earned,
            COALESCE(e.available_earned, 0) AS available_earned,
            COALESCE(e.pending_earned, 0) AS pending_earned,
            COALESCE(e.transaction_count, 0) AS transaction_count,
            COALESCE(p.total_paid, 0) AS total_paid,
            COALESCE(p.completed_payout_count, 0) AS completed_payout_count,
            COALESCE(p.pending_payouts, 0) AS pending_payouts,
            COALESCE(p.pending_payout_count, 0) AS pending_payout_count
        FROM earned e
        FULL OUTER JOIN payouts p
          ON p.user_id = e.user_id
         AND p.stripe_account_id = e.stripe_account_id
    )
    INSERT INTO public.seller_balance_by_account (
        user_id,
        stripe_account_id,
        total_earned,
        available_earned,
        pending_earned,
        transaction_count,
        total_paid,
        completed_payout_count,
        pending_payouts,
        pending_payout_count
    )
    SELECT
        m.user_id,
        m.stripe_account_id,
        m.total_earned,
        m.available_earned,
        m.pending_earned,
        m.transaction_count,
        m.total_paid,
        m.completed_payout_count,
        m.pending_payouts,
        m.pending_payout_count
    FROM merged m;
END;
$$ LANGUAGE plpgsql;

-- NOTA: No se agrega trigger de auditoría en seller_balance_summary.
-- Las operaciones incrementales (claim, payout, funds release) ya están auditadas
-- en sus tablas fuente (transaction_assignments, seller_payouts, stripe_transactions).
-- Las correcciones por reconciliación se registran directamente en audit_log
-- desde la función reconcile_seller_balances() con actor_email='system:reconciliation'.

-- ==============================================================================
-- 12. AUDIT TRAIL
-- Registra operaciones sensibles para compliance y respuesta a incidentes.
-- Cubre: cambios de rol, desactivación de usuarios, gestión de invitaciones,
-- y asignaciones de transacciones.
-- La tabla usa SECURITY DEFINER para que los triggers puedan escribir
-- independientemente de los permisos del usuario que dispara la acción.
--
-- PARTICIONAMIENTO MENSUAL por created_at (PARTITION BY RANGE).
-- PK compuesta (id, created_at) requerida por PostgreSQL para tablas particionadas.
-- Particiones creadas automáticamente por create_future_audit_partitions() + pg_cron.
-- Horizonte: mes actual + 5 futuros (6 meses). Si pg_cron falla, la partición
-- DEFAULT captura datos; al reactivarse, la función migra filas automáticamente.
-- Archivado: DROP TABLE audit_log_YYYY_MM (instantáneo, sin bloqueo).
-- ==============================================================================
CREATE TABLE public.audit_log (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL CHECK (length(table_name) <= 100),
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    actor_auth_id UUID,
    actor_email TEXT CHECK (actor_email IS NULL OR length(actor_email) <= 320),
    changes JSONB CHECK (changes IS NULL OR pg_column_size(changes) <= 102400),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE public.audit_log_default PARTITION OF public.audit_log DEFAULT;

CREATE INDEX idx_audit_log_table_date ON public.audit_log(table_name, created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_auth_id, created_at DESC);
CREATE INDEX idx_audit_log_record ON public.audit_log(record_id, created_at DESC);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin"
    ON public.audit_log FOR SELECT TO authenticated
    USING (public.is_admin_or_owner());

CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    audit_changes JSONB := '{}'::jsonb;
    actor_id UUID;
    actor_mail TEXT;
    audit_record_id UUID;
BEGIN
    BEGIN
        actor_id := auth.uid();
        SELECT email INTO actor_mail FROM public.users WHERE auth_user_id = actor_id;
    EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
        actor_id := NULL;
        actor_mail := NULL;
    END;

    IF TG_TABLE_NAME = 'seller_balance_by_account' THEN
        IF TG_OP = 'DELETE' THEN
            audit_record_id := OLD.user_id;
        ELSE
            audit_record_id := NEW.user_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        audit_record_id := OLD.id;
    ELSE
        audit_record_id := NEW.id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'seller_payment_methods' THEN
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'DELETE', actor_id, actor_mail,
                jsonb_build_object('deleted_record', jsonb_build_object(
                    'id', OLD.id, 'user_id', OLD.user_id, 'method_type', OLD.method_type,
                    'is_enabled', OLD.is_enabled, 'is_default', OLD.is_default
                )));
        ELSIF TG_TABLE_NAME = 'seller_balance_by_account' THEN
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'DELETE', actor_id, actor_mail,
                jsonb_build_object('deleted_record', jsonb_build_object(
                    'user_id', OLD.user_id,
                    'stripe_account_id', OLD.stripe_account_id
                )));
        ELSE
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'DELETE', actor_id, actor_mail,
                jsonb_build_object('deleted_record', jsonb_build_object(
                    'record_id', audit_record_id
                )));
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'users' THEN
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'INSERT', actor_id, actor_mail,
                jsonb_build_object('new_record', jsonb_build_object(
                    'id', NEW.id, 'email', NEW.email, 'role_id', NEW.role_id,
                    'invited_by', NEW.invited_by, 'is_active', NEW.is_active
                )));
        ELSIF TG_TABLE_NAME = 'seller_payment_methods' THEN
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'INSERT', actor_id, actor_mail,
                jsonb_build_object('new_record', jsonb_build_object(
                    'id', NEW.id, 'user_id', NEW.user_id, 'method_type', NEW.method_type,
                    'is_enabled', NEW.is_enabled, 'is_default', NEW.is_default
                )));
        ELSIF TG_TABLE_NAME = 'seller_balance_by_account' THEN
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'INSERT', actor_id, actor_mail,
                jsonb_build_object('new_record', jsonb_build_object(
                    'user_id', NEW.user_id,
                    'stripe_account_id', NEW.stripe_account_id
                )));
        ELSE
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'INSERT', actor_id, actor_mail,
                jsonb_build_object('new_record', jsonb_build_object(
                    'record_id', audit_record_id
                )));
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'users' THEN
            IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
                audit_changes := audit_changes || jsonb_build_object('role_id', jsonb_build_object('old', OLD.role_id, 'new', NEW.role_id));
            END IF;
            IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
                audit_changes := audit_changes || jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
            END IF;
            IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN
                audit_changes := audit_changes || jsonb_build_object('onboarding_completed', jsonb_build_object('old', OLD.onboarding_completed, 'new', NEW.onboarding_completed));
            END IF;
            IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
                audit_changes := audit_changes || jsonb_build_object('commission_rate', jsonb_build_object('old', OLD.commission_rate, 'new', NEW.commission_rate));
            END IF;
        ELSIF TG_TABLE_NAME = 'invitations' THEN
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                audit_changes := audit_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
            END IF;
        ELSIF TG_TABLE_NAME = 'transaction_assignments' THEN
            IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
                audit_changes := audit_changes || jsonb_build_object('user_id', jsonb_build_object('old', OLD.user_id, 'new', NEW.user_id));
            END IF;
            IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
                audit_changes := audit_changes || jsonb_build_object('commission_rate', jsonb_build_object('old', OLD.commission_rate, 'new', NEW.commission_rate));
            END IF;
        ELSIF TG_TABLE_NAME = 'seller_payouts' THEN
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                audit_changes := audit_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
            END IF;
            IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN
                audit_changes := audit_changes || jsonb_build_object('platform_fee', jsonb_build_object('old', OLD.platform_fee, 'new', NEW.platform_fee));
            END IF;
            IF NEW.notes IS DISTINCT FROM OLD.notes THEN
                audit_changes := audit_changes || jsonb_build_object('notes', jsonb_build_object('old', OLD.notes, 'new', NEW.notes));
            END IF;
            IF NEW.reference IS DISTINCT FROM OLD.reference THEN
                audit_changes := audit_changes || jsonb_build_object('reference', jsonb_build_object('old', OLD.reference, 'new', NEW.reference));
            END IF;
        ELSIF TG_TABLE_NAME = 'seller_payment_methods' THEN
            IF NEW.is_enabled IS DISTINCT FROM OLD.is_enabled THEN
                audit_changes := audit_changes || jsonb_build_object('is_enabled', jsonb_build_object('old', OLD.is_enabled, 'new', NEW.is_enabled));
            END IF;
            IF NEW.is_default IS DISTINCT FROM OLD.is_default THEN
                audit_changes := audit_changes || jsonb_build_object('is_default', jsonb_build_object('old', OLD.is_default, 'new', NEW.is_default));
            END IF;
            IF NEW.binance_id IS DISTINCT FROM OLD.binance_id THEN
                audit_changes := audit_changes || jsonb_build_object('binance_id', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.ach_account_number IS DISTINCT FROM OLD.ach_account_number THEN
                audit_changes := audit_changes || jsonb_build_object('ach_account_number', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.ach_routing_number IS DISTINCT FROM OLD.ach_routing_number THEN
                audit_changes := audit_changes || jsonb_build_object('ach_routing_number', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.binance_qr_image_url IS DISTINCT FROM OLD.binance_qr_image_url THEN
                audit_changes := audit_changes || jsonb_build_object('binance_qr_image_url', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.qr_ci_number IS DISTINCT FROM OLD.qr_ci_number THEN
                audit_changes := audit_changes || jsonb_build_object('qr_ci_number', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
        ELSIF TG_TABLE_NAME = 'stripe_transactions' THEN
            IF NEW.stripe_status IS DISTINCT FROM OLD.stripe_status THEN
                audit_changes := audit_changes || jsonb_build_object('stripe_status', jsonb_build_object('old', OLD.stripe_status, 'new', NEW.stripe_status));
            END IF;
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                audit_changes := audit_changes || jsonb_build_object('amount', jsonb_build_object('old', OLD.amount, 'new', NEW.amount));
            END IF;
            IF NEW.stripe_fee IS DISTINCT FROM OLD.stripe_fee THEN
                audit_changes := audit_changes || jsonb_build_object('stripe_fee', jsonb_build_object('old', OLD.stripe_fee, 'new', NEW.stripe_fee));
            END IF;
            IF NEW.net_amount IS DISTINCT FROM OLD.net_amount THEN
                audit_changes := audit_changes || jsonb_build_object('net_amount', jsonb_build_object('old', OLD.net_amount, 'new', NEW.net_amount));
            END IF;
            IF NEW.customer_email IS DISTINCT FROM OLD.customer_email THEN
                audit_changes := audit_changes || jsonb_build_object('customer_email', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.customer_name IS DISTINCT FROM OLD.customer_name THEN
                audit_changes := audit_changes || jsonb_build_object('customer_name', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.description IS DISTINCT FROM OLD.description THEN
                audit_changes := audit_changes || jsonb_build_object('description', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.payment_method_type IS DISTINCT FROM OLD.payment_method_type THEN
                audit_changes := audit_changes || jsonb_build_object('payment_method_type', jsonb_build_object('old', OLD.payment_method_type, 'new', NEW.payment_method_type));
            END IF;
            IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
                audit_changes := audit_changes || jsonb_build_object('metadata', jsonb_build_object('old', 'REDACTED', 'new', 'REDACTED'));
            END IF;
            IF NEW.funds_available_at IS DISTINCT FROM OLD.funds_available_at THEN
                audit_changes := audit_changes || jsonb_build_object('funds_available_at', jsonb_build_object('old', OLD.funds_available_at, 'new', NEW.funds_available_at));
            END IF;
        ELSIF TG_TABLE_NAME = 'stripe_accounts' THEN
            IF NEW.stripe_account_external_id IS DISTINCT FROM OLD.stripe_account_external_id THEN
                audit_changes := audit_changes || jsonb_build_object('stripe_account_external_id', jsonb_build_object('old', OLD.stripe_account_external_id, 'new', NEW.stripe_account_external_id));
            END IF;
            IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
                audit_changes := audit_changes || jsonb_build_object('display_name', jsonb_build_object('old', OLD.display_name, 'new', NEW.display_name));
            END IF;
            IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
                audit_changes := audit_changes || jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
            END IF;
        ELSIF TG_TABLE_NAME = 'seller_balance_by_account' THEN
            IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
                audit_changes := audit_changes || jsonb_build_object('total_earned', jsonb_build_object('old', OLD.total_earned, 'new', NEW.total_earned));
            END IF;
            IF NEW.available_earned IS DISTINCT FROM OLD.available_earned THEN
                audit_changes := audit_changes || jsonb_build_object('available_earned', jsonb_build_object('old', OLD.available_earned, 'new', NEW.available_earned));
            END IF;
            IF NEW.pending_earned IS DISTINCT FROM OLD.pending_earned THEN
                audit_changes := audit_changes || jsonb_build_object('pending_earned', jsonb_build_object('old', OLD.pending_earned, 'new', NEW.pending_earned));
            END IF;
            IF NEW.total_paid IS DISTINCT FROM OLD.total_paid THEN
                audit_changes := audit_changes || jsonb_build_object('total_paid', jsonb_build_object('old', OLD.total_paid, 'new', NEW.total_paid));
            END IF;
            IF NEW.pending_payouts IS DISTINCT FROM OLD.pending_payouts THEN
                audit_changes := audit_changes || jsonb_build_object('pending_payouts', jsonb_build_object('old', OLD.pending_payouts, 'new', NEW.pending_payouts));
            END IF;
        ELSIF TG_TABLE_NAME = 'roles' THEN
            IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
                audit_changes := audit_changes || jsonb_build_object('permissions', jsonb_build_object('old', OLD.permissions, 'new', NEW.permissions));
            END IF;
            IF NEW.hierarchy_level IS DISTINCT FROM OLD.hierarchy_level THEN
                audit_changes := audit_changes || jsonb_build_object('hierarchy_level', jsonb_build_object('old', OLD.hierarchy_level, 'new', NEW.hierarchy_level));
            END IF;
            IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
                audit_changes := audit_changes || jsonb_build_object('display_name', jsonb_build_object('old', OLD.display_name, 'new', NEW.display_name));
            END IF;
        END IF;

        IF audit_changes != '{}'::jsonb THEN
            INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
            VALUES (TG_TABLE_NAME, audit_record_id, 'UPDATE', actor_id, actor_mail, audit_changes);
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_invitations_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_tx_assignments_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.transaction_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_seller_payouts_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.seller_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_seller_balance_by_account_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.seller_balance_by_account
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_seller_pm_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.seller_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_stripe_accounts_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_stripe_tx_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.stripe_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_roles_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_table_changes();

-- ==============================================================================
-- 13. VISTA DE SALDO DE VENDEDORES
-- seller_balances_by_account: detalle por cuenta Stripe.
-- seller_balances: agregado global derivado de la vista por cuenta (compatibilidad).
-- ==============================================================================
CREATE OR REPLACE VIEW public.seller_balances_by_account
WITH (security_invoker = true)
AS
SELECT
    u.id AS user_id,
    u.auth_user_id,
    u.email,
    u.full_name,
    sba.stripe_account_id,
    sa.stripe_account_external_id,
    sa.display_name AS stripe_account_display_name,
    u.commission_rate AS current_commission_rate,
    sba.total_earned,
    sba.available_earned,
    sba.pending_earned,
    sba.transaction_count,
    sba.total_paid,
    sba.completed_payout_count,
    sba.pending_payouts,
    sba.pending_payout_count,
    sba.balance,
    sba.available_for_payout
FROM public.users u
INNER JOIN public.roles r ON r.id = u.role_id AND r.role_name IN ('seller', 'admin', 'owner')
INNER JOIN public.seller_balance_by_account sba ON sba.user_id = u.id
INNER JOIN public.stripe_accounts sa ON sa.id = sba.stripe_account_id;

CREATE OR REPLACE VIEW public.seller_balances
WITH (security_invoker = true)
AS
SELECT
    s.user_id,
    s.auth_user_id,
    s.email,
    s.full_name,
    s.current_commission_rate,
    SUM(s.total_earned)::INTEGER AS total_earned,
    SUM(s.available_earned)::INTEGER AS available_earned,
    SUM(s.pending_earned)::INTEGER AS pending_earned,
    SUM(s.transaction_count)::INTEGER AS transaction_count,
    SUM(s.total_paid)::INTEGER AS total_paid,
    SUM(s.completed_payout_count)::INTEGER AS completed_payout_count,
    SUM(s.pending_payouts)::INTEGER AS pending_payouts,
    SUM(s.pending_payout_count)::INTEGER AS pending_payout_count,
    SUM(s.balance)::INTEGER AS balance,
    SUM(s.available_for_payout)::INTEGER AS available_for_payout
FROM public.seller_balances_by_account s
GROUP BY
    s.user_id,
    s.auth_user_id,
    s.email,
    s.full_name,
    s.current_commission_rate;

-- Documentación nativa visible en Supabase Studio, pgAdmin y \dt+
COMMENT ON TABLE public.roles IS 'Roles del sistema (RBAC). Controla permisos y acceso al dashboard.';
COMMENT ON TABLE public.users IS 'Perfiles de usuario. Extiende auth.users con rol, comisión y preferencias.';
COMMENT ON TABLE public.invitations IS 'Invitaciones para nuevos usuarios. Flujo: pending → accepted/expired/revoked.';
COMMENT ON TABLE public.stripe_accounts IS 'Catálogo de cuentas Stripe conectadas en single-tenant (multi-cuenta).';
COMMENT ON TABLE public.stripe_transactions IS 'Transacciones sincronizadas desde Stripe (webhooks/API). Montos en centavos USD.';
COMMENT ON TABLE public.transaction_assignments IS 'Vincula transacciones con el vendedor que las realizó. Una transacción = un seller.';
COMMENT ON TABLE public.seller_payment_methods IS 'Métodos de pago de sellers (binance, airtm, bank_qr). Campos financieros cifrados AES-256-GCM.';
COMMENT ON TABLE public.seller_payouts IS 'Retiros/pagos a sellers por comisiones. Flujo: pending → completed/cancelled/rejected.';
COMMENT ON TABLE public.seller_balance_summary IS 'Saldos pre-calculados por seller (legado/compatibilidad). Para multi-cuenta usar seller_balance_by_account y vistas derivadas.';
COMMENT ON TABLE public.seller_balance_by_account IS 'Saldos pre-calculados por seller y cuenta Stripe.';
COMMENT ON TABLE public.audit_log IS 'Registro de auditoría particionado por mes (pg_cron). Cubre cambios en usuarios, roles, transacciones, retiros y métodos de pago.';

-- ==============================================================================
-- 14. MANTENIMIENTO AUTOMATIZADO
-- ==============================================================================

-- Crear particiones mensuales futuras para audit_log.
-- Genera particiones para el mes actual y los próximos 5 meses (horizonte de 6 meses).
-- Idempotente: verifica existencia antes de crear. Retorna cantidad de particiones creadas.
-- Si la partición DEFAULT contiene filas que caen en el rango de una nueva partición,
-- desacopla DEFAULT, crea la partición, migra las filas afectadas y re-acopla DEFAULT.
-- Esto previene el error "default partition would be violated" tras fallos prolongados de pg_cron.
-- Ejecutar manualmente: SELECT public.create_future_audit_partitions();
-- Automatizado con pg_cron (ver sección 17).
CREATE OR REPLACE FUNCTION public.create_future_audit_partitions()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    month_start DATE;
    month_end DATE;
    partition_name TEXT;
    created_count INTEGER := 0;
    conflicting_rows INTEGER;
    i INTEGER;
    default_detached BOOLEAN;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Acceso denegado: solo admin/owner o service_role';
    END IF;

    -- Evita ejecuciones concurrentes de mantenimiento de particiones.
    PERFORM pg_advisory_xact_lock(hashtext('audit_log_partitions_maintenance'));
    LOCK TABLE public.audit_log IN ACCESS EXCLUSIVE MODE;

    FOR i IN 0..5 LOOP
        month_start := date_trunc('month', NOW() + (i || ' months')::INTERVAL)::DATE;
        month_end := (month_start + INTERVAL '1 month')::DATE;
        partition_name := 'audit_log_' || to_char(month_start, 'YYYY_MM');

        IF EXISTS (
            SELECT 1 FROM pg_catalog.pg_class
            WHERE relname = partition_name
            AND relnamespace = 'public'::regnamespace
        ) THEN
            CONTINUE;
        END IF;

        SELECT COUNT(*) INTO conflicting_rows
        FROM public.audit_log_default
        WHERE created_at >= month_start AND created_at < month_end;

        IF conflicting_rows > 0 THEN
            default_detached := FALSE;
            BEGIN
                ALTER TABLE public.audit_log DETACH PARTITION public.audit_log_default;
                default_detached := TRUE;

                EXECUTE format(
                    'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
                    partition_name, month_start, month_end
                );

                EXECUTE format(
                    'INSERT INTO public.%I SELECT * FROM public.audit_log_default WHERE created_at >= %L AND created_at < %L',
                    partition_name, month_start, month_end
                );

                DELETE FROM public.audit_log_default
                WHERE created_at >= month_start AND created_at < month_end;

                ALTER TABLE public.audit_log ATTACH PARTITION public.audit_log_default DEFAULT;
                default_detached := FALSE;
            EXCEPTION WHEN OTHERS THEN
                IF default_detached THEN
                    BEGIN
                        ALTER TABLE public.audit_log ATTACH PARTITION public.audit_log_default DEFAULT;
                    EXCEPTION WHEN OTHERS THEN
                        RAISE EXCEPTION 'Error crítico: no se pudo re-adjuntar audit_log_default tras fallo creando "%": %',
                            partition_name, SQLERRM;
                    END;
                END IF;
                RAISE EXCEPTION 'Error creando partición "%" para rango [% - %): %',
                    partition_name, month_start, month_end, SQLERRM;
            END;
        ELSE
            EXECUTE format(
                'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
                partition_name, month_start, month_end
            );
        END IF;

        created_count := created_count + 1;
    END LOOP;

    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- Elimina particiones mensuales antiguas del audit_log, conservando una ventana
-- deslizante de N meses (incluyendo el mes actual). No toca la partición DEFAULT.
-- Ejemplo: retain_months = 6 conserva mes actual + 5 meses previos.
-- Ejecutar manualmente: SELECT public.drop_old_audit_partitions(6);
CREATE OR REPLACE FUNCTION public.drop_old_audit_partitions(retain_months INTEGER DEFAULT 6)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    cutoff_month DATE;
    current_month DATE;
    dropped_count INTEGER := 0;
    part RECORD;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Acceso denegado: solo admin/owner o service_role';
    END IF;

    IF retain_months < 1 THEN
        RAISE EXCEPTION 'retain_months debe ser >= 1';
    END IF;

    current_month := date_trunc('month', NOW())::DATE;
    cutoff_month := (
        current_month - ((retain_months - 1) || ' months')::INTERVAL
    )::DATE;

    FOR part IN
        SELECT
            c.relname AS partition_name,
            to_date(substring(c.relname FROM 'audit_log_(\d{4}_\d{2})$'), 'YYYY_MM')::DATE AS partition_month
        FROM pg_catalog.pg_inherits i
        JOIN pg_catalog.pg_class p ON p.oid = i.inhparent
        JOIN pg_catalog.pg_namespace pn ON pn.oid = p.relnamespace
        JOIN pg_catalog.pg_class c ON c.oid = i.inhrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE pn.nspname = 'public'
          AND p.relname = 'audit_log'
          AND n.nspname = 'public'
          AND c.relname ~ '^audit_log_[0-9]{4}_[0-9]{2}$'
        ORDER BY partition_month
    LOOP
        IF part.partition_month IS NULL THEN
            RAISE EXCEPTION 'Nombre de partición inválido para audit_log: %', part.partition_name;
        END IF;

        -- Guardrail 1: nunca eliminar mes actual o futuros.
        IF part.partition_month >= current_month THEN
            CONTINUE;
        END IF;

        -- Guardrail 2: eliminar solo fuera de la ventana de retención.
        IF part.partition_month < cutoff_month THEN
            EXECUTE format('DROP TABLE IF EXISTS public.%I', part.partition_name);
            dropped_count := dropped_count + 1;
        END IF;
    END LOOP;

    RETURN dropped_count;
END;
$$ LANGUAGE plpgsql;

-- Crear particiones iniciales (mes actual + 5 futuros)
SELECT public.create_future_audit_partitions();

-- Marca como 'expired' las invitaciones cuyo expires_at haya pasado.
-- Ejecutar manualmente: SELECT public.expire_pending_invitations();
-- Automatizado: pg_cron job 'expire-invitations' (sección 17).
CREATE OR REPLACE FUNCTION public.expire_pending_invitations()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.invitations
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Liberar fondos que se volvieron disponibles con el paso del tiempo.
-- Cuando una transacción tiene funds_available_at en el futuro al momento de la
-- asignación, la comisión se contabiliza como pending_earned. Esta función mueve
-- esas comisiones a available_earned una vez que funds_available_at <= NOW().
-- Ejecutar manualmente: SELECT public.release_available_funds();
-- Automatizado: pg_cron job 'release-available-funds' (sección 17).
CREATE OR REPLACE FUNCTION public.release_available_funds()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    refreshed_users INTEGER := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Acceso denegado: solo admin/owner o service_role';
    END IF;

    SELECT public.reconcile_seller_balances() INTO refreshed_users;
    RETURN refreshed_users;
END;
$$ LANGUAGE plpgsql;

-- Reconcilia seller_balance_summary con las tablas fuente.
-- Recalcula los 8 contadores desde cero y corrige discrepancias.
-- Retorna el número de filas corregidas. Registra discrepancias en audit_log.
-- Ejecutar manualmente: SELECT public.reconcile_seller_balances();
-- Automatizado: pg_cron job 'reconcile-balances' (sección 17).
CREATE OR REPLACE FUNCTION public.reconcile_seller_balances()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    corrected_count INTEGER := 0;
    user_rec RECORD;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Acceso denegado: solo admin/owner o service_role';
    END IF;

    FOR user_rec IN
        SELECT DISTINCT user_id
        FROM (
            SELECT ta.user_id FROM public.transaction_assignments ta
            UNION
            SELECT sp.user_id FROM public.seller_payouts sp
        ) u
    LOOP
        PERFORM public.recompute_user_balance_by_account(user_rec.user_id);
        INSERT INTO public.audit_log (table_name, record_id, action, actor_auth_id, actor_email, changes)
        VALUES (
            'seller_balance_by_account',
            user_rec.user_id,
            'UPDATE',
            NULL,
            'system:reconciliation',
            jsonb_build_object('reconciliation', TRUE, 'scope', 'by_account')
        );
        corrected_count := corrected_count + 1;
    END LOOP;

    RETURN corrected_count;
END;
$$ LANGUAGE plpgsql;

-- Inicializa seller_balance_summary para usuarios existentes.
-- Ejecutar UNA VEZ después de crear la tabla y los triggers, para poblar
-- los saldos de usuarios que ya existían antes de la migración.
-- Ejecutar manualmente: SELECT public.initialize_seller_balances();
CREATE OR REPLACE FUNCTION public.initialize_seller_balances()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    initialized_count INTEGER;
    user_rec RECORD;
BEGIN
    initialized_count := 0;
    FOR user_rec IN SELECT u.id AS user_id FROM public.users u LOOP
        PERFORM public.recompute_user_balance_by_account(user_rec.user_id);
        initialized_count := initialized_count + 1;
    END LOOP;
    RETURN initialized_count;
END;
$$ LANGUAGE plpgsql;

-- Health check operativo para auditoría:
-- - cobertura de particiones futuras (mes actual + 5)
-- - backlog en audit_log_default
-- - estado reciente de jobs de cron relevantes
-- Ejecutar manualmente: SELECT public.audit_log_health();
CREATE OR REPLACE FUNCTION public.audit_log_health()
RETURNS JSONB
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    current_month DATE := date_trunc('month', NOW())::DATE;
    existing_partitions TEXT[];
    expected_partitions TEXT[];
    missing_future_partitions TEXT[];
    backlog_count BIGINT;
    backlog_oldest TIMESTAMPTZ;
    backlog_newest TIMESTAMPTZ;
    cron_status JSONB;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Acceso denegado: solo admin/owner o service_role';
    END IF;

    SELECT COALESCE(array_agg(c.relname ORDER BY c.relname), ARRAY[]::TEXT[])
    INTO existing_partitions
    FROM pg_catalog.pg_inherits i
    JOIN pg_catalog.pg_class p ON p.oid = i.inhparent
    JOIN pg_catalog.pg_namespace pn ON pn.oid = p.relnamespace
    JOIN pg_catalog.pg_class c ON c.oid = i.inhrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE pn.nspname = 'public'
      AND p.relname = 'audit_log'
      AND n.nspname = 'public'
      AND c.relname ~ '^audit_log_[0-9]{4}_[0-9]{2}$';

    SELECT array_agg(
        'audit_log_' || to_char((current_month + (m || ' months')::INTERVAL)::DATE, 'YYYY_MM')
        ORDER BY m
    )
    INTO expected_partitions
    FROM generate_series(0, 5) AS m;

    SELECT COALESCE(array_agg(partition_name ORDER BY partition_name), ARRAY[]::TEXT[])
    INTO missing_future_partitions
    FROM unnest(expected_partitions) AS partition_name
    WHERE NOT (partition_name = ANY (existing_partitions));

    SELECT COUNT(*), MIN(created_at), MAX(created_at)
    INTO backlog_count, backlog_oldest, backlog_newest
    FROM public.audit_log_default;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'jobname', j.jobname,
                'schedule', j.schedule,
                'active', j.active,
                'last_run_status', d.status,
                'last_run_start', d.start_time,
                'last_run_end', d.end_time,
                'last_return_message', d.return_message
            )
            ORDER BY j.jobname
        ),
        '[]'::jsonb
    )
    INTO cron_status
    FROM cron.job j
    LEFT JOIN LATERAL (
        SELECT
            d.status,
            d.start_time,
            d.end_time,
            d.return_message
        FROM cron.job_run_details d
        WHERE d.jobid = j.jobid
        ORDER BY d.start_time DESC
        LIMIT 1
    ) d ON TRUE
    WHERE j.jobname IN (
        'create-audit-partitions',
        'prune-audit-partitions',
        'expire-invitations',
        'release-available-funds',
        'reconcile-balances'
    );

    RETURN jsonb_build_object(
        'generated_at', NOW(),
        'expected_future_partitions', to_jsonb(expected_partitions),
        'existing_monthly_partitions', to_jsonb(existing_partitions),
        'missing_future_partitions', to_jsonb(missing_future_partitions),
        'default_partition_backlog', jsonb_build_object(
            'row_count', backlog_count,
            'oldest_created_at', backlog_oldest,
            'newest_created_at', backlog_newest
        ),
        'cron_jobs', cron_status
    );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 15. STORAGE: BUCKET PARA IMÁGENES DE QR BANCARIO
-- Bucket privado para almacenar las imágenes de códigos QR bancarios de los sellers.
-- Las imágenes se organizan por auth_user_id: payment-qr/{auth_uid}/{timestamp}.{ext}
-- Se acceden mediante signed URLs para proteger datos financieros sensibles.
-- Límite: 2MB por archivo. Formatos permitidos: JPEG, PNG, WebP.
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-qr',
    'payment-qr',
    false,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_qr_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment-qr'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_active_seller_or_above()
);

CREATE POLICY "storage_qr_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payment-qr'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_active_seller_or_above()
);

CREATE POLICY "storage_qr_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'payment-qr'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_active_seller_or_above()
)
WITH CHECK (
    bucket_id = 'payment-qr'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_active_seller_or_above()
);

CREATE POLICY "storage_qr_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'payment-qr'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_active_seller_or_above()
);

-- Admins/owners: ver todos los QR para verificar al procesar retiros
CREATE POLICY "storage_qr_select_admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payment-qr'
    AND public.is_admin_or_owner()
);

-- Admins/owners: subir QR en nombre de cualquier seller (registro administrativo)
CREATE POLICY "storage_qr_insert_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment-qr'
    AND public.is_admin_or_owner()
);

-- Admins/owners: actualizar QR de cualquier seller (reemplazo administrativo)
CREATE POLICY "storage_qr_update_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'payment-qr'
    AND public.is_admin_or_owner()
);

-- Admins/owners: eliminar QR de cualquier seller (limpieza administrativa)
CREATE POLICY "storage_qr_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'payment-qr'
    AND public.is_admin_or_owner()
);

-- ==============================================================================
-- 16. PERMISOS EXPLÍCITOS (REVOKE / GRANT)
-- Defensa en profundidad: RLS controla *qué filas* ve cada usuario, pero los
-- GRANTs controlan *qué operaciones* puede intentar cada rol de Supabase.
-- Sin estos REVOKEs, si alguien desactiva RLS en una tabla por error,
-- anon y authenticated tendrían acceso irrestricto.
--
-- anon: sin acceso a ninguna tabla (todo requiere autenticación).
-- authenticated: solo las operaciones que las políticas RLS permiten.
-- service_role: bypasea RLS (usado por webhooks y funciones de mantenimiento).
--
-- Funciones de mantenimiento (cron/admin): solo ejecutables por service_role.
-- Funciones helper RLS + get_team_members(): ejecutables por authenticated
-- (necesarias para que las políticas RLS y RPCs funcionen).
-- ==============================================================================

-- Revocar permisos por defecto en tablas
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Revocar permisos por defecto en funciones
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Evitar creación de objetos en schema public por roles no privilegiados
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Aplicar lo mismo a tablas/funciones creadas en el futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;

-- ── Tablas: GRANTs a authenticated ──────────────────────────────────────────
-- Cada GRANT habilita la operación a nivel de tabla; las políticas RLS
-- filtran las filas accesibles según el rol del usuario.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT SELECT, UPDATE, DELETE         ON public.users TO authenticated;
-- No INSERT en users: los perfiles se crean exclusivamente via handle_new_user()
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.stripe_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_payment_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.seller_payouts TO authenticated;
GRANT SELECT                         ON public.seller_payout_allocations TO authenticated;
GRANT SELECT                         ON public.seller_balance_summary TO authenticated;
GRANT SELECT                         ON public.seller_balance_by_account TO authenticated;
GRANT SELECT                         ON public.audit_log TO authenticated;
GRANT SELECT                         ON public.seller_balances TO authenticated;
GRANT SELECT                         ON public.seller_balances_by_account TO authenticated;
GRANT SELECT                         ON public.stripe_transactions_safe TO authenticated;

-- Minimización de datos: campos sensibles de Stripe no se exponen a authenticated.
REVOKE SELECT (customer_email, customer_name, description, metadata)
ON public.stripe_transactions FROM authenticated;

-- ── Funciones: GRANTs a authenticated ───────────────────────────────────────
-- Helper RLS (requeridas para que las políticas funcionen)
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_seller_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_dashboard_user() TO authenticated;

-- RPC pública
GRANT EXECUTE ON FUNCTION public.get_team_members() TO authenticated;

-- ── Funciones de mantenimiento: solo service_role ───────────────────────────
-- (Ya revocadas de anon/authenticated arriba; service_role bypasea permisos)
-- expire_pending_invitations(), release_available_funds(),
-- reconcile_seller_balances(), initialize_seller_balances(),
-- create_future_audit_partitions(), drop_old_audit_partitions(),
-- audit_log_health()

-- ==============================================================================
-- 17. JOBS AUTOMATIZADOS (pg_cron)
-- Requiere: CREATE EXTENSION pg_cron (sección 1).
-- pg_cron ejecuta con permisos de superusuario; no necesita GRANTs adicionales.
-- Verificar estado: SELECT * FROM cron.job;
-- Ver historial: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
-- ==============================================================================

-- Crear particiones mensuales del audit_log (horizonte: mes actual + 5 futuros)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'create-audit-partitions';

SELECT cron.schedule(
    'create-audit-partitions',
    '0 0 1 * *',
    $$SELECT public.create_future_audit_partitions()$$
);

-- Limpiar particiones antiguas del audit_log (retención: 6 meses incluyendo actual)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'prune-audit-partitions';

SELECT cron.schedule(
    'prune-audit-partitions',
    '30 3 * * *',
    $$SELECT public.drop_old_audit_partitions(6)$$
);

-- Expirar invitaciones pendientes cuyo plazo haya vencido
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'expire-invitations';

SELECT cron.schedule(
    'expire-invitations',
    '0 * * * *',
    $$SELECT public.expire_pending_invitations()$$
);

-- Liberar fondos: mover pending_earned → available_earned cuando funds_available_at llega
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'release-available-funds';

SELECT cron.schedule(
    'release-available-funds',
    '0 * * * *',
    $$SELECT public.release_available_funds()$$
);

-- Reconciliar saldos de sellers: recalcular desde tablas fuente y corregir discrepancias
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'reconcile-balances';

SELECT cron.schedule(
    'reconcile-balances',
    '0 3 * * *',
    $$SELECT public.reconcile_seller_balances()$$
);

-- ==============================================================================
-- 17.5 RUNBOOK DE MIGRACIÓN (MULTI-CUENTA STRIPE)
-- Orden recomendado al migrar una base existente:
-- 1) Crear public.stripe_accounts + políticas.
-- 2) Insertar cuentas iniciales: acct_jnode y acct_vascruz.
-- 3) Agregar stripe_account_id en stripe_transactions (nullable).
-- 4) Backfill de stripe_account_id con cuenta default (acct_jnode).
-- 5) Imponer NOT NULL en stripe_account_id.
-- 6) Cambiar unicidad a (stripe_account_id, stripe_id).
-- 7) Crear índices por cuenta y actualizar vista stripe_transactions_safe.
-- 8) Ajustar GRANT/RLS y trigger de auditoría para stripe_accounts.
--
-- Rollback de emergencia (parcial):
-- - Mantener respaldo lógico previo al cambio de unicidad.
-- - Restaurar UNIQUE(stripe_id) si fuera necesario.
-- - No eliminar registros de stripe_accounts; marcar is_active = FALSE.
-- ==============================================================================

-- ==============================================================================
-- 18. RUNBOOK OPERATIVO (CONSULTAS SOLO LECTURA)
-- Estas consultas son referencia para soporte/diagnóstico y NO se ejecutan
-- automáticamente por este script.
-- ==============================================================================

-- 18.1 Últimos eventos de auditoría por tabla
-- SELECT table_name, action, actor_email, created_at, changes
-- FROM public.audit_log
-- ORDER BY created_at DESC
-- LIMIT 100;

-- 18.2 Actividad de un actor específico (últimas 24h)
-- SELECT table_name, action, record_id, created_at, changes
-- FROM public.audit_log
-- WHERE actor_auth_id = '<uuid-del-actor>'
--   AND created_at >= NOW() - INTERVAL '24 hours'
-- ORDER BY created_at DESC;

-- 18.3 Estado de particiones y backlog
-- SELECT public.audit_log_health();

-- 18.4 Estado de jobs de cron
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- ORDER BY jobname;

-- 18.5 Historial reciente de ejecuciones cron
-- SELECT jobid, status, start_time, end_time, return_message
-- FROM cron.job_run_details
-- ORDER BY start_time DESC
-- LIMIT 50;

-- 18.6 Verificar cobertura esperada de particiones (mes actual + 5 futuros)
-- WITH expected AS (
--   SELECT 'audit_log_' || to_char((date_trunc('month', NOW()) + (g || ' months')::INTERVAL)::DATE, 'YYYY_MM') AS partition_name
--   FROM generate_series(0, 5) AS g
-- )
-- SELECT e.partition_name AS missing_partition
-- FROM expected e
-- LEFT JOIN pg_catalog.pg_class c ON c.relname = e.partition_name
-- LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
-- WHERE c.oid IS NULL OR n.nspname <> 'public';

-- 18.7 Verificar que no faltan particiones dentro de la ventana de retención (6 meses)
-- WITH retention_window AS (
--   SELECT 'audit_log_' || to_char((date_trunc('month', NOW()) - (g || ' months')::INTERVAL)::DATE, 'YYYY_MM') AS partition_name
--   FROM generate_series(0, 5) AS g
-- )
-- SELECT r.partition_name AS missing_in_retention_window
-- FROM retention_window r
-- LEFT JOIN pg_catalog.pg_class c ON c.relname = r.partition_name
-- LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
-- WHERE c.oid IS NULL OR n.nspname <> 'public';

-- 18.8 Detectar posibles ejecuciones solapadas o colas en cron
-- SELECT j.jobname, d.status, d.start_time, d.end_time
-- FROM cron.job j
-- JOIN cron.job_run_details d ON d.jobid = j.jobid
-- WHERE j.jobname IN ('create-audit-partitions', 'prune-audit-partitions')
-- ORDER BY d.start_time DESC
-- LIMIT 30;
