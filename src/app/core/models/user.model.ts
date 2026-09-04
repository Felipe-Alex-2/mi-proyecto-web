export type UserRole = 'ADMIN' | 'STORE_MANAGER' | 'CASHIER' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  branch_id?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  password?: string;
}

export interface UserCreateAdmin {
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
  phone?: string;
}

export interface UserUpdateAdmin {
  full_name?: string;
  email?: string;
  role?: UserRole;
  phone?: string;
  is_active?: boolean;
  password?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}
