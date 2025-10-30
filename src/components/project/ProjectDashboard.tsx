import React, { useEffect, useState } from 'react';
import type {Project} from '../../types/project.types';
import ProjectService from '../../services/projectService';
import './ProjectDashboard.css';
import type {User} from '../../types/user.types';

const ProjectDashboard: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<keyof Project>('name');
    const [isAscending, setIsAscending] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        dueDate: '',
        crs: '',
        responsibleId: '',
    });

    useEffect(() => {
        const unsub = ProjectService.subscribeToProjects((data) => {
            setProjects(data);
            setFilteredProjects(data);
        });

        // Simula carga de usuarios
        ProjectService.getUsers().then(setUsers);

        return unsub;
    }, []);

    useEffect(() => {
        let filtered = projects.filter((p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
            if (valA < valB) return isAscending ? -1 : 1;
            if (valA > valB) return isAscending ? 1 : -1;
            return 0;
        });

        setFilteredProjects(filtered);
    }, [searchTerm, projects, sortKey, isAscending]);

    const handleSort = (key: keyof Project) => {
        if (sortKey === key) {
            setIsAscending(!isAscending);
        } else {
            setSortKey(key);
            setIsAscending(true);
        }
    };

    const openModal = (project?: Project) => {
        if (project) {
            setEditingProject(project);
            setFormData({
                name: project.name,
                description: project.description,
                dueDate: project.dueDate,
                crs: project.crs,
                responsibleId: project.responsibleId,
            });
        } else {
            setEditingProject(null);
            setFormData({
                name: '',
                description: '',
                dueDate: '',
                crs: '',
                responsibleId: '',
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.dueDate || !formData.crs || !formData.responsibleId) {
            alert('Completa todos los campos requeridos');
            return;
        }

        const payload = {
            ...formData,
            dueDate: new Date(formData.dueDate).toISOString(),
            responsibleId: formData.responsibleId,
        };

        if (editingProject) {
            await ProjectService.updateProject(editingProject.id, payload);
        } else {
            await ProjectService.createProject(payload);
        }

        setShowModal(false);
    };

    const handleArchive = async (id: string) => {
        if (!confirm('¿Archivar este proyecto?')) return;
        await ProjectService.updateProject(id, { status: 'archived' });
    };

    const handleClone = async (project: Project) => {
        await ProjectService.cloneProject(project.id);
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h2>Administrador de Proyectos</h2>
                <input
                    type="text"
                    placeholder="Buscar por nombre o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
                <button className="btn-primary" onClick={() => openModal()}>Nuevo Proyecto</button>
            </div>

            <table className="project-table">
                <thead>
                    <tr>
                        <th onClick={() => handleSort('name')}>Nombre</th>
                        <th onClick={() => handleSort('responsibleId')}>Responsable</th>
                        <th onClick={() => handleSort('dueDate')}>Fecha Límite</th>
                        <th onClick={() => handleSort('status')}>Estado</th>
                        <th onClick={() => handleSort('crs')}>CRS</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredProjects.map((p) => (
                        <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{users.find((u) => u.id === p.responsibleId)?.name || '-'}</td>
                            <td>{new Date(p.dueDate).toLocaleDateString()}</td>
                            <td>{p.status === 'active' ? 'Activo' : 'Archivado'}</td>
                            <td>{p.crs}</td>
                            <td>
                                <button onClick={() => openModal(p)}>Editar</button>
                                <button onClick={() => handleArchive(p.id)}>Archivar</button>
                                <button onClick={() => handleClone(p)}>Clonar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
                        <div className="form-group">
                            <label>Nombre *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Descripción</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Fecha Límite *</label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>CRS *</label>
                            <input
                                type="text"
                                placeholder="EPSG:4326"
                                value={formData.crs}
                                onChange={(e) => setFormData({ ...formData, crs: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Responsable *</label>
                            <select
                                value={formData.responsibleId}
                                onChange={(e) => setFormData({ ...formData, responsibleId: e.target.value })}
                            >
                                <option value="">Seleccionar...</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={handleSave}>Guardar</button>
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDashboard;