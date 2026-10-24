export interface Season {
  id: string;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonCreate {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
}

export interface SeasonUpdate {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}
