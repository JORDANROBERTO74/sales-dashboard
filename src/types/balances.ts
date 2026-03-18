export type BalancePeriod = {
  from: string | null;
  to: string | null;
  preset: "always" | "custom";
};

export type BalanceAccountOption = {
  id: string;
  external_id: string;
  display_name: string;
};

export type BalanceSellerOption = {
  id: string;
  full_name: string | null;
  email: string;
};

export type SellerBalanceRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  stripe_account_id: string;
  stripe_account_external_id: string;
  stripe_account_display_name: string;
  current_commission_rate: number;
  total_earned: number;
  available_earned: number;
  pending_earned: number;
  total_paid: number;
  pending_payouts: number;
  available_for_payout: number;
};

export type BalancesKpis = {
  sellers_count: number;
  total_earned_cents: number;
  available_earned_cents: number;
  pending_earned_cents: number;
  total_paid_cents: number;
  pending_payouts_cents: number;
  available_for_payout_cents: number;
};

export type BalancesFilters = {
  page?: number;
  pageSize?: number;
  accountExternalId?: string;
  sellerUserId?: string;
  q?: string;
  from?: string;
  to?: string;
  periodPreset?: "always";
};

export type BalancesResponse = {
  generated_at: string;
  period: BalancePeriod;
  account_options: BalanceAccountOption[];
  seller_options: BalanceSellerOption[];
  kpis: BalancesKpis;
  rows: SellerBalanceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
