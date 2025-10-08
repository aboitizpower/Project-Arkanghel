import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

// Add a small delay for smoother transitions
const AUTH_TRANSITION_DELAY = 300; // ms

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Function to validate and set user from token
    const validateAndSetUser = useCallback((token) => {
        try {
            if (!token) return null;
            
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            // Check if token is expired
            if (decodedToken.exp * 1000 > Date.now()) {
                return {
                    id: decodedToken.id,
                    email: decodedToken.email,
                    isAdmin: decodedToken.isAdmin,
                    first_name: decodedToken.first_name,
                    last_name: decodedToken.last_name,
                    token: token
                };
            }
            localStorage.removeItem('token');
            return null;
        } catch (error) {
            console.error("Failed to parse token", error);
            localStorage.removeItem('token');
            return null;
        }
    }, []);

    // Initialize auth state
    useEffect(() => {
        const token = localStorage.getItem('token');
        const validatedUser = validateAndSetUser(token);
        setUser(validatedUser);
        setLoading(false);
        
        // Check for existing accounts on mount
        const currentAccounts = instance.getAllAccounts();
        if (currentAccounts.length > 0 && !validatedUser) {
            // We have accounts but no valid token, try to get a new one silently
            instance.acquireTokenSilent({
                ...loginRequest,
                account: currentAccounts[0]
            }).catch(() => {
                // Silent token acquisition failed, user needs to sign in again
                instance.logout();
            });
        }
    }, [instance, validateAndSetUser]);

    // Handle account changes
    useEffect(() => {
        if (accounts.length > 0) {
            const currentAccount = accounts[0];
            if (user && user.email !== currentAccount.username) {
                // Account changed, need to re-authenticate
                handleLogout();
            }
        } else if (isAuthenticated === false && user) {
            // User was logged out from another tab or window
            handleLogout();
        }
    }, [accounts, user, isAuthenticated]);

    const handleLogout = useCallback(async () => {
        try {
            // Add a small delay before starting the logout process for smoother transition
            await new Promise(resolve => setTimeout(resolve, AUTH_TRANSITION_DELAY));
            
            // Clear local state
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            
            // Sign out from MSAL
            const currentAccounts = instance.getAllAccounts();
            if (currentAccounts.length > 0) {
                try {
                    await instance.logout({
                        account: currentAccounts[0],
                        onRedirectNavigate: () => false,
                        postLogoutRedirectUri: window.location.origin
                    });
                } catch (msalError) {
                    console.warn('MSAL logout warning:', msalError);
                }
            }
            
            // Clear user state after MSAL logout is complete
            setUser(null);
            
            // Force a hard redirect to clear any React state
            window.location.href = '/';
        } catch (error) {
            console.error("Error during logout:", error);
            // Ensure we still clear the user state on error
            setUser(null);
            window.location.href = '/';
        }
    }, [instance]);

    // The AuthProvider exposes user state and auth methods
    const value = { 
        user, 
        setUser: useCallback((userData) => {
            if (userData) {
                if (typeof userData === 'object' && userData.token) {
                    localStorage.setItem('token', userData.token);
                    setUser(validateAndSetUser(userData.token));
                } else if (typeof userData === 'string') {
                    localStorage.setItem('token', userData);
                    setUser(validateAndSetUser(userData));
                }
            } else {
                handleLogout();
            }
        }, [handleLogout, validateAndSetUser]),
        logout: handleLogout,
        loading 
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
