import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export function Breadcrumb({ children }: { children: React.ReactNode }) {
  return <nav aria-label="breadcrumb">{children}</nav>;
}

export function BreadcrumbList({ children }: { children: React.ReactNode }) {
  return <ol className="flex items-center gap-2">{children}</ol>;
}

export function BreadcrumbItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <li className={className}>{children}</li>;
}

export function BreadcrumbLink({
  asChild,
  href,
  children,
  className,
}: {
  asChild?: boolean;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      href={href}
      className={cn(
        "text-sm text-muted-foreground hover:underline transition-colors",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function BreadcrumbPage({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium">{children}</span>;
}

export function BreadcrumbSeparator({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <li role="presentation" aria-hidden="true" className={cn(className)}>
      {children ?? <span>/</span>}
    </li>
  );
}

export function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      aria-label="More"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <span className="text-sm">...</span>
      <span className="sr-only">More</span>
    </span>
  );
}

export default Breadcrumb;
