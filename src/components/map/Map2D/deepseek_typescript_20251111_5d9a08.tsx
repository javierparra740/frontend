import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON as LeafletGeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection, Geometry, Feature, Polygon, LineString, Point } from 'geojson';
import Swal from 'sweetalert2';

// --- INTERFACES MEJORADAS ---
interface OptimizedLayerData {
    name: string;
    geoJson: FeatureCollection;
    validationStats?: ValidationStats;
    style: LayerStyle;
    optimized?: boolean;
    featureCount: number;
    bounds: [number, number, number, number];
}

interface LayerStyle {
    color: string;
    weight: number;
    opacity: number;
    fillColor?: string;
    fillOpacity: number;
}

interface PerformanceMetrics {
    renderTime: number;
    featureCount: number;
    vertexCount: number;
    memoryUsage: number;
}

// --- FUNCIONES DE OPTIMIZACIÓN ---

// Simplificación de geometrías usando el algoritmo Douglas-Peucker
const simplifyGeometry = (coordinates: number[][], tolerance: number = 0.0001): number[][] => {
    if (coordinates.length <= 2) return coordinates;

    const douglasPeucker = (points: number[][], tolerance: number): number[][] => {
        if (points.length <= 2) return points;

        let maxDistance = 0;
        let index = 0;
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }

        if (maxDistance > tolerance) {
            const left = douglasPeucker(points.slice(0, index + 1), tolerance);
            const right = douglasPeucker(points.slice(index), tolerance);
            return left.slice(0, -1).concat(right);
        } else {
            return [start, end];
        }
    };

    const perpendicularDistance = (point: number[], lineStart: number[], lineEnd: number[]): number => {
        const area = Math.abs(
            (lineEnd[0] - lineStart[0]) * (point[1] - lineStart[1]) -
            (lineEnd[1] - lineStart[1]) * (point[0] - lineStart[0])
        );
        const lineLength = Math.sqrt(
            Math.pow(lineEnd[0] - lineStart[0], 2) + Math.pow(lineEnd[1] - lineStart[1], 2)
        );
        return lineLength > 0 ? area / lineLength : 0;
    };

    return douglasPeucker(coordinates, tolerance);
};

// Optimizar FeatureCollection completo
const optimizeGeoJson = (geoJson: FeatureCollection, maxFeatures: number = 5000): FeatureCollection => {
    const needsOptimization = geoJson.features.length > maxFeatures;
    
    if (!needsOptimization) {
        return geoJson;
    }

    console.log(`🔄 Optimizando GeoJSON: ${geoJson.features.length} features`);

    const optimizedFeatures = geoJson.features
        .filter(feature => feature.geometry && feature.geometry.coordinates)
        .slice(0, maxFeatures) // Limitar número máximo de features
        .map(feature => {
            const geometry = feature.geometry;
            let optimizedGeometry: Geometry | null = null;

            try {
                switch (geometry.type) {
                    case 'Polygon':
                        optimizedGeometry = {
                            ...geometry,
                            coordinates: geometry.coordinates.map(ring => 
                                simplifyGeometry(ring, 0.001)
                            )
                        } as Polygon;
                        break;

                    case 'LineString':
                        optimizedGeometry = {
                            ...geometry,
                            coordinates: simplifyGeometry(geometry.coordinates, 0.001)
                        } as LineString;
                        break;

                    case 'MultiPolygon':
                        optimizedGeometry = {
                            ...geometry,
                            coordinates: geometry.coordinates.map(polygon =>
                                polygon.map(ring => simplifyGeometry(ring, 0.001))
                            )
                        };
                        break;

                    default:
                        optimizedGeometry = geometry;
                }
            } catch (error) {
                console.warn('Error optimizando geometría:', error);
                optimizedGeometry = geometry;
            }

            return {
                ...feature,
                geometry: optimizedGeometry
            };
        });

    console.log(`✅ GeoJSON optimizado: ${optimizedFeatures.length} features`);

    return {
        type: 'FeatureCollection',
        features: optimizedFeatures
    };
};

// Calcular bounds de un FeatureCollection
const calculateBounds = (geoJson: FeatureCollection): [number, number, number, number] => {
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;

    geoJson.features.forEach(feature => {
        if (!feature.geometry) return;

        const processCoordinates = (coords: any[]): void => {
            coords.forEach(coord => {
                if (Array.isArray(coord[0])) {
                    processCoordinates(coord);
                } else if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                    minLng = Math.min(minLng, coord[0]);
                    minLat = Math.min(minLat, coord[1]);
                    maxLng = Math.max(maxLng, coord[0]);
                    maxLat = Math.max(maxLat, coord[1]);
                }
            });
        };

        try {
            processCoordinates([feature.geometry.coordinates]);
        } catch (error) {
            console.warn('Error calculando bounds para feature:', feature);
        }
    });

    return [minLng, minLat, maxLng, maxLat];
};

// Generar estilo inteligente basado en el tipo de geometría
const generateSmartStyle = (geometryType: string, layerIndex: number): LayerStyle => {
    const colorPalette = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];

    const baseColor = colorPalette[layerIndex % colorPalette.length];

    switch (geometryType) {
        case 'Polygon':
        case 'MultiPolygon':
            return {
                color: baseColor,
                weight: 1,
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

// --- COMPONENTE OPTIMIZADO PARA RENDERIZADO ---
interface OptimizedGeoJsonRendererProps {
    layer: OptimizedLayerData;
    isVisible: boolean;
    onRenderComplete?: (metrics: PerformanceMetrics) => void;
}

const OptimizedGeoJsonRenderer: React.FC<OptimizedGeoJsonRendererProps> = ({ 
    layer, 
    isVisible,
    onRenderComplete 
}) => {
    const renderRef = useRef<number>();
    const map = useMap();

    useEffect(() => {
        if (!isVisible) return;

        const startTime = performance.now();

        // Usar requestAnimationFrame para renderizado no bloqueante
        renderRef.current = requestAnimationFrame(() => {
            const endTime = performance.now();
            const renderTime = endTime - startTime;

            if (onRenderComplete) {
                const metrics: PerformanceMetrics = {
                    renderTime,
                    featureCount: layer.featureCount,
                    vertexCount: layer.validationStats?.totalVertices || 0,
                    memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0
                };
                onRenderComplete(metrics);
            }
        });

        return () => {
            if (renderRef.current) {
                cancelAnimationFrame(renderRef.current);
            }
        };
    }, [layer, isVisible, onRenderComplete]);

    if (!isVisible) return null;

    return (
        <LeafletGeoJSON
            key={layer.name}
            data={layer.geoJson}
            style={layer.style}
            onEachFeature={(feature, layerInstance) => {
                // Bind popup solo si hay propiedades
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
    );
};

// --- COMPONENTE PRINCIPAL MEJORADO ---
const RobustGeoMapViewer: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [layers, setLayers] = useState<OptimizedLayerData[]>([]);
    const [visibility, setVisibility] = useState<Record<string, boolean>>({});
    const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, PerformanceMetrics>>({});
    const [mapCenter, setMapCenter] = useState<[number, number]>([40.4168, -3.7038]);
    const [mapZoom, setMapZoom] = useState<number>(6);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    // Procesar archivos GeoJSON de manera robusta
    const processGeoJsonFile = async (file: File): Promise<{ 
        geoJson: FeatureCollection; 
        validation: any;
        optimized: boolean;
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    if (!content) {
                        throw new Error('No se pudo leer el archivo');
                    }

                    let geoJson: FeatureCollection;
                    
                    // Intentar parsear como JSON
                    try {
                        geoJson = JSON.parse(content);
                    } catch (parseError) {
                        throw new Error('El archivo no es un JSON válido');
                    }

                    // Validar estructura GeoJSON básica
                    if (!geoJson.type || geoJson.type !== 'FeatureCollection') {
                        throw new Error('El archivo no es un FeatureCollection GeoJSON válido');
                    }

                    if (!geoJson.features || !Array.isArray(geoJson.features)) {
                        throw new Error('Estructura GeoJSON inválida: falta array de features');
                    }

                    // Optimizar si es necesario
                    const needsOptimization = geoJson.features.length > 1000;
                    const processedGeoJson = needsOptimization 
                        ? optimizeGeoJson(geoJson) 
                        : geoJson;

                    const validation = {
                        attributes: { 
                            warnings: needsOptimization ? ['GeoJSON optimizado para mejor rendimiento'] : [] 
                        },
                        performance: { 
                            warnings: [] 
                        }
                    };

                    resolve({ 
                        geoJson: processedGeoJson, 
                        validation,
                        optimized: needsOptimization
                    });
                    
                } catch (error) {
                    reject(new Error(`Error procesando GeoJSON: ${error instanceof Error ? error.message : 'Error desconocido'}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Error leyendo el archivo'));
            };

            reader.readAsText(file);
        });
    };

    // Manejar upload de archivos
    const handleFiles = (files: FileList) => {
        const newFiles: UploadingFile[] = Array.from(files).map((file) => ({
            file,
            status: 'pending',
            progress: 0,
            errors: [],
            warnings: []
        }));
        setUploadingFiles((prev) => [...prev, ...newFiles]);
        newFiles.forEach(uploadGeoJsonFile);
    };

    const uploadGeoJsonFile = async (uploadingFile: UploadingFile) => {
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

            // Validación de seguridad
            const securityValidation = validateSecurity(file);
            if (!securityValidation.isValid) {
                updateProgressState(0, 'error', securityValidation.errors, securityValidation.warnings);
                return;
            }

            updateProgressState(30, 'uploading');

            Swal.fire({
                title: 'Procesando GeoJSON…',
                text: `Procesando ${file.name}`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            updateProgressState(50);

            // Procesar el archivo GeoJSON
            const result = await processGeoJsonFile(file);
            const { geoJson, validation, optimized } = result;

            updateProgressState(70);

            // Generar estadísticas
            const validationStats = generateValidationStats(geoJson);
            const bounds = calculateBounds(geoJson);
            const geographicValidation = validateGeographicData(geoJson);
            const performanceValidation = validatePerformance(geoJson);

            const allErrors = [
                ...geographicValidation.errors,
                ...performanceValidation.errors
            ];

            if (allErrors.length > 0) {
                Swal.close();
                updateProgressState(0, 'error', allErrors, [], validationStats);
                return;
            }

            const allWarnings = [
                ...securityValidation.warnings,
                ...geographicValidation.warnings,
                ...performanceValidation.warnings,
                ...(validation.attributes?.warnings || []),
                ...(validation.performance?.warnings || [])
            ];

            updateProgressState(100, 'completed', [], allWarnings, validationStats);

            // Crear capa optimizada
            const layerData: OptimizedLayerData = {
                name: file.name,
                geoJson: geoJson,
                validationStats,
                style: generateSmartStyle(
                    Array.from(validationStats.geometryTypes)[0] || 'Polygon',
                    layers.length
                ),
                optimized,
                featureCount: geoJson.features.length,
                bounds
            };

            // Añadir capa
            setLayers((prev) => [...prev, layerData]);
            setVisibility((v) => ({ ...v, [layerData.name]: true }));

            // Ajustar mapa a los bounds de la capa si es la primera
            if (layers.length === 0) {
                const [minLng, minLat, maxLng, maxLat] = bounds;
                const centerLng = (minLng + maxLng) / 2;
                const centerLat = (minLat + maxLat) / 2;
                setMapCenter([centerLat, centerLng]);
                setMapZoom(10);
            }

            Swal.close();
            
            Swal.fire({
                title: optimized ? '✅ GeoJSON Optimizado' : '✅ GeoJSON Cargado',
                html: `
                    <div style="text-align: left;">
                        <p><strong>${file.name}</strong> se cargó exitosamente.</p>
                        ${optimized ? '<p><em>⚠️ GeoJSON optimizado para mejor rendimiento</em></p>' : ''}
                        <p><strong>Estadísticas:</strong></p>
                        <ul>
                            <li>Features: ${validationStats.totalFeatures}</li>
                            <li>Vértices: ${validationStats.totalVertices.toLocaleString()}</li>
                            <li>Geometrías: ${Array.from(validationStats.geometryTypes).join(', ')}</li>
                            <li>Bounds: [${bounds[0].toFixed(4)}, ${bounds[1].toFixed(4)}] - [${bounds[2].toFixed(4)}, ${bounds[3].toFixed(4)}]</li>
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
            console.error('❌ Error procesando GeoJSON:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            
            updateProgressState(0, 'error', [errorMessage]);
        }
    };

    // Manejar métricas de rendimiento
    const handleRenderComplete = useCallback((layerName: string, metrics: PerformanceMetrics) => {
        setPerformanceMetrics(prev => ({
            ...prev,
            [layerName]: metrics
        }));
    }, []);

    // Limpiar capas para liberar memoria
    const clearLayers = useCallback(() => {
        setLayers([]);
        setVisibility({});
        setPerformanceMetrics({});
        Swal.fire('✅', 'Todas las capas han sido limpiadas', 'success');
    }, []);

    // Componente de métricas de rendimiento
    const PerformancePanel: React.FC = () => {
        if (Object.keys(performanceMetrics).length === 0) return null;

        return (
            <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000,
                fontSize: '0.75rem',
                maxWidth: '300px'
            }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>📊 Rendimiento</h4>
                {Object.entries(performanceMetrics).map(([layerName, metrics]) => (
                    <div key={layerName} style={{ marginBottom: '0.25rem' }}>
                        <strong>{layerName}:</strong> {metrics.renderTime.toFixed(1)}ms
                    </div>
                ))}
            </div>
        );
    };

    // ... (resto de funciones de drag & drop y UI similares al componente original)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>

            {/* Zona de Dropzone */}
            <div style={/* estilos del dropzone */}>
                {/* Contenido similar al componente original */}
            </div>

            {/* Mapa con renderizado optimizado */}
            <div style={{ flexGrow: 1, minHeight: '500px', position: 'relative' }}>
                <MapContainer 
                    center={mapCenter} 
                    zoom={mapZoom} 
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />

                    {/* Renderizar cada capa de forma optimizada */}
                    {layers.map((layer) => (
                        <OptimizedGeoJsonRenderer
                            key={layer.name}
                            layer={layer}
                            isVisible={visibility[layer.name] || false}
                            onRenderComplete={(metrics) => handleRenderComplete(layer.name, metrics)}
                        />
                    ))}
                </MapContainer>

                <PerformancePanel />

                {/* Panel de control de capas personalizado */}
                <CustomLayerControlPanel
                    layers={layers}
                    visibility={visibility}
                    onToggle={(id) => setVisibility((v) => ({ ...v, [id]: !v[id] }))}
                    onClear={clearLayers}
                />
            </div>
        </div>
    );
};

// Panel de control mejorado
const CustomLayerControlPanel: React.FC<{
    layers: OptimizedLayerData[];
    visibility: Record<string, boolean>;
    onToggle: (id: string) => void;
    onClear: () => void;
}> = ({ layers, visibility, onToggle, onClear }) => {
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
            maxWidth: '350px',
            maxHeight: '500px',
            overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Capaas ({layers.length})</h3>
                <button 
                    onClick={onClear}
                    style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                    }}
                >
                    Limpiar Todo
                </button>
            </div>
            
            {layers.map((layer) => (
                <div key={layer.name} style={{
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
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
                            {layer.optimized && <span title="Optimizado" style={{ marginLeft: '0.25rem' }}>⚡</span>}
                        </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={visibility[layer.name] || false}
                            onChange={() => onToggle(layer.name)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.875rem' }}>Visible</span>
                        
                        <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: layer.style.color,
                            borderRadius: '50%',
                            marginLeft: 'auto'
                        }} />
                    </div>

                    {layer.validationStats && (
                        <div style={{ 
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            backgroundColor: '#f8fafc',
                            borderRadius: '0.25rem',
                            fontSize: '0.7rem',
                            color: '#4b5563'
                        }}>
                            <div>📊 {layer.featureCount} features</div>
                            <div>📍 {layer.validationStats.totalVertices.toLocaleString()} vértices</div>
                            <div>🎯 {Array.from(layer.validationStats.geometryTypes).join(', ')}</div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default RobustGeoMapViewer;