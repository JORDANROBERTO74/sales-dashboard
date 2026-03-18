import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TRANSACTIONS_ALLOWED_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.ANALYST,
  UserRole.VIEWER,
];

const TRANSACTIONS_SECTIONS = [
  {
    key: "jnode",
    title: "Cuenta Stripe JNode",
    description: "Ver transacciones de la cuenta Stripe JNode.",
    href: "/admin/transactions/jnode",
    accessLabel: "JNode",
    cta: "Ir a JNode",
  },
  {
    key: "vascruz",
    title: "Cuenta Stripe Vascruz",
    description: "Ver transacciones de la cuenta Stripe Vascruz.",
    href: "/admin/transactions/vascruz",
    accessLabel: "Vascruz",
    cta: "Ir a Vascruz",
  },
] as const;

export default async function AdminTransactionsPage() {
  await requireAnyRole(TRANSACTIONS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold">Transacciones</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona la cuenta Stripe que quieres gestionar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TRANSACTIONS_SECTIONS.map((section) => (
          <Card key={section.key}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle>{section.title}</CardTitle>
              </div>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={section.href}>
                  {section.cta}
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
