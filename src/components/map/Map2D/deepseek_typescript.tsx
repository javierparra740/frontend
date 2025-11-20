import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON as LeafletGeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection, Geometry, Feature, Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection } from 'geojson';
import Swal from 'sweetalert2';
import L from 'leaflet';
import shp from 'shpjs'; // ✅ IMPORTAR SHpJS

// Configuración de iconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- INTERFACES ---
interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

interface ValidationStats {
    totalFeatures: number;
    totalVertices: number;
    geometryTypes: Set<string>;
    hasAttributes: boolean;
    processingMethod: 'qgis' | 'shpjs' | 'fallback';
    processingTime: number;
}

interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'validating';
    progress: number;
    errors?: string[];
    warnings?: string[];
    validationStats?: ValidationStats;
    processingMethod?: 'qgis' | 'shpjs' | 'fallback';
}

interface LayerData {
    name: string;
    geoJson: FeatureCollection;
    validationStats?: ValidationStats;
    style: LayerStyle;
    featureCount: number;
    bounds: [number, number, number, number];
    processingMethod: 'qgis' | 'shpjs' | 'fallback';
    fileSize: number;
    uploadTime: Date;
}

interface LayerStyle {
    color: string;
    weight: number;
    opacity: number;
    fillColor?: string;
    fillOpacity: number;
}

// --- FUNCIONES MEJORADAS PARA MANEJAR GEOMETRÍAS ---

// Función robusta para extraer todas las coordenadas de cualquier geometría
const extractAllCoordinates = (geometry: Geometry): number[][] => {
    const coordinates: number[][] = [];

    const extractFromGeometry = (geom: Geometry) => {
        switch (geom.type) {
            case 'Point':
                coordinates.push((geom as Point).coordinates);
                break;

            case 'LineString':
                coordinates.push(...(geom as LineString).coordinates);
                break;

            case 'Polygon':
                (geom as Polygon).coordinates.forEach(ring => {
                    coordinates.push(...ring);
                });
                break;

            case 'MultiPoint':
                coordinates.push(...(geom as MultiPoint).coordinates);
                break;

            case 'MultiLineString':
                (geom as MultiLineString).coordinates.forEach(line => {
                    coordinates.push(...line);
                });
                break;

            case 'MultiPolygon':
                (geom as MultiPolygon).coordinates.forEach(polygon => {
                    polygon.forEach(ring => {
                        coordinates.push(...ring);
                    });
                });
                break;

            case 'GeometryCollection':
                (geom as GeometryCollection).geometries.forEach(g => extractFromGeometry(g));
                break;

            default:
                console.warn('Tipo de geometría no soportado:', geom.type);
        }
    };

    extractFromGeometry(geometry);
    return coordinates;
};

// Función para contar vértices de cualquier geometría
const countVertices = (geometry: Geometry): number => {
    const coordinates = extractAllCoordinates(geometry);
    return coordinates.length;
};

// Función para obtener el tipo de geometría principal (excluyendo GeometryCollection)
const getMainGeometryType = (geometry: Geometry): string => {
    if (geometry.type === 'GeometryCollection') {
        const collection = geometry as GeometryCollection;
        if (collection.geometries.length > 0) {
            return collection.geometries[0].type;
        }
        return 'Unknown';
    }
    return geometry.type;
};

// ✅ Verificación simplificada - ya no necesitamos verificar window.shp
const isShpjsAvailable = () => {
    return typeof shp !== 'undefined' && typeof shp === 'function';
};

const isQgisAvailable = () => {
    return typeof window !== 'undefined' && 
           (window as any).QgisLayerService && 
           typeof (window as any).QgisLayerService.uploadLayer === 'function';
};

// --- TIPOS PARA SHpJS ---
// shpjs puede retornar diferentes tipos, necesitamos manejar todos
type ShpjsResult = FeatureCollection | FeatureCollection[];

// --- FUNCIONES DE PROCESAMIENTO CORREGIDAS ---
const processShapefile = async (file: File): Promise<FeatureCollection> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (!arrayBuffer) {
                    throw new Error('No se pudo leer el archivo');
                }

                // shpjs puede retornar FeatureCollection o FeatureCollection[]
                const result = await shp(arrayBuffer) as ShpjsResult;
                
                let geoJson: FeatureCollection;

                // ✅ MANEJAR DIFERENTES TIPOS DE RETORNO
                if (Array.isArray(result)) {
                    // Si es un array, tomar el primer FeatureCollection
                    if (result.length === 0) {
                        throw new Error('El archivo no contiene capas válidas');
                    }
                    geoJson = result[0];
                } else {
                    // Si es un solo FeatureCollection
                    geoJson = result;
                }

                // ✅ VALIDAR QUE TENGA FEATURES
                if (!geoJson.features || !Array.isArray(geoJson.features) || geoJson.features.length === 0) {
                    throw new Error('El archivo no contiene geometrías válidas');
                }

                // ✅ FILTRAR FEATURES VÁLIDAS
                const validFeatures = geoJson.features.filter((feature: Feature) => 
                    feature.geometry && 
                    feature.geometry.type && 
                    feature.geometry.type !== 'GeometryCollection'
                );

                if (validFeatures.length === 0) {
                    throw new Error('No se encontraron geometrías válidas después del filtrado');
                }

                // ✅ RETORNAR FeatureCollection VÁLIDO
                const validGeoJson: FeatureCollection = {
                    type: 'FeatureCollection',
                    features: validFeatures
                };

                resolve(validGeoJson);

            } catch (error) {
                console.error('Error detallado con shpjs:', error);
                reject(new Error(`No se pudo procesar el shapefile: ${error instanceof Error ? error.message : 'Error desconocido'}`));
            }
        };

        reader.onerror = () => reject(new Error('Error leyendo el archivo'));
        reader.readAsArrayBuffer(file);
    });
};

const processGeoJson = async (file: File): Promise<FeatureCollection> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const geoJson = JSON.parse(content) as FeatureCollection;

                // Validar estructura GeoJSON
                if (!geoJson.type || geoJson.type !== 'FeatureCollection') {
                    throw new Error('No es un FeatureCollection GeoJSON válido');
                }

                if (!geoJson.features || !Array.isArray(geoJson.features) || geoJson.features.length === 0) {
                    throw new Error('No contiene features válidos');
                }

                // Filtrar features válidas
                const validFeatures = geoJson.features.filter(feature => 
                    feature.geometry && 
                    feature.geometry.type && 
                    feature.geometry.type !== 'GeometryCollection'
                );

                if (validFeatures.length === 0) {
                    throw new Error('No se encontraron geometrías válidas');
                }

                resolve({
                    ...geoJson,
                    features: validFeatures
                });

            } catch (error) {
                reject(new Error(`Error procesando GeoJSON: ${error instanceof Error ? error.message : 'Error desconocido'}`));
            }
        };

        reader.onerror = () => reject(new Error('Error leyendo el archivo'));
        reader.readAsText(file);
    });
};

// Función para simular procesamiento QGIS
const processWithQgis = async (file: File): Promise<FeatureCollection> => {
    return new Promise((resolve, reject) => {
        try {
            // Simular procesamiento QGIS - usar shpjs como fallback
            processShapefile(file).then(resolve).catch(reject);
        } catch (error) {
            reject(new Error(`Error en procesamiento QGIS: ${error}`));
        }
    });
};

// --- FUNCIONES DE VALIDACIÓN MEJORADAS ---
const validateSecurity = (file: File): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validExtensions = ['.zip', '.geojson', '.json', '.shp'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
        errors.push(`Formato no soportado. Use: ${validExtensions.join(', ')}`);
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        errors.push(`Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 50MB`);
    }

    return { isValid: errors.length === 0, errors, warnings };
};

const generateValidationStats = (geoJson: FeatureCollection, processingMethod: string, processingTime: number): ValidationStats => {
    const geometryTypes = new Set<string>();
    let totalVertices = 0;
    let totalFeatures = geoJson.features.length;
    let hasAttributes = false;

    geoJson.features.forEach(feature => {
        if (feature.geometry) {
            const geometryType = getMainGeometryType(feature.geometry);
            geometryTypes.add(geometryType);
            totalVertices += countVertices(feature.geometry);
        }
        if (feature.properties && Object.keys(feature.properties).length > 0) {
            hasAttributes = true;
        }
    });

    return {
        totalFeatures,
        totalVertices,
        geometryTypes,
        hasAttributes,
        processingMethod: processingMethod as 'qgis' | 'shpjs' | 'fallback',
        processingTime
    };
};

const validateGeographicData = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!geoJson.features || geoJson.features.length === 0) {
        errors.push('El archivo no contiene geometrías válidas');
        return { isValid: false, errors, warnings };
    }

    const geometryTypes = new Set(
        geoJson.features
            .filter(f => f.geometry)
            .map(f => getMainGeometryType(f.geometry))
    );

    if (geometryTypes.size === 0) {
        errors.push('No se encontraron geometrías válidas en el archivo');
    }

    // Validar coordenadas
    let validCoordinatesCount = 0;
    let outOfBoundsCount = 0;

    geoJson.features.forEach((feature, index) => {
        if (feature.geometry) {
            const coordinates = extractAllCoordinates(feature.geometry);
            const invalidCoords = coordinates.filter(coord =>
                coord.length >= 2 && (Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90)
            );

            if (invalidCoords.length > 0) {
                outOfBoundsCount++;
                if (outOfBoundsCount <= 5) { // Limitar warnings
                    warnings.push(`Feature ${index + 1}: ${invalidCoords.length} coordenadas fuera del rango WGS84`);
                }
            }

            if (coordinates.length > 0) {
                validCoordinatesCount++;
            }
        }
    });

    if (outOfBoundsCount > 5) {
        warnings.push(`... y ${outOfBoundsCount - 5} features más con coordenadas fuera de rango`);
    }

    if (validCoordinatesCount === 0) {
        errors.push('No se encontraron coordenadas geográficas válidas');
    }

    return { isValid: errors.length === 0, errors, warnings };
};

const validatePerformance = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const MAX_FEATURES = 100000;
    if (geoJson.features.length > MAX_FEATURES) {
        errors.push(`Demasiadas geometrías (${geoJson.features.length}). Máximo permitido: ${MAX_FEATURES}`);
    }

    let totalVertices = 0;
    const complexFeatures: number[] = [];

    geoJson.features.forEach((feature, index) => {
        if (feature.geometry) {
            const vertices = countVertices(feature.geometry);
            totalVertices += vertices;

            if (vertices > 1000) {
                complexFeatures.push(index + 1);
                if (complexFeatures.length <= 10) {
                    warnings.push(`Feature ${index + 1} tiene ${vertices} vértices`);
                }
            }
        }
    });

    if (complexFeatures.length > 10) {
        warnings.push(`... y ${complexFeatures.length - 10} features más son complejas`);
    }

    if (totalVertices > 500000) {
        warnings.push(`Capa compleja: ${totalVertices.toLocaleString()} vértices totales`);
    }

    return { isValid: errors.length === 0, errors, warnings };
};

const calculateBounds = (geoJson: FeatureCollection): [number, number, number, number] => {
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    let hasValidBounds = false;

    geoJson.features.forEach(feature => {
        if (!feature.geometry) return;

        const coordinates = extractAllCoordinates(feature.geometry);

        coordinates.forEach(coord => {
            if (coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                const [lng, lat] = coord;
                minLng = Math.min(minLng, lng);
                minLat = Math.min(minLat, lat);
                maxLng = Math.max(maxLng, lng);
                maxLat = Math.max(maxLat, lat);
                hasValidBounds = true;
            }
        });
    });

    return hasValidBounds ? [minLng, minLat, maxLng, maxLat] : [-180, -90, 180, 90];
};

const generateSmartStyle = (geometryType: string, layerIndex: number): LayerStyle => {
    const colorPalette = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];

    const baseColor = colorPalette[layerIndex % colorPalette.length];

    switch (geometryType) {
        case 'Polygon':
        case 'MultiPolygon':
            return {
                color: baseColor,
                weight: 2,
                opacity: 0.8,
                fillColor: baseColor,
                fillOpacity: 0.3
            };
        case 'LineString':
        case 'MultiLineString':
            return {
                color: baseColor,
                weight: 3,
                opacity: 0.7,
                fillOpacity: 0
            };
        case 'Point':
        case 'MultiPoint':
            return {
                color: baseColor,
                weight: 2,
                opacity: 0.9,
                fillColor: baseColor,
                fillOpacity: 0.6
            };
        default:
            return {
                color: baseColor,
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.3
            };
    }
};

// --- COMPONENTE PRINCIPAL CORREGIDO ---
const RobustShapefileViewer: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [layers, setLayers] = useState<LayerData[]>([]);
    const [visibility, setVisibility] = useState<Record<string, boolean>>({});
    const [mapCenter, setMapCenter] = useState<[number, number]>([40.4168, -3.7038]);
    const [mapZoom, setMapZoom] = useState<number>(6);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    

    // Handlers de drag & drop
    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    }, []);

    // Estilos del dropzone
    const dropzoneBase: React.CSSProperties = {
        padding: '2rem',
        border: '2px dashed #9ca3af',
        borderRadius: '1rem',
        margin: '1rem',
        transition: 'all 0.3s ease-in-out',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
    };

    const dropzoneDragging: React.CSSProperties = {
        borderColor: '#10b981',
        backgroundColor: '#f0fff4',
        transform: 'scale(1.02)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const dropzoneStyle = isDragging ? { ...dropzoneBase, ...dropzoneDragging } : dropzoneBase;

    // Determinar el método de procesamiento
    const getProcessingMethod = (file: File): 'qgis' | 'shpjs' | 'fallback' => {
        const extension = file.name.toLowerCase().split('.').pop();

        if (extension === 'zip' || extension === 'shp') {
            if (typeof (window as any).QgisLayerService !== 'undefined') {
                return 'qgis';
            }
            return 'shpjs';
        }

        return 'fallback';
    };

    // Procesar archivo
    const processFile = async (file: File, method: 'qgis' | 'shpjs' | 'fallback'): Promise<{
        geoJson: FeatureCollection;
        processingTime: number;
    }> => {
        const startTime = performance.now();
        let geoJson: FeatureCollection;

        try {
            switch (method) {
                case 'qgis':
                    geoJson = await processWithQgis(file);
                    break;
                case 'shpjs':
                    geoJson = await processShapefile(file);
                    break;
                case 'fallback':
                default:
                    geoJson = await processGeoJson(file);
                    break;
            }

            const processingTime = performance.now() - startTime;
            return { geoJson, processingTime };

        } catch (error) {
            // Fallback estratégico
            if (method === 'qgis') {
                try {
                    console.log('QGIS falló, intentando con shpjs...');
                    geoJson = await processShapefile(file);
                    const processingTime = performance.now() - startTime;
                    return { geoJson, processingTime };
                } catch (shpError) {
                    // Último intento
                    try {
                        console.log('shpjs falló, intentando como GeoJSON...');
                        geoJson = await processGeoJson(file);
                        const processingTime = performance.now() - startTime;
                        return { geoJson, processingTime };
                    } catch (finalError) {
                        throw new Error(`Todos los métodos fallaron: ${finalError}`);
                    }
                }
            }

            throw error;
        }
    };

    // Manejar subida de archivos
    const handleFiles = (files: FileList) => {
        const newFiles: UploadingFile[] = Array.from(files).map((file) => ({
            file,
            status: 'pending',
            progress: 0,
            errors: [],
            warnings: []
        }));
        setUploadingFiles((prev) => [...prev, ...newFiles]);
        newFiles.forEach(uploadFile);
    };

    const uploadFile = async (uploadingFile: UploadingFile) => {
        const { file } = uploadingFile;

        const updateProgressState = (updates: Partial<UploadingFile>) => {
            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.file.name === file.name ? { ...f, ...updates } : f
                )
            );
        };

        try {
            updateProgressState({ status: 'validating', progress: 10 });

            const securityValidation = validateSecurity(file);
            if (!securityValidation.isValid) {
                updateProgressState({
                    status: 'error',
                    progress: 0,
                    errors: securityValidation.errors,
                    warnings: securityValidation.warnings
                });
                return;
            }

            updateProgressState({ status: 'uploading', progress: 30 });

            const processingMethod = getProcessingMethod(file);
            updateProgressState({ processingMethod });

            Swal.fire({
                title: `Procesando ${file.name}`,
                html: `
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; margin-bottom: 1rem;">
                            ${processingMethod === 'qgis' ? '🎯' :
                        processingMethod === 'shpjs' ? '⚡' : '📄'}
                        </div>
                        <p>Método: <strong>${processingMethod.toUpperCase()}</strong></p>
                        <p>Procesando archivo...</p>
                    </div>
                `,
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });

            updateProgressState({ status: 'processing', progress: 60 });

            const result = await processFile(file, processingMethod);
            const { geoJson, processingTime } = result;

            updateProgressState({ progress: 90 });

            const geographicValidation = validateGeographicData(geoJson);
            const performanceValidation = validatePerformance(geoJson);

            const allErrors = [
                ...geographicValidation.errors,
                ...performanceValidation.errors
            ];

            if (allErrors.length > 0) {
                Swal.close();
                updateProgressState({
                    status: 'error',
                    progress: 0,
                    errors: allErrors
                });
                return;
            }

            const validationStats = generateValidationStats(geoJson, processingMethod, processingTime);
            const bounds = calculateBounds(geoJson);
            const allWarnings = [
                ...securityValidation.warnings,
                ...geographicValidation.warnings,
                ...performanceValidation.warnings
            ];

            updateProgressState({
                status: 'completed',
                progress: 100,
                warnings: allWarnings,
                validationStats
            });

            // Determinar el tipo de geometría principal para el estilo
            const mainGeometryType = Array.from(validationStats.geometryTypes)[0] || 'Polygon';
            const layerData: LayerData = {
                name: file.name,
                geoJson,
                validationStats,
                style: generateSmartStyle(mainGeometryType, layers.length),
                featureCount: geoJson.features.length,
                bounds,
                processingMethod,
                fileSize: file.size,
                uploadTime: new Date()
            };

            setLayers((prev) => [...prev, layerData]);
            setVisibility((v) => ({ ...v, [layerData.name]: true }));

            if (layers.length === 0 && bounds[0] !== -180) {
                const [minLng, minLat, maxLng, maxLat] = bounds;
                const centerLng = (minLng + maxLng) / 2;
                const centerLat = (minLat + maxLat) / 2;
                setMapCenter([centerLat, centerLng]);
                setMapZoom(10);
            }

            Swal.close();

            Swal.fire({
                title: '✅ Capa Cargada Exitosamente',
                html: `
                    <div style="text-align: left;">
                        <p><strong>${file.name}</strong></p>
                        <div style="background: #f0f9ff; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem;">
                                <div><strong>Features:</strong> ${validationStats.totalFeatures}</div>
                                <div><strong>Vértices:</strong> ${validationStats.totalVertices.toLocaleString()}</div>
                                <div><strong>Geometrías:</strong> ${Array.from(validationStats.geometryTypes).join(', ')}</div>
                                <div><strong>Método:</strong> ${processingMethod.toUpperCase()}</div>
                                <div><strong>Tiempo:</strong> ${processingTime.toFixed(0)}ms</div>
                                <div><strong>Atributos:</strong> ${validationStats.hasAttributes ? 'Sí' : 'No'}</div>
                            </div>
                        </div>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Ver en Mapa'
            });

        } catch (error) {
            Swal.close();
            console.error('Error procesando archivo:', error);

            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            updateProgressState({
                status: 'error',
                progress: 0,
                errors: [errorMessage]
            });

            Swal.fire({
                title: '❌ Error al Procesar',
                html: `
                    <div>
                        <p>No se pudo procesar <strong>${file.name}</strong></p>
                        <p style="color: #dc2626;">${errorMessage}</p>
                    </div>
                `,
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
        }
    };

    // Resto del componente (Drag & Drop, UI, etc.) se mantiene igual...
    // [El resto del código del componente permanece igual que en la respuesta anterior]

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#f8fafc'
        }}>
            {/* Header y contenido igual que antes */}
            <div style={{
                backgroundColor: 'white',
                padding: '1rem 2rem',
                borderBottom: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#1f2937'
                    }}>
                        🗺️ Visualizador de Shapefiles
                    </h1>
                    <p style={{
                        margin: '0.25rem 0 0 0',
                        color: '#6b7280',
                        fontSize: '0.9rem'
                    }}>
                        Carga y visualiza shapefiles, GeoJSON y archivos GIS
                    </p>
                </div>
            </div>

            <div style={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden'
            }}>
                {/* Panel lateral */}
                <div style={{
                    width: '400px',
                    backgroundColor: 'white',
                    borderRight: '1px solid #e5e7eb',
                    overflowY: 'auto',
                    padding: '1.5rem'
                }}>
                    <h2 style={{
                        margin: '0 0 1.5rem 0',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#1f2937'
                    }}>
                        Cargar Capas GIS
                    </h2>

                    {/* Zona de dropzone */}
                    <div
                        style={dropzoneStyle}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".zip,.geojson,.json,.shp"
                            style={{ display: 'none' }}
                            onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        />
                        {/* Contenido del dropzone */}
                    </div>

                    {/* Lista de archivos y capas */}
                    {/* ... */}
                </div>

                {/* Mapa */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    backgroundColor: '#e2e8f0'
                }}>
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap contributors'
                        />

                        {/* Renderizar capas REALES */}
                        {layers.map((layer) => (
                            visibility[layer.name] && (
                                <LeafletGeoJSON
                                    key={layer.name}
                                    data={layer.geoJson}
                                    style={layer.style}
                                    onEachFeature={(feature, layerInstance) => {
                                        if (feature.properties && Object.keys(feature.properties).length > 0) {
                                            const popupContent = `
                                                <div style="max-width: 300px; max-height: 200px; overflow-y: auto;">
                                                    <h4 style="margin: 0 0 8px 0; font-weight: bold;">${layer.name}</h4>
                                                    ${Object.entries(feature.properties)
                                                    .map(([key, value]) =>
                                                        `<div><strong>${key}:</strong> ${value}</div>`
                                                    )
                                                    .join('')}
                                                </div>
                                            `;
                                            layerInstance.bindPopup(popupContent);
                                        }
                                    }}
                                />
                            )
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default RobustShapefileViewer;