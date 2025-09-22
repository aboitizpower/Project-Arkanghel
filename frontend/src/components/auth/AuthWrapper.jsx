import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import './AuthButton.css';

/**
 * Wrapper component to handle smooth transitions during auth state changes
 */
const AuthWrapper = ({ children }) => {
    const { loading } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [content, setContent] = useState(children);

    useEffect(() => {
        // When loading changes, start the transition
        if (loading) {
            setIsVisible(false);
        } else {
            // After hiding, update content and show with delay
            const timer = setTimeout(() => {
                setContent(children);
                setIsVisible(true);
            }, 300); // Match this with the CSS transition duration
            
            return () => clearTimeout(timer);
        }
    }, [loading, children]);

    return (
        <div className={`auth-transition ${isVisible ? 'page-transition' : 'hidden'}`}>
            {content}
        </div>
    );
};

export default AuthWrapper;
