import React, { useState, useEffect, useCallback } from 'react';
// Importamos useMap para acceder a la instancia de Leaflet Map
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
// Importamos 'leaflet.pm' para inicializar el plugin globalmente
import 'leaflet.pm';

import type { FeatureCollection } from 'geojson';

// Asumimos un objeto CSS para mantener la funcionalidad sin archivos externos.
const styles = {
    pageContainer: 'flex flex-col h-screen',
    dropzone: 'p-4 border-2 border-dashed border-gray-400 m-2 transition-colors',
    dragging: 'border-green-500 bg-green-50',
    uploadButton: 'bg-blue-500 text-white p-2 rounded',
    mapViewer: 'flex-grow h-1/2',
    fileList: 'mt-4 border-t pt-2',
    fileItem: 'flex justify-between items-center py-1',
    fileName: 'truncate w-1/2',
    progressBarContainer: 'w-1/4 h-2 bg-gray-200 rounded overflow-hidden',
    progressBar: 'h-full bg-green-500 transition-all duration-300',
    fileStatus: 'w-1/6 text-right'
};


// --- MOCK SERVICES (Corregidos para callback de progreso y fetch) ---

// Define un tipo para el callback de progreso
type ProgressCallback = (progress: number) => void;

const GeoService = {
    // FIX C: Ahora acepta un callback para reportar el progreso de forma local
    uploadLayer: async (file: File, onProgress: ProgressCallback) => {
        console.log(`Uploading layer: ${file.name}`);

        return new Promise<{ success: boolean; layer: { name: string; geoFileUrl: string } }>(resolve => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 20;
                // Llama al callback local en lugar de una función global de window
                onProgress(progress);

                if (progress >= 100) {
                    clearInterval(interval);
                    const mockUrl = `/uploads/${file.name}.json`;
                    console.log(`File uploaded to ${mockUrl}`);
                    resolve({ success: true, layer: { name: file.name, geoFileUrl: mockUrl } });
                }
            }, 300);
        });
    },

    // FIX B: Servicio para simular la obtención del GeoJSON de una URL
    fetchGeoJson: async (url: string): Promise<FeatureCollection> => {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`Fetching GeoJSON from: ${url}`);

        // Datos mock de ejemplo para que la capa no se renderice vacía
        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: `Data from ${url}` },
                    geometry: {
                        type: 'Point',
                        coordinates: [(-0.09 + Math.random() * 0.02), (51.505 + Math.random() * 0.02)]
                    }
                }
            ]
        };
    }
};


interface LayerMetadata {
    name: string;
    geoFileUrl: string;
}

const useGeoLayers = () => {
    const [layers, setLayers] = useState<LayerMetadata[]>([
        { name: 'Initial Layer', geoFileUrl: '/initial-layer.json' }
    ]);

    const addLayer = (layer: LayerMetadata) => {
        setLayers(prev => [...prev, layer]);
    };

    return { layers, addLayer };
};

interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
}


// --- NUEVO COMPONENTE: LayerRenderer (Solución a FIX B) ---
// Se encarga de la lógica de fetch y renderizado individual de una capa
interface LayerRendererProps {
    layer: LayerMetadata;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({ layer }) => {
    const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await GeoService.fetchGeoJson(layer.geoFileUrl);
                setGeoJsonData(data);
            } catch (error) {
                console.error(`Failed to load data for layer ${layer.name}:`, error);
                setGeoJsonData(null);
            }
        };

        if (layer.geoFileUrl) {
            loadData();
        }
    }, [layer.geoFileUrl, layer.name]); // Dependencia del URL para re-fetch

    if (!geoJsonData) {
        return null;
    }

    return <GeoJSON data={geoJsonData} style={{ color: 'blue', weight: 2 }} />;
};


// --- NUEVO COMPONENTE: PmControls (Solución a FIX A) ---
// Utiliza useMap para acceder a la instancia y configurar el plugin
interface PmControlsProps {
    onGeometryCreated: (geoJson: any) => void;
}

const PmControls: React.FC<PmControlsProps> = ({ onGeometryCreated }) => {
    const map = useMap();

    const handlePmCreate = useCallback((e: any) => {
        const { layer } = e;
        const geoJson = layer.toGeoJSON();
        onGeometryCreated(geoJson);
        console.log('Geometry created:', geoJson);
    }, [onGeometryCreated]);


    useEffect(() => {
        // Inicialización y controles de leaflet.pm (se ejecutan una vez)
        if (!map.pm) return;
        map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolyline: true,
            drawPolygon: true,
            //editMode: true,
            //removalMode: true,
        });

        // Configurar el listener de creación de geometría
        map.on('pm:create', handlePmCreate);

        // Función de limpieza
        return () => {
            map.off('pm:create', handlePmCreate);
            // map.pm.removeControls(); // Dejar comentado si es el mapa principal
        };

    }, [map, handlePmCreate]);

    return null;
};


// --- GeoMapViewer Component (Principal) ---
const GeoMapViewer: React.FC = () => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
    const { layers, addLayer } = useGeoLayers();

    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const handleGeometryCreated = useCallback((geoJson: any) => {
        setDrawnGeometry(geoJson);
    }, []);

    // --- Lógica de Carga de Archivos (Corregida: FIX C) ---
    const handleFiles = (files: FileList) => {
        const newFiles: UploadingFile[] = Array.from(files).map(file => ({
            file,
            status: 'pending',
            progress: 0
        }));
        setUploadingFiles(prev => [...prev, ...newFiles]);
        newFiles.forEach(uploadFile);
    };

    const uploadFile = async (uploadingFile: UploadingFile) => {
        const { file } = uploadingFile;

        // Helper para actualizar el progreso del archivo específico
        const updateProgressState = (progress: number, status: UploadingFile['status'] = 'uploading') => {
            setUploadingFiles(prev => prev.map(f =>
                f.file.name === file.name ? { ...f, progress, status } : f
            ));
        };

        try {
            updateProgressState(0, 'uploading');

            // FIX C: Pasamos el callback de progreso local al servicio
            const result = await GeoService.uploadLayer(file, (progress) => {
                updateProgressState(progress);
            });

            if (result.success) {
                updateProgressState(100, 'completed');
                addLayer(result.layer);
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading layer:', error);
            updateProgressState(0, 'error');
        }
    };


    // --- Drag & Drop Handlers ---
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


    return (
        <div className={styles.pageContainer}>
            <div
                className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    // Incluimos archivos comunes para Shapefile (.dbf, .shx, .prj) y GeoPackage
                    accept=".gpkg,.shp,.dbf,.shx,.prj"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                <p>Arrastra y suelta tus archivos geoespaciales aquí (.gpkg, .shp, .dbf, etc.)</p>
                <button onClick={() => fileInputRef.current?.click()} className={styles.uploadButton}>
                    Seleccionar Archivos
                </button>
                {uploadingFiles.length > 0 && (
                    <div className={styles.fileList}>
                        {uploadingFiles.map(({ file, status, progress }) => (
                            <div key={file.name} className={styles.fileItem}>
                                <span className={styles.fileName}>{file.name}</span>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
                                </div>
                                <span className={styles.fileStatus} style={{ color: status === 'error' ? 'red' : 'green' }}>{status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.mapViewer}>
                <MapContainer
                    center={[51.505, -0.09]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                // Eliminamos whenReady y mapRef para seguir la práctica de useMap
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {/* FIX A: Renderizamos PmControls para inicializar el plugin */}
                    <PmControls onGeometryCreated={handleGeometryCreated} />

                    {/* FIX B: Renderizamos LayerRenderer para que haga el fetch de cada capa */}
                    {layers.map((layer, index) => (
                        <LayerRenderer key={index} layer={layer} />
                    ))}

                    {/* Renderizar la geometría dibujada */}
                    {drawnGeometry && <GeoJSON data={drawnGeometry} style={{ color: 'red', weight: 3 }} />}
                </MapContainer>
            </div>
        </div>
    );
};

export default GeoMapViewer;
