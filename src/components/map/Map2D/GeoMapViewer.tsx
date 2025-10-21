import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm/dist/leaflet.pm.css';
import 'leaflet.pm';
import type { FeatureCollection, Geometry } from 'geojson';
import shp from 'shpjs';
import { LayerControlPanel } from '../LayerControlPanel/LayerControlPanel';
import L, { geoJSON } from 'leaflet';

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

// --- FUNCIONES DE VALIDACIÓN ---

// Validaciones de Seguridad
const validateSecurity = (file: File): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Tipo de archivo - solo ZIP
  if (!file.name.toLowerCase().endsWith('.zip')) {
    errors.push('Solo se permiten archivos ZIP que contengan shapefiles');
  }

  // 2. Tamaño máximo (10MB para MVP)
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    errors.push(`El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 10MB`);
  }

  // 3. Nombre de archivo seguro
  if (/[<>:"|?*\\/]/.test(file.name)) {
    warnings.push('El nombre del archivo contiene caracteres especiales que podrían causar problemas');
  }

  return { isValid: errors.length === 0, errors, warnings };
};

// Validaciones de Datos Geográficos
const validateGeographicData = (geoJson: FeatureCollection): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Verificar que tenga features
  if (!geoJson.features || geoJson.features.length === 0) {
    errors.push('El shapefile no contiene geometrías válidas');
    return { isValid: false, errors, warnings };
  }

  // 2. Validar tipos de geometría
  const geometryTypes = new Set(
    geoJson.features
      .filter(f => f.geometry)
      .map(f => f.geometry.type)
  );

  if (geometryTypes.size === 0) {
    errors.push('No se encontraron geometrías válidas en el archivo');
  }

  if (geometryTypes.size > 1) {
    warnings.push(`Shapefile contiene múltiples tipos de geometría: ${Array.from(geometryTypes).join(', ')}`);
  }

  // 3. Validar coordenadas en rango WGS84 razonable
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

// Validaciones de Atributos
const validateAttributes = (geoJson: FeatureCollection): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const featuresWithProperties = geoJson.features.filter(f => f.properties && Object.keys(f.properties).length > 0);
  
  // 1. Verificar presencia de atributos
  if (featuresWithProperties.length === 0) {
    warnings.push('El shapefile no contiene atributos/tabla de datos');
    return { isValid: true, errors, warnings };
  }

  // 2. Validar nombres de campos
  const sampleFeature = featuresWithProperties[0];
  if (sampleFeature.properties) {
    const problematicFields = Object.keys(sampleFeature.properties).filter(field => 
      /[^a-zA-Z0-9_áéíóúñÑ]/.test(field)
    );
    
    if (problematicFields.length > 0) {
      warnings.push(`Algunos nombres de campo contienen caracteres especiales: ${problematicFields.slice(0, 3).join(', ')}${problematicFields.length > 3 ? '...' : ''}`);
    }
  }

  // 3. Verificar consistencia de campos entre features
  if (featuresWithProperties.length > 1) {
    const firstFields = Object.keys(featuresWithProperties[0].properties || {});
    const inconsistentFeatures = featuresWithProperties.slice(1).filter((feature, index) => {
      const currentFields = Object.keys(feature.properties || {});
      return firstFields.length !== currentFields.length || 
             firstFields.some(field => !currentFields.includes(field));
    });

    if (inconsistentFeatures.length > 0) {
      warnings.push(`${inconsistentFeatures.length} features tienen estructura de atributos inconsistente`);
    }
  }

  return { isValid: true, errors, warnings };
};

// Validaciones de Rendimiento
const validatePerformance = (geoJson: FeatureCollection): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Límite de features (5000 para MVP)
  const MAX_FEATURES = 5000;
  if (geoJson.features.length > MAX_FEATURES) {
    errors.push(`Demasiadas geometrías (${geoJson.features.length}). Máximo permitido: ${MAX_FEATURES}`);
  }

  // 2. Complejidad de geometrías
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

  if (totalVertices > 50000) {
    warnings.push(`Geometrías muy complejas (${totalVertices.toLocaleString()} vértices totales). Puede afectar el rendimiento`);
  }

  // 3. Estadísticas para información
  const stats = calculateValidationStats(geoJson);
  console.log('Estadísticas de validación:', stats);

  return { isValid: errors.length === 0, errors, warnings };
};

// --- FUNCIONES UTILITARIAS ---
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

const calculateValidationStats = (geoJson: FeatureCollection): ValidationStats => {
  const geometryTypes = new Set<string>();
  let totalVertices = 0;
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

  return {
    totalFeatures: geoJson.features.length,
    totalVertices,
    geometryTypes,
    hasAttributes
  };
};

// --- COMPONENTES EXISTENTES (sin cambios) ---
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

// --- SERVICIO GEO ACTUALIZADO CON VALIDACIONES ---
type ProgressCallback = (progress: number) => void;

export const GeoService = {
  uploadLayer: async (file: File, onProgress: ProgressCallback): Promise<{ 
    success: boolean; 
    layer: LayerData;
    validation?: {
      security: ValidationResult;
      geographic: ValidationResult;
      attributes: ValidationResult;
      performance: ValidationResult;
    }
  }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          onProgress(30);
          const buffer = e.target?.result as ArrayBuffer;
          
          // Procesar shapefile con shpjs
          let geoJson = await shp(buffer);
          
          // Si shpjs devuelve un array, fusionar FeatureCollections
          if (Array.isArray(geoJson)) {
            geoJson = {
              type: 'FeatureCollection',
              features: geoJson.flatMap((fc: any) => fc.features),
            };
          }
          
          onProgress(70);
          
          // Ejecutar validaciones
          const securityValidation = validateSecurity(file);
          const geographicValidation = validateGeographicData(geoJson);
          const attributesValidation = validateAttributes(geoJson);
          const performanceValidation = validatePerformance(geoJson);
          
          // Combinar todos los errores
          const allErrors = [
            ...securityValidation.errors,
            ...geographicValidation.errors,
            ...performanceValidation.errors
          ];
          
          // Si hay errores críticos, rechazar
          if (allErrors.length > 0) {
            reject(new Error(allErrors.join('; ')));
            return;
          }
          
          onProgress(100);
          
          resolve({ 
            success: true, 
            layer: { name: file.name, geoJson },
            validation: {
              security: securityValidation,
              geographic: geographicValidation,
              attributes: attributesValidation,
              performance: performanceValidation
            }
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
    const mockBlob = new Blob([JSON.stringify({ layerId, meta: 'mock' })], { type: 'application/zip' });
    return Promise.resolve(mockBlob);
  },

  runValidation: async (layerId: string): Promise<{ issues: string[] }> => {
    const hasIssues = Math.random() > 0.5;
    return Promise.resolve({ issues: hasIssues ? ['Geometría vacía detectada'] : [] });
  },
};

// --- TIPOS Y HOOKS EXISTENTES ---
export interface LayerData {
  name: string;
  geoJson: FeatureCollection;
}

const useGeoLayers = () => {
  const [layers, setLayers] = useState<LayerData[]>([]);
  const addLayer = (layer: LayerData) => {
    setLayers((prev) => [...prev, layer]);
  };
  return { layers, addLayer };
};

interface UploadingFile {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'validating';
  progress: number;
  errors?: string[];
  warnings?: string[];
}

// --- COMPONENTE PRINCIPAL ACTUALIZADO ---
const GeoMapViewer: React.FC = () => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const [validationMessages, setValidationMessages] = useState<{errors: string[], warnings: string[]}>({errors: [], warnings: []});
  
  const { layers, addLayer } = useGeoLayers();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleGeometryCreated = useCallback((geoJson: any) => {
    setDrawnGeometry(geoJson);
  }, []);

  // --- MANEJO DE ARCHIVOS CON VALIDACIONES ---
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
    
    const updateProgressState = (progress: number, status: UploadingFile['status'] = 'uploading', errors?: string[], warnings?: string[]) => {
      setUploadingFiles((prev) =>
        prev.map((f) => 
          f.file.name === file.name ? { ...f, progress, status, errors, warnings } : f
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

      // Mostrar advertencias de seguridad
      if (securityValidation.warnings.length > 0) {
        setValidationMessages(prev => ({
          ...prev,
          warnings: [...prev.warnings, ...securityValidation.warnings]
        }));
      }

      updateProgressState(0, 'uploading');
      
      // Procesar archivo con validaciones integradas
      const result = await GeoService.uploadLayer(file, (p) => updateProgressState(p));
      
      if (result.success) {
        // Recolectar todos los warnings de las validaciones
        const allWarnings = [
          ...result.validation!.security.warnings,
          ...result.validation!.geographic.warnings,
          ...result.validation!.attributes.warnings,
          ...result.validation!.performance.warnings
        ];

        updateProgressState(100, 'completed', [], allWarnings);
        
        // Mostrar warnings en la consola y en el estado
        if (allWarnings.length > 0) {
          console.warn('Advertencias de validación para', file.name, ':', allWarnings);
          setValidationMessages(prev => ({
            ...prev,
            warnings: [...prev.warnings, ...allWarnings]
          }));
        }
        
        addLayer(result.layer);
        setVisibility((v) => ({ ...v, [result.layer.name]: true }));
        setOpacity((o) => ({ ...o, [result.layer.name]: 1 }));
        
        console.log('✅ Archivo cargado exitosamente:', file.name);
      }
      
    } catch (error) {
      console.error('❌ Error en carga:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar el archivo';
      updateProgressState(0, 'error', [errorMessage]);
      setValidationMessages(prev => ({
        errors: [...prev.errors, errorMessage],
        warnings: prev.warnings
      }));
    }
  };

  // Limpiar mensajes de validación
  const clearValidationMessages = () => {
    setValidationMessages({errors: [], warnings: []});
  };

  // --- DRAG & DROP (sin cambios) ---
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
    clearValidationMessages(); // Limpiar mensajes anteriores
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  // --- ESTILOS (mejorados para mostrar validaciones) ---
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
          accept=".zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            clearValidationMessages();
            e.target.files && handleFiles(e.target.files);
          }}
        />
        <p style={{ margin: '0.5rem 0' }}>
          Arrastra y suelta tus archivos <strong>.zip</strong> con shapefiles aquí
        </p>
        <button onClick={() => {
          clearValidationMessages();
          fileInputRef.current?.click();
        }} style={uploadButton}>
          Seleccionar Archivos
        </button>

        {/* Mostrar mensajes de validación */}
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
            {uploadingFiles.map(({ file, status, progress, errors = [], warnings = [] }) => (
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
                
                {/* Mostrar errores y warnings específicos del archivo */}
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

      {/* Mapa */}
      <div style={{ flexGrow: 1, minHeight: '500px', position: 'relative' }}>
        <MapContainer center={[40.4168, -3.7038]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <PmControls onGeometryCreated={handleGeometryCreated} />
          
          {/* Renderizar capas */}
          {layers.map((layer, idx) => (
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
          ))}

          {drawnGeometry && <GeoJSON data={drawnGeometry} style={{ color: 'red', weight: 3 }} />}
        </MapContainer>

        {/* Panel de control de capas */}
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