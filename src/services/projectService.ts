import type Project from '../types/project.types';
import type User from "../types/user.types"

// Datos mock iniciales
let projects: Project[] = [
    {
        id: '1',
        name: 'Proyecto Alpha',
        description: 'Cartografía urbana',
        dueDate: new Date('2025-12-31').toISOString(),
        crs: 'EPSG:4326',
        responsibleId: 'u1',
        status: 'active',
    },
    {
        id: '2',
        name: 'Proyecto Beta',
        description: 'Análisis de cobertura vegetal',
        dueDate: new Date('2025-11-15').toISOString(),
        crs: 'EPSG:3857',
        responsibleId: 'u2',
        status: 'active',
    },
];

let users: User[] = [
    { id: 'u1', name: 'Laura García' },
    { id: 'u2', name: 'Carlos Ruiz' },
    { id: 'u3', name: 'Ana Martínez' },
];

let listeners: ((projects: Project[]) => void)[] = [];

// Audit log básico
const logAudit = (action: string, projectId?: string, details?: any) => {
    console.log(`[AUDIT] ${new Date().toISOString()} - ${action}`, { projectId, details });
};

const ProjectService = {
    // CRUD básico
    async createProject(data: Omit<Project, 'id' | 'status'>): Promise<Project> {
        const newProject: Project = {
            ...data,
            id: `p${Date.now()}`,
            status: 'active',
        };
        projects.push(newProject);
        logAudit('CREATE_PROJECT', newProject.id, newProject);
        emitProjects();
        return newProject;
    },

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
        const index = projects.findIndex((p) => p.id === id);
        if (index === -1) throw new Error('Proyecto no encontrado');
        projects[index] = { ...projects[index], ...updates };
        logAudit('UPDATE_PROJECT', id, updates);
        emitProjects();
    },

    async deleteProject(id: string): Promise<void> {
        projects = projects.filter((p) => p.id !== id);
        logAudit('DELETE_PROJECT', id);
        emitProjects();
    },

    async cloneProject(id: string): Promise<Project> {
        const original = projects.find((p) => p.id === id);
        if (!original) throw new Error('Proyecto no encontrado');
        const cloned: Project = {
            ...original,
            id: `p${Date.now()}`,
            name: `Copia de ${original.name}`,
            status: 'active',
        };
        projects.push(cloned);
        logAudit('CLONE_PROJECT', cloned.id, { originalId: id });
        emitProjects();
        return cloned;
    },

    // Usuarios
    async getUsers(): Promise<User[]> {
        return [...users];
    },

    // Suscripción en tiempo real (simulada)
    subscribeToProjects(callback: (projects: Project[]) => void): () => void {
        listeners.push(callback);
        callback([...projects]);
        return () => {
            listeners = listeners.filter((l) => l !== callback);
        };
    },
};

// Emite cambios a todos los suscriptores
const emitProjects = () => {
    const snapshot = [...projects];
    listeners.forEach((l) => l(snapshot));
};
export default ProjectService