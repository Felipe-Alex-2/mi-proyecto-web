export interface BranchStaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
  is_active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string;
  opening_hours?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  staff_count: number;
  manager?: BranchStaffMember | null;
  cashiers: BranchStaffMember[];
}

export interface BranchCreate {
  name: string;
  city: string;
  address: string;
  phone?: string;
  opening_hours?: string;
}

export interface BranchUpdate {
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
  opening_hours?: string;
  is_active?: boolean;
}

export interface AssignStaffRequest {
  user_ids: string[];
}
