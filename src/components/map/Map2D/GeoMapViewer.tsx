import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import 'leaflet.pm';
import type { FeatureCollection } from 'geojson';
//import shp from 'shpjs';
import { LayerControlPanel } from '../LayerControlPanel/LayerControlPanel';
import L, { geoJSON } from 'leaflet';


// --- RENDERIZADO Y EFECTOS ---
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
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            const [lng, lat] = (layer.geoJson.features[0].geometry as any).coordinates;
            map.setView([lat, lng], 16);
        }
    }, [layer, map, visible]);

    if (!visible) return null;          // hide completely

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
/* const LayerRenderer: React.FC<{ layer: LayerData }> = ({ layer }) => {
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
}; */

// --- CONTROLES DE DIBUJO ---
const PmControls: React.FC<{ onGeometryCreated: (geoJson: any) => void }> = ({ onGeometryCreated }) => {
    const map = useMap();

    useEffect(() => {
        if (!map.pm) return;
        map.pm.addControls({
            position: 'bottomleft',
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

// -- Servicio de carga --
//type ProgressCallback = (pct: number) => void;

export const GeoService = {
    /**
     * Cualquier archivo → GeoJSON vía gdal-async
     * Misma firma que antes para no romper la UI
     */
    uploadLayer: async (file: File, onProgress?: (p: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);

    onProgress?.(10);
    const res = await fetch('http://localhost:4000/upload', {
      method: 'POST',
      body: fd,
    });
    onProgress?.(100);

    if (!res.ok) throw new Error(await res.text());
    const geoJson: FeatureCollection = await res.json();
    return { success: true, layer: { name: file.name, geoJson } };
  },
    /* uploadLayer: async (
        file: File,
        onProgress?: ProgressCallback
    ): Promise<{ success: boolean; layer: LayerData }> => {
        try {
            onProgress?.(10);

             ---------- 1.  Abrir con GDAL (vsimem) ---------- 
            const buffer = await file.arrayBuffer();
            const ds = await gdal.openAsync(buffer); // acepta Buffer | ArrayBuffer
            onProgress?.(30);

             ---------- 2.  Primera capa vectorial ---------- 
            if (ds.layers.count() === 0) throw new Error('No se encontraron capas vectoriales');
            const layer = ds.layers.get(0);

             ---------- 3.  FeatureCollection de salida ---------- 
            const fc: FeatureCollection = { type: 'FeatureCollection', features: [] };

             opcional: reprojectar a EPSG:4326 si no lo está
            const tgt = gdal.SpatialReference.fromEPSG(4326);
            const transform = layer.srs
                ? new gdal.CoordinateTransformation(layer.srs, tgt)
                : null;

             ---------- 4.  Leer features (async iterator) ---------- 
            let i = 0;
            for await (const f of layer.features) {
                
                let geom = f.getGeometry();
                if (geom) {
                    if (transform) geom.transform(transform); // → 4326
                    const gjGeom = geom.toObject(); // GeoJSON geometry
                    fc.features.push({
                        type: 'Feature',
                        geometry: gjGeom as GeoJSON.Geometry,
                        properties: f.fields.toObject() || {},
                    });
                }
                 feedback cada 50 feats
                if (++i % 50 === 0) onProgress?.(30 + (i / layer.features.count()) * 60);
            }
            onProgress?.(100);

            return { success: true, layer: { name: file.name, geoJson: fc } };
        } catch (e) {
            console.error('[GeoService] gdal-async error:', e);
            throw new Error('No se pudo convertir el archivo a GeoJSON');
        }
    }, */

    /* ---- resto de métodos (downloadLayer, runValidation) sin cambios ---- */
    downloadLayer: async (layerId: string): Promise<Blob> => {
        // Simula descarga de archivo original + metadato
        const mockBlob = new Blob([JSON.stringify({ layerId, meta: 'mock' })], { type: 'application/zip' });
        return Promise.resolve(mockBlob);
    },

    runValidation: async (layerId: string): Promise<{ issues: string[] }> => {
        // Simula validación topológica
        const hasIssues = Math.random() > 0.5;
        return Promise.resolve({ issues: hasIssues ? ['Geometría vacía detectada'] : [] });
    },
};

/* export const GeoService = {
    uploadLayer: async (file: File, onProgress: ProgressCallback): Promise<{ success: boolean; layer: LayerData }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    onProgress(30);
                    const buffer = e.target?.result as ArrayBuffer;
                    let geoJson = await shp(buffer);
                    // Si shpjs devuelve un array, fusiona todos los FeatureCollection en uno solo
                    if (Array.isArray(geoJson)) {
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

    downloadLayer: async (layerId: string): Promise<Blob> => {
        // Simula descarga de archivo original + metadato
        const mockBlob = new Blob([JSON.stringify({ layerId, meta: 'mock' })], { type: 'application/zip' });
        return Promise.resolve(mockBlob);
    },

    runValidation: async (layerId: string): Promise<{ issues: string[] }> => {
        // Simula validación topológica
        const hasIssues = Math.random() > 0.5;
        return Promise.resolve({ issues: hasIssues ? ['Geometría vacía detectada'] : [] });
    },
}; */

// -- Tipos --
export interface LayerData {
    name: string;
    geoJson: FeatureCollection;
}

// -- Hook de capas --
const useGeoLayers = () => {
    const [layers, setLayers] = useState<LayerData[]>([]);

    const addLayer = (layer: LayerData) => {
        setLayers((prev) => [...prev, layer]);
    };

    return { layers, addLayer };
};

// -- Estado de carga --
interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
}

// -- Componente principal --
const GeoMapViewer: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
    const { layers, addLayer } = useGeoLayers();

    // Visibilidad y opacidad
    const [visibility, setVisibility] = useState<Record<string, boolean>>({});
    const [opacity, setOpacity] = useState<Record<string, number>>({});

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
                setVisibility((v) => ({ ...v, [result.layer.name]: true }));
                setOpacity((o) => ({ ...o, [result.layer.name]: 1 }));
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            updateProgressState(0, 'error');
        }
    };

    // Drag & Drop
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

    // Estilos inline mínimos
    const dropzoneBase: React.CSSProperties = {
        padding: '1rem',
        border: '2px dashed #9ca3af',
        margin: '0.5rem',
        transition: 'all 0.15s ease-in-out',
        textAlign: 'center',
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
    };

    const dropzoneStyle = isDragging ? { ...dropzoneBase, ...dropzoneDragging } : dropzoneBase;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
            <style>{`
        .layer-panel {
          position: absolute;
          top: 80px;
          right: 10px;
          width: 360px;
          max-height: 60vh;
          background: #fff;
          border: 1px solid #ccc;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 0.75rem;
          overflow-y: auto;
          z-index: 1000;
          font-size: 0.9rem;
        }
        .layer-panel h3 { margin: 0 0 0.5rem 0; font-weight: 600; }
        .empty { color: #666; font-size: 0.85rem; margin: 0; }
        .layer-row { border-bottom: 1px solid #eee; padding: 0.5rem 0; }
        .layer-row:last-child { border-bottom: none; }
        .row-main { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
        .toggle { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; }
        .opacity-slider { width: 90px; }
        .row-actions { display: flex; gap: 0.4rem; }
        .btn-download, .btn-validate { flex: 1; font-size: 0.75rem; padding: 0.25rem 0.4rem; border: 1px solid #bbb; background: #f5f5f5; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
        .btn-download:hover, .btn-validate:hover:not(:disabled) { background: #e4e4e4; }
        .btn-validate:disabled { opacity: 0.6; cursor: not-allowed; }
        .alert { margin-top: 0.4rem; font-size: 0.75rem; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.25rem 0.4rem; }
      `}</style>

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
                    accept=".zip,.shp,.shx,.dbf,.prj,.xml"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                <p style={{ margin: '0.5rem 0' }}>Arrastra y suelta tus archivos <strong>.zip</strong> con shapefiles aquí</p>
                <button onClick={() => fileInputRef.current?.click()} style={uploadButton}>
                    Seleccionar Archivos
                </button>

                {uploadingFiles.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                        {uploadingFiles.map(({ file, status, progress }) => (
                            <div key={file.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', width: '50%' }}>{file.name}</span>
                                <div style={{ width: '25%', height: '0.5rem', backgroundColor: '#e5e7eb', borderRadius: '0.25rem', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease-in-out', width: `${progress}%` }}></div>
                                </div>
                                <span style={{ width: '16.6667%', textAlign: 'right', fontSize: '0.875rem', color: status === 'error' ? 'red' : status === 'completed' ? 'green' : 'black' }}>
                                    {status === 'completed' ? 'Listo' : status === 'uploading' ? 'Cargando' : status === 'error' ? 'Error' : 'Pendiente'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ flexGrow: 1, minHeight: '500px', position: 'relative' }}>
                <MapContainer center={[40.4168, -3.7038]} zoom={6} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

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
                                    return (L as any).circleMarker(latlng, { radius: 6, color: 'blue' })
                                        .setStyle({ opacity: opacity[layer.name] ?? 1 })
                                        .bindPopup(popup);
                                }}
                            />
                        ) : null
                    )}

                    <PmControls onGeometryCreated={handleGeometryCreated} />
                    {layers.map((layer, idx) => (
                        <LayerRenderer key={idx} layer={layer} opacity={0} visible={false} />
                    ))}
                    {drawnGeometry && <GeoJSON data={drawnGeometry} style={{ color: 'red', weight: 3 }} />}

                </MapContainer>
                <div style={{ flexGrow: 1, minHeight: '600px' }}>
                    <MapContainer center={[40.4168, -3.7038]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <PmControls onGeometryCreated={handleGeometryCreated} />
                        {layers.map((layer, idx) => (
                            <LayerRenderer key={idx} layer={layer} opacity={0} visible={false} />
                        ))}
                        {drawnGeometry && <GeoJSON data={drawnGeometry} style={{ color: 'red', weight: 3 }} />}
                    </MapContainer>
                </div>

                <LayerControlPanel
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

export default GeoMapViewer;