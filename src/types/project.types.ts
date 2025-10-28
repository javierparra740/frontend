import type { AuditLog } from "./audit.types";
import type { Layer } from "./geo.types";
import type { Organization } from "./organization.types";
import type { Task } from "./task.types";

export type ProjectStatus = 'Active' | 'Inactive' | 'Completed' | 'Cancelled';

export interface Project {
    id: number;
    organization_id: number;
    name: string;
    description: string | null;
    due_date: string | null;
    responsible: string | null;
    crs: string;
    status: ProjectStatus;
    created_at: string;
    updated_at: string;
}

export interface ProjectCreate {
    organization_id: number;
    name: string;
    description?: string;
    due_date?: string;
    responsible?: string;
    crs?: string;
    status?: ProjectStatus;
}

export interface ProjectWithDetails extends Project {
    organization?: Organization;
    tasks?: Task[];
    layers?: Layer[];
    audit_logs?: AuditLog[];
}

