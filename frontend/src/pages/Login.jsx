import React from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import AuthButton from '../components/auth/AuthButton.jsx';
import '../styles/Auth.css';
import '../styles/Login.css';
import logo from '../assets/loginlogo.jpg';
import bgImg from '../assets/bg_login.jpg';

const Login = () => {
    const { instance } = useMsal();

    const handleRegisterClick = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };
    return (
        <div className="auth-container">
            {/* Left Panel: Login Form */}
            <div className="auth-panel auth-form-panel white-panel left-panel login-panel">
                <div className="login-outer-panel">
                    <div className="login-logo-container">
                        <img src={logo} alt="loginlogo" className="login-logo" />
                    </div>
                    <div className="login-form-center">
                        <h2 className="auth-title darkblue-text login-title">Sign In</h2>
                        <div className="login-message login-panel-message">
                            Please use your Aboitiz account to sign in.
                        </div>
                        <AuthButton className="login-btn" />
                    </div>
                </div>
            </div>

            {/* Right Panel: Welcome & Background */}
            <div className="auth-panel auth-welcome-panel right-panel split-bg-panel">
                <div
                    className="login-bg"
                    style={{ backgroundImage: `url(${bgImg})` }}
                />
                <div className="login-bg-overlay"></div>
                {/* Register Link at upper right */}
                <div className="login-bg-register-link">
                    <span style={{ color: '#fff', fontWeight: 600, marginRight: '8px' }}>Don’t have an account?</span>
                    <button
                        className="register-link-btn"
                        onClick={handleRegisterClick}
                    >
                        <span style={{ fontWeight: 600 }}>Sign up</span>
                    </button>
                </div>
                <div className="login-bg-content">
                    <h1 className="auth-welcome-title">Welcome to<br/>End-User Training System</h1>
                    <p className="auth-welcome-desc">
                        This system provides learning and training to end users on the Unified Health Management System (UHMS), Asset Information Management System, <br/>Anomaly Detection, Boiler Digital Twin, and Smart Operator Rounds.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
