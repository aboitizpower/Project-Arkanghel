import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const navigate = useNavigate();

  const handleRegisterClick = () => {
    setAnimateOut(true);
    setTimeout(() => {
      navigate('/register');
    }, 400);
  };

  return (
    <div className="auth-container">
      <div className={`auth-panel auth-form-panel white-panel left-panel${animateOut ? ' slide-out-left' : ' slide-in-left'}`}
        style={{ maxWidth: 400, width: '100%', padding: '2.5rem 2rem', boxShadow: '0 4px 32px rgba(7, 14, 27, 0.10), 0 2px 8px rgba(0,0,0,0.04)' }}>
        <h2 className="auth-title darkblue-text">Login</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setMessage("");
          setIsError(false);
          const result = await loginUser(email, password);
          if (result.ok) {
            setMessage(result.success);
            setIsError(false);
            // Store user info in localStorage
            if (result.user) {
              localStorage.setItem('user', JSON.stringify({
                first_name: result.user.first_name,
                last_name: result.user.last_name,
                email: result.user.email,
                isAdmin: result.user.isAdmin
              }));
            }
            // Redirect based on isAdmin
            if (result.user && result.user.isAdmin) {
              setTimeout(() => {
                setMessage("");
                navigate("/admin/analytics");
              }, 700);
            } else if (result.user && !result.user.isAdmin) {
              setTimeout(() => {
                setMessage("");
                navigate("/employee/dashboard");
              }, 700);
            }
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
          <button className="auth-link-btn" onClick={handleRegisterClick}>Register</button>
        </div>
        {message && (
          <div className={isError ? "auth-message error" : "auth-message success"}>
            {message}
          </div>
        )}
      </div>
      <div className="auth-panel auth-welcome-panel darkblue-panel right-panel slide-in-right">
        <h1 className="auth-welcome-title">Welcome to Project Arkanghel</h1>
        <p className="auth-welcome-desc">Your secure portal for learning and growth. Please login to continue.</p>
      </div>
    </div>
  );
};

export default Login;
