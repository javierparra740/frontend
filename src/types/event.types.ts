import type { Task } from "./task.types";

export interface Event {
    id: number;
    task_id: number;
    title: string;
    event_date: string;
    created_at: string;
}

export interface EventCreate {
    task_id: number;
    title: string;
    event_date: string;
}

export interface EventWithDetails extends Event {
    task?: Task;
}