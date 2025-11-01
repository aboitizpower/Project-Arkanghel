import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import axios from 'axios';
import { loginRequest } from '../../authConfig';
import { useAuth } from '../../auth/AuthProvider.jsx';
import API_URL from '../../config/api';
import './AuthButton.css'; // We'll create this for transitions

function AuthButton({ className }) {
    const { instance } = useMsal();
    const { user, logout } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (isLoading) return;
        
        setIsLoading(true);
        try {
            // Clear any existing tokens
            localStorage.removeItem('token');
            
            // 1. First, log in with Microsoft
            const loginResponse = await instance.loginPopup({
                ...loginRequest,
                prompt: 'select_account',
                loginHint: ''
            });
            
            console.log('Microsoft login successful, ID token:', loginResponse.idToken);

            // 2. Verify the token with our backend
            console.log('Verifying token with backend...');
            const verifyResponse = await axios.post(`${API_URL}/api/auth/verify`, { 
                idToken: loginResponse.idToken 
            });
            
            console.log('Backend verify response:', JSON.stringify(verifyResponse.data, null, 2));
            
            if (!verifyResponse.data || !verifyResponse.data.token) {
                throw new Error('Invalid response from server: Missing token');
            }
            
            // 3. Store the application token
            const appToken = verifyResponse.data.token;
            localStorage.setItem('token', appToken);
            
            // 4. Decode the token to check admin status and extract userId
            let isAdmin = false;
            let decodedToken;
            let userId = null;
            
            try {
                const tokenPayload = appToken.split('.')[1];
                const decodedPayload = atob(tokenPayload.replace(/-/g, '+').replace(/_/g, '/'));
                decodedToken = JSON.parse(decodedPayload);
                console.log('Decoded token:', decodedToken);
                
                // Extract userId from token
                userId = decodedToken.id || decodedToken.user_id || decodedToken.userId;
                console.log('Extracted userId from token:', userId);
                
                // Check for admin status in various possible locations
                isAdmin = Boolean(
                    decodedToken.isAdmin || 
                    decodedToken.roles?.includes('admin') ||
                    decodedToken.roles?.includes('administrator') ||
                    (verifyResponse.data.user && verifyResponse.data.user.isAdmin) ||
                    (verifyResponse.data.decoded && verifyResponse.data.decoded.isAdmin)
                );
                
                console.log('Admin check results:', {
                    fromToken: decodedToken.isAdmin,
                    fromRoles: decodedToken.roles,
                    fromResponse: verifyResponse.data.isAdmin,
                    fromUser: verifyResponse.data.user && verifyResponse.data.user.isAdmin,
                    finalIsAdmin: isAdmin
                });
                
            } catch (decodeError) {
                console.error('Error decoding token:', decodeError);
                // If we can't decode the token, try to get admin status from the response
                isAdmin = Boolean(verifyResponse.data.isAdmin);
                console.log('Using direct isAdmin from response:', isAdmin);
            }
            
            // Store userId in localStorage if we have it
            if (userId) {
                localStorage.setItem('userId', userId.toString());
                console.log('Stored userId in localStorage:', userId);
            } else {
                console.warn('No userId found in token - Employee pages may not work correctly');
            }
            
            // 5. Force a redirect with full page reload
            const redirectUrl = isAdmin 
                ? 'http://localhost:5173/admin/analytics' 
                : 'http://localhost:5173/employee/dashboard';
                
            console.log(`Redirecting to: ${redirectUrl} (isAdmin: ${isAdmin})`);
            
            // Add a small delay to ensure token is saved before redirect
            await new Promise(resolve => setTimeout(resolve, 100));
            window.location.href = redirectUrl;
            return; // Ensure no further code execution
            
        } catch (error) {
            console.error('Login error:', error);
            // Clear any partial state
            localStorage.removeItem('token');
            // Don't show error to user, just stay on current page
        } finally {
            setIsLoading(false);
        }
    };

    // Add a small delay before showing the button to prevent flash
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    if (user) {
        return (
            <button 
                onClick={async () => {
                    setIsLoading(true);
                    await logout();
                }} 
                className={`${className} auth-transition ${isVisible ? '' : 'hidden'}`}
                disabled={isLoading}
                aria-label="Sign out"
            >
                {isLoading ? (
                    <span>Signing out...</span>
                ) : (
                    <span>Sign Out</span>
                )}
            </button>
        );
    }

    return (
        <button 
            onClick={handleLogin} 
            className={`${className} auth-transition ${isVisible ? '' : 'hidden'}`}
            disabled={isLoading}
            aria-label="Sign in"
        >
            {isLoading ? (
                <span>Signing in...</span>
            ) : (
                <span>Sign In</span>
            )}
        </button>
    );
}

export default AuthButton;
