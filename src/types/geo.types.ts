import type { FeatureCollection, Geometry } from 'geojson';
import type { Task } from './task.types';

export interface Layer {
    id: number;
    task_id: number;
    filename: string;
    hash: string;
    file_path: string | null;
    geometry: any | null; // PostGIS geometry
    uploaded_at: string;
}

export interface LayerCreate {
    task_id: number;
    filename: string;
    hash: string;
    file_path?: string;
    geometry?: any;
}

export interface LayerWithDetails extends Layer {
    task?: Task;
    validation_result?: LayerValidationResult;
}

export interface LayerValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats?: {
        totalFeatures: number;
        totalVertices: number;
        geometryTypes: string[];
        fileSize: number;
    };
}

// Mantener tipos existentes para compatibilidad
export interface LayerData {
    name: string;
    geoJson: FeatureCollection;
    layerId?: number;
    taskId?: number;
    validation?: LayerValidationResult;
}