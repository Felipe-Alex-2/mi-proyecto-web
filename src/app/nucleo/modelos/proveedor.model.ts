export interface Supplier {
  id: string;
  company_name: string;
  contact_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreate {
  company_name: string;
  contact_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SupplierUpdate {
  company_name?: string;
  contact_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
}
