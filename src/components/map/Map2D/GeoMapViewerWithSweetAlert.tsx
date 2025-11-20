/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import 'leaflet.pm';
import type { FeatureCollection, Geometry } from 'geojson';
import shp from 'shpjs';
import { LayerControlPanel } from '../LayerControlPanel/LayerControlPanel';
import L, { geoJSON } from 'leaflet';

/* --------------  SweetAlert2  -------------- */
import { toast, modal } from '../../../utils/alertUtils';
import Swal from 'sweetalert2';

/* --------------  INTERFACES  -------------- */
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

/* --------------  VALIDACIONES (sin cambios) -------------- */
const validateSecurity = (file: File): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!file.name.toLowerCase().endsWith('.zip')) {
        errors.push('Solo se permiten archivos ZIP que contengan shapefiles');
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        errors.push(
            `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 10MB`
        );
    }

    if (/[<>:"|?*\\/]/.test(file.name)) {
        warnings.push('El nombre del archivo contiene caracteres especiales que podrían causar problemas');
    }

    return { isValid: errors.length === 0, errors, warnings };
};

const validateGeographicData = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!geoJson.features || geoJson.features.length === 0) {
        errors.push('El shapefile no contiene geometrías válidas');
        return { isValid: false, errors, warnings };
    }

    const geometryTypes = new Set(
        geoJson.features.filter((f) => f.geometry).map((f) => f.geometry!.type)
    );

    if (geometryTypes.size === 0) errors.push('No se encontraron geometrías válidas en el archivo');
    if (geometryTypes.size > 1) {
        warnings.push(`Shapefile contiene múltiples tipos de geometría: ${Array.from(geometryTypes).join(', ')}`);
    }

    let validCoordinatesCount = 0;
    geoJson.features.forEach((feature, idx) => {
        if (!feature.geometry) return;
        const coords = getCoordinates(feature.geometry);
        const invalid = coords.filter((c) => Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90);
        if (invalid.length) warnings.push(`Feature ${idx + 1}: ${invalid.length} coordenadas fuera de rango WGS84`);
        else if (coords.length) validCoordinatesCount++;
    });

    if (!validCoordinatesCount) errors.push('No se encontraron coordenadas geográficas válidas');

    return { isValid: errors.length === 0, errors, warnings };
};

const validateAttributes = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const withProps = geoJson.features.filter((f) => f.properties && Object.keys(f.properties).length);
    if (!withProps.length) {
        warnings.push('El shapefile no contiene atributos/tabla de datos');
        return { isValid: true, errors, warnings };
    }

    const sample = withProps[0].properties!;
    const badFields = Object.keys(sample).filter((f) => /[^a-zA-Z0-9_áéíóúñÑ]/.test(f));
    if (badFields.length) {
        warnings.push(
            `Algunos nombres de campo contienen caracteres especiales: ${badFields.slice(0, 3).join(', ')}${badFields.length > 3 ? '...' : ''
            }`
        );
    }

    if (withProps.length > 1) {
        const first = Object.keys(withProps[0].properties || {});
        const inconsistent = withProps.slice(1).filter((f) => {
            const curr = Object.keys(f.properties || {});
            return first.length !== curr.length || first.some((k) => !curr.includes(k));
        });
        if (inconsistent.length) warnings.push(`${inconsistent.length} features tienen estructura de atributos inconsistente`);
    }

    return { isValid: true, errors, warnings };
};

const validatePerformance = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const MAX_FEATURES = 5000;
    if (geoJson.features.length > MAX_FEATURES) {
        errors.push(`Demasiadas geometrías (${geoJson.features.length}). Máximo permitido: ${MAX_FEATURES}`);
    }

    let totalVertices = 0;
    const complex: number[] = [];

    geoJson.features.forEach((f, idx) => {
        if (!f.geometry) return;
        const verts = countVertices(f.geometry);
        totalVertices += verts;
        if (verts > 1000) complex.push(idx + 1);
    });

    if (complex.length) warnings.push(`${complex.length} geometrías son muy complejas (más de 1000 vértices)`);
    if (totalVertices > 50000) {
        warnings.push(
            `Geometrías muy complejas (${totalVertices.toLocaleString()} vértices totales). Puede afectar el rendimiento`
        );
    }

    return { isValid: errors.length === 0, errors, warnings };
};

/* --------------  UTILITARIAS (sin cambios) -------------- */
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

const countVertices = (geometry: Geometry): number => getCoordinates(geometry).length;

const calculateValidationStats = (geoJson: FeatureCollection): ValidationStats => {
    const types = new Set<string>();
    let vertices = 0;
    let hasAttr = false;

    geoJson.features.forEach((f) => {
        if (f.geometry) {
            types.add(f.geometry.type);
            vertices += countVertices(f.geometry);
        }
        if (f.properties && Object.keys(f.properties).length) hasAttr = true;
    });

    return {
        totalFeatures: geoJson.features.length,
        totalVertices: vertices,
        geometryTypes: types,
        hasAttributes: hasAttr,
    };
};

/* --------------  COMPONENTES EXISTENTES -------------- */
interface LayerRendererProps {
    layer: LayerData;
    opacity: number;
    visible: boolean;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({ layer, opacity, visible }) => {
    const map = useMap();

    useEffect(() => {
        if (!visible || !layer.geoJson.features.length) return;
        const leafletLayer = geoJSON(layer.geoJson);
        const bounds = leafletLayer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
        else {
            const [lng, lat] = (layer.geoJson.features[0].geometry as any).coordinates;
            map.setView([lat, lng], 16);
        }
    }, [layer, map, visible]);

    if (!visible) return null;

    return (
        <GeoJSON
            data={layer.geoJson}
            style={{ color: 'blue', weight: 2, opacity }}
            pointToLayer={(feature, latlng) => {
                const popup = feature.properties
                    ? `<strong>${feature.properties.name || 'Sin nombre'}</strong><br/>${JSON.stringify(feature.properties)}`
                    : 'Sin datos';
                return L.circleMarker(latlng, { radius: 6, color: 'blue', opacity }).bindPopup(popup);
            }}
        />
    );
};

const PmControls: React.FC<{ onGeometryCreated: (geoJson: any) => void }> = ({ onGeometryCreated }) => {
    const map = useMap();

    useEffect(() => {
        if (!map.pm) return;
        map.pm.addControls({
            position: 'bottomleft',
            drawMarker: true,
            drawPolyline: true,
            drawPolygon: true,
        });
        const handler = (e: any) => onGeometryCreated(e.layer.toGeoJSON());
        map.on('pm:create', handler);
        return () => {
            map.off('pm:create', handler);
        };
    }, [map, onGeometryCreated]);

    return null;
};

/* --------------  SERVICIO GEO -------------- */
type ProgressCallback = (progress: number) => void;

export interface LayerData {
    name: string;
    geoJson: FeatureCollection;
}

export const GeoService = {
    uploadLayer: async (
        file: File,
        onProgress: ProgressCallback
    ): Promise<{
        success: boolean;
        layer: LayerData;
        validation?: {
            security: ValidationResult;
            geographic: ValidationResult;
            attributes: ValidationResult;
            performance: ValidationResult;
        };
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    onProgress(30);
                    const buffer = e.target?.result as ArrayBuffer;
                    let geoJson = await shp(buffer);
                    if (Array.isArray(geoJson)) {
                        geoJson = {
                            type: 'FeatureCollection',
                            features: geoJson.flatMap((fc: any) => fc.features),
                        };
                    }
                    onProgress(70);

                    const security = validateSecurity(file);
                    const geographic = validateGeographicData(geoJson);
                    const attributes = validateAttributes(geoJson);
                    const performance = validatePerformance(geoJson);

                    const critical = [
                        ...security.errors,
                        ...geographic.errors,
                        ...performance.errors,
                    ];
                    if (critical.length) {
                        reject(new Error(critical.join('; ')));
                        return;
                    }

                    onProgress(100);
                    resolve({
                        success: true,
                        layer: { name: file.name, geoJson },
                        validation: { security, geographic, attributes, performance },
                    });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsArrayBuffer(file);
        });
    },

    downloadLayer: async (layerId: string): Promise<Blob> => {
        const mock = new Blob([JSON.stringify({ layerId, meta: 'mock' })], { type: 'application/zip' });
        return Promise.resolve(mock);
    },

    runValidation: async (layerId: string): Promise<{ issues: string[] }> => {
        const has = Math.random() > 0.5;
        return Promise.resolve({ issues: has ? ['Geometría vacía detectada'] : [] });
    },
};

/* --------------  HOOKS EXISTENTES -------------- */
const useGeoLayers = () => {
    const [layers, setLayers] = useState<LayerData[]>([]);
    const addLayer = (l: LayerData) => setLayers((p) => [...p, l]);
    return { layers, addLayer };
};

interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error' | 'validating';
    progress: number;
}

/* --------------  COMPONENTE PRINCIPAL -------------- */
const GeoMapViewer: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);

    const { layers, addLayer } = useGeoLayers();
    const [visibility, setVisibility] = useState<Record<string, boolean>>({});
    const [opacity, setOpacity] = useState<Record<string, number>>({});
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const handleGeometryCreated = useCallback((geoJson: any) => setDrawnGeometry(geoJson), []);

    /*  DRAG & DROP (sin cambios visuales)  */
    const handleFiles = (files: FileList) => {
        const list: UploadingFile[] = Array.from(files).map((f) => ({
            file: f,
            status: 'pending',
            progress: 0,
        }));
        setUploadingFiles((p) => [...p, ...list]);
        list.forEach(uploadFile);
    };

    const uploadFile = async (uf: UploadingFile) => {
        const { file } = uf;

        // Abrir alerta de progreso
        let swalAlert: any = null;

        const openProgressAlert = () => {
            swalAlert = Swal.fire({
                title: `Procesando ${file.name}`,
                html: `<div style="width: 100%; background: #e5e7eb; height: 8px; border-radius: 4px;">
               <div id="swal-progress-bar" style="height: 100%; background: #3b82f6; width: 0%; transition: width 0.3s;"></div>
             </div>
             <p id="swal-status-text">Validando...</p>`,
                allowOutsideClick: false,
                showConfirmButton: false,
            });
        };

        const updateProgress = (progress: number, status: UploadingFile['status']) => {
            const statusText =
                status === 'validating' ? 'Validando...' :
                    status === 'uploading' ? 'Subiendo...' :
                        status === 'completed' ? '✅ Carga completa' :
                            status === 'error' ? '❌ Error' : '⏳ Pendiente';

            const color =
                status === 'error' ? '#dc2626' :
                    status === 'completed' ? '#10b981' : '#3b82f6';

            if (swalAlert) {
                const bar = Swal.getHtmlContainer()?.querySelector('#swal-progress-bar') as HTMLElement;
                const text = Swal.getHtmlContainer()?.querySelector('#swal-status-text') as HTMLElement;
                if (bar) bar.style.width = `${progress}%`;
                if (text) text.textContent = statusText;
                if (status === 'completed' || status === 'error') {
                    setTimeout(() => Swal.close(), 1500);
                }
            }
        };

        openProgressAlert();

        try {
            updateProgress(0, 'validating');
            const security = validateSecurity(file);
            if (!security.isValid) {
                modal.errors(security.errors);
                if (security.warnings.length) toast.warning(security.warnings.join('<br/>'));
                updateProgress(0, 'error');
                return;
            }
            if (security.warnings.length) toast.warning(security.warnings.join('<br/>'));

            updateProgress(0, 'uploading');
            const res = await GeoService.uploadLayer(file, (n) => updateProgress(n, 'uploading'));

            const allWarnings = [
                ...res.validation!.security.warnings,
                ...res.validation!.geographic.warnings,
                ...res.validation!.attributes.warnings,
                ...res.validation!.performance.warnings,
            ];
            if (allWarnings.length) modal.warnings(allWarnings);

            addLayer(res.layer);
            setVisibility((v) => ({ ...v, [res.layer.name]: true }));
            setOpacity((o) => ({ ...o, [res.layer.name]: 1 }));
            updateProgress(100, 'completed');
        } catch (e: any) {
            updateProgress(0, 'error');
            toast.error(e?.message || 'Error desconocido');
        }
    };

    const onDrag =
        (f: (e: React.DragEvent<HTMLDivElement>) => void) => (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            f(e);
        };
    const handleDrop = onDrag((e) => {
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    });

    /* --------------  ESTILOS -------------- */
    const dropBase: React.CSSProperties = {
        padding: '1rem',
        border: '2px dashed #9ca3af',
        margin: '.5rem',
        transition: 'all .15s',
        textAlign: 'center',
    };
    const dropOver: React.CSSProperties = { borderColor: '#10b981', backgroundColor: '#f0fff4' };
    const dropStyle = isDragging ? { ...dropBase, ...dropOver } : dropBase;

    const btn: React.CSSProperties = {
        backgroundColor: '#3b82f6',
        color: '#fff',
        padding: '.5rem 1rem',
        borderRadius: '.25rem',
        border: 'none',
        cursor: 'pointer',
        margin: '.5rem',
    };

    /* --------------  RENDER -------------- */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
            {/* Dropzone */}
            <div
                style={dropStyle}
                onDragEnter={onDrag(() => setIsDragging(true))}
                onDragLeave={onDrag(() => setIsDragging(false))}
                onDragOver={onDrag(() => { })}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        e.target.files && handleFiles(e.target.files);
                    }}
                />
                <p style={{ margin: '.5rem 0' }}>
                    Arrastra y suelta tus archivos <strong>.zip</strong> con shapefiles aquí
                </p>
                <button
                    style={btn}
                    onClick={() => {
                        fileInputRef.current?.click();
                    }}
                >
                    Seleccionar Archivos
                </button>

                {/* Lista de archivos */}
                {uploadingFiles.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '.5rem', borderTop: '1px solid #e5e7eb' }}>
                        {uploadingFiles.map(({ file, status, progress }) => (
                            <div
                                key={file.name}
                                style={{
                                    marginBottom: '.5rem',
                                    padding: '.5rem',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '.375rem',
                                    backgroundColor: status === 'error' ? '#fef2f2' : status === 'completed' ? '#f0fff4' : '#fff',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span
                                        style={{
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            textOverflow: 'ellipsis',
                                            width: '50%',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {file.name}
                                    </span>
                                    <div style={{ width: '25%', height: '.5rem', backgroundColor: '#e5e7eb', borderRadius: '.25rem', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                backgroundColor: status === 'error' ? '#dc2626' : status === 'completed' ? '#10b981' : '#3b82f6',
                                                transition: 'width .3s',
                                                width: `${progress}%`,
                                            }}
                                        />
                                    </div>
                                    <span style={{ width: '16.6667%', textAlign: 'right', fontSize: '.875rem', fontWeight: 'bold' }}>
                                        {status === 'completed' ? '✅ Listo' : status === 'uploading' ? '📤 Cargando' : status === 'error' ? '❌ Error' : '⏳ Pendiente'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Mapa */}
            <div style={{ flexGrow: 1, minHeight: '500px', position: 'relative' }}>
                <MapContainer center={[40.4168, -3.7038]} zoom={6} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <PmControls onGeometryCreated={handleGeometryCreated} />

                    {layers.map((layer) =>
                        visibility[layer.name] !== false ? (
                            <GeoJSON
                                key={layer.name}
                                data={layer.geoJson}
                                style={{ color: 'blue', weight: 2, opacity: opacity[layer.name] ?? 1 }}
                                pointToLayer={(feature, latlng) => {
                                    const popup = feature.properties
                                        ? `<strong>${feature.properties.name || 'Sin nombre'}</strong><br/>${JSON.stringify(feature.properties)}`
                                        : 'Sin datos';
                                    return L.circleMarker(latlng, { radius: 6, color: 'blue' })
                                        .setStyle({ opacity: opacity[layer.name] ?? 1 })
                                        .bindPopup(popup);
                                }}
                            />
                        ) : null
                    )}
                    {drawnGeometry && <GeoJSON data={drawnGeometry} style={{ color: 'red', weight: 3 }} />}
                </MapContainer>

                <LayerControlPanel
                    layers={layers}
                    visibility={visibility}
                    opacity={opacity}
                    onToggle={(id) => setVisibility((v) => ({ ...v, [id]: !v[id] }))}
                    onOpacity={(id, val) => setOpacity((o) => ({ ...o, [id]: val }))}
                />
            </div>
        </div>
    );
};

export default GeoMapViewer;