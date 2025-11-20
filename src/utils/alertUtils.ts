import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

export const Alert = withReactContent(Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    didOpen: (t) => {
        t.addEventListener('mouseenter', Swal.stopTimer);
        t.addEventListener('mouseleave', Swal.resumeTimer);
    },
}));

/* helpers ---------------------------------------------------------- */
export const toast = {
    success: (html: string) => Alert.fire({ icon: 'success', html }),
    warning: (html: string) => Alert.fire({ icon: 'warning', html }),
    error: (html: string) => Alert.fire({ icon: 'error', html }),
};

export const modal = {
    errors: (list: string[]) =>
        Swal.fire({
            title: 'Errores de validación',
            icon: 'error',
            html: `<ul class="text-left">${list.map((e) => `<li>${e}</li>`).join('')}</ul>`,
        }),

    warnings: (list: string[]) =>
        Swal.fire({
            title: 'Advertencias',
            icon: 'warning',
            html: `<ul class="text-left">${list.map((w) => `<li>${w}</li>`).join('')}</ul>`,
        }),
};
