
import pool from './database';
import { Task, TaskService, User } from './TaskService'; // Assuming interfaces are in a shared file

export class PostgresTaskService implements TaskService {
  async subscribeToTasks(
    projectId: string,
    onTasksUpdate: (tasks: Task[]) => void
  ): Promise<() => void> {
    try {
      const result = await pool.query('SELECT * FROM tasks WHERE "projectId" = $1', [
        projectId,
      ]);
      onTasksUpdate(result.rows);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
    // Real-time subscription is more complex and might require additional tools
    return () => {}; // Return an empty unsubscribe function
  }

  async updateTaskStatus(
    taskId: string,
    newStatus: 'ToDo' | 'In Progress' | 'Done',
    author: string
  ): Promise<void> {
    try {
      await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [
        newStatus,
        taskId,
      ]);
      // Audit logging can be implemented here by inserting into an audit table
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  }

  async createTask(
    taskData: Omit<Task, 'id' | 'auditLog' | 'status'>,
    projectId: string
  ): Promise<void> {
    const { title, description, dueDate } = taskData;
    try {
      await pool.query(
        'INSERT INTO tasks (title, description, "dueDate", "projectId", status) VALUES ($1, $2, $3, $4, $5)',
        [title, description, dueDate, projectId, 'ToDo']
      );
    } catch (error) {
      console.error('Error creating task:', error);
    }
  }

  async uploadGeoFile(file: File): Promise<string> {
    // File upload logic would go here. For simplicity, we'll return a placeholder.
    // This could involve saving the file to a file system and storing the path in the database.
    console.log(`Uploading file: ${file.name}`);
    return `/uploads/geo-files/${file.name}`;
  }

  async fetchUsers(organizationId: string): Promise<User[]> {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE "organizationId" = $1',
        [organizationId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }
}
