# J-Node Sales - Roadmap hasta Produccion

Este documento define el plan de ejecucion del proyecto desde el estado actual hasta un go-live estable en produccion.  
Incluye inventario tecnico real, TODOs por fases, dependencias entre tareas y Definition of Done.

## 1) Estado actual del proyecto

### Backend y Base de Datos (Supabase)

- Esquema principal en `supabase/schema.sql`.
- Tablas core detectadas:
  - `roles`
  - `users`
  - `invitations`
  - `stripe_transactions`
  - `transaction_assignments`
  - `seller_payment_methods`
  - `seller_payouts`
  - `seller_balance_summary`
  - `audit_log` (+ `audit_log_default`)
- El esquema contiene funciones de negocio para:
  - onboarding/invitaciones
  - control de privilegios/RBAC
  - asignaciones y comisiones
  - retiros y validacion de balance
  - auditoria y mantenimiento programado
- Hay RLS activo y forzado en tablas sensibles.

### Backend HTTP (Next API routes)

Rutas existentes en `src/app/api`:

- `src/app/api/auth/confirm/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/stripe/sync/route.ts`

Estado:

- Integracion de cobros ya iniciada (webhook + sync manual).
- Confirmacion de email con Supabase ya funcional.
- No existen endpoints de health/readiness todavia.

### Frontend App Router

Paginas detectadas en `src/app`:

- Publica: `/` en `src/app/page.tsx`
- Auth cliente: `/auth/*`
- Auth admin: `/admin/auth/*`
- Admin: solo `/admin/dashboard` en `src/app/admin/dashboard/page.tsx`

Rutas referenciadas en navegacion pero no implementadas en `src/app`:

- `/admin/configuration`
- `/admin/orders`
- `/settings/*`

### Layout y UI

- Layout condicional: `src/components/conditional-layout.tsx`
- Sidebar admin: `src/components/ui/app-sidebar.tsx`
- Header/Breadcrumb: `src/components/ui/app-header.tsx`
- Sistema UI base (shadcn/radix): `src/components/ui/*`

Estado:

- Shell admin responsive existe.
- Dashboard y modulos de negocio aun en estado inicial.

### Hooks y estado de datos

Hooks actuales en `src/hooks`:

- Auth:
  - `src/hooks/auth/use-user.ts`
  - `src/hooks/auth/use-sign-in.ts`
  - `src/hooks/auth/use-sign-up.ts`
  - `src/hooks/auth/use-sign-out.ts`
  - `src/hooks/auth/use-forgot-password.ts`
  - `src/hooks/auth/use-update-password.ts`
  - `src/hooks/auth/use-update-profile.ts`
- Permisos:
  - `src/hooks/permission/use-permissions.ts`
- UI:
  - `src/hooks/use-mobile.ts`
  - `src/hooks/use-toast.ts`

Estado:

- React Query esta configurado en `src/app/providers.tsx`.
- Falta una capa de hooks por dominio (transactions, assignments, payouts, dashboard, team, settings).

### Seguridad y operacion (estado actual)

- Cliente admin de Supabase para procesos internos en `src/lib/supabase/admin.ts`.
- Middleware de auth/rutas protegido en `src/middleware.ts` y `src/lib/supabase/middleware.ts`.
- Falta pipeline CI/CD, tests automatizados y observabilidad completa.

## 2) Objetivo de producto (MVP operativo)

Entregar un panel administrativo de cobros y ventas para J-Node con:

1. autenticacion y RBAC por rol
2. dashboard con KPIs reales
3. asignacion de transacciones a sellers
4. control de comisiones y saldo disponible
5. flujo de retiros con validaciones
6. auditoria y operacion segura para produccion

## 3) Dependencias entre fases

1. Fase 0 (seguridad/base) bloquea todo.
2. Fase 1 (contrato datos/backend) desbloquea hooks (Fase 2).
3. Fase 2 desbloquea modulos y UI (Fase 3-4).
4. Fase 5-6 validan calidad/operacion antes de go-live.
5. Fase 7 solo inicia cuando Fase 0-6 estan en verde.

## 4) Roadmap por fases con TODO list

## Fase 0 - Seguridad y base operativa (bloqueante)

**Objetivo:** cerrar riesgos de seguridad y establecer una base de entrega confiable.

### TODO

- [ ] Rotar secretos de infraestructura/cobros/cifrado y reemitir credenciales por entorno.
- [ ] Crear matriz de secretos por ambiente (`dev`, `staging`, `prod`) y responsables.
- [ ] Fijar versiones de dependencias criticas en `package.json` (evitar `latest`).
- [ ] Definir politicas de `.env` y onboarding de desarrolladores.
- [ ] Configurar escaneo de secretos y vulnerabilidades en CI.

### Definition of Done

- No hay secretos expuestos en repositorio ni artefactos compartidos.
- Dependencias criticas quedan versionadas de forma deterministica.
- Existen validaciones automaticas minimas de seguridad en cada PR.

---

## Fase 1 - Contrato de datos y backend funcional

**Objetivo:** estabilizar el dominio de datos y la capa backend para consumo frontend.

### TODO

- [ ] Documentar diccionario de datos (tablas, campos clave, relaciones) desde `supabase/schema.sql`.
- [ ] Crear matriz funcion SQL -> caso de uso frontend.
- [ ] Definir endpoints/RPC para dashboard, assignments, payouts y team.
- [ ] Definir convencion de errores y payloads de API.
- [ ] Definir estrategia de migraciones versionadas de DB.

### Definition of Done

- Existe contrato de datos y endpoints acordado con frontend.
- Los casos de uso principales tienen fuente de datos clara.
- El esquema queda listo para evolucion controlada por migraciones.

---

## Fase 2 - Capa de datos frontend (hooks)

**Objetivo:** construir hooks por dominio con React Query y manejo estandar de estados.

### Estructura objetivo de hooks

- `src/hooks/dashboard/*`
- `src/hooks/transactions/*`
- `src/hooks/assignments/*`
- `src/hooks/payouts/*`
- `src/hooks/team/*`
- `src/hooks/settings/*`

### TODO

- [ ] Definir `queryKeys` por dominio en un archivo central.
- [ ] Implementar hooks de lectura (listas, detalle, KPIs).
- [ ] Implementar hooks de mutacion (claim/unclaim, payout actions, update settings).
- [ ] Estandarizar invalidaciones y optimistic updates donde aplique.
- [ ] Estandarizar manejo de `loading`, `error`, `empty` y toasts.

### Definition of Done

- Cada modulo tiene hooks reutilizables y tipados.
- No hay fetch ad-hoc en componentes de pagina.
- Estrategia de cache e invalidacion documentada y consistente.

---

## Fase 3 - Modulos y rutas admin

**Objetivo:** habilitar modulos de negocio navegables y protegidos por permisos.

### TODO

- [ ] Implementar `src/app/admin/orders/page.tsx`.
- [ ] Implementar `src/app/admin/configuration/page.tsx`.
- [ ] Crear seccion `src/app/settings/*` referenciada por navegacion.
- [ ] Definir rutas para productos/categorias/inventario/sucursales segun backlog.
- [ ] Integrar guardas RBAC por vista y accion.

### Definition of Done

- Sidebar y breadcrumbs apuntan solo a rutas existentes.
- Las rutas admin principales son funcionales.
- Los permisos bloquean acciones sensibles por rol.

---

## Fase 4 - UI/UX end-to-end

**Objetivo:** completar experiencia de usuario con flujos reales y consistentes.

### TODO

- [ ] Diseñar vistas de lista, filtros y detalle por modulo.
- [ ] Implementar tabla de transacciones con estados y acciones.
- [ ] Implementar vista de asignaciones y comisiones.
- [ ] Implementar vista de retiros (`seller_payouts`) y metodos de pago.
- [ ] Completar dashboard con KPIs reales (ventas, comisiones, saldo disponible, retiros pendientes).
- [ ] Estandarizar componentes de `skeleton`, `empty state`, `error state`, confirmaciones y feedback.

### Definition of Done

- El usuario puede completar flujos de negocio sin salir del panel.
- La UI mantiene patrones consistentes en todos los modulos.
- Los estados de carga/error/vacio estan cubiertos en pantallas criticas.

---

## Fase 5 - Calidad y pruebas

**Objetivo:** reducir regresiones y asegurar estabilidad antes de staging.

### TODO

- [ ] Agregar framework de pruebas y script `test` en `package.json`.
- [ ] Crear unit tests para utilidades de auth, permisos, mappers y crypto.
- [ ] Crear integration tests para API routes (webhook, sync, confirm auth).
- [ ] Crear E2E smoke para login, dashboard y flujo de payout.
- [ ] Integrar `lint`, `type-check`, `test`, `build` como quality gates en CI.

### Definition of Done

- Hay cobertura automatica sobre flujos criticos.
- Ningun PR se fusiona sin pasar gates de calidad.
- Se puede detectar regresion funcional antes de deploy.

---

## Fase 6 - Observabilidad y hardening

**Objetivo:** operar en produccion con monitoreo, trazabilidad y seguridad.

### TODO

- [ ] Exponer `/api/health` y `/api/ready`.
- [ ] Integrar tracking de errores y logging estructurado.
- [ ] Definir alertas minimas (errores API, webhook fallido, latencia, tasa de 5xx).
- [ ] Revisar y probar politicas RLS por rol para operaciones criticas.
- [ ] Hardening de `next.config.ts` y cabeceras de seguridad.
- [ ] Definir runbooks: incidente, rollback, degradacion y rotacion de claves.

### Definition of Done

- Se detectan y diagnostican fallos en tiempo razonable.
- Existen procedimientos de respuesta operativa.
- Seguridad de app y DB validada para escenario productivo.

---

## Fase 7 - Staging, UAT y Go-Live

**Objetivo:** salir a produccion con control de riesgo y plan de soporte inicial.

### TODO

- [ ] Configurar pipeline CI/CD con despliegue a `staging` y `production`.
- [ ] Ejecutar UAT por modulo con checklist de aceptacion.
- [ ] Realizar prueba de carga basica y prueba de resiliencia operativa.
- [ ] Preparar ventana de lanzamiento y plan de rollback.
- [ ] Ejecutar go-live y monitoreo intensivo de 48-72h.
- [ ] Cerrar postmortem inicial con backlog de mejoras.

### Definition of Done

- UAT aprobado por negocio y equipo tecnico.
- Go-live ejecutado con metricas estables.
- Existe plan de mejoras priorizado post-lanzamiento.

## 5) Backlog detallado de hooks, modulos y UI

## Hooks (prioridad sugerida)

### A. Dashboard

- [ ] `use-dashboard-kpis`
- [ ] `use-sales-timeseries`
- [ ] `use-pending-payouts-summary`

### B. Transactions

- [ ] `use-transactions-list` (filtros/paginacion)
- [ ] `use-transaction-detail`
- [ ] `use-sync-stripe-transactions` (trigger admin)

### C. Assignments

- [ ] `use-assign-transaction`
- [ ] `use-unassign-transaction`
- [ ] `use-assignment-history`

### D. Payouts

- [ ] `use-seller-payouts`
- [ ] `use-create-payout`
- [ ] `use-update-payout-status`
- [ ] `use-payment-methods`

### E. Team y Settings

- [ ] `use-team-members`
- [ ] `use-invitations`
- [ ] `use-role-management`
- [ ] `use-profile-settings`

## Modulos/UI (secuencia recomendada)

1. Dashboard (KPIs)
2. Transactions
3. Assignments/Commissions
4. Payouts
5. Team + Invitations
6. Configuration + Settings

Para cada modulo:

- [ ] pagina + layout
- [ ] hooks de lectura
- [ ] acciones/mutaciones
- [ ] validaciones de permisos
- [ ] estados visuales completos
- [ ] pruebas minimas

## 6) Plan de ejecucion sugerido (12 semanas)

- Semana 1-2: Fase 0
- Semana 3-4: Fase 1
- Semana 5-6: Fase 2
- Semana 7-8: Fase 3
- Semana 9-10: Fase 4
- Semana 11: Fase 5-6
- Semana 12: Fase 7

## 7) Checklist global de salida a produccion

- [ ] Seguridad aprobada (secretos, permisos, RLS, hardening)
- [ ] Calidad aprobada (lint, type-check, tests, build)
- [ ] Observabilidad activa (health, logs, alertas)
- [ ] Operacion definida (runbooks y ownership)
- [ ] UAT aprobado
- [ ] Plan de rollback validado
- [ ] Go-live ejecutado y monitoreado

---

## Referencias tecnicas clave

- DB schema: `supabase/schema.sql`
- Layout shell: `src/components/conditional-layout.tsx`
- Sidebar: `src/components/ui/app-sidebar.tsx`
- Header/Breadcrumb: `src/components/ui/app-header.tsx`
- React Query provider: `src/app/providers.tsx`
- Middleware auth/rutas: `src/middleware.ts`, `src/lib/supabase/middleware.ts`
- API webhook de cobros: `src/app/api/webhooks/stripe/route.ts`
- API sync de cobros: `src/app/api/stripe/sync/route.ts`
- API confirm auth: `src/app/api/auth/confirm/route.ts`
- RBAC frontend: `src/lib/auth/permissions.ts`
- Supabase admin client: `src/lib/supabase/admin.ts`

Este README es la fuente de verdad para ejecutar el roadmap hasta produccion.
