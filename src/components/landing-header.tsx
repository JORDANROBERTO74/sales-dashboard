"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

export function LandingHeader() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <Building2 className="size-4" />
          </div>
          <span className="hidden md:inline font-bold text-lg">J-Node Sales</span>
        </Link>
      </div>
    </header>
  );
}
