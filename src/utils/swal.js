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
    background: '#1e293b',
    color: '#f8fafc',
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
    title: title,
    text: text,
    icon: 'success',
    confirmButtonColor: '#10b981',
    background: '#1e293b',
    color: '#f8fafc'
  });
};

export const showError = (title, text = "") => {
  MySwal.fire({
    title: title,
    text: text,
    icon: 'error',
    confirmButtonColor: '#ef4444',
    background: '#1e293b',
    color: '#f8fafc'
  });
};
