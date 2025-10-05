import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes, FaTimesCircle } from 'react-icons/fa';
import './NotificationDialog.css';

const NotificationDialog = ({ message, type = 'success', isVisible, onClose, duration = 8000 }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose, duration]);

    if (!isVisible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <FaCheckCircle className="notification-icon" />;
            case 'error':
                return <FaTimesCircle className="notification-icon" />;
            case 'warning':
                return <FaExclamationTriangle className="notification-icon" />;
            case 'info':
                return <FaInfoCircle className="notification-icon" />;
            default:
                return <FaCheckCircle className="notification-icon" />;
        }
    };

    return (
        <div className={`notification-dialog ${type}`}>
            <div className="notification-content">
                <div className="notification-left">
                    {getIcon()}
                    <span className="notification-message">{message}</span>
                </div>
                <button className="notification-close" onClick={onClose}>
                    <FaTimes />
                </button>
            </div>
        </div>
    );
};

export default NotificationDialog;
