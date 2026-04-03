export type User = {
  id: number;
  name: string;
  email: string;
};

export type Account = {
  id: number;
  name: string;
  currency: string;
  user_id: number;
};

export type AccountImportMapping = {
  account_id: number;
  date_column: string | null;
  description_column: string | null;
  amount_column: string | null;
  currency_column: string | null;
  tag_id_column: string | null;
};

export type AccountBalanceItem = {
  account_id: number;
  account_name: string;
  currency: string;
  balance: number;
};

export type AccountsBalanceResponse = {
  overall_balance: number;
  by_account: AccountBalanceItem[];
};

export type Tag = {
  id: number;
  label: string;
  user_id: number;
};

export type Transaction = {
  id: number;
  date: string;
  description: string;
  account_id: number;
  tag_id: number | null;
  amount: string;
  currency: string;
  is_transfer: boolean;
  transfer_group_id: string | null;
  transfer_direction: "in" | "out" | null;
  linked_account_id: number | null;
  parent_transaction_id: number | null;
};

export type DashboardSummary = {
  current_month_income: string;
  current_month_expenses: string;
  current_month_net: string;
  latest_transactions: Transaction[];
};

export type DashboardPatrimonyPoint = {
  year: number;
  patrimony: string;
};

export type DashboardIncomeExpensePoint = {
  month: string;
  income: string;
  expenses: string;
  net: string;
  net_trend: string;
};

export type DashboardChartsResponse = {
  patrimony_by_year: DashboardPatrimonyPoint[];
  income_vs_expenses_last_12_months: DashboardIncomeExpensePoint[];
};

export type PaginatedTransactionsResponse = {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type MonthlyAnalyticsItem = {
  label: string;
  total_expense: string;
};

export type MonthlyAnalyticsResponse = {
  by_tag: MonthlyAnalyticsItem[];
  by_account: MonthlyAnalyticsItem[];
};

export type TagMonthlyTrendItem = {
  month: string;
  total_expense: string;
};

export type TagMonthlyTrendResponse = {
  tag_id: number;
  points: TagMonthlyTrendItem[];
};

export type MonthlySummaryCard = {
  income: string;
  expenses: string;
  net: string;
};

export type MonthlyAccountSummary = {
  account_id: number;
  account_name: string;
  income: string;
  expenses: string;
  net: string;
};

export type MonthlySummaryResponse = {
  overall: MonthlySummaryCard;
  by_account: MonthlyAccountSummary[];
};

export type ImportPreviewItem = {
  row: number;
  date: string;
  description: string;
  amount: string;
  currency: string;
  tag_id: number | null;
  status: "ok" | "error";
  message: string | null;
};

export type ImportPreviewError = {
  row: number;
  message: string;
};

export type ImportPreviewResponse = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview: ImportPreviewItem[];
  errors: ImportPreviewError[];
};

export type SplitTransactionRow = {
  id?: number;
  description: string;
  amount: string;
  tag_id: number | null;
};

export type SplitTransactionResponse = {
  parent: Transaction;
  rows: Transaction[];
  remaining_amount: string;
};

export type ClassifierUntaggedTransaction = {
  id: number;
  date: string;
  description: string;
  account_id: number;
  amount: string;
  currency: string;
};

export type ClassifierModelMeta = {
  account_id: number;
  user_id: number;
  trained_at: string;
  model_name: string;
  score: number;
  sample_count: number;
  class_count: number;
};

export type ClassifierTrainResponse = {
  trained: boolean;
  reason: string | null;
  meta: ClassifierModelMeta | null;
};

export type ClassifierPredictionItem = {
  transaction_id: number;
  suggested_tag_id: number;
  confidence: number;
};

export type ClassifierPredictResponse = {
  model_ready: boolean;
  reason: string | null;
  meta: ClassifierModelMeta | null;
  predictions: ClassifierPredictionItem[];
};
