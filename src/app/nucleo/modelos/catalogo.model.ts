export interface CatalogFilterOptions {
  categories: CatalogOption[];
  sizes: CatalogOption[];
  colors: CatalogColorOption[];
  seasons: CatalogOption[];
  branches: CatalogBranchOption[];
  genders: string[];
  min_price: number;
  max_price: number;
}

export interface CatalogOption {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
}

export interface CatalogColorOption extends CatalogOption {
  hex_code?: string | null;
}

export interface CatalogBranchOption {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface CatalogProductVariant {
  id: string;
  size_id: string;
  size_name: string;
  size_code: string;
  color_id: string;
  color_name: string;
  color_hex: string;
  sku: string;
  price: number;
  total_stock: number;
  branch_availability: CatalogBranchStock[];
}

export interface CatalogBranchStock {
  branch_id: string;
  branch_name: string;
  branch_city: string;
  quantity: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  season_id?: string | null;
  season_name?: string | null;
  gender?: string | null;
  promotion_id?: string | null;
  promotion_name?: string | null;
  discount_percent?: number | null;
  image_url?: string | null;
  min_price: number;
  max_price: number;
  total_stock: number;
  variants: CatalogProductVariant[];
  colors: { name: string; hex?: string | null }[];
  sizes: { name: string; code?: string | null }[];
}

export interface CatalogProductListResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  page_size: number;
}
