export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type PaymentType = 'EFECTIVO' | 'PAYPAL';

export interface PaymentItem {
  variant_id: string;
  product_name: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  payment_code: string;
  branch_id: string;
  branch_name?: string;
  reservation_id?: string;
  reservation_code?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  concept: string;
  amount: number;
  currency: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  reference?: string;
  paypal_order_id?: string;
  paypal_capture_id?: string;
  cashier_id?: string;
  cashier_name?: string;
  items_detail?: string;
  items?: PaymentItem[];
  notes?: string;
  created_at: string;
  paid_at?: string;
}

export interface PaymentCreate {
  customer_name: string;
  customer_email?: string;
  concept: string;
  amount: number;
  currency?: string;
  payment_type: PaymentType;
  branch_id: string;
  reservation_id?: string;
  items?: PaymentItem[];
  notes?: string;
}

export interface PaymentProcess {
  payment_type?: PaymentType;
  notes?: string;
}

export interface PaymentPayPalOrderResponse {
  payment_id: string;
  order_id: string;
  approval_url: string;
  amount: number;
  currency: string;
}

export interface PendingReservationOption {
  reservation_id: string;
  reservation_code: string;
  customer_name: string;
  customer_email?: string;
  branch_id: string;
  branch_name?: string;
  total_items: number;
  total_amount: number;
  items_summary: string;
  status: string;
  payment_status: string;
}
