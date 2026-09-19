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
  payment_method?: 'EFECTIVO' | 'PAYPAL' | string;
  payment_status?: 'PENDING' | 'PAID' | string;
  paypal_order_id?: string;
  paypal_capture_id?: string;
  paid_at?: string;
  total_amount?: number;
}

export interface ReservationStatusUpdate {
  status: ReservationStatus;
  staff_notes?: string;
  payment_method?: string;
  payment_status?: string;
}

export interface PayPalReservationOrderCreate {
  branch_id: string;
  items: { variant_id: string; quantity: number }[];
  customer_notes?: string;
  return_url?: string;
  cancel_url?: string;
}

export interface PayPalOrderResponse {
  order_id: string;
  approval_url: string;
  reservation: Reservation;
}

export interface PayPalCaptureResponse {
  order_id: string;
  capture_id?: string;
  status: string;
  reservation: Reservation;
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
