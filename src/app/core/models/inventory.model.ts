export type MovementType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'RETURN';

export interface InventoryMovementCreate {
  variant_id: string;
  branch_id: string;
  type: MovementType;
  quantity: number;
  reason: string;
  reference_number?: string;
}

export interface InventoryMovement {
  id: string;
  variant_id: string;
  branch_id: string;
  type: MovementType;
  quantity: number;
  reason: string;
  reference_number?: string;
  previous_stock: number;
  new_stock: number;
  user_id?: string;
  created_at: string;
  product_id?: string;
  product_name?: string;
  sku?: string;
  size_name?: string;
  color_name?: string;
  branch_name?: string;
  user_name?: string;
}

export interface BranchInventorySummary {
  branch_id: string;
  branch_name: string;
  total_variants: number;
  total_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface VariantBranchAvailability {
  branch_id: string;
  branch_name: string;
  branch_city: string;
  branch_address: string;
  quantity: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface AvailabilityMatrixRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  size_name: string;
  size_code: string;
  color_name: string;
  color_hex: string;
  price: number;
  total_quantity: number;
  branches: Record<string, number>;
}
