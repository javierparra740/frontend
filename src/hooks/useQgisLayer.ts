import { useState } from 'react';
import { QgisLayerService,type ValidatedLayer } from '../services/qgisLayerService';

export const useQgisLayers = () => {
    const [layers, setLayers] = useState<ValidatedLayer[]>([]);

    const addLayer = (vl: ValidatedLayer) => setLayers((prev) => [...prev, vl]);

    return { layers, addLayer };
};