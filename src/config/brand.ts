export const BRAND = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Sales Platform",
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "",
  appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL ?? "",
} as const;

export type BrandConfig = typeof BRAND;
