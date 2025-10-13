
export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string | Date;
  status: 'ToDo' | 'In Progress' | 'Done';
  assignee?: User;
  geoFileUrl?: string;
  auditLog?: any[];
}

export interface User {
  id: string;
  name: string;
}
