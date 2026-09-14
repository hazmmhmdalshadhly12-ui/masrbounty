export interface AuthItem {
  id: string;
  created_at: string;
}

export type UserRole = 'researcher' | 'company' | 'moderator' | 'admin';

export interface SessionUser {
  id: string;
  email: string | null;
  username: string | null;
  roles: UserRole[];
}

export interface AuthState {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  role: 'researcher' | 'company';
}
