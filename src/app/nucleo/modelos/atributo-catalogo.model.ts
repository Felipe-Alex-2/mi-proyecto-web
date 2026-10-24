export interface Category {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface Size {
  id: string;
  name: string;
  code: string;
  category_type?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SizeCreate {
  name: string;
  code: string;
  category_type?: string;
}

export interface SizeUpdate {
  name?: string;
  code?: string;
  category_type?: string;
  is_active?: boolean;
}

export interface Color {
  id: string;
  name: string;
  hex_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ColorCreate {
  name: string;
  hex_code: string;
}

export interface ColorUpdate {
  name?: string;
  hex_code?: string;
  is_active?: boolean;
}
