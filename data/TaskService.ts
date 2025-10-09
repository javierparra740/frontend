export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string | Date;
  status: 'ToDo' | 'In Progress' | 'Done';
  geoFileUrl?: string;
  auditLog: any[];
}

export interface User {
  id: string;
  name: string;
}

export interface TaskService {
  subscribeToTasks: (
    projectId: string,
    onTasksUpdate: (tasks: Task[]) => void
  ) => () => void;
  updateTaskStatus: (
    taskId: string,
    newStatus: 'ToDo' | 'In Progress' | 'Done',
    author: string
  ) => Promise<void>;
  createTask: (
    taskData: Omit<Task, 'id' | 'auditLog' | 'status'>,
    projectId: string
  ) => Promise<void>;
  uploadGeoFile: (file: File) => Promise<string>;
  fetchUsers: (organizationId: string) => Promise<User[]>;
}
