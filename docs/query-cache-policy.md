# Query Cache Policy

This project uses React Query as the client cache layer. The goal is to avoid calling APIs on every mount and only refetch when data is likely stale or after user actions that mutate data.

## Query keys

- `["user"]`: authenticated user profile.
- `["settings", "profile"]`: profile settings.
- `["settings", "team-members", filters]`: team list with filters.
- `["settings", "team-member", memberId]`: team member detail.
- `["settings", "team-roles"]`: role catalog.
- `["settings", "team-invitations"]`: invitation list.
- `["settings", "payment-methods"]`: seller payment methods.

## Default policy

- Global defaults in providers:
  - `staleTime: 60_000`
  - `refetchOnWindowFocus: false`
  - `retry: 1`

## Domain overrides

- **User (`["user"]`)**
  - `staleTime: 5 minutes`
  - `refetchOnWindowFocus: false`
  - Rationale: identity data changes infrequently and is invalidated explicitly after auth/profile mutations.

- **Profile settings (`["settings", "profile"]`)**
  - `staleTime: 5 minutes`
  - `refetchOnMount: false`
  - `refetchOnWindowFocus: false`
  - Optional `initialData` is supported to hydrate from server when available.

- **Team**
  - `["settings", "team-roles"]`: `staleTime: 10 minutes`, `refetchOnMount: false`.
  - `["settings", "team-members", filters]`: `staleTime: 1 minute`, `placeholderData: keepPreviousData`.
  - `["settings", "team-invitations"]`: `staleTime: 2 minutes`.
  - `["settings", "team-member", memberId]`: `staleTime: 1 minute`.
  - UI-level debounce (350ms) is used for search to avoid request-per-keystroke.

- **Payment methods (`["settings", "payment-methods"]`)**
  - `staleTime: 5 minutes`
  - `refetchOnMount: false`
  - `refetchOnWindowFocus: false`
  - Prefer `setQueryData` updates after mutations when payload is known.

## Invalidation rules

- Invalidate only when optimistic/local cache updates are not enough.
- Prefer targeted cache updates with `queryClient.setQueryData` after:
  - upsert payment method
  - set default payment method
  - patch payment method
  - delete payment method
- Keep profile and user keys in sync after profile mutations by invalidating both keys.
