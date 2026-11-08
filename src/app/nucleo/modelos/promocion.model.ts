export interface Promotion {
  id: string;
  name: string;
  description?: string | null;
  discount_percent: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionCreate {
  product_ids?: string[];
  name: string;
  description?: string;
  discount_percent: number;
  start_date: string;
  end_date: string;
}

export interface DiscountSuggestion {
  product_id: string;
  product_name: string;
  stock: number;
  days_in_stock: number;
  minutes_in_stock?: number;
  estimated: boolean;
  reason: string;
  discount_percent: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
}

export interface PromotionUpdate {
  name?: string;
  description?: string;
  discount_percent?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}
