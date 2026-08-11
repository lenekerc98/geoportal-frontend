import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const confirmDelete = async (title, text = "Esta acción no se puede deshacer.") => {
  const result = await MySwal.fire({
    title: title,
    text: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)',
    customClass: {
      popup: 'swal-custom-popup',
      title: 'swal-custom-title',
      confirmButton: 'swal-custom-confirm',
      cancelButton: 'swal-custom-cancel'
    }
  });
  return result.isConfirmed;
};

export const showSuccess = (title, text = "") => {
  MySwal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    title: title,
    text: text,
    icon: 'success',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)'
  });
};

export const showError = (title, text = "") => {
  MySwal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    title: title,
    text: text,
    icon: 'error',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)'
  });
};
