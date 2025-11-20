import type { FeatureCollection } from 'geojson';

/* --------------  INTERFACES -------------- */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/* --------------  FUNCIONES AUXILIARES -------------- */
const getCoordinates = (geometry: any): number[][] => {
    const coords: number[][] = [];

    const extractCoords = (geom: any) => {
        if (!geom) return;

        if (geom.type === 'Point') {
            coords.push(geom.coordinates);
        } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
            coords.push(...geom.coordinates);
        } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
            geom.coordinates.forEach((ring: number[][]) => coords.push(...ring));
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((polygon: number[][][]) => {
                polygon.forEach((ring: number[][]) => coords.push(...ring));
            });
        }
    };

    extractCoords(geometry);
    return coords;
};

/* --------------  VALIDACIONES -------------- */
export const validateSecurity = (file: File): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!file.name.toLowerCase().endsWith('.zip')) {
        errors.push('Solo se permiten archivos ZIP que contengan shapefiles');
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        errors.push(
            `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 10MB`
        );
    }

    if (/[<>:"|?*\\/]/.test(file.name)) {
        warnings.push('El nombre del archivo contiene caracteres especiales que podrían causar problemas');
    }

    return { isValid: errors.length === 0, errors, warnings };
};

export const validateGeographicData = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!geoJson.features || geoJson.features.length === 0) {
        errors.push('El shapefile no contiene geometrías válidas');
        return { isValid: false, errors, warnings };
    }

    const geometryTypes = new Set(
        geoJson.features.filter((f) => f.geometry).map((f) => f.geometry!.type)
    );

    if (geometryTypes.size === 0) errors.push('No se encontraron geometrías válidas en el archivo');
    if (geometryTypes.size > 1) {
        warnings.push(`Shapefile contiene múltiples tipos de geometría: ${Array.from(geometryTypes).join(', ')}`);
    }

    let validCoordinatesCount = 0;
    geoJson.features.forEach((feature, idx) => {
        if (!feature.geometry) return;
        const coords = getCoordinates(feature.geometry);
        const invalid = coords.filter((c) => Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90);
        if (invalid.length) warnings.push(`Feature ${idx + 1}: ${invalid.length} coordenadas fuera de rango WGS84`);
        else if (coords.length) validCoordinatesCount++;
    });

    if (!validCoordinatesCount) errors.push('No se encontraron coordenadas geográficas válidas');

    return { isValid: errors.length === 0, errors, warnings };
};

export const validateAttributes = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!geoJson.features || geoJson.features.length === 0) {
        return { isValid: true, errors, warnings };
    }

    // Validar estructura de propiedades
    const sampleFeature = geoJson.features[0];
    if (!sampleFeature.properties) {
        warnings.push('El shapefile no contiene atributos o propiedades');
        return { isValid: true, errors, warnings };
    }

    // Validar nombres de campos
    const fieldNames = Object.keys(sampleFeature.properties);

    if (fieldNames.length === 0) {
        warnings.push('No se encontraron campos de atributos');
    }

    // Validar caracteres problemáticos en nombres de campos
    const invalidFieldNames = fieldNames.filter(name => /[^a-zA-Z0-9_]/.test(name));
    if (invalidFieldNames.length > 0) {
        warnings.push(`Algunos nombres de campo contienen caracteres especiales: ${invalidFieldNames.join(', ')}`);
    }

    // Validar campos demasiado largos
    const longFieldNames = fieldNames.filter(name => name.length > 50);
    if (longFieldNames.length > 0) {
        warnings.push(`Algunos nombres de campo son muy largos (>50 chars): ${longFieldNames.join(', ')}`);
    }

    // Validar consistencia de campos entre features
    geoJson.features.forEach((feature, idx) => {
        if (feature.properties) {
            const currentFields = Object.keys(feature.properties);
            const missingFields = fieldNames.filter(field => !currentFields.includes(field));
            const extraFields = currentFields.filter(field => !fieldNames.includes(field));

            if (missingFields.length > 0) {
                warnings.push(`Feature ${idx + 1}: faltan campos presentes en otros features: ${missingFields.join(', ')}`);
            }
            if (extraFields.length > 0) {
                warnings.push(`Feature ${idx + 1}: tiene campos adicionales no presentes en otros features: ${extraFields.join(', ')}`);
            }
        }
    });

    return { isValid: true, errors, warnings };
};

export const validatePerformance = (geoJson: FeatureCollection): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!geoJson.features) {
        return { isValid: true, errors, warnings };
    }

    const MAX_FEATURES = 10000;
    const MAX_VERTICES_PER_FEATURE = 10000;
    const MAX_TOTAL_VERTICES = 100000;

    // Validar número total de features
    if (geoJson.features.length > MAX_FEATURES) {
        errors.push(`Demasiadas features: ${geoJson.features.length}. Máximo permitido: ${MAX_FEATURES}`);
    }

    // Contar vértices y validar geometrías complejas
    let totalVertices = 0;
    let complexFeatures: number[] = [];

    geoJson.features.forEach((feature, idx) => {
        if (!feature.geometry) return;

        const coords = getCoordinates(feature.geometry);
        const vertexCount = coords.length;
        totalVertices += vertexCount;

        if (vertexCount > MAX_VERTICES_PER_FEATURE) {
            complexFeatures.push(idx + 1);
            warnings.push(`Feature ${idx + 1} tiene demasiados vértices: ${vertexCount}`);
        }
    });

    // Validar vértices totales
    if (totalVertices > MAX_TOTAL_VERTICES) {
        errors.push(`Demasiados vértices en total: ${totalVertices}. Máximo permitido: ${MAX_TOTAL_VERTICES}`);
    }

    // Validar geometrías vacías o inválidas
    let emptyGeometries = 0;
    geoJson.features.forEach((feature, idx) => {
        if (!feature.geometry) {
            emptyGeometries++;
            warnings.push(`Feature ${idx + 1} no tiene geometría`);
        } else {
            const coords = getCoordinates(feature.geometry);
            if (coords.length === 0) {
                emptyGeometries++;
                warnings.push(`Feature ${idx + 1} tiene geometría vacía`);
            }
        }
    });

    if (emptyGeometries > geoJson.features.length * 0.5) {
        warnings.push(`Más del 50% de las features tienen geometrías vacías o inválidas`);
    }

    return { isValid: errors.length === 0, errors, warnings };
};

