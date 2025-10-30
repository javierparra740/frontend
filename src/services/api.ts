import type { KPIHistory, KPISummary } from '../types/kpi.types';
import type {
    User, UserCreate, UserUpdate,
    Organization, OrganizationCreate,
    Project, ProjectCreate, ProjectWithDetails,
    Task, TaskCreate, TaskWithDetails,
    Layer, LayerCreate, LayerWithDetails,
    AuditLog, AuditLogCreate,
    Event, EventCreate,
    NPSSurvey, NPSSurveyCreate, NPSStats, TaskStatus
} from '../types/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        const response = await fetch(url, config);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // Users
    async getUsers(): Promise<User[]> {
        return this.request<User[]>('/users');
    }

    async createUser(user: UserCreate): Promise<User> {
        return this.request<User>('/users', {
            method: 'POST',
            body: JSON.stringify(user),
        });
    }

    async updateUser(id: number, user: UserUpdate): Promise<User> {
        return this.request<User>(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(user),
        });
    }

    // Organizations
    async getOrganizations(): Promise<Organization[]> {
        return this.request<Organization[]>('/organizations');
    }

    async createOrganization(org: OrganizationCreate): Promise<Organization> {
        return this.request<Organization>('/organizations', {
            method: 'POST',
            body: JSON.stringify(org),
        });
    }

    // Projects
    async getProjects(): Promise<Project[]> {
        return this.request<Project[]>('/projects');
    }

    async getProject(id: number): Promise<ProjectWithDetails> {
        return this.request<ProjectWithDetails>(`/projects/${id}`);
    }

    async createProject(project: ProjectCreate): Promise<Project> {
        return this.request<Project>('/projects', {
            method: 'POST',
            body: JSON.stringify(project),
        });
    }

    // Tasks
    async getTasks(projectId?: number): Promise<Task[]> {
        const endpoint = projectId ? `/tasks?projectId=${projectId}` : '/tasks';
        return this.request<Task[]>(endpoint);
    }

    async createTask(task: TaskCreate): Promise<Task> {
        return this.request<Task>('/tasks', {
            method: 'POST',
            body: JSON.stringify(task),
        });
    }

    async updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
        return this.request<Task>(`/tasks/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    // Layers
    async getLayers(taskId?: number): Promise<Layer[]> {
        const endpoint = taskId ? `/layers?taskId=${taskId}` : '/layers';
        return this.request<Layer[]>(endpoint);
    }

    async createLayer(layer: LayerCreate): Promise<Layer> {
        return this.request<Layer>('/layers', {
            method: 'POST',
            body: JSON.stringify(layer),
        });
    }

    async uploadLayerFile(taskId: number, file: File): Promise<Layer> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskId', taskId.toString());

        const response = await fetch(`${API_BASE_URL}/layers/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // Audit
    async getAuditLogs(projectId?: number): Promise<AuditLog[]> {
        const endpoint = projectId ? `/audit?projectId=${projectId}` : '/audit';
        return this.request<AuditLog[]>(endpoint);
    }

    // KPI
    async getKPISummary(): Promise<KPISummary> {
        return this.request<KPISummary>('/kpi/summary');
    }

    async getKPIHistory(): Promise<KPIHistory[]> {
        return this.request<KPIHistory[]>('/kpi/history');
    }

    // Events
    async getEvents(startDate?: string, endDate?: string): Promise<Event[]> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const endpoint = `/events?${params.toString()}`;
        return this.request<Event[]>(endpoint);
    }

    // NPS
    async submitNPSSurvey(survey: NPSSurveyCreate): Promise<NPSSurvey> {
        return this.request<NPSSurvey>('/nps', {
            method: 'POST',
            body: JSON.stringify(survey),
        });
    }

    async getNPSStats(): Promise<NPSStats> {
        return this.request<NPSStats>('/nps/stats');
    }
}

export const apiService = new ApiService();
