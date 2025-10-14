<<<<<<< HEAD
import React, { useState, useEffect, useCallback } from 'react';
// Importamos useMap para acceder a la instancia de Leaflet Map
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'; 
=======

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
>>>>>>> e2e471f (actualizacion de GeoMapViewer con cambios avanzados)
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import 'leaflet.pm'; // Solo necesitamos que el plugin se ejecute, sin necesidad de importar L
// Nota: En un proyecto real, necesitarías un archivo styles/Map2D.module.css
// import styles from './Map2D.module.css'; 
// Para mantener el código funcional sin el archivo CSS, he comentado la importación de estilos
// y asumiré que existen las clases básicas para el contenedor.

import type { FeatureCollection } from 'geojson';

// --- Mock Implementations (sin cambios) ---
const GeoService = {
  uploadLayer: async (file: File) => {
    console.log(`Uploading layer: ${file.name}`);
<<<<<<< HEAD
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockUrl = `/uploads/${file.name}.json`;
    console.log(`File uploaded to ${mockUrl}`);
    return { success: true, layer: { name: file.name, geoFileUrl: mockUrl } };
=======
    // Simulate API call with progress
    return new Promise<{ success: boolean; layer: { name: string; geoFileUrl: string } }>(resolve => {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 20;
            // In a real implementation, you would get progress from the upload event
            if (window.updateUploadProgress) {
                window.updateUploadProgress(file.name, progress);
            }
            if (progress >= 100) {
                clearInterval(interval);
                const mockUrl = `/uploads/${file.name}.json`;
                console.log(`File uploaded to ${mockUrl}`);
                resolve({ success: true, layer: { name: file.name, geoFileUrl: mockUrl } });
            }
        }, 300);
    });
>>>>>>> e2e471f (actualizacion de GeoMapViewer con cambios avanzados)
  },
};

const useGeoLayers = () => {
    const [layers, setLayers] = useState([
        { name: 'Initial Layer', geoFileUrl: '/initial-layer.json' }
    ]);

    const addLayer = (layer: { name: string, geoFileUrl: string }) => {
        setLayers(prev => [...prev, layer]);
    };

    return { layers, addLayer };
};

interface UploadingFile {
    file: File;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
}

// --- NUEVO COMPONENTE: PmControls ---
// Práctica corregida: Componente hijo para inicializar plugins y lógica de mapa.
// Esto asegura que la instancia de L.Map esté lista.
interface PmControlsProps {
    onGeometryCreated: (geoJson: any) => void;
}

const PmControls: React.FC<PmControlsProps> = ({ onGeometryCreated }) => {
    // 1. Uso de useMap para obtener la instancia de L.Map de forma segura
    const map = useMap(); 
    
    // Optimizamos el callback para evitar re-creación innecesaria en cada render
    const handlePmCreate = useCallback((e: any) => {
        const { layer } = e;
        const geoJson = layer.toGeoJSON();
        onGeometryCreated(geoJson);
        console.log('Geometry created:', geoJson);
    }, [onGeometryCreated]);


    useEffect(() => {
        // Inicialización y controles de leaflet.pm (se ejecutan una vez)
        map.pm.addControls({
            position: 'bottomleft',
            drawMarker: true,
            drawPolyline: true,
            drawPolygon: true,
            //drawCircle: true,
            //editMode: true,
            //removalMode: true,
        });

        // Configurar el listener de creación de geometría
        map.on('pm:create', handlePmCreate);

        // Función de limpieza: Buena práctica para remover event listeners
        return () => {
            map.off('pm:create', handlePmCreate);
            // Opcional: remover los controles si el componente se desmonta (no es habitual en un mapa principal)
            // map.pm.removeControls();
        };

    }, [map, handlePmCreate]); // Dependencias: la instancia del mapa y el callback

    // Los componentes hijos de MapContainer que solo manejan lógica deben devolver null.
    return null; 
};


// --- GeoMapViewer Component (Corregido) ---
const GeoMapViewer: React.FC = () => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const { layers, addLayer } = useGeoLayers();
  
  // 2. Manejador optimizado para actualizar el estado de la geometría dibujada
  const handleGeometryCreated = useCallback((geoJson: any) => {
      setDrawnGeometry(geoJson);
  }, []);

  // --- 3. Handle Layer Upload (sin cambios funcionales) ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Asegurarse de que el input se resetee para poder subir el mismo archivo si es necesario
    event.target.value = '';

    setIsUploading(true);
  const mapRef = useRef<L.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- 1. leaflet.pm Integration ---
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      if (!map.pm) return; // Ensure pm is available

      map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolyline: true,
        drawPolygon: true,
        //editMode: true,
        //removalMode: true,
      });

      map.on('pm:create', (e) => {
        const { layer } = e;
        const geoJson = layer.toGeoJSON();
        setDrawnGeometry(geoJson);
        console.log('Geometry created:', geoJson);
      });

      // Cleanup on unmount
      return () => {
        map.pm.removeControls();
        map.off('pm:create');
      };
    }
  }, [mapRef.current]);
 //
  // --- 2. File Upload Logic ---
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

    // Update status to 'uploading'
    setUploadingFiles(prev => prev.map(f => f.file.name === file.name ? { ...f, status: 'uploading' } : f));

    // Expose a global function for progress updates
    (window as any).updateUploadProgress = (fileName: string, progress: number) => {
        setUploadingFiles(prev => prev.map(f => f.file.name === fileName ? { ...f, progress } : f));
    };

    try {
      const result = await GeoService.uploadLayer(file);
      if (result.success) {
        setUploadingFiles(prev => prev.map(f => f.file.name === file.name ? { ...f, status: 'completed', progress: 100 } : f));
        addLayer(result.layer);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading layer:', error);
      setUploadingFiles(prev => prev.map(f => f.file.name === file.name ? { ...f, status: 'error' } : f));
    } finally {
        delete (window as any).updateUploadProgress;
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
    e.stopPropagation(); // Necessary to allow drop
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

  // Asumiendo que styles.mapContainer, styles.toolbar, y styles.geoJsonOutput existen
  const mapContainerClass = 'mapContainer'; // Reemplazo simulado
  const toolbarClass = 'toolbar'; 
  const geoJsonOutputClass = 'geoJsonOutput';

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
                accept=".gpkg,.shp,.dbf,.shx,.prj"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <p>Arrastra y suelta tus archivos geoespaciales aquí</p>
            <button onClick={() => fileInputRef.current?.click()} className={styles.uploadButton}>
                Seleccionar Archivos
            </button>
            {uploadingFiles.length > 0 && (
                <div className={styles.fileList}>
                    {uploadingFiles.map(({ file, status, progress }) => (
                        <div key={file.name} className={styles.fileItem}>
                            <span className={styles.fileName}>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                            <div className={styles.progressBarContainer}>
                                <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className={styles.fileStatus}>{status}</span>
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
                whenReady={(map: L.Map | null) => mapRef.current = map}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {/* --- 3. Render Layers --- */}
                {layers.map((_layer, index) => (
                    <GeoJSON key={index} data={{ type: 'FeatureCollection', features: [] }} />
                ))}

                {drawnGeometry && <GeoJSON data={drawnGeometry} />}
            </MapContainer>
        </div>
    </div>
  );
};

export default GeoMapViewer;

// Add a declaration for the global function to satisfy TypeScript
declare global {
    interface Window {
        updateUploadProgress?: (fileName: string, progress: number) => void;
    }
}
