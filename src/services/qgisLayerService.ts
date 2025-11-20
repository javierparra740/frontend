import type { QgisLayer } from '../types/qgis.types';
import { validateSecurity, validateGeographicData, validateAttributes, validatePerformance, type ValidationResult } from '../utils/validations'; // tus funciones actuales

export interface ValidatedLayer {
    layer: QgisLayer;
    geoJson: GeoJSON.FeatureCollection;
    validation: {
        security: ValidationResult;
        geographic: ValidationResult;
        attributes: ValidationResult;
        performance: ValidationResult;
    };
}

export const QgisLayerService = {
    async uploadLayer(file: File): Promise<ValidatedLayer> {
        // 1. Seguridad
        const security = validateSecurity(file);
        if (!security.isValid) throw new Error(security.errors.join('; '));

        // 2. Cargar capa
        const buffer = await file.arrayBuffer();
        const qgisLayer: QgisLayer = await (window as any).QGIS.open(buffer, file.name);

        // 3. GeoJSON para validaciones
        const geoJson = qgisLayer.toGeoJSON();

        // 4. Resto de validaciones
        const geographic = validateGeographicData(geoJson);
        const attributes = validateAttributes(geoJson);
        const performance = validatePerformance(geoJson);

        const critical = [...geographic.errors, ...performance.errors];
        if (critical.length) throw new Error(critical.join('; '));

        return { layer: qgisLayer, geoJson, validation: { security, geographic, attributes, performance } };
    },
};