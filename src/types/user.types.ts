export type UserRole = 'Viewer' | 'Editor' | 'ProjectManager' | 'Admin' | 'SuperAdmin' | 'External';

export interface User {
    id: number;
    email: string;
    password_hash: string;
    role: UserRole;
    organization_id: number;
    created_at: string;
}

export interface UserCreate {
    email: string;
    password: string;
    role: UserRole;
    organization_id: number;
}

export interface UserUpdate {
    email?: string;
    role?: UserRole;
    organization_id?: number;
}
