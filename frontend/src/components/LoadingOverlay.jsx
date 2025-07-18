import React from 'react';
import '../styles/LoadingOverlay.css';

const LoadingOverlay = ({ loading, text = 'Loading...' }) => {
  if (!loading) return null;
  return (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
    </div>
  );
};

export default LoadingOverlay; 