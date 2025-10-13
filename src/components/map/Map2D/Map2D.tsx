
import React, { useState, useEffect, useCallback } from 'react';
// Importamos useMap para acceder a la instancia de Leaflet Map
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'; 
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
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockUrl = `/uploads/${file.name}.json`;
    console.log(`File uploaded to ${mockUrl}`);
    return { success: true, layer: { name: file.name, geoFileUrl: mockUrl } };
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
            position: 'topleft',
            drawMarker: true,
            drawPolyline: true,
            drawPolygon: true,
            // drawCircle: true,
            // editMode: true,
            // removalMode: true,
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
  const [isUploading, setIsUploading] = useState(false);
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
    try {
      const result = await GeoService.uploadLayer(file);
      if (result.success) {
        addLayer(result.layer);
      }
    } catch (error) {
      console.error('Error uploading layer:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Asumiendo que styles.mapContainer, styles.toolbar, y styles.geoJsonOutput existen
  const mapContainerClass = 'mapContainer'; // Reemplazo simulado
  const toolbarClass = 'toolbar'; 
  const geoJsonOutputClass = 'geoJsonOutput';

  return (
    <div className={mapContainerClass} style={{ height: '80vh', width: '100%' }}>
      <div className={toolbarClass} style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>
        <input type="file" accept=".gpkg,.shp,.geojson" onChange={handleFileUpload} disabled={isUploading} />
        {isUploading && <span style={{ marginLeft: '10px', color: 'blue' }}>Subiendo...</span>}
      </div>
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        style={{ height: 'calc(100% - 40px)', width: '100%' }} // Ajuste de altura
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* 4. Renderizamos el componente PmControls como hijo de MapContainer */}
        <PmControls onGeometryCreated={handleGeometryCreated} />

        {layers.map((_layer, index) => {
          // Nota: Aquí se mantiene el GeoJSON vacío, pero en una aplicación real 
          // deberías usar un hook o lógica para hacer un fetch real de layer.geoFileUrl.
          const emptyFeatureCollection: FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
          };
          return <GeoJSON key={index} data={emptyFeatureCollection} />;
        })}
      

        {drawnGeometry && <GeoJSON data={drawnGeometry} />}
      </MapContainer>
      {drawnGeometry && (
          <div className={geoJsonOutputClass} style={{ marginTop: '10px', padding: '10px', border: '1px solid #ccc', maxHeight: '200px', overflowY: 'auto' }}>
              <strong>Drawn GeoJSON:</strong>
              <pre style={{ margin: 0 }}>{JSON.stringify(drawnGeometry, null, 2)}</pre>
          </div>
      )}
    </div>
  );
};

export default GeoMapViewer;
