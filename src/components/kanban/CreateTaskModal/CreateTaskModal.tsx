
import React, { useState } from 'react';
import { Task, User } from '../../../types/task.types';
import styles from './CreateTaskModal.module.css';
import { PostgresTaskService } from '../../../../data/TaskService.postgres';

interface CreateTaskModalProps {
  users: User[];
  onClose: () => void;
  isOpen: boolean;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ users, onClose, isOpen }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [geoFile, setGeoFile] = useState<File | null>(null);
  const taskService = new PostgresTaskService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let geoFileUrl = '';
    if (geoFile) {
      geoFileUrl = await taskService.uploadGeoFile(geoFile);
    }

    const newTask: Partial<Task> = {
      title,
      description,
      dueDate,
      assignee: users.find(u => u.id === assigneeId),
      status: 'ToDo',
      geoFileUrl,
    };

    await taskService.createTask(newTask as Task);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required>
            <option value="">Assign to</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".gpkg,.shp"
            onChange={(e) => setGeoFile(e.target.files ? e.target.files[0] : null)}
          />
          <div className={styles.modalActions}>
            <button type="submit" className={styles.btn-primary}>Create Task</button>
            <button type="button" onClick={onClose} className={styles.btn-secondary}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
