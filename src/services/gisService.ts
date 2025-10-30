import shp from 'shpjs';
import type { FeatureCollection } from 'geojson';
import type { LayerData, LayerValidationResult } from '../types/geo.types';
import { apiService } from './api';
import { BackendValidationService } from './backendValidationService';

// Extender el servicio GIS para integrar con la base de datos
export const GeoService = {
    uploadLayer: async (file: File, taskId: number, onProgress: (progress: number) => void): Promise<{
        success: boolean;
        layer: LayerData;
        dbLayer?: any;
        validation?: {
            security: any;
            geographic: any;
            attributes: any;
            performance: any;
            backend?: any;
        }
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    onProgress(10);

                    // 1. Validación backend primero
                    const backendValidation = await BackendValidationService.quickValidate(file);
                    onProgress(30);

                    if (!backendValidation.isValid) {
                        reject(new Error(backendValidation.errors.join('; ')));
                        return;
                    }

                    // 2. Procesar shapefile con shpjs
                    const buffer = e.target?.result as ArrayBuffer;
                    let geoJson = await shp(buffer);

                    // Si shpjs devuelve un array, fusionar FeatureCollections
                    if (Array.isArray(geoJson)) {
                        geoJson = {
                            type: 'FeatureCollection',
                            features: geoJson.flatMap((fc: any) => fc.features),
                        } as FeatureCollection;
                    }

                    onProgress(70);

                    // 3. Validaciones cliente (las existentes)
                    const geographicValidation = validateGeographicData(geoJson);
                    const attributesValidation = validateAttributes(geoJson);
                    const performanceValidation = validatePerformance(geoJson);

                    // Combinar todos los errores
                    const allErrors = [
                        ...geographicValidation.errors,
                        ...performanceValidation.errors
                    ];

                    // Si hay errores críticos, rechazar
                    if (allErrors.length > 0) {
                        reject(new Error(allErrors.join('; ')));
                        return;
                    }

                    // 4. Guardar en base de datos
                    let dbLayer;
                    try {
                        // Calcular hash del archivo
                        const hash = await calculateFileHash(file);

                        // Crear registro en base de datos
                        dbLayer = await apiService.uploadLayerFile(taskId, file);

                        console.log('✅ Capa guardada en BD con ID:', dbLayer.id);
                    } catch (dbError) {
                        console.warn('⚠️ No se pudo guardar en BD, pero la capa se procesó:', dbError);
                        // No rechazamos porque el procesamiento fue exitoso, solo mostramos advertencia
                    }

                    onProgress(100);

                    resolve({
                        success: true,
                        layer: {
                            name: file.name,
                            geoJson,
                            layerId: dbLayer?.id,
                            taskId: taskId
                        },
                        dbLayer,
                        validation: {
                            security: geographicValidation,
                            geographic: geographicValidation,
                            attributes: attributesValidation,
                            performance: performanceValidation,
                            backend: backendValidation
                        }
                    });

                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsArrayBuffer(file);
        });
    },

    // Obtener capas desde la base de datos
    async getLayersByTask(taskId: number): Promise<LayerData[]> {
        try {
            const layers = await apiService.getLayers(taskId);

            // Convertir las capas de la BD al formato LayerData
            return layers.map(layer => ({
                name: layer.filename,
                geoJson: { type: 'FeatureCollection', features: [] }, // Se cargaría on-demand
                layerId: layer.id,
                taskId: layer.task_id
            }));
        } catch (error) {
            console.error('Error obteniendo capas:', error);
            return [];
        }
    },

    // Mantener funciones existentes para compatibilidad
    downloadLayer: async (layerId: string): Promise<Blob> => {
        const mockBlob = new Blob([JSON.stringify({ layerId, meta: 'mock' })], { type: 'application/zip' });
        return Promise.resolve(mockBlob);
    },

    runValidation: async (layerId: string): Promise<{ issues: string[] }> => {
        const hasIssues = Math.random() > 0.5;
        return Promise.resolve({ issues: hasIssues ? ['Geometría vacía detectada'] : [] });
    },
};

// Función auxiliar para calcular hash del archivo (SHA-256)
const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Las funciones de validación existentes se mantienen igual...
const validateGeographicData = (geoJson: FeatureCollection): any => { /* ... */ };
const validateAttributes = (geoJson: FeatureCollection): any => { /* ... */ };
const validatePerformance = (geoJson: FeatureCollection): any => { /* ... */ };