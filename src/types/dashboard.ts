export type DashboardAccountOption = {
  id: string;
  external_id: string;
  display_name: string;
};

export type DashboardKpis = {
  gross_amount_cents: number;
  stripe_fee_cents: number;
  net_amount_cents: number;
  transactions_count: number;
  assigned_commission_cents: number;
  unassigned_transactions_count: number;
  completed_payouts_cents: number;
  pending_payouts_cents: number;
};

export type DashboardAccountBreakdown = {
  stripe_account_id: string;
  stripe_account_external_id: string;
  stripe_account_display_name: string;
  gross_amount_cents: number;
  stripe_fee_cents: number;
  net_amount_cents: number;
  transactions_count: number;
  assigned_commission_cents: number;
  unassigned_transactions_count: number;
  completed_payouts_cents: number;
  pending_payouts_cents: number;
  daily_gross_series: DashboardDailyGrossPoint[];
};

export type DashboardDailyGrossPoint = {
  date: string;
  gross_amount_cents: number;
};

export type DashboardTopSeller = {
  user_id: string;
  full_name: string | null;
  email: string;
  current_commission_rate: number;
  period_commission_cents: number;
  period_transactions_count: number;
  total_earned_cents: number;
  available_for_payout_cents: number;
  pending_payouts_cents: number;
};

export type DashboardPeriod = {
  from: string | null;
  to: string | null;
  preset: "last_30_days" | "custom" | "always";
};

export type DashboardResponse = {
  generated_at: string;
  period: DashboardPeriod;
  selected_account_external_id: string | null;
  account_options: DashboardAccountOption[];
  kpis: DashboardKpis;
  accounts: DashboardAccountBreakdown[];
  top_sellers: DashboardTopSeller[];
};

export type DashboardFilters = {
  from?: string;
  to?: string;
  periodPreset?: "always";
  accountExternalId?: string;
};
