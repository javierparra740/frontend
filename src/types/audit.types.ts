export interface AuditLog {
    id: number;
    project_id: number;
    user_name: string;
    action: string;
    old_value: any | null;
    new_value: any | null;
    created_at: string;
}

export interface AuditLogCreate {
    project_id: number;
    user_name: string;
    action: string;
    old_value?: any;
    new_value?: any;
}