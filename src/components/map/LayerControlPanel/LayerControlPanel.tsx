import React, { useState } from 'react';
// Import the actual GeoService (adjust the import path if needed)
import type { LayerData } from '../Map2D/GeoMapViewer'; // Adjust the import path as needed
import { GeoService} from '../Map2D/GeoMapViewer';
interface Props {
  layers: LayerData[];
  visibility: Record<string, boolean>;
  opacity: Record<string, number>;
  onToggle: (id: string) => void;
  onOpacity: (id: string, value: number) => void;
}

export const LayerControlPanel: React.FC<Props> = ({
  layers,
  visibility,
  opacity,
  onToggle,
  onOpacity,
}) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<Record<string, string>>({});

  /* ---------- Descarga ---------- */
  const handleDownload = async (layer: LayerData) => {
    try {
      const blob = await GeoService.downloadLayer(layer.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${layer.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  /* ---------- Validación ---------- */
  const handleValidate = async (layer: LayerData) => {
    setLoading((p) => ({ ...p, [layer.name]: true }));
    try {
      const res = await GeoService.runValidation(layer.name);
      if (res.issues.length) {
        setAlerts((a) => ({ ...a, [layer.name]: `⚠️ ${res.issues.join(', ')}` }));
      } else {
        setAlerts((a) => ({ ...a, [layer.name]: '' }));
      }
    } catch (e) {
      setAlerts((a) => ({ ...a, [layer.name]: '❌ Error al validar' }));
    } finally {
      setLoading((p) => ({ ...p, [layer.name]: false }));
    }
  };

  /* ---------- Render ---------- */
  return (
    <aside className="layer-panel">
      <h3>Capas</h3>
      {layers.length === 0 && <p className="empty">Sin capas</p>}
      {layers.map((ly) => (
        <div key={ly.name} className="layer-row">
          <div className="row-main">
            <label className="toggle">
              <input
                type="checkbox"
                checked={visibility[ly.name] ?? true}
                onChange={() => onToggle(ly.name)}
              />
              <span>{ly.name}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity[ly.name] ?? 1}
              onChange={(e) => onOpacity(ly.name, parseFloat(e.target.value))}
              className="opacity-slider"
            />
          </div>

          <div className="row-actions">
            <button className="btn-download" onClick={() => handleDownload(ly)}>
              Descargar
            </button>
            <button
              className="btn-validate"
              onClick={() => handleValidate(ly)}
              disabled={loading[ly.name]}
            >
              {loading[ly.name] ? '…' : 'Validar'}
            </button>
          </div>

          {alerts[ly.name] && <div className="alert">{alerts[ly.name]}</div>}
        </div>
      ))}
    </aside>
  );
};