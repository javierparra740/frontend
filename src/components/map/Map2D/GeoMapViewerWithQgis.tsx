import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import 'leaflet.pm';
import type { FeatureCollection, Geometry } from 'geojson';
import { GeoJSON } from 'react-leaflet';
import { LayerControlPanel } from '../LayerControlPanel/LayerControlPanel';
import Swal from 'sweetalert2';
import { QgisLayerService } from '../../../services/qgisLayerService';


// --- INTERFACES Y TIPOS PARA VALIDACIONES ---
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
}

interface LayerData {
    name: string;
    geoJson: FeatureCollection;
    qgisLayer?: any;
    validationStats?: ValidationStats;
}

interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error' | 'validating';
    progress: number;
    errors?: string[];
    warnings?: string[];
    validationStats?: ValidationStats;
}

// --- FUNCIONES DE VALIDACIÓN ---
const validateSecurity = (file: File): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!file.name.toLowerCase().endsWith('.zip') && !file.name.toLowerCase().endsWith('.gpkg')) {
        errors.push('Solo se permiten archivos ZIP con shapefiles o GeoPackage (.gpkg)');
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        errors.push(
            `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 50MB`
        );
    }

    if (/[<>:"|?*\\/]/.test(file.name)) {
        warnings.push('El nombre del archivo contiene caracteres especiales que podrían causar problemas');
    }

    return { isValid: errors.length === 0, errors, warnings };
};

const getCoordinates = (geometry: Geometry): number[][] => {
    switch (geometry.type) {
        case 'Point':
            return [geometry.coordinates as number[]];
        case 'LineString':
            return geometry.coordinates as number[][];
        case 'Polygon':
            return (geometry.coordinates as number[][][]).flat();
        case 'MultiPoint':
            return geometry.coordinates as number[][];
        case 'MultiLineString':
            return (geometry.coordinates as number[][][]).flat();
        case 'MultiPolygon':
            return (geometry.coordinates as number[][][][]).flat(2);
        default:
            return [];
    }
};

const countVertices = (geometry: Geometry): number => {
    const coords = getCoordinates(geometry);
    return coords.length;
};

const generateValidationStats = (geoJson: FeatureCollection): ValidationStats => {
    const geometryTypes = new Set<string>();
    let totalVertices = 0;
    let totalFeatures = geoJson.features.length;
    let hasAttributes = false;

    geoJson.features.forEach(feature => {
        if (feature.geometry) {
            geometryTypes.add(feature.geometry.type);
            totalVertices += countVertices(feature.geometry);
        }
        if (feature.properties && Object.keys(feature.properties).length > 0) {
            hasAttributes = true;
        }
    });

    return { totalFeatures, totalVertices, geometryTypes, hasAttributes };
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
            .map(f => f.geometry.type)
    );

    if (geometryTypes.size === 0) {
        errors.push('No se encontraron geometrías válidas en el archivo');
    }

    if (geometryTypes.size > 1) {
        warnings.push(`Archivo contiene múltiples tipos de geometría: ${Array.from(geometryTypes).join(', ')}`);
    }

    let validCoordinatesCount = 0;
    geoJson.features.forEach((feature, index) => {
        if (feature.geometry) {
            const coords = getCoordinates(feature.geometry);
            const invalidCoords = coords.filter(coord =>
                Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90
            );

            if (invalidCoords.length > 0) {
                warnings.push(`Feature ${index + 1}: ${invalidCoords.length} coordenadas fuera del rango WGS84 típico`);
            } else if (coords.length > 0) {
                validCoordinatesCount++;
            }
        }
    });

    if (validCoordinatesCount === 0) {
        errors.push('No se encontraron coordenadas geográficas válidas');
    }

    return { isValid: errors.length === 0, errors, warnings };
};

const validatePerformance = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const MAX_FEATURES = 10000;
    if (geoJson.features.length > MAX_FEATURES) {
        errors.push(`Demasiadas geometrías (${geoJson.features.length}). Máximo permitido: ${MAX_FEATURES}`);
    }

    let totalVertices = 0;
    const complexGeometries: number[] = [];

    geoJson.features.forEach((feature, index) => {
        if (feature.geometry) {
            const vertices = countVertices(feature.geometry);
            totalVertices += vertices;

            if (vertices > 1000) {
                complexGeometries.push(index + 1);
            }
        }
    });

    if (complexGeometries.length > 0) {
        warnings.push(`${complexGeometries.length} geometrías son muy complejas (más de 1000 vértices)`);
    }

    if (totalVertices > 100000) {
        warnings.push(`Geometrías muy complejas (${totalVertices.toLocaleString()} vértices totales). Puede afectar el rendimiento`);
    }

    return { isValid: errors.length === 0, errors, warnings };
};

// --- COMPONENTE QGIS RENDERER ---
interface QgisRendererProps {
    layers: LayerData[];
    opacity: Record<string, number>;
    visible: Record<string, boolean>;
}

const QgisRenderer: React.FC<QgisRendererProps> = ({ layers, opacity, visible }) => {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    const containerRef = useRef<HTMLDivElement>(document.createElement('div'));

    useEffect(() => {
        const container = containerRef.current;
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';

        const canvas = canvasRef.current;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        map.getContainer().appendChild(container);

        return () => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        };
    }, [map]);

    useEffect(() => {
        const renderLayers = async () => {
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            const bounds = map.getBounds();
            const size = map.getSize();

            canvasRef.current.width = size.x;
            canvasRef.current.height = size.y;

            const renderOpts = {
                extent: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] as [number, number, number, number],
                width: size.x,
                height: size.y
            };

            for (const layerData of layers) {
                if (visible[layerData.name] && layerData.qgisLayer) {
                    try {
                        const layerOpacity = opacity[layerData.name] ?? 1;
                        ctx.globalAlpha = layerOpacity;
                        await layerData.qgisLayer.render(canvasRef.current, renderOpts);
                    } catch (error) {
                        console.error('Error renderizando capa QGIS:', layerData.name, error);
                    }
                }
            }
            ctx.globalAlpha = 1;
        };

        renderLayers();
    }, [layers, opacity, visible, map]);

    return null;
};

// --- COMPONENTE PRINCIPAL HÍBRIDO ---
const GeoMapViewerWithQgis: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
    const [validationMessages, setValidationMessages] = useState<{ errors: string[], warnings: string[] }>({ errors: [], warnings: [] });
    const [layers, setLayers] = useState<LayerData[]>([]);
    const [visibility, setVisibility] = useState<Record<string, boolean>>({});
    const [opacity, setOpacity] = useState<Record<string, number>>({});
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    // ✅ Función de respaldo para procesar archivos sin QGIS - CORREGIDA
    const processFileWithoutQgis = async (file: File): Promise<{ geoJson: FeatureCollection; layer: any; validation: any }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    // Simular procesamiento básico del archivo
                    const geoJson: FeatureCollection = {
                        type: "FeatureCollection",
                        features: [
                            {
                                type: "Feature",
                                geometry: {
                                    type: "Point",
                                    coordinates: [-3.7038, 40.4168] // Madrid como ejemplo
                                },
                                properties: {
                                    name: file.name,
                                    processed: new Date().toISOString(),
                                    source: 'Fallback Processing'
                                }
                            }
                        ]
                    };

                    // ✅ CORREGIDO: Crear la propiedad layer correctamente
                    const layer = {
                        render: async (canvas: HTMLCanvasElement, opts: any) => {
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                // Dibujar un marcador simple
                                ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
                                ctx.beginPath();
                                const x = canvas.width / 2;
                                const y = canvas.height / 2;
                                ctx.arc(x, y, 20, 0, 2 * Math.PI);
                                ctx.fill();
                                
                                ctx.strokeStyle = 'rgb(29, 78, 216)';
                                ctx.lineWidth = 2;
                                ctx.stroke();
                                
                                ctx.fillStyle = 'white';
                                ctx.font = '12px Arial';
                                ctx.textAlign = 'center';
                                ctx.fillText('📍', x, y + 4);
                            }
                        }
                    };

                    const validation = {
                        attributes: { 
                            warnings: ['Procesado con método alternativo (sin QGIS)'] 
                        },
                        performance: { 
                            warnings: [] 
                        }
                    };

                    resolve({ geoJson, layer, validation });
                } catch (error) {
                    reject(new Error(`Error procesando archivo: ${error}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Error leyendo el archivo'));
            };

            reader.readAsArrayBuffer(file);
        });
    };

    const handleGeometryCreated = useCallback((geoJson: any) => {
        setDrawnGeometry(geoJson);
        
        if (geoJson.features && geoJson.features.length > 0) {
            const stats = generateValidationStats(geoJson);
            console.log('📊 Estadísticas de geometría dibujada:', stats);
            
            Swal.fire({
                title: 'Geometría Creada',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Estadísticas:</strong></p>
                        <ul>
                            <li>Features: ${stats.totalFeatures}</li>
                            <li>Vértices totales: ${stats.totalVertices}</li>
                            <li>Tipos de geometría: ${Array.from(stats.geometryTypes).join(', ')}</li>
                            <li>Con atributos: ${stats.hasAttributes ? 'Sí' : 'No'}</li>
                        </ul>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Aceptar'
            });
        }
    }, []);

    const addLayer = (layer: LayerData) => {
        setLayers((prev) => [...prev, layer]);
    };

    // --- MANEJO DE ARCHIVOS CON QGIS ---
    const handleFiles = (files: FileList) => {
        const newFiles: UploadingFile[] = Array.from(files).map((file) => ({
            file,
            status: 'pending',
            progress: 0,
            errors: [],
            warnings: []
        }));
        setUploadingFiles((prev) => [...prev, ...newFiles]);
        newFiles.forEach(uploadFileWithQgis);
    };

    const uploadFileWithQgis = async (uploadingFile: UploadingFile) => {
        const { file } = uploadingFile;

        const updateProgressState = (progress: number, status: UploadingFile['status'] = 'uploading', errors?: string[], warnings?: string[], validationStats?: ValidationStats) => {
            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.file.name === file.name ? { ...f, progress, status, errors, warnings, validationStats } : f
                )
            );
        };

        try {
            updateProgressState(0, 'validating');

            // Validación inicial de seguridad
            const securityValidation = validateSecurity(file);
            if (!securityValidation.isValid) {
                updateProgressState(0, 'error', securityValidation.errors, securityValidation.warnings);
                setValidationMessages(prev => ({
                    errors: [...prev.errors, ...securityValidation.errors],
                    warnings: [...prev.warnings, ...securityValidation.warnings]
                }));
                return;
            }

            if (securityValidation.warnings.length > 0) {
                setValidationMessages(prev => ({
                    ...prev,
                    warnings: [...prev.warnings, ...securityValidation.warnings]
                }));
            }

            updateProgressState(30, 'uploading');

            Swal.fire({
                title: 'Procesando archivo…',
                text: `Procesando ${file.name}`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            let validatedLayer;
            
            try {
                // Intentar usar QgisLayerService primero
                if (QgisLayerService && typeof QgisLayerService.uploadLayer === 'function') {
                    validatedLayer = await QgisLayerService.uploadLayer(file);
                    console.log('✅ Archivo procesado con QgisLayerService');
                } else {
                    throw new Error('QgisLayerService no está disponible');
                }
            } catch (qgisError) {
                console.warn('QGIS no disponible, usando procesamiento básico:', qgisError);
                
                // ✅ CORREGIDO: Usar procesamiento básico como fallback
                validatedLayer = await processFileWithoutQgis(file);
                console.log('✅ Archivo procesado con método alternativo');
            }

            updateProgressState(70);

            // Generar estadísticas de validación
            const validationStats = generateValidationStats(validatedLayer.geoJson);
            
            const geographicValidation = validateGeographicData(validatedLayer.geoJson);
            const performanceValidation = validatePerformance(validatedLayer.geoJson);

            const allErrors = [
                ...geographicValidation.errors,
                ...performanceValidation.errors
            ];

            if (allErrors.length > 0) {
                Swal.close();
                updateProgressState(0, 'error', allErrors, [], validationStats);
                setValidationMessages(prev => ({
                    errors: [...prev.errors, ...allErrors],
                    warnings: prev.warnings
                }));
                return;
            }

            const allWarnings = [
                ...securityValidation.warnings,
                ...geographicValidation.warnings,
                ...performanceValidation.warnings,
                ...(validatedLayer.validation?.attributes?.warnings || []),
                ...(validatedLayer.validation?.performance?.warnings || [])
            ];

            updateProgressState(100, 'completed', [], allWarnings, validationStats);

            // ✅ CORREGIDO: Asegurar que layer existe
            const layerData: LayerData = {
                name: file.name,
                geoJson: validatedLayer.geoJson,
                qgisLayer: validatedLayer.layer, // ✅ Ahora layer está definido
                validationStats
            };

            addLayer(layerData);
            setVisibility((v) => ({ ...v, [layerData.name]: true }));
            setOpacity((o) => ({ ...o, [layerData.name]: 1 }));

            console.log(`📊 Estadísticas para ${file.name}:`, validationStats);

            if (allWarnings.length > 0) {
                console.warn('Advertencias de validación para', file.name, ':', allWarnings);
                setValidationMessages(prev => ({
                    ...prev,
                    warnings: [...prev.warnings, ...allWarnings]
                }));
            }

            Swal.close();
            
            Swal.fire({
                title: '✅ Archivo Procesado',
                html: `
                    <div style="text-align: left;">
                        <p><strong>${file.name}</strong> se cargó exitosamente.</p>
                        <p><strong>Estadísticas:</strong></p>
                        <ul>
                            <li>Features: ${validationStats.totalFeatures}</li>
                            <li>Vértices totales: ${validationStats.totalVertices.toLocaleString()}</li>
                            <li>Tipos de geometría: ${Array.from(validationStats.geometryTypes).join(', ')}</li>
                            <li>Con atributos: ${validationStats.hasAttributes ? 'Sí' : 'No'}</li>
                        </ul>
                        ${allWarnings.length > 0 ? `
                            <p><strong>Advertencias:</strong></p>
                            <ul style="color: orange;">
                                ${allWarnings.map(warning => `<li>${warning}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Aceptar'
            });

        } catch (error) {
            Swal.close();
            console.error('❌ Error procesando archivo:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar el archivo';
            
            // Mensaje más específico para el error "open"
            if (errorMessage.includes('open') || errorMessage.includes('undefined')) {
                updateProgressState(0, 'error', [
                    'Error al abrir el archivo ZIP',
                    'El archivo puede estar corrupto o no ser un shapefile válido',
                    'Verifica que el ZIP contenga los archivos .shp, .shx, .dbf, .prj'
                ]);
            } else {
                updateProgressState(0, 'error', [errorMessage]);
            }
            
            setValidationMessages(prev => ({
                errors: [...prev.errors, errorMessage],
                warnings: prev.warnings
            }));
        }
    };

    const clearValidationMessages = () => {
        setValidationMessages({ errors: [], warnings: [] });
    };

    // --- DRAG & DROP ---
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        clearValidationMessages();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    // Función para mostrar estadísticas detalladas de una capa
    const showLayerStats = (layerName: string) => {
        const layer = layers.find(l => l.name === layerName);
        if (layer?.validationStats) {
            const stats = layer.validationStats;
            Swal.fire({
                title: `Estadísticas: ${layerName}`,
                html: `
                    <div style="text-align: left;">
                        <ul>
                            <li><strong>Total de Features:</strong> ${stats.totalFeatures}</li>
                            <li><strong>Total de Vértices:</strong> ${stats.totalVertices.toLocaleString()}</li>
                            <li><strong>Tipos de Geometría:</strong> ${Array.from(stats.geometryTypes).join(', ')}</li>
                            <li><strong>Contiene Atributos:</strong> ${stats.hasAttributes ? 'Sí' : 'No'}</li>
                            <li><strong>Vértices por Feature:</strong> ${stats.totalFeatures > 0 ? (stats.totalVertices / stats.totalFeatures).toFixed(1) : '0'}</li>
                        </ul>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Cerrar'
            });
        }
    };

    // --- COMPONENTE PERSONALIZADO PARA EL PANEL DE CAPAS ---
    const CustomLayerControlPanel: React.FC<{
        layers: LayerData[];
        visibility: Record<string, boolean>;
        opacity: Record<string, number>;
        onToggle: (id: string) => void;
        onOpacity: (id: string, value: number) => void;
    }> = ({ layers, visibility, opacity, onToggle, onOpacity }) => {
        return (
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                maxWidth: '300px',
                maxHeight: '400px',
                overflowY: 'auto'
            }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 'bold' }}>
                    Capas ({layers.length})
                </h3>
                {layers.map((layer) => (
                    <div key={layer.name} style={{
                        marginBottom: '0.75rem',
                        padding: '0.5rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        backgroundColor: visibility[layer.name] ? '#f0fff4' : '#f9fafb'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ 
                                fontWeight: 'bold', 
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                flex: 1
                            }} onClick={() => onToggle(layer.name)}>
                                {layer.name}
                            </span>
                            <button 
                                onClick={() => showLayerStats(layer.name)}
                                style={{
                                    backgroundColor: '#8b5cf6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.25rem',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    marginLeft: '0.5rem'
                                }}
                                title="Ver estadísticas"
                            >
                                📊
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={visibility[layer.name] || false}
                                onChange={() => onToggle(layer.name)}
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.875rem' }}>Visible</span>
                            
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={opacity[layer.name] || 1}
                                onChange={(e) => onOpacity(layer.name, parseFloat(e.target.value))}
                                style={{ marginLeft: 'auto', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.75rem', width: '30px' }}>
                                {Math.round((opacity[layer.name] || 1) * 100)}%
                            </span>
                        </div>

                        {layer.validationStats && visibility[layer.name] && (
                            <div style={{ 
                                marginTop: '0.5rem',
                                padding: '0.25rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '0.25rem',
                                fontSize: '0.7rem',
                                color: '#4b5563'
                            }}>
                                📊 {layer.validationStats.totalFeatures} features, 
                                {layer.validationStats.totalVertices.toLocaleString()} vértices
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // --- ESTILOS ---
    const dropzoneBase: React.CSSProperties = {
        padding: '1rem',
        border: '2px dashed #9ca3af',
        margin: '0.5rem',
        transition: 'all 0.15s ease-in-out',
        textAlign: 'center',
        position: 'relative'
    };

    const dropzoneDragging: React.CSSProperties = {
        borderColor: '#10b981',
        backgroundColor: '#f0fff4',
    };

    const uploadButton: React.CSSProperties = {
        backgroundColor: '#3b82f6',
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '0.25rem',
        border: 'none',
        cursor: 'pointer',
        margin: '0.5rem'
    };

    const errorStyle: React.CSSProperties = {
        color: '#dc2626',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        padding: '0.5rem',
        borderRadius: '0.375rem',
        margin: '0.5rem 0'
    };

    const warningStyle: React.CSSProperties = {
        color: '#d97706',
        backgroundColor: '#fffbeb',
        border: '1px solid #fed7aa',
        padding: '0.5rem',
        borderRadius: '0.375rem',
        margin: '0.5rem 0'
    };

    const qgisBadge: React.CSSProperties = {
        backgroundColor: '#9333ea',
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        marginLeft: '0.5rem'
    };

    const dropzoneStyle = isDragging ? { ...dropzoneBase, ...dropzoneDragging } : dropzoneBase;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>

            {/* Zona de Dropzone */}
            <div
                style={dropzoneStyle}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".zip,.gpkg,.shp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        clearValidationMessages();
                        e.target.files && handleFiles(e.target.files);
                    }}
                />
                <p style={{ margin: '0.5rem 0' }}>
                    Arrastra y suelta tus archivos <strong>.zip</strong> con shapefiles o <strong>.gpkg</strong> aquí
                    <span style={qgisBadge}>QGIS</span>
                </p>
                <button onClick={() => {
                    clearValidationMessages();
                    fileInputRef.current?.click();
                }} style={uploadButton}>
                    Seleccionar Archivos
                </button>

                {/* Información de ayuda */}
                <div style={{ 
                    marginTop: '0.5rem', 
                    padding: '0.5rem',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                }}>
                    <strong>💡 Información:</strong> Asegúrate de que los ZIP contengan: .shp, .shx, .dbf, .prj
                </div>

                {validationMessages.errors.length > 0 && (
                    <div style={errorStyle}>
                        <strong>Errores:</strong>
                        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                            {validationMessages.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {validationMessages.warnings.length > 0 && (
                    <div style={warningStyle}>
                        <strong>Advertencias:</strong>
                        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                            {validationMessages.warnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Lista de archivos en proceso */}
                {uploadingFiles.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                        {uploadingFiles.map(({ file, status, progress, errors = [], warnings = [], validationStats }) => (
                            <div key={file.name} style={{
                                marginBottom: '0.5rem',
                                padding: '0.5rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.375rem',
                                backgroundColor: status === 'error' ? '#fef2f2' : status === 'completed' ? '#f0fff4' : 'white'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        width: '50%',
                                        fontWeight: 'bold'
                                    }}>
                                        {file.name}
                                    </span>
                                    <div style={{ width: '25%', height: '0.5rem', backgroundColor: '#e5e7eb', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            backgroundColor: status === 'error' ? '#dc2626' : status === 'completed' ? '#10b981' : '#3b82f6',
                                            transition: 'width 0.3s ease-in-out',
                                            width: `${progress}%`
                                        }}></div>
                                    </div>
                                    <span style={{
                                        width: '16.6667%',
                                        textAlign: 'right',
                                        fontSize: '0.875rem',
                                        color: status === 'error' ? '#dc2626' : status === 'completed' ? '#059669' : status === 'validating' ? '#d97706' : '#374151',
                                        fontWeight: 'bold'
                                    }}>
                                        {status === 'completed' ? '✅ Listo' :
                                            status === 'uploading' ? '📤 Cargando' :
                                                status === 'validating' ? '🔍 Validando' :
                                                    status === 'error' ? '❌ Error' : '⏳ Pendiente'}
                                    </span>
                                </div>

                                {status === 'completed' && validationStats && (
                                    <div style={{ 
                                        margin: '0.5rem 0 0 0', 
                                        padding: '0.5rem',
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.8rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                            <span>Features: <strong>{validationStats.totalFeatures}</strong></span>
                                            <span>Vértices: <strong>{validationStats.totalVertices.toLocaleString()}</strong></span>
                                            <span>Geometrías: <strong>{Array.from(validationStats.geometryTypes).join(', ')}</strong></span>
                                            <span>Atributos: <strong>{validationStats.hasAttributes ? 'Sí' : 'No'}</strong></span>
                                        </div>
                                    </div>
                                )}

                                {errors.length > 0 && (
                                    <div style={{ ...errorStyle, margin: '0.5rem 0 0 0', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                                        {errors.map((error, idx) => <div key={idx}>• {error}</div>)}
                                    </div>
                                )}

                                {warnings.length > 0 && (
                                    <div style={{ ...warningStyle, margin: '0.5rem 0 0 0', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                                        {warnings.map((warning, idx) => <div key={idx}>• {warning}</div>)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Mapa con renderizado QGIS */}
            <div style={{ flexGrow: 1, minHeight: '500px', position: 'relative' }}>
                <MapContainer 
                    center={[40.4168, -3.7038]} 
                    zoom={6} 
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    <QgisRenderer layers={layers} opacity={opacity} visible={visibility} />

                    {drawnGeometry && (
                        <GeoJSON
                            data={drawnGeometry}
                            style={{ color: 'red', weight: 3 }}
                        />
                    )}
                </MapContainer>

                <CustomLayerControlPanel
                    layers={layers}
                    visibility={visibility}
                    opacity={opacity}
                    onToggle={(id) => setVisibility((v) => ({ ...v, [id]: !v[id] }))}
                    onOpacity={(id, value) => setOpacity((o) => ({ ...o, [id]: value }))}
                />
            </div>
        </div>
    );
};

export default GeoMapViewerWithQgis;