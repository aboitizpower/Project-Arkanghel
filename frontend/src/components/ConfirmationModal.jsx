import React from 'react';
import './ConfirmationModal.css';

const ConfirmationModal = ({ 
  isVisible, 
  title, 
  message, 
  confirmText = 'Delete', 
  cancelText = 'Cancel', 
  onConfirm, 
  onCancel,
  type = 'danger' // 'danger', 'warning', 'info'
}) => {
  if (!isVisible) return null;

  return (
    <div className="confirmation-modal-overlay" onClick={onCancel}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirmation-modal-header ${type}`}>
          <h3 className="confirmation-modal-title">{title}</h3>
        </div>
        
        <div className="confirmation-modal-body">
          <p className="confirmation-modal-message">{message}</p>
        </div>
        
        <div className="confirmation-modal-footer">
          <button 
            className="btn-secondary" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`btn-${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
