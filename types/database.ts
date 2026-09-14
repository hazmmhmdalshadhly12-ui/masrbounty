import type { Profile, UserRoleRow, ResearcherProfile } from './user';
import type { Program } from './program';
import type { Report } from './report';

/** Canonical profile row (single source of truth lives in types/user.ts). */
export type { Profile };
export type DbProfile = Profile;
export type DbUserRole = UserRoleRow;
export type DbResearcherProfile = ResearcherProfile;
export type DbProgram = Program;
export type DbReport = Report;

export interface PaginatedParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sort?: string;
  order?: 'asc' | 'desc';
}
