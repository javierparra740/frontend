// src/models/KPIHistory.ts
export interface KPIHistory {
    id: number;
    cycle: number;
    lead_time_minutes: number | null;
    nps_avg: number | null;
    tasks_closed: number | null;
    layers_orphan: number | null;
    created_at: string;
}
export interface KPISummary {
    current_cycle: number;
    average_lead_time: number;
    current_nps: number;
    tasks_closed_this_cycle: number;
    orphan_layers_count: number;
    cycle_start_date: string;
}