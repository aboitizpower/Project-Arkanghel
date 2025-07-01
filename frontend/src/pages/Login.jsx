import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/Auth.css";

// Async function to handle login
async function loginUser(email, password) {
  try {
    const res = await fetch("http://localhost:8081/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (jsonErr) {
      data = { error: "Invalid JSON response from server." };
    }
    return { ok: res.ok, ...data };
  } catch (err) {
    return { ok: false, error: `Network/server error: ${err.message}` };
  }
}

const Login = ({ animateToRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="auth-container darkblue-theme">
      <div className="auth-panel auth-form-panel white-panel slide-in-left">
        <h2 className="auth-title darkblue-text">Login</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setMessage("");
          setIsError(false);
          const result = await loginUser(email, password);
          if (result.ok) {
            setMessage(result.success);
            setIsError(false);
          } else {
            setMessage(result.error ? result.error : "Unknown error.");
            setIsError(true);
          }
        }}>
          <div className="auth-field">
            <label htmlFor="login-email" className="darkblue-text">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="auth-input darkblue-input"
            />
          </div>
          <div className="auth-field auth-password-field">
            <label htmlFor="login-password" className="darkblue-text">Password</label>
            <div className="auth-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
          <button
            type="submit"
            className="auth-btn darkblue-btn"
          >
            Login
          </button>
        </form>
        <div className="auth-link-container">
          <span className="darkblue-text">Don't have an account? </span>
          <button className="auth-link-btn" onClick={animateToRegister}>Register</button>
        </div>
        {message && (
          <div className={isError ? "auth-message error" : "auth-message success"}>
            {message}
          </div>
        )}
      </div>
      <div className="auth-panel auth-welcome-panel darkblue-panel slide-in-right">
        <h1 className="auth-welcome-title">Welcome to Project Arkanghel</h1>
        <p className="auth-welcome-desc">Your secure portal for learning and growth. Please login to continue.</p>
      </div>
    </div>
  );
};

export default Login;
