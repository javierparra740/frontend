import type { LayerValidationResult } from '../types/geo.types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const BackendValidationService = {
    async validateStructure(file: File): Promise<LayerValidationResult> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${BACKEND_URL}/api/validate/structure`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            return await response.json() as LayerValidationResult;
        } catch (error) {
            console.error('Error en validación de estructura:', error);
            throw new Error('No se pudo conectar con el servidor de validación');
        }
    },

    async validateSecurity(file: File): Promise<LayerValidationResult> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${BACKEND_URL}/api/validate/security`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            return await response.json() as LayerValidationResult;
        } catch (error) {
            console.error('Error en validación de seguridad:', error);
            throw new Error('No se pudo conectar con el servidor de validación');
        }
    },

    async quickValidate(file: File): Promise<LayerValidationResult> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${BACKEND_URL}/api/validate/quick`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            return await response.json() as LayerValidationResult;
        } catch (error) {
            console.error('Error en validación rápida:', error);
            throw new Error('No se pudo conectar con el servidor de validación');
        }
    },
};
