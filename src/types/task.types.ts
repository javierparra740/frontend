import type { Layer } from "./geo.types";
import type { Project } from "./project.types";

export type TaskStatus = 'ToDo' | 'Doing' | 'Done';

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  assignee: string | null;
  start_date: string | null;
  end_date: string | null;
  responsible: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  project_id: number;
  title: string;
  description?: string;
  status?: TaskStatus;
  due_date?: string;
  assignee?: string;
  start_date?: string;
  end_date?: string;
  responsible?: string;
}

export interface TaskWithDetails extends Task {
  project?: Project;
  events?: Event[];
  layers?: Layer[];
}

