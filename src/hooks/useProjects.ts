import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';

export const useProjects = () => {
    const {
        projects,
        currentProject,
        isLoading,
        error,
        loadProjects,
        loadProject,
        createProject,
        clearError
    } = useProjectStore();

    useEffect(() => {
        loadProjects();
    }, []);

    return {
        projects,
        currentProject,
        isLoading,
        error,
        loadProject,
        createProject,
        clearError
    };
};