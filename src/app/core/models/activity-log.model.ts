export interface ActivityLog {
  id: string;
  user_id?: string | null;
  user_email: string;
  user_name: string;
  action: string;
  description: string;
  category: string;
  ip_address?: string | null;
  created_at: string;
}

export interface ActivityLogListResponse {
  items: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActivityLogCreate {
  action: string;
  description: string;
  category: string;
}
