import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/Auth.css";

const Register = ({ animateToLogin }) => {
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

  return (
    <div className="auth-container darkblue-theme">
      <div className="auth-panel auth-welcome-panel darkblue-panel slide-in-left">
        <h1 className="auth-welcome-title">Welcome to Project Arkanghel</h1>
        <p className="auth-welcome-desc">Join us and unlock your learning journey. Register your account below.</p>
      </div>
      <div className="auth-panel auth-form-panel white-panel slide-in-right">
        <h2 className="auth-title darkblue-text">Register</h2>
        <form onSubmit={handleRegister}>
          <div className="auth-field-row">
            <div className="auth-field half-width">
              <label htmlFor="register-first-name" className="darkblue-text">First Name</label>
              <input
                id="register-first-name"
                name="first_name"
                placeholder="First Name"
                value={form.first_name}
                onChange={handleChange}
                required
                className="auth-input darkblue-input"
              />
            </div>
            <div className="auth-field half-width">
              <label htmlFor="register-last-name" className="darkblue-text">Last Name</label>
              <input
                id="register-last-name"
                name="last_name"
                placeholder="Last Name"
                value={form.last_name}
                onChange={handleChange}
                required
                className="auth-input darkblue-input"
              />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="register-email" className="darkblue-text">Email</label>
            <input
              id="register-email"
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              className="auth-input darkblue-input"
            />
          </div>
          <div className="auth-field auth-password-field">
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
                className="auth-input darkblue-input"
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
          <div className="auth-field auth-password-field">
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
                className="auth-input darkblue-input"
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
            className="auth-btn darkblue-btn"
          >
            Register
          </button>
        </form>
        <div className="auth-link-container">
          <span className="darkblue-text">Already have an account? </span>
          <button className="auth-link-btn" onClick={animateToLogin}>Login</button>
        </div>
        {message && (
          <div className={isError ? "auth-message error" : "auth-message success"}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;