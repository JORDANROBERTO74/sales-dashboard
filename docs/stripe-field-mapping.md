# Cobros -> `stripe_transactions` Mapping

Esta tabla documenta el mapeo implementado en `src/lib/stripe/transactions.ts` para J-Node Sales.

| Columna Supabase | Fuente de cobros | Regla |
|---|---|---|
| `stripe_id` | `object.id` | Requiere prefijo válido (`pi_`, `ch_`, `cs_`, `in_`, `sub_`) |
| `transaction_type` | `event.type` | `payment_intent.succeeded` -> `payment_intent`, `charge.succeeded` -> `charge`, `checkout.session.completed` -> `checkout_session`, `invoice.paid` -> `invoice`, `customer.subscription.created` -> `subscription` |
| `stripe_status` | `object.status` | Fallback a `payment_status` (checkout) o `unknown` |
| `amount` | `amount`/`amount_total`/`amount_paid` | Siempre en centavos |
| `currency` | `object.currency` | Solo se persiste si es `usd` (requisito del schema) |
| `stripe_fee` | `balance_transaction.fee` | `0` si no hay balance transaction |
| `net_amount` | `balance_transaction.net` o `amount - fee` | Clamp a no negativo |
| `stripe_customer_id` | `object.customer` | Si existe y es expandible, usa `id` |
| `customer_email` | `customer_details.email`, `billing_details.email`, `receipt_email`, `invoice.customer_email` | Fallback a `customers.retrieve(customerId)` |
| `customer_name` | `customer_details.name`, `billing_details.name`, `shipping.name` | Fallback a `customers.retrieve(customerId)` |
| `description` | `object.description` | En checkout usa `client_reference_id` como fallback |
| `payment_method_type` | `charge.payment_method_details.type` o `payment_method_types[0]` | Depende del objeto |
| `stripe_product_id` | `line_items.price.product`, `invoice.lines.price.product`, `subscription.items.price.product`, metadata | Best-effort: se intenta resolver por API y fallback a `metadata.product_id`/`metadata.stripe_product_id` |
| `stripe_created_at` | `object.created` | Epoch -> ISO8601 |
| `funds_available_at` | `balance_transaction.available_on` | Epoch -> ISO8601 |
| `metadata` | `object.metadata` | JSON normalizado |

## Notas importantes

- El webhook y sync hacen `upsert` por `stripe_id` para idempotencia.
- Para `payment_intent`, `checkout_session` e `invoice` se resuelve el `charge` asociado para calcular `fee/net/funds_available_at`.
- En `subscription` se persiste `amount=0`, `stripe_fee=0`, `net_amount=0` porque ese objeto no trae un monto cobrado directo.
- Se agrega `_ingestion` dentro de `metadata` para trazabilidad (`source`, `event_type`, `event_id`, `processed_at`).
