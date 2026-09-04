export interface StockResponse {
  id: string;
  variant_id: string;
  branch_id: string;
  quantity: number;
  min_alert_threshold: number;
  updated_at: string;
  branch_name?: string | null;
  branch_city?: string | null;
}

export interface StockAdjustRequest {
  variant_id: string;
  branch_id: string;
  quantity: number;
}

export interface BranchInventoryItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  category_name: string;
  sku: string;
  size_code: string;
  size_name: string;
  color_name: string;
  color_hex: string;
  price: number;
  quantity: number;
  min_alert_threshold: number;
  is_low_stock: boolean;
}
