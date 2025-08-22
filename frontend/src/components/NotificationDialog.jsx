import React, { useEffect } from 'react';
import './NotificationDialog.css';

const NotificationDialog = ({ message, type = 'success', isVisible, onClose, duration = 3000 }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose, duration]);

    if (!isVisible) return null;

    return (
        <div className={`notification-dialog ${type}`}>
            <div className="notification-content">
                <span className="notification-message">{message}</span>
                <button className="notification-close" onClick={onClose}>×</button>
            </div>
        </div>
    );
};

export default NotificationDialog;
