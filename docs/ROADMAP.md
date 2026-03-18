# Roadmap: De Schema a Produccion

Guia paso a paso para implementar todas las funcionalidades del sistema y llegar a produccion.
Cada fase incluye los archivos a crear/modificar, comandos a ejecutar y criterios de aceptacion.

---

## Estado Actual

| Componente                                                   | Estado    |
| ------------------------------------------------------------ | --------- |
| Schema SQL (7 tablas + audit + vista + storage)              | Completo  |
| Auth pages (login, signup, forgot-password, update-password) | Completo  |
| Middleware (rutas protegidas, sesion)                        | Completo  |
| Hooks de auth (useSignIn, useSignUp, useSignOut, etc.)       | Completo  |
| Permisos RBAC (`src/lib/auth/permissions.ts`)                | Completo  |
| Cifrado AES-256-GCM (`src/lib/crypto.ts`)                    | Completo  |
| Settings pages (profile, account, security, etc.)            | Completo  |
| Componentes UI (shadcn/ui)                                   | Completo  |
| Team management table (con mock data)                        | Parcial   |
| Database types (`database.types.ts`)                         | Pendiente |
| Onboarding flow                                              | Pendiente |
| Invitaciones de equipo                                       | Pendiente |
| Integracion de cobros (SDK + webhooks)                       | Pendiente |
| UI de transacciones y asignaciones                           | Pendiente |
| Metodos de pago de sellers                                   | Pendiente |
| Retiros (payouts)                                            | Pendiente |
| Dashboard con datos reales                                   | Pendiente |
| Testing, CI/CD, deploy                                       | Pendiente |

---

## Estandar de Queries Grandes (obligatorio para modulos nuevos)

Este roadmap define una estrategia dual para listas de alto volumen:

1. **Query list paginada (tabla):** filtros + sorting + paginacion clasica (`page`, `pageSize` o cursor).
2. **Query infinita (`useInfiniteQuery`):** para UX tipo scroll infinito o carga incremental.

### Reglas de implementacion

- **Sesion/cookies:** los hooks cliente no leen cookies manualmente; la autenticacion se resuelve server-side en API routes con Supabase SSR y cookies HTTP-only.
- **Permisos por usuario:** toda consulta/mutacion valida permisos en el servidor (RBAC + RLS). La UI puede ocultar acciones, pero la autorizacion final siempre vive en backend.
- **Paginacion por defecto:** para listas potencialmente grandes, usar paginacion por cursor estable (recomendado) o `range` con limite estricto.
- **Limites y filtros:** toda lista debe soportar filtros y limite maximo para evitar lecturas completas.
- **Keys de React Query:** incluir parametros de filtros/sort/paginacion en `queryKey` para cache correcto.

### Criterio de aceptacion

- Existe hook de tabla paginada y hook infinito para el mismo dominio cuando aplique.
- Las consultas grandes no hacen `select *` sin limites en cliente.
- Las respuestas incluyen metadatos de paginacion (`nextCursor` o equivalente).
- Se verifica acceso por rol en servidor para cada endpoint de datos.

---

## Fase 0: Fundacion

> Prerequisito para todo lo demas. Sin tipos generados, toda interaccion con Supabase carece de type-safety.

### 0.1 Generar tipos de Supabase

Project_Id: zpvijrtcpdyrcxbwjtoa

**Comando:**

```bash
npx supabase gen types typescript --project-id zpvijrtcpdyrcxbwjtoa > src/types/database.types.ts
```

**Archivos a modificar:**

| Archivo                        | Cambio                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `src/types/database.types.ts`  | Crear (output del comando)                                    |
| `src/lib/supabase/client.ts`   | Tipar `createBrowserClient` con `Database`                    |
| `src/lib/supabase/server.ts`   | Tipar `createServerClient` con `Database`                     |
| `src/lib/auth/require-user.ts` | Reemplazar tipos inline `UserProfile` por los tipos generados |

**Ejemplo de tipado del cliente:**

```typescript
import { Database } from "@/types/database.types";

// En client.ts
export function createClient() {
  const { url, key } = validateEnvVars();
  return createBrowserClient<Database>(url, key);
}

// En server.ts
export async function createClient() {
  const { url, key } = validateEnvVars();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, { cookies: { ... } });
}
```

**Script para `package.json`:**

```json
{
  "scripts": {
    "db:types": "npx supabase gen types typescript --project-id $PROJECT_ID > src/types/database.types.ts"
  }
}
```

**Criterio de aceptacion:** `npm run build` pasa sin errores de tipo. Las queries a Supabase tienen autocompletado de tablas y columnas.

---

### 0.2 Conectar Team management a datos reales

**Contexto:** `src/app/settings/team/` usa mock data de `src/lib/mock-data.ts`.

**Archivos a modificar:**

| Archivo                                 | Cambio                                                              |
| --------------------------------------- | ------------------------------------------------------------------- |
| `src/app/settings/team/team-client.tsx` | Reemplazar `MOCK_USERS`/`MOCK_ROLES` por queries a Supabase         |
| `src/app/settings/team/team-table.tsx`  | Adaptar tipos a los datos reales de `public.users` + `public.roles` |

**Query principal:**

```typescript
const { data: users } = await supabase
  .from("users")
  .select(
    `
    id, auth_user_id, email, full_name, phone, avatar_url,
    is_active, onboarding_completed, commission_rate,
    created_at, updated_at,
    roles:role_id (id, role_name, display_name)
  `,
  )
  .order("created_at", { ascending: false });
```

**Politicas RLS activas:** `users_select_all_admin` permite a admin/owner ver todos los perfiles. `users_select_own_profile` permite a cada usuario ver el suyo.

**Criterio de aceptacion:** La tabla de equipo muestra usuarios reales de la base de datos. Los filtros de rol y estado funcionan. Solo admin/owner pueden ver la lista completa.

---

## Fase 1: Auth Completo (Onboarding + Invitaciones)

> El schema exige que todo usuario nuevo pase por onboarding (`onboarding_completed = FALSE` al crearse).

### 1.1 Pagina de Onboarding

**Contexto del schema:** El trigger `handle_new_user()` crea el perfil con `onboarding_completed = FALSE`. La app debe:

1. Redirigir a onboarding si `onboarding_completed = FALSE`
2. Recoger datos personales (nombre, telefono, avatar)
3. Marcar onboarding como completado
4. Marcar la invitacion como `accepted`

**Archivos a crear:**

| Archivo                                  | Proposito                                    |
| ---------------------------------------- | -------------------------------------------- |
| `src/app/onboarding/page.tsx`            | Pagina del formulario de onboarding          |
| `src/app/onboarding/onboarding-form.tsx` | Componente del formulario (client component) |
| `src/hooks/auth/use-onboarding.ts`       | Hook para completar onboarding               |

**Archivos a modificar:**

| Archivo                          | Cambio                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/supabase/middleware.ts` | Agregar redireccion a `/onboarding` si el usuario esta autenticado pero `onboarding_completed = FALSE` |

**Logica del middleware:**

```
Usuario autenticado
  └─> Consultar public.users.onboarding_completed
      └─> FALSE y ruta != /onboarding → Redirigir a /onboarding
      └─> TRUE → Continuar normalmente
```

**Operaciones al completar onboarding:**

```typescript
// 1. Actualizar perfil del usuario
await supabase
  .from("users")
  .update({
    full_name: data.fullName,
    phone: data.phone,
    onboarding_completed: true,
  })
  .eq("auth_user_id", user.id);

// 2. Marcar invitacion como aceptada
await supabase
  .from("invitations")
  .update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
  })
  .eq("email", user.email)
  .eq("status", "pending");
```

**Triggers que protegen:** `prevent_privilege_escalation` permite cambiar `onboarding_completed` de `FALSE` a `TRUE` (no al reves).

**Criterio de aceptacion:** Un usuario nuevo que confirma su email es redirigido a `/onboarding`. Al completar el formulario, `onboarding_completed` se marca como `TRUE` y la invitacion pasa a `accepted`. El usuario es redirigido al dashboard segun su rol.

---

### 1.2 Pagina de Invitacion de Equipo

**Contexto del schema:** El trigger `a_validate_invitation_before_insert` valida la invitacion (limpia huerfanos, verifica duplicados). El trigger `b_rate_limit_invitations_trigger` limita a 20 invitaciones por hora por admin.

**Archivos a crear:**

| Archivo                                        | Proposito                                                  |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `src/app/settings/team/invite/page.tsx`        | Pagina de invitacion                                       |
| `src/app/settings/team/invite/invite-form.tsx` | Formulario: email + selector de rol                        |
| `src/lib/supabase/admin.ts`                    | Cliente Supabase con `service_role` para operaciones admin |

**Variable de entorno requerida:**

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Flujo de invitacion (server action):**

```
1. Admin completa formulario (email + rol)
2. Server action:
   a. INSERT INTO public.invitations (email, role_id, invited_by)
      → Triggers validan automaticamente
   b. supabase.auth.admin.inviteUserByEmail(email, { redirectTo })
      → Supabase envia email de invitacion
3. Usuario recibe email → confirma → handle_new_user() crea perfil
4. Redirigido a /onboarding (Fase 1.1)
```

**Proteccion:** `requirePermission(Permission.MANAGE_USERS)` en la pagina. Politica RLS `invitations_insert_admin` valida que `invited_by = get_admin_user_id()`.

**Criterio de aceptacion:** Admin puede invitar usuarios con un rol especifico. El email se envia correctamente. Las validaciones del schema (duplicados, rate-limit, re-invitacion) funcionan y muestran errores claros.

---

### 1.3 Pagina de Detalle/Edicion de Miembro

**Archivos a crear:**

| Archivo                                        | Proposito                       |
| ---------------------------------------------- | ------------------------------- |
| `src/app/settings/team/[id]/page.tsx`          | Pagina de detalle del miembro   |
| `src/app/settings/team/[id]/member-detail.tsx` | Componente con datos y acciones |

**Datos a mostrar:**

- Informacion personal: nombre, email, telefono, avatar
- Rol actual (selector para cambiar)
- Estado: activo/inactivo (toggle)
- Tasa de comision (input numerico)
- Fecha de registro, ultima actualizacion
- Estado de onboarding

**Acciones de admin:**

| Accion             | Query                                  | Trigger que protege                                           |
| ------------------ | -------------------------------------- | ------------------------------------------------------------- |
| Cambiar rol        | `UPDATE users SET role_id = ?`         | `prevent_privilege_escalation` (admin no puede asignar owner) |
| Activar/Desactivar | `UPDATE users SET is_active = ?`       | `protect_last_owner` (ultimo owner no se puede desactivar)    |
| Cambiar comision   | `UPDATE users SET commission_rate = ?` | Solo admin/owner pueden cambiar                               |

**Criterio de aceptacion:** Admin puede ver y editar los datos de cualquier miembro. Los triggers del schema protegen contra operaciones invalidas (ej. degradar ultimo owner). Los errores de la DB se muestran como mensajes claros al usuario.

---

## Fase 2: Integracion de Cobros (Core del Negocio)

> Sin la integracion de cobros, la tabla `stripe_transactions` permanece vacia y todo el flujo de comisiones no funciona.

### 2.1 Instalar SDK de cobros y configurar

**Comando:**

```bash
npm install stripe
```

**Variables de entorno a agregar en `.env.example`:**

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Archivo a crear:**

| Archivo                    | Proposito                                      |
| -------------------------- | ---------------------------------------------- |
| `src/lib/stripe/client.ts` | Instancia del SDK de cobros (server-side only) |

**Contenido de `src/lib/stripe/client.ts`:**

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia", // usar la version mas reciente
  typescript: true,
});
```

**Criterio de aceptacion:** El SDK de cobros esta instalado y configurado. El cliente solo se importa en codigo server-side. El build pasa sin errores.

---

### 2.2 Webhook de cobros

**Archivo a crear:**

| Archivo                                | Proposito                      |
| -------------------------------------- | ------------------------------ |
| `src/app/api/webhooks/stripe/route.ts` | Receptor de webhooks de cobros |

**Eventos a manejar:**

| Evento de cobros                | `transaction_type` | Prefijo `stripe_id` |
| ------------------------------- | ------------------ | ------------------- |
| `payment_intent.succeeded`      | `payment_intent`   | `pi_`               |
| `charge.succeeded`              | `charge`           | `ch_`               |
| `checkout.session.completed`    | `checkout_session` | `cs_`               |
| `invoice.paid`                  | `invoice`          | `in_`               |
| `customer.subscription.created` | `subscription`     | `sub_`              |

**Estructura del handler:**

```
1. Leer body raw (no parsear JSON, la pasarela necesita el body crudo)
2. Verificar firma: stripe.webhooks.constructEvent(body, sig, secret)
3. Extraer datos segun tipo de evento
4. Mapear al formato de stripe_transactions:
   - stripe_id, transaction_type, stripe_status
   - amount (centavos), stripe_fee, net_amount (amount - fee)
   - customer_email, customer_name, stripe_customer_id
   - payment_method_type, description, metadata, stripe_created_at
5. Upsert en stripe_transactions (idempotencia por stripe_id)
6. Responder 200 OK
```

**Importante:** Usar Supabase con `service_role` key (bypasea RLS). El schema lo contempla:

```sql
-- (linea 801 del schema.sql)
-- en produccion, los webhooks usan service_role que bypasea RLS
```

**Constraint critico:** `chk_stripe_id_type_match` valida que el prefijo de `stripe_id` coincida con `transaction_type`. Si el mapeo es incorrecto, la insercion falla.

**Idempotencia:** `stripe_id` tiene constraint UNIQUE. Usar upsert (`onConflict: 'stripe_id'`) para manejar re-entregas de webhooks sin duplicados.

**Criterio de aceptacion:** El webhook recibe eventos de cobros, verifica la firma, y los inserta correctamente en `stripe_transactions`. Re-entregas no causan duplicados. Eventos desconocidos se ignoran con 200 OK.

---

### 2.3 Sync manual / backfill

**Archivos a crear:**

| Archivo                            | Proposito                            |
| ---------------------------------- | ------------------------------------ |
| `src/app/api/stripe/sync/route.ts` | API route para sincronizacion manual |

**Flujo:**

```
1. Admin presiona boton "Sincronizar" en el dashboard
2. POST /api/stripe/sync
3. Server-side:
   a. Verificar que el caller es admin/owner
   b. Llamar a stripe.paymentIntents.list({ limit: 100 })
   c. Para cada payment intent con status 'succeeded':
      - Obtener charge asociado para el fee
      - Mapear al formato de stripe_transactions
      - Upsert en la tabla
   d. Repetir con paginacion (starting_after)
4. Responder con count de transacciones sincronizadas
```

**Criterio de aceptacion:** Un admin puede sincronizar transacciones historicas de cobros. Las transacciones existentes se actualizan (upsert). El proceso es idempotente.

---

## Fase 3: UI de Transacciones y Asignaciones

### 3.1 Listado de Transacciones

**Archivos a crear:**

| Archivo                                       | Proposito                           |
| --------------------------------------------- | ----------------------------------- |
| `src/app/transactions/page.tsx`               | Pagina principal de transacciones   |
| `src/app/transactions/transactions-table.tsx` | Tabla con filtros                   |
| `src/hooks/use-transactions-list.ts`          | Hook `useQuery` para tabla paginada |
| `src/hooks/use-infinite-transactions.ts`      | Hook `useInfiniteQuery` para scroll |
| `src/app/api/transactions/route.ts`           | Endpoint server-side con filtros y paginacion |

**Estrategia de consulta (obligatoria):**

- **Modo A - Tabla paginada (`useQuery`):**
  - parametros: `status`, `type`, `from`, `to`, `search`, `sortBy`, `sortDir`, `page`, `pageSize`
  - respuesta: `items`, `total`, `page`, `pageSize`
- **Modo B - Infinita (`useInfiniteQuery`):**
  - parametros: `status`, `type`, `from`, `to`, `search`, `sortBy`, `sortDir`, `cursor`, `limit`
  - respuesta: `items`, `nextCursor`

**Query base (server-side):**

```typescript
const { data } = await supabase
  .from("stripe_transactions")
  .select(
    `
    *,
    transaction_assignments (
      id, user_id, commission_amount, notes,
      users:user_id (full_name, email)
    )
  `,
  )
  .order("stripe_created_at", { ascending: false })
  .limit(pageSize);
```

> Nota: Para listas muy grandes, evitar offset profundo. Preferir cursor sobre `stripe_created_at` + `id` para estabilidad.

**Columnas de la tabla:**

| Columna    | Campo                                          |
| ---------- | ---------------------------------------------- |
| Fecha      | `stripe_created_at`                            |
| ID Cobro   | `stripe_id` (truncado)                         |
| Tipo       | `transaction_type` (badge con color)           |
| Cliente    | `customer_name` o `customer_email`             |
| Monto      | `amount` (formateado como USD)                 |
| Fee de cobro | `stripe_fee`                                 |
| Neto       | `net_amount`                                   |
| Estado     | `stripe_status` (badge)                        |
| Asignada   | Si/No (con nombre del seller si esta asignada) |

**Filtros:** tipo, estado, rango de fechas, busqueda por cliente.

**Indices que optimizan:** `idx_stripe_tx_type`, `idx_stripe_tx_status`, `idx_stripe_tx_created`, `idx_stripe_tx_customer`.

**Politica RLS:** `stripe_tx_select_active_users` permite a todos los usuarios activos ver todas las transacciones.

**Permisos y sesion (obligatorio):**

- Endpoint en `src/app/api/transactions/route.ts` valida sesion con Supabase server client (cookies HTTP-only).
- Se aplica verificacion de rol/permiso en servidor antes de ejecutar consulta.
- El hook cliente nunca usa `service_role` ni maneja tokens manualmente.

**Criterio de aceptacion:** Todos los usuarios activos pueden ver la lista de transacciones. Los filtros funcionan. Se muestra claramente si una transaccion ya esta asignada.

---

### 3.2 Reclamacion de Ventas (Sellers)

**Archivos a crear:**

| Archivo                                 | Proposito                         |
| --------------------------------------- | --------------------------------- |
| `src/hooks/use-claim-transaction.ts`    | Hook para reclamar transacciones  |
| `src/app/transactions/claim-dialog.tsx` | Dialog de confirmacion de reclamo |

**Flujo de reclamacion:**

```
1. Seller ve transaccion no asignada → click "Reclamar"
2. Dialog muestra preview de comision:
   - net_amount de la transaccion
   - commission_rate del seller (de public.users)
   - commission_amount calculado (preview)
3. Seller confirma
4. INSERT INTO transaction_assignments (stripe_transaction_id, user_id)
   → Trigger auto_populate_assignment_fields auto-llena:
     - net_amount_snapshot (del net_amount de stripe_transactions)
     - commission_rate (del commission_rate del seller)
   → Columna generada commission_amount se calcula automaticamente
5. Feedback: "Venta reclamada. Comision: $X.XX"
```

**Restriccion 1:1:** UNIQUE en `stripe_transaction_id` impide que dos sellers reclamen la misma transaccion.

**Politica RLS:** `tx_assign_insert_seller_self` solo permite que el seller reclame para si mismo (`user_id` debe coincidir con el caller).

**Criterio de aceptacion:** Sellers pueden reclamar transacciones no asignadas. La comision se calcula automaticamente. No se puede reclamar una transaccion ya asignada. El seller puede eliminar su propia reclamacion.

---

### 3.3 Gestion de Asignaciones (Admin)

**Archivos a crear:**

| Archivo                                                 | Proposito                   |
| ------------------------------------------------------- | --------------------------- |
| `src/app/transactions/assignments/page.tsx`             | Vista admin de asignaciones |
| `src/app/transactions/assignments/assignment-table.tsx` | Tabla con acciones admin    |

**Acciones de admin:**

| Accion           | Operacion                        | Trigger que protege                            |
| ---------------- | -------------------------------- | ---------------------------------------------- |
| Reasignar        | `UPDATE SET user_id = ?`         | `protect_assignment_fields` (solo admin/owner) |
| Ajustar comision | `UPDATE SET commission_rate = ?` | `protect_assignment_fields` (solo admin/owner) |
| Eliminar         | `DELETE`                         | Politica RLS `tx_assign_all_admin`             |

**Campos inmutables para todos (incluyendo admin):** `stripe_transaction_id`, `net_amount_snapshot`, `assigned_at`.

**Criterio de aceptacion:** Admin puede ver todas las asignaciones. Puede reasignar a otro seller o ajustar la tasa de comision (recalcula `commission_amount` automaticamente). No puede modificar el snapshot ni la fecha de asignacion.

---

## Fase 4: Metodos de Pago de Sellers

### 4.1 UI de Configuracion

**Archivos a crear:**

| Archivo                                             | Proposito                         |
| --------------------------------------------------- | --------------------------------- |
| `src/app/settings/payment-methods/page.tsx`         | Pagina principal                  |
| `src/app/settings/payment-methods/binance-form.tsx` | Formulario Binance (Stellar USDC) |
| `src/app/settings/payment-methods/airtm-form.tsx`   | Formulario Airtm (ACH)            |
| `src/app/settings/payment-methods/bank-qr-form.tsx` | Formulario QR Bancario            |
| `src/hooks/use-payment-methods.ts`                  | Hook CRUD para metodos de pago    |

**Tres metodos de pago:**

| Metodo    | Campos requeridos (antes de cifrar)                                                                   | Constraint en schema |
| --------- | ----------------------------------------------------------------------------------------------------- | -------------------- |
| `binance` | `binance_stellar_address`, `binance_stellar_memo`                                                     | `chk_binance_fields` |
| `airtm`   | `ach_account_holder`, `ach_routing_number`, `ach_account_number`, `ach_bank_name`, `ach_account_type` | `chk_airtm_fields`   |
| `bank_qr` | `qr_bank_name`, `qr_account_holder`, `qr_ci_number` + opcional: `qr_account_number`, `qr_image_url`   | `chk_bank_qr_fields` |

**Flujo de guardado:**

```
1. Seller completa formulario con datos en claro
2. Validacion client-side (formatos, longitudes)
3. Cifrar campos sensibles con encryptPaymentFields() (AES-256-GCM)
4. INSERT/UPDATE en seller_payment_methods con datos cifrados
5. Constraint one_method_per_user(user_id, method_type) previene duplicados
```

**Cifrado:** Usar `encryptPaymentFields()` de `src/lib/payment-methods/crypto.ts`. Requiere `PAYMENT_ENCRYPTION_KEY` (env var, 64 hex chars).

**Upload QR:** Subir imagen al bucket `payment-qr` de Storage. Path: `{auth_uid}/{timestamp}.{ext}`. Politicas de storage ya existen.

**Metodo predeterminado:**

- Primer metodo se marca como `is_default = TRUE` automaticamente (trigger `manage_default_pm`)
- Al marcar otro como default, el anterior se desmarca automaticamente
- No se puede quitar `is_default` manualmente (hay que marcar otro)
- No se puede eliminar el metodo predeterminado (trigger `prevent_default_pm_delete`)

**Criterio de aceptacion:** Seller puede registrar hasta 3 metodos de pago. Los datos se cifran antes de almacenarse. El metodo predeterminado se gestiona automaticamente. La imagen QR se sube correctamente al storage.

---

## Fase 5: Retiros (Payouts)

### 5.1 Dashboard de Balance del Seller

**Archivos a crear:**

| Archivo                                 | Proposito                         |
| --------------------------------------- | --------------------------------- |
| `src/app/earnings/page.tsx`             | Dashboard de ganancias del seller |
| `src/app/earnings/balance-card.tsx`     | Tarjeta con resumen de saldo      |
| `src/app/earnings/earnings-history.tsx` | Historial de comisiones           |
| `src/app/earnings/payout-history.tsx`   | Historial de retiros              |

**Query principal (vista `seller_balances`):**

```typescript
const { data } = await supabase
  .from("seller_balances")
  .select("*")
  .eq("auth_user_id", user.id)
  .single();
```

**Campos de la vista:**

| Campo                  | Significado                          |
| ---------------------- | ------------------------------------ |
| `total_earned`         | Suma de todas las comisiones ganadas |
| `transaction_count`    | Numero de transacciones asignadas    |
| `total_paid`           | Suma de retiros completados          |
| `balance`              | `total_earned - total_paid`          |
| `pending_payouts`      | Suma de retiros pendientes           |
| `available_for_payout` | `balance - pending_payouts`          |

**Criterio de aceptacion:** Seller ve su saldo actual, historial de comisiones y retiros. Los montos son consistentes con la vista `seller_balances`.

---

### 5.2 Gestion de Retiros (Admin)

**Archivos a crear:**

| Archivo                                        | Proposito                    |
| ---------------------------------------------- | ---------------------------- |
| `src/app/admin/payouts/page.tsx`               | Lista de retiros (admin)     |
| `src/app/admin/payouts/create-payout-form.tsx` | Formulario para crear retiro |
| `src/app/admin/payouts/payout-table.tsx`       | Tabla con acciones de estado |
| `src/hooks/use-payouts.ts`                     | Hook CRUD para retiros       |

**Flujo de retiro:**

```
1. Admin selecciona seller y monto
2. INSERT INTO seller_payouts (user_id, amount, payout_method, created_by)
   → validate_payout_method_exists: verifica metodo habilitado
   → validate_payout_balance: verifica saldo suficiente (advisory lock)
3. Retiro creado con status='pending'
4. Admin realiza pago en plataforma externa
5. Admin marca como 'completed'
   → validate_payout_status_transition: auto-set paid_at = NOW()
6. Si hay problema: admin marca 'cancelled' o 'rejected'
```

**Maquina de estados:**

```
pending ──> completed  (paid_at se auto-establece)
pending ──> cancelled
pending ──> rejected
```

**Campos inmutables post-creacion:** `amount`, `user_id`, `currency`, `payout_method`, `created_by`, `created_at`, `paid_at`.

**Campos editables por admin en estado pending:** `platform_fee`, `notes`, `reference`.

**Criterio de aceptacion:** Admin puede crear retiros verificando saldo y metodo de pago. Las transiciones de estado funcionan correctamente. `paid_at` se establece automaticamente al completar. No se puede crear un retiro que exceda el saldo disponible.

---

## Fase 6: Dashboard con Datos Reales

**Archivo a modificar:** `src/app/admin/dashboard/page.tsx` (actualmente placeholder).

**Archivos a crear:**

| Archivo                                           | Proposito                           |
| ------------------------------------------------- | ----------------------------------- |
| `src/app/admin/dashboard/stats-cards.tsx`         | Tarjetas de metricas principales    |
| `src/app/admin/dashboard/recent-transactions.tsx` | Tabla de ultimas transacciones      |
| `src/app/admin/dashboard/sales-chart.tsx`         | Grafico de ventas por periodo       |
| `src/app/dashboard/page.tsx`                      | Dashboard del seller (sus metricas) |

**Metricas principales (admin):**

| Metrica               | Query                                                   |
| --------------------- | ------------------------------------------------------- |
| Transacciones totales | `COUNT(*)` de `stripe_transactions`                     |
| Volumen de ventas     | `SUM(amount)` de `stripe_transactions`                  |
| Comisiones generadas  | `SUM(commission_amount)` de `transaction_assignments`   |
| Retiros pendientes    | `COUNT(*)` de `seller_payouts WHERE status = 'pending'` |

**Dashboard del seller:**

| Metrica                | Fuente                                            |
| ---------------------- | ------------------------------------------------- |
| Comisiones ganadas     | `seller_balances.total_earned`                    |
| Balance actual         | `seller_balances.balance`                         |
| Disponible para retiro | `seller_balances.available_for_payout`            |
| Ultimo retiro          | `seller_payouts ORDER BY created_at DESC LIMIT 1` |

**Criterio de aceptacion:** El dashboard admin muestra metricas reales en tiempo real. El dashboard del seller muestra sus propias metricas. Los datos son consistentes con las tablas subyacentes.

---

## Fase 7: Produccion

### 7.1 Variables de Entorno

Documentar en `.env.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pasarela de cobros
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cifrado
PAYMENT_ENCRYPTION_KEY=your_64_char_hex_key  # openssl rand -hex 32
```

### 7.2 Automatizacion de Mantenimiento DB

Habilitar `pg_cron` en Supabase (Dashboard > Database > Extensions) y programar:

```sql
-- Expirar invitaciones pendientes cada hora
SELECT cron.schedule('expire-invitations', '0 * * * *',
  $$SELECT public.expire_pending_invitations()$$);

-- Crear particion de audit_log cada trimestre (dia 1 del primer mes)
SELECT cron.schedule('create-audit-partition', '0 0 1 */3 *',
  $$SELECT public.create_next_audit_partition()$$);
```

Monitorear que `audit_log_default` no acumule registros (indicaria que las particiones no se estan creando).

### 7.3 Testing

**Instalar:**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Tests prioritarios:**

| Tipo        | Cobertura                                                           |
| ----------- | ------------------------------------------------------------------- |
| Unitarios   | `crypto.ts` (cifrado/descifrado), `permissions.ts` (roles/permisos) |
| Integracion | Flujo de auth (signup -> onboarding -> login)                       |
| Integracion | Flujo de reclamacion (claim -> assignment -> balance)               |
| Integracion | Flujo de retiro (create -> complete -> balance update)              |
| E2E         | Flujo completo de invitacion a primer retiro                        |

### 7.4 CI/CD

**GitHub Actions (`.github/workflows/ci.yml`):**

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
```

### 7.5 Checklist Pre-Deploy

- [ ] `.env.local` esta en `.gitignore`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo se usa en codigo server-side (nunca expuesto al cliente)
- [ ] `STRIPE_SECRET_KEY` solo se usa en codigo server-side
- [ ] CORS configurado en Supabase para el dominio de produccion
- [ ] Webhook endpoint registrado en el panel de cobros (URL de produccion)
- [ ] `pg_cron` habilitado y jobs programados
- [ ] Particiones de `audit_log` creadas para el año en curso
- [ ] `npm run build` pasa sin errores
- [ ] Tests criticos pasan

### 7.6 Deploy

La aplicacion es compatible con cualquier plataforma que soporte Next.js:

```bash
# Vercel (recomendado)
npx vercel

# O build manual
npm run build
npm start
```

Configurar las variables de entorno en la plataforma de deploy (Vercel Environment Variables, etc.).

---

## Orden de Dependencias

```
Fase 0.1 (DB Types)
    │
    ├── Fase 0.2 (Team real data)
    │       │
    │       ├── Fase 1.2 (Invite)
    │       └── Fase 1.3 (Member detail)
    │
    └── Fase 1.1 (Onboarding)
            │
            └── Fase 2 (Cobros)
                    │
                    ├── Fase 3 (Transactions UI)
                    │       │
                    │       └── Fase 4 (Payment Methods)
                    │               │
                    │               └── Fase 5 (Payouts)
                    │
                    └── Fase 6 (Dashboard)
                            │
                            └── Fase 7 (Production)
```

Las fases pueden paralelizarse parcialmente: por ejemplo, Fase 1.2/1.3 (team) y Fase 1.1 (onboarding) pueden desarrollarse en paralelo. Fase 4 (payment methods) y Fase 3 (transactions) son independientes entre si pero ambas son prerequisito para Fase 5 (payouts).
