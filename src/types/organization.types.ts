import type { Project } from "./project.types";
import type { User } from "./user.types";

export interface Organization {
    id: number;
    name: string;
    crs_default: string;
    created_at: string;
}

export interface OrganizationCreate {
    name: string;
    crs_default?: string;
}

export interface OrganizationWithUsers extends Organization {
    users?: User[];
    projects?: Project[];
}