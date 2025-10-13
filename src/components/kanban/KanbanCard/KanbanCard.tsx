
import React from 'react';
import type { Task } from '../../../types/task.types';
import styles from './KanbanCard.module.css';

interface TaskCardProps {
  task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const statusClass = task.status ? styles[`statusIndicator-${task.status.replace(/\s+/g, '')}`] : '';
  return (
    <div
      id={task.id}
      className={`${styles.taskCard} ${statusClass}`}
    >
      <div className={styles.taskTitle}>{task.title}</div>
      {task.assignee && <div className={styles.taskAssignee}>{task.assignee.name}</div>}
      <div className={styles.taskDueDate}>
        Due: {new Date(task.dueDate).toLocaleDateString()}
      </div>
    </div>
  );
};

export default TaskCard;
