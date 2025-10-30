import { create } from 'zustand';
import { apiService } from '../services/api';
import type { Project, ProjectWithDetails, Task, Layer } from '../types/types';

interface ProjectState {
    projects: Project[];
    currentProject: ProjectWithDetails | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadProjects: () => Promise<void>;
    loadProject: (id: number) => Promise<void>;
    createProject: (project: any) => Promise<void>;
    updateProject: (id: number, updates: any) => Promise<void>;
    clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    currentProject: null,
    isLoading: false,
    error: null,

    loadProjects: async () => {
        set({ isLoading: true, error: null });
        try {
            const projects = await apiService.getProjects();
            set({ projects, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    loadProject: async (id: number) => {
        set({ isLoading: true, error: null });
        try {
            const project = await apiService.getProject(id);
            set({ currentProject: project, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    createProject: async (projectData: any) => {
        set({ isLoading: true, error: null });
        try {
            const newProject = await apiService.createProject(projectData);
            set(state => ({
                projects: [...state.projects, newProject],
                isLoading: false
            }));
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    updateProject: async (id: number, updates: any) => {
        set({ isLoading: true, error: null });
        try {
            // Implementar actualización
            set({ isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    clearError: () => set({ error: null }),
}));
