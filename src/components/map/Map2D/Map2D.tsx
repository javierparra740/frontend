
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import L from 'leaflet';
import 'leaflet.pm';

import styles from './Map2D.module.css';

// --- Mock Implementations (as per instructions) ---

// Mock GeoService
const GeoService = {
  uploadLayer: async (file: File) => {
    console.log(`Uploading layer: ${file.name}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockUrl = `/uploads/${file.name}.json`;
    console.log(`File uploaded to ${mockUrl}`);
    return { success: true, layer: { name: file.name, geoFileUrl: mockUrl } };
  },
};

// Mock useGeoLayers hook
const useGeoLayers = () => {
    const [layers, setLayers] = useState([
        { name: 'Initial Layer', geoFileUrl: '/initial-layer.json' }
    ]);

    const addLayer = (layer: { name: string, geoFileUrl: string }) => {
        setLayers(prev => [...prev, layer]);
    };

    return { layers, addLayer };
};


// --- GeoMapViewer Component ---

const GeoMapViewer: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const { layers, addLayer } = useGeoLayers();
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;

      // --- 1. Integrate leaflet.pm ---
      map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolyline: true,
        drawPolygon: true,
        editMode: true,
        removalMode: true,
      });

      map.on('pm:create', (e) => {
        const { layer } = e;
        const geoJson = layer.toGeoJSON();
        setDrawnGeometry(geoJson);
        console.log('Geometry created:', geoJson);
        // Here you would typically associate this GeoJSON with a task
      });
    }
  }, [mapRef.current]);

  // --- 2. Handle Layer Upload ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

  return (
    <div className={styles.mapContainer}>
      <div className={styles.toolbar}>
        <input type="file" accept=".gpkg,.shp" onChange={handleFileUpload} disabled={isUploading} />
        {isUploading && <span>Subiendo...</span>}
      </div>
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map: L.Map | null) => mapRef.current = map}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* --- 3. Render Layers --- */}
        {layers.map((_layer, index) => (
          // In a real app, you would fetch the GeoJSON from layer.geoFileUrl
          // For this example, we assume the URL points to a valid GeoJSON file
          // and use a placeholder key.
          <GeoJSON key={index} data={{ type: 'FeatureCollection', features: [] }} />
        ))}

        {drawnGeometry && <GeoJSON data={drawnGeometry} />}
      </MapContainer>
      {drawnGeometry && (
          <div className={styles.geoJsonOutput}>
              <strong>Drawn GeoJSON:</strong>
              <pre>{JSON.stringify(drawnGeometry, null, 2)}</pre>
          </div>
      )}
    </div>
  );
};

export default GeoMapViewer;
