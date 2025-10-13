
import React from 'react';
import { User } from '../../../types/task.types';
import styles from './TaskFilter.module.css';

interface TaskFilterProps {
  users: User[];
  onFilterChange: (filters: { searchTerm: string; status: string; userId: string }) => void;
}

const TaskFilter: React.FC<TaskFilterProps> = ({ users, onFilterChange }) => {
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ [name]: value } as any);
  };

  return (
    <div className={styles.filterContainer}>
      <input
        type="text"
        name="searchTerm"
        placeholder="Search by title or description"
        onChange={handleFilterChange}
        className={styles.filterInput}
      />
      <select name="status" onChange={handleFilterChange} className={styles.filterSelect}>
        <option value="">All Statuses</option>
        <option value="ToDo">To Do</option>
        <option value="In Progress">In Progress</option>
        <option value="Done">Done</option>
      </select>
      <select name="userId" onChange={handleFilterChange} className={styles.filterSelect}>
        <option value="">All Users</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TaskFilter;
