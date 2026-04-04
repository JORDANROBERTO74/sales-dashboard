export type StripeTransactionType =
  | "payment_intent"
  | "charge"
  | "checkout_session"
  | "invoice"
  | "subscription";

export type SellerAssignmentFilter = `seller:${string}`;
export type AssignmentFilter =
  | "all"
  | "assigned"
  | "unassigned"
  | SellerAssignmentFilter;

export type TransactionSeller = {
  id: string;
  full_name: string | null;
  email: string;
  commission_rate: number;
  role_name: string | null;
};

export type TransactionAssignment = {
  id: string;
  stripe_transaction_id: string;
  user_id: string;
  commission_amount: number;
  assigned_at: string;
  notes: string | null;
  seller: TransactionSeller | null;
};

export type StripeTransactionRow = {
  id: string;
  stripe_id: string;
  transaction_type: StripeTransactionType;
  transaction_status: string;
  stripe_status: string;
  amount: number;
  currency: "usd";
  stripe_fee: number;
  net_amount: number;
  customer_email: string | null;
  customer_name: string | null;
  payment_method_type: string | null;
  stripe_product_id: string | null;
  stripe_created_at: string | null;
  funds_available_at: string | null;
  created_at: string;
  assignment: TransactionAssignment | null;
};

export type SellerOption = {
  id: string;
  full_name: string | null;
  email: string;
  commission_rate: number;
  role_name: string | null;
};

export type TransactionsFilters = {
  accountExternalId?: string;
  q?: string;
  status?: string;
  type?: StripeTransactionType | "all";
  assignment?: AssignmentFilter;
  from?: string;
  to?: string;
  periodPreset?: "always";
};

export type TransactionsListResponse = {
  rows: StripeTransactionRow[];
  sellers: SellerOption[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  canViewCustomerData: boolean;
};

export type TransactionDetailResponse = {
  row: StripeTransactionRow;
  canViewCustomerData: boolean;
};
