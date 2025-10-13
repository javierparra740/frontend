
import React, { useState } from 'react';
import { useTasksKanban } from '../../../hooks/useTasks';
import TaskCard from '../KanbanCard/KanbanCard';
import styles from './KanbanBoard.module.css';
import { useDragAndDrop } from '@formkit/drag-and-drop/react';
import { Task } from '../../../types/task.types';
import { PostgresTaskService } from '../../../../data/TaskService.postgres';
import TaskFilter from '../TaskFilter/TaskFilter';
import CreateTaskModal from '../CreateTaskModal/CreateTaskModal';

const TaskBoard: React.FC = () => {
  const taskService = new PostgresTaskService();
  const { tasks, users, loading, updateTaskStatus } = useTasksKanban(taskService, 'your-project-id', 'your-org-id');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({ searchTerm: '', status: '', userId: '' });

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const filteredTasks = tasks.filter(task => {
    return (
      (filters.searchTerm ? task.title.includes(filters.searchTerm) || task.description.includes(filters.searchTerm) : true) &&
      (filters.status ? task.status === filters.status : true) &&
      (filters.userId ? task.assignee?.id === filters.userId : true)
    );
  });

  const todoTasks = filteredTasks.filter((t) => t.status === 'ToDo');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'In Progress');
  const doneTasks = filteredTasks.filter((t) => t.status === 'Done');

  const [toDoBoard, toDoList] = useDragAndDrop<Task>(todoTasks, {
    group: 'kanban',
    onEnd: (data) => {
      const { target, parent } = data;
      const targetId = target.id;
      if(parent.id === 'inProgress'){
        updateTaskStatus(targetId, 'In Progress');
      } else if (parent.id === 'done'){
        updateTaskStatus(targetId, 'Done');
      }
    },
  });
  const [inProgressBoard, inProgressList] = useDragAndDrop<Task>(inProgressTasks, {
    group: 'kanban',
    onEnd: (data) => {
        const { target, parent } = data;
        const targetId = target.id;
        if(parent.id === 'todo'){
          updateTaskStatus(targetId, 'ToDo');
        } else if (parent.id === 'done'){
          updateTaskStatus(targetId, 'Done');
        }
      },
  });
  const [doneBoard, doneList] = useDragAndDrop<Task>(doneTasks, {
    group: 'kanban',
    onEnd: (data) => {
        const { target, parent } = data;
        const targetId = target.id;
        if(parent.id === 'todo'){
          updateTaskStatus(targetId, 'ToDo');
        } else if (parent.id === 'inProgress'){
          updateTaskStatus(targetId, 'In Progress');
        }
      },
  });

  if (loading) {
    return <div className={styles.loading}>Loading tasks...</div>;
  }

  return (
    <div>
      <TaskFilter users={users} onFilterChange={handleFilterChange} />
      <button onClick={() => setIsModalOpen(true)} className={styles.newTaskButton}>New Task</button>
      <CreateTaskModal users={users} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <div className={styles.taskBoard}>
        <div id="todo" ref={toDoBoard} className={styles.column}>
          <div className={styles.columnHeader}>To Do</div>
          {toDoList.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        <div id="inProgress" ref={inProgressBoard} className={styles.column}>
          <div className={styles.columnHeader}>In Progress</div>
          {inProgressList.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        <div id="done" ref={doneBoard} className={styles.column}>
          <div className={styles.columnHeader}>Done</div>
          {doneList.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
