/**
 * Payment Links de Stripe. Orden de visualización: menor a mayor según
 * `sortAmount` (USD en dólares; BOB en bolivianos para el ítem en BOB).
 */
export type StripePaymentLinkItem = {
  id: string;
  name: string;
  url: string;
  /** Moneda principal mostrada en el checkout para este enlace. */
  currency: "usd" | "bob";
  createdAt: string;
  /** Monto en USD (0 si el precio listado es solo en BOB). */
  amountUsd: number;
  /** Monto en BOB cuando el precio no está en USD. */
  amountBob?: number;
  /** Valor usado para ordenar de menor a mayor en el listado. */
  sortAmount: number;
  /** Texto EN // ES con detalle del servicio. */
  description: string;
  billingNote?: string;
};

const STRIPE_PAYMENT_LINKS_RAW: StripePaymentLinkItem[] = [
  {
    id: "plink_1T5By1GnhIf8nTXAFM5VJHLY",
    name: "System Health & Performance Checklist",
    url: "https://buy.stripe.com/fZueVd72Ac9H8r42pWbQY04",
    currency: "usd",
    createdAt: "2026-02-26T21:19:00Z",
    amountUsd: 10,
    sortAmount: 10,
    description:
      "Technical guide to audit system health, databases, and security. // Guía técnica para auditar salud de sistemas, bases de datos y seguridad.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1Sz3NuGnhIf8nTXAhbg5CJfo",
    name: "Initial Scope Assessment",
    url: "https://buy.stripe.com/14AcN5biQ0qZbDge8EbQY03",
    currency: "usd",
    createdAt: "2026-02-09T22:56:00Z",
    amountUsd: 20,
    sortAmount: 20,
    description:
      "Review of project requirements and feasibility report for a specific feature. // Revisión de requerimientos del proyecto e informe de viabilidad para una funcionalidad específica.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1TJ0t1GnhIf8nTXAXsuQJwXa",
    name: "Initial Scope Assessment",
    url: "https://buy.stripe.com/8x29ATgDa8XvazcfcIbQY08",
    currency: "usd",
    createdAt: "2026-04-06T00:19:00Z",
    amountUsd: 22,
    sortAmount: 22,
    description:
      "Review of project requirements and feasibility report for a specific feature. // Revisión de requerimientos del proyecto e informe de viabilidad para una funcionalidad específica.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1TAFCJGnhIf8nTXAwmSCEVSZ",
    name: "IT Professional Services & Support",
    url: "https://buy.stripe.com/cNiaEXgDaflT6iW9SobQY07",
    currency: "usd",
    createdAt: "2026-03-12T19:47:00Z",
    amountUsd: 25,
    sortAmount: 25,
    description:
      "Professional fee for software development, technical assistance, or ongoing maintenance services as agreed. // Honorario profesional por desarrollo de software, asistencia técnica o servicios de mantenimiento según lo acordado.",
    billingNote: "Facturación semanal",
  },
  {
    id: "plink_1Sz1FWGnhIf8nTXAZ3YPP0rw",
    name: "IT Professional Services & Support",
    url: "https://buy.stripe.com/28EeVdcmUddL4aO8OkbQY00",
    currency: "usd",
    createdAt: "2026-02-09T20:40:00Z",
    amountUsd: 25,
    sortAmount: 25,
    description:
      "Professional fee for software development, technical assistance, or ongoing maintenance services as agreed. // Honorario profesional por desarrollo de software, asistencia técnica o servicios de mantenimiento según lo acordado.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1T8oihGnhIf8nTXAIHBXZU2O",
    name: "Software Installation Service",
    url: "https://buy.stripe.com/fZufZh3Qo6PnazcaWsbQY06",
    currency: "usd",
    createdAt: "2026-03-08T21:18:00Z",
    amountUsd: 50,
    sortAmount: 50,
    description:
      "Deployment and initial configuration of scripts, CRMs, or tools on client server. // Instalación y configuración de software en servidor.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1T7NB5GnhIf8nTXAQP4Mh249",
    name: "Automated Site Health Report",
    url: "https://buy.stripe.com/eVq28r3Qo0qZ8r4ggMbQY05",
    currency: "usd",
    createdAt: "2026-03-04T21:41:00Z",
    amountUsd: 90,
    sortAmount: 90,
    description:
      "Automated generation of a technical report highlighting basic SEO issues and broken links. // Generación automatizada de un reporte técnico destacando problemas básicos de SEO y enlaces rotos.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1Sz30cGnhIf8nTXAG0gAducJ",
    name: "Web Performance Optimization",
    url: "https://buy.stripe.com/fZu14n1Ig8Xv8r45C8bQY02",
    currency: "usd",
    createdAt: "2026-02-09T22:32:00Z",
    amountUsd: 90,
    sortAmount: 90,
    description:
      "Load time improvement, resource compression, and cache configuration. // Optimización de velocidad de carga y configuración de caché.",
    billingNote: "Pago único",
  },
  {
    id: "plink_1Sz2xOGnhIf8nTXAqQxPWK8L",
    name: "Technical Strategy & Architecture Session",
    url: "https://buy.stripe.com/28EdR9gDa0qZ5eSc0wbQY01",
    currency: "usd",
    createdAt: "2026-02-09T22:29:00Z",
    amountUsd: 100,
    sortAmount: 100,
    description:
      "1-hour expert session on software architecture, planning, or code review. // Sesión de 1 hora de estrategia técnica y arquitectura de software.",
    billingNote: "Pago único",
  },
];

export function formatUsdAmount(amountUsd: number): string {
  if (amountUsd <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amountUsd % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountUsd);
}

export function formatBobAmount(amountBob: number): string {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountBob);
}

/** Precio tal como debe mostrarse en la card. */
export function formatListedPrice(item: StripePaymentLinkItem): string {
  if (item.currency === "bob" && item.amountBob != null) {
    return formatBobAmount(item.amountBob);
  }
  return formatUsdAmount(item.amountUsd);
}

export function getActiveStripePaymentLinks(): StripePaymentLinkItem[] {
  return [...STRIPE_PAYMENT_LINKS_RAW].sort((a, b) => {
    if (a.sortAmount !== b.sortAmount) return a.sortAmount - b.sortAmount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/** `true` si hay más de un link con el mismo nombre (mostrar fecha de referencia en la card). */
export function getDuplicateNameIds(
  items: StripePaymentLinkItem[],
): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  const dup = new Set<string>();
  for (const item of items) {
    if ((counts.get(item.name) ?? 0) > 1) dup.add(item.id);
  }
  return dup;
}
