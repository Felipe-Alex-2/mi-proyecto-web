export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface ReservationItem {
  id: string;
  variant_id: string;
  quantity: number;
  product_id?: string;
  product_name?: string;
  sku?: string;
  size_name?: string;
  color_name?: string;
  color_hex?: string;
  price: number;
  image_url?: string;
}

export interface Reservation {
  id: string;
  reservation_code: string;
  customer_id: string;
  branch_id: string;
  status: ReservationStatus;
  customer_notes?: string;
  staff_notes?: string;
  staff_user_id?: string;
  created_at: string;
  expires_at: string;
  updated_at: string;
  items: ReservationItem[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  branch_name?: string;
  branch_address?: string;
  total_items: number;
  total_estimated_amount: number;
}

export interface ReservationStatusUpdate {
  status: ReservationStatus;
  staff_notes?: string;
}

export interface ReservationStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  expired: number;
  conversion_rate: number;
}
