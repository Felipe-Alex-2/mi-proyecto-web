import { StockResponse } from './stock.model';

export interface VariantCreate {
  size_id: string;
  color_id: string;
  sku?: string;
  price_override?: number | null;
  initial_stock?: Record<string, number>;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size_id: string;
  color_id: string;
  sku: string;
  price_override?: number | null;
  is_active: boolean;
  size_code?: string | null;
  size_name?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  total_stock: number;
  stocks: StockResponse[];
}

export interface ProductCreate {
  name: string;
  description?: string;
  price: number;
  category_id: string;
  season_id?: string;
  supplier_id?: string;
  image_url?: string;
  gender?: string;
  variants: VariantCreate[];
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  price?: number;
  category_id?: string;
  season_id?: string;
  supplier_id?: string;
  image_url?: string;
  gender?: string;
  is_active?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category_id: string;
  category_name?: string | null;
  season_id?: string | null;
  season_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  image_url?: string | null;
  gender: string;
  is_active: boolean;
  total_stock: number;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}
