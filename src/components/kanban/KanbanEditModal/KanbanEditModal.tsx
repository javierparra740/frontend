
import React, { useState } from 'react';
import styles from './KanbanEditModal.module.css';

interface KanbanEditModalProps {
  task: {
    id: string;
    title: string;
    assignee: string;
    dueDate: string;
  };
  onClose: () => void;
  onSave: (updatedTask: {
    id: string;
    title: string;
    assignee: string;
    dueDate: string;
  }) => void;
}

const KanbanEditModal: React.FC<KanbanEditModalProps> = ({
  task,
  onClose,
  onSave,
}) => {
  const [assignee, setAssignee] = useState(task.assignee);
  const [dueDate, setDueDate] = useState(task.dueDate);

  const handleSave = () => {
    onSave({
      ...task,
      assignee,
      dueDate,
    });
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <h2>Edit Task</h2>
        <div className={styles.formGroup}>
          <label htmlFor="assignee">Assignee</label>
          <input
            type="text"
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="dueDate">Due Date</label>
          <input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className={styles.buttonGroup}>
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default KanbanEditModal;

