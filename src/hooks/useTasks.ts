
import { useState, useEffect } from 'react';
import { Task, User } from '../types/task.types';
import { TaskService } from '../../data/TaskService';

export const useTasksKanban = (
  taskService: TaskService,
  projectId: string,
  organizationId: string
) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLoading(true);

    const unsubscribe = taskService.subscribeToTasks(projectId, (newTasks) => {
      setTasks(newTasks);
      setLoading(false);
    });

    taskService
      .fetchUsers(organizationId)
      .then(setUsers)
      .catch((err) => {
        setError('Failed to fetch users.');
        console.error(err);
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [projectId, organizationId, taskService]);

  const updateTaskStatus = async (taskId: string, newStatus: 'ToDo' | 'In Progress' | 'Done') => {
    // Assuming a default author for now. In a real app, you'd get this from auth context.
    await taskService.updateTaskStatus(taskId, newStatus, 'current-user');
  };


  return { tasks, users, loading, error, updateTaskStatus };
};
