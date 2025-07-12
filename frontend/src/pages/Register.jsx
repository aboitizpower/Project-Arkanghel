import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/Auth.css";
import "../styles/Login.css";
import logo from "../assets/loginlogo.jpg";
import bgImg from "../assets/bg_login.jpg";

const Register = () => {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    if (form.password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setIsError(true);
      return;
    }
    try {
      const res = await fetch("http://localhost:8081/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { error: "Invalid JSON response from server." };
      }
      if (res.ok) {
        setMessage(data.success);
        setIsError(false);
        // Optionally, redirect to login
      } else {
        setMessage(
          (data.error ? data.error : "Unknown error.") + ` (Status: ${res.status})`
        );
        setIsError(true);
      }
    } catch (err) {
      setMessage(`Network/server error: ${err.message}`);
      setIsError(true);
    }
  };

  const handleLoginClick = () => {
    setAnimateOut(true);
    setTimeout(() => {
      navigate('/');
    }, 400);
  };

  return (
    <div className="auth-container">
      {/* Left Panel: Welcome & Login */}
      <div className="auth-panel auth-welcome-panel left-panel split-bg-panel">
        {/* Background image only */}
        <div
          className="login-bg"
          style={{ backgroundImage: `url(${bgImg})` }}
        />
        <div className="login-bg-overlay"></div>
        {/* Welcome Message */}
        <div className="login-bg-content">
          <h1 className="auth-welcome-title">Welcome to<br/>End-User Training System</h1>
          <p className="auth-welcome-desc">
            This system provides learning and training to end users on the Unified Health Management System (UHMS), Asset Information Management System, <br/>Anomaly Detection, Boiler Digital Twin, and Smart Operator Rounds.
          </p>
        </div>
        
        
      </div>

      {/* Right Panel: Register Form */}
      <div className={`auth-panel auth-form-panel white-panel right-panel${animateOut ? ' slide-out-right' : ' slide-in-right' } login-panel`}>
        <div className="login-outer-panel">
          {/* Logo higher up */}
          <div className="login-logo-container">
            <img src={logo} alt="registerlogo" className="login-logo" />
          </div>
          {/* Login Link below logo */}
          <div className="login-bg-register-link" style={{ margin: '0 auto 12px auto', textAlign: 'center' }}>
            <span style={{ color: '#2563eb', fontWeight: 600, marginRight: '8px' }}>Already have an account?</span>
            <button
              className="register-link-btn"
              onClick={handleLoginClick}
              style={{ color: '#2563eb', fontWeight: 600 }}
            >
              Login
            </button>
          </div>
          {/* Centered form container */}
          <div className="login-form-center">
            <h2 className="auth-title darkblue-text login-title">Register</h2>
            <form className="login-form" onSubmit={handleRegister}>
              <div className="auth-field login-form-field">
                <label htmlFor="register-first-name" className="darkblue-text">First Name</label>
                <input
                  id="register-first-name"
                  name="first_name"
                  placeholder="First Name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                  className="auth-input darkblue-input login-input"
                />
              </div>
              <div className="auth-field login-form-field">
                <label htmlFor="register-last-name" className="darkblue-text">Last Name</label>
                <input
                  id="register-last-name"
                  name="last_name"
                  placeholder="Last Name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                  className="auth-input darkblue-input login-input"
                />
              </div>
              <div className="auth-field login-form-field">
                <label htmlFor="register-email" className="darkblue-text">Email</label>
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="auth-input darkblue-input login-input"
                />
              </div>
              <div className="auth-field auth-password-field login-form-field">
                <label htmlFor="register-password" className="darkblue-text">Password</label>
                <div className="auth-password-wrapper">
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="auth-input darkblue-input login-input"
                  />
                  <span
                    onClick={() => setShowPassword((v) => !v)}
                    className="auth-password-toggle darkblue-icon"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
              </div>
              <div className="auth-field auth-password-field login-form-field">
                <label htmlFor="register-confirm-password" className="darkblue-text">Re-enter Password</label>
                <div className="auth-password-wrapper">
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm_password"
                    placeholder="Re-enter Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="auth-input darkblue-input login-input"
                  />
                  <span
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="auth-password-toggle darkblue-icon"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="login-btn"
                style={{ width: '60%', alignSelf: 'center', margin: '18px 0 6px 0', background: '#2563eb', color: '#fff', borderRadius: '18px', fontWeight: 700, fontSize: '1.08rem', padding: '10px 0', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#1d4ed8'}
                onMouseOut={e => e.currentTarget.style.background = '#2563eb'}
              >
                Register
              </button>
            </form>
            {message && (
              <div className={isError ? "auth-message error" : "auth-message success"}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;