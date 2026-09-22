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
  name: string;
  description?: string;
  discount_percent: number;
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
