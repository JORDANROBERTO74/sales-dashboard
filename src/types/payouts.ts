export type PayoutStatus = "pending" | "completed" | "cancelled" | "rejected";
export type PayoutMethod = "binance" | "airtm" | "bank_qr";

export type PayoutRow = {
  id: string;
  user_id: string;
  seller_name: string | null;
  seller_email: string;
  seller_phone: string | null;
  stripe_account_id: string;
  stripe_account_external_id: string;
  stripe_account_display_name: string;
  amount: number;
  currency: "usd";
  payout_method: PayoutMethod;
  platform_fee: number;
  received_amount: number;
  exchange_rate_bob: number | null;
  status: PayoutStatus;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PayoutSellerOption = {
  id: string;
  full_name: string | null;
  email: string;
};

export type PayoutPaymentMethodOption = {
  id: string;
  method_type: PayoutMethod;
  is_default: boolean;
  is_enabled: boolean;
};

export type PayoutPaymentMethodDetail = {
  id: string;
  user_id: string;
  method_type: PayoutMethod;
  is_enabled: boolean;
  is_default: boolean;
  tutorial_url: string | null;
  binance_id: string | null;
  binance_qr_image_url: string | null;
  binance_qr_image_signed_url?: string | null;
  ach_account_holder: string | null;
  ach_routing_number: string | null;
  ach_account_number: string | null;
  ach_bank_name: string | null;
  ach_account_type: string | null;
  qr_bank_name: string | null;
  qr_account_holder: string | null;
  qr_ci_number: string | null;
  qr_account_number: string | null;
  qr_image_url: string | null;
  qr_image_signed_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type PayoutAccountOption = {
  id: string;
  external_id: string;
  display_name: string;
};

export type PayoutsFilters = {
  page?: number;
  pageSize?: number;
  accountExternalId?: string;
  sellerUserId?: string;
  status?: PayoutStatus | "all";
  method?: PayoutMethod | "all";
  q?: string;
  from?: string;
  to?: string;
  periodPreset?: "always";
};

export type PayoutsListResponse = {
  rows: PayoutRow[];
  sellers: PayoutSellerOption[];
  account_options: PayoutAccountOption[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PayoutDetailResponse = {
  row: PayoutRow;
  payment_method: PayoutPaymentMethodDetail | null;
};

export type PayoutSellerPaymentMethodsResponse = {
  methods: PayoutPaymentMethodOption[];
};
