
import React, { useState } from 'react';
import KanbanEditModal from '../KanbanEditModal/KanbanEditModal';
import styles from './KanbanCard.module.css';
import { taskService } from '../../../services/taskService';
import type { Task } from '../../../types/task.types';

interface KanbanCardProps {
  task: Task;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (updatedTask: Task) => {
    await taskService.updateTask(updatedTask);
    handleCloseModal();
  };

  return (
    <div className={styles.card}>
      <span>{task.title}</span>
      <button onClick={handleOpenModal}>Edit</button>

      {isModalOpen && (
        <KanbanEditModal
          task={task}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default KanbanCard;
