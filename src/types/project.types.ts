export default interface Project {
    id: string;
    name: string;
    description: string;
    dueDate: string; // ISO
    crs: string;
    responsibleId: string;
    status: 'active' | 'archived';
}