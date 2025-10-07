import React, { useState } from 'react';
import styles from './CreateProject.module.css';

const CreateProject: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [crs, setCrs] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica para crear el proyecto aquí
    console.log({ name, description, deadline, crs });
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2>Nuevo Proyecto</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="name">Nombre</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="deadline">Fecha Límite</label>
          <input
            type="date"
            id="deadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="crs">CRS</label>
          <input
            type="text"
            id="crs"
            value={crs}
            onChange={(e) => setCrs(e.target.value)}
            required
          />
        </div>
        <button type="submit" className={styles.button}>
          Crear
        </button>
      </form>
    </div>
  );
};

export default CreateProject;
