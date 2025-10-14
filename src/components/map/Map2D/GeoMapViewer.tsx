import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import 'leaflet.pm';
import type { FeatureCollection } from 'geojson';
import shp from 'shpjs';
import proj4 from 'proj4';
import { geoJSON } from 'leaflet';
import L from 'leaflet';

// Configura proj4 para reproyecciones comunes
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs');

// --- SERVICIO REAL DE CARGA ---
type ProgressCallback = (progress: number) => void;

const GeoService = {
    uploadLayer: async (file: File, onProgress: ProgressCallback): Promise<{ success: boolean; layer: { name: string; geoJson: FeatureCollection } }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    onProgress(30);
                    const buffer = e.target?.result as ArrayBuffer;
                    let geoJson = await shp(buffer); // FeatureCollection or array
                    if (Array.isArray(geoJson)) {
                        // If it's an array, merge all features into one FeatureCollection
                        geoJson = {
                            type: 'FeatureCollection',
                            features: geoJson.flatMap((fc: any) => fc.features),
                        };
                    }
                    onProgress(100);
                    resolve({ success: true, layer: { name: file.name, geoJson } });
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },
};

// --- TIPOS ---
interface LayerData {
    name: string;
    geoJson: FeatureCollection;
}

// --- HOOK PARA CAPAS ---
const useGeoLayers = () => {
    const [layers, setLayers] = useState<LayerData[]>([]);

    const addLayer = (layer: LayerData) => {
        setLayers((prev) => [...prev, layer]);
    };

    return { layers, addLayer };
};

// --- UPLOAD STATE ---
interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
}

// --- ESTILOS INLINE ---
const style = {
    dropzoneBase: {
        padding: '1rem',
        border: '2px dashed #9ca3af',
        margin: '0.5rem',
        transition: 'all 0.15s ease-in-out',
        textAlign: 'center' as const,
    },
    dropzoneDragging: {
        borderColor: '#10b981',
        backgroundColor: '#f0fff4',
    },
    uploadButton: {
        backgroundColor: '#3b82f6',
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '0.25rem',
        border: 'none',
        cursor: 'pointer',
    },
    fileList: {
        marginTop: '1rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid #e5e7eb',
    },
    fileItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.25rem 0',
    },
    fileName: {
        overflow: 'hidden',
        whiteSpace: 'nowrap' as const,
        textOverflow: 'ellipsis',
        width: '50%',
    },
    progressBarContainer: {
        width: '25%',
        height: '0.5rem',
        backgroundColor: '#e5e7eb',
        borderRadius: '0.25rem',
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#10b981',
        transition: 'width 0.3s ease-in-out',
    },
    fileStatus: {
        width: '16.6667%',
        textAlign: 'right' as const,
        fontSize: '0.875rem',
    },
};

// --- RENDERIZADO Y EFECTOS ---
const LayerRenderer: React.FC<{ layer: LayerData }> = ({ layer }) => {
    const map = useMap();

    useEffect(() => {
        if (!layer.geoJson.features.length) return;
        const leafletLayer = geoJSON(layer.geoJson);
        const bounds = leafletLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            const [lng, lat] = (layer.geoJson.features[0].geometry as any).coordinates;
            map.setView([lat, lng], 16);
        }
    }, [layer, map]);

    return (
        <GeoJSON
            data={layer.geoJson}
            style={{ color: 'blue', weight: 2 }}
            pointToLayer={(feature, latlng) => {
                const popup = feature.properties
                    ? `<div><strong>${feature.properties.name || 'Sin nombre'}</strong><br/>${JSON.stringify(feature.properties)}</div>`
                    : 'Sin datos';
                return (L as any).circleMarker(latlng, { radius: 6, color: 'blue' }).bindPopup(popup);
            }}
        />
    );
};

// --- CONTROLES DE DIBUJO ---
const PmControls: React.FC<{ onGeometryCreated: (geoJson: any) => void }> = ({ onGeometryCreated }) => {
    const map = useMap();

    useEffect(() => {
        if (!map.pm) return;
        map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolyline: true,
            drawPolygon: true,
            //editMode: true,
            //removalMode: true,
        });
        const handler = (e: any) => onGeometryCreated(e.layer.toGeoJSON());
        map.on('pm:create', handler);
        return () => {
            map.off('pm:create', handler);
        };
    }, [map, onGeometryCreated]);

    return null;
};

// --- COMPONENTE PRINCIPAL ---
const GeoMapViewer: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
    const { layers, addLayer } = useGeoLayers();
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const handleGeometryCreated = useCallback((geoJson: any) => {
        setDrawnGeometry(geoJson);
    }, []);

    const handleFiles = (files: FileList) => {
        const newFiles: UploadingFile[] = Array.from(files).map((file) => ({
            file,
            status: 'pending',
            progress: 0,
        }));
        setUploadingFiles((prev) => [...prev, ...newFiles]);
        newFiles.forEach(uploadFile);
    };

    const uploadFile = async (uploadingFile: UploadingFile) => {
        const { file } = uploadingFile;
        const updateProgressState = (progress: number, status: UploadingFile['status'] = 'uploading') => {
            setUploadingFiles((prev) =>
                prev.map((f) => (f.file.name === file.name ? { ...f, progress, status } : f))
            );
        };

        try {
            updateProgressState(0, 'uploading');
            const result = await GeoService.uploadLayer(file, (p) => updateProgressState(p));
            if (result.success) {
                updateProgressState(100, 'completed');
                addLayer(result.layer);
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            updateProgressState(0, 'error');
        }
    };

    // --- DRAG & DROP HANDLERS ---
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    const dropzoneStyle = isDragging ? { ...style.dropzoneBase, ...style.dropzoneDragging } : style.dropzoneBase;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
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
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                <p style={{ margin: '0.5rem 0' }}>Arrastra y suelta tus archivos <strong>.zip</strong> con shapefiles aquí</p>
                <button onClick={() => fileInputRef.current?.click()} style={style.uploadButton}>
                    Seleccionar Archivos
                </button>

                {uploadingFiles.length > 0 && (
                    <div style={style.fileList}>
                        {uploadingFiles.map(({ file, status, progress }) => (
                            <div key={file.name} style={style.fileItem}>
                                <span style={style.fileName}>{file.name}</span>
                                <div style={style.progressBarContainer}>
                                    <div style={{ ...style.progressBar, width: `${progress}%` }}></div>
                                </div>
                                <span
                                    style={{
                                        ...style.fileStatus,
                                        color: status === 'error' ? 'red' : status === 'completed' ? 'green' : 'black',
                                    }}
                                >
                                    {status === 'completed' ? 'Listo' : status === 'uploading' ? 'Cargando' : status === 'error' ? 'Error' : 'Pendiente'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ flexGrow: 1, minHeight: '500px' }}>
                <MapContainer center={[40.4168, -3.7038]} zoom={6} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <PmControls onGeometryCreated={handleGeometryCreated} />
                    {layers.map((layer, idx) => (
                        <LayerRenderer key={idx} layer={layer} />
                    ))}
                    {drawnGeometry && <GeoJSON data={drawnGeometry} style={{ color: 'red', weight: 3 }} />}
                </MapContainer>
            </div>
        </div>
    );
};

export default GeoMapViewer;
