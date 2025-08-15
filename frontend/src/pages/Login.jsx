import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../App";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import "../styles/Auth.css";
import "../styles/Login.css";
import logo from "../assets/loginlogo.jpg";
import bgImg from "../assets/bg_login.jpg";

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
  const [isLoading, setIsLoading] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);

  const handleRegisterClick = () => {
    setAnimateOut(true);
    setTimeout(() => {
      navigate('/register');
    }, 400);
  };

  return (
    <div className="auth-container">
      {/* Left Panel: Login Form */}
      <div className={`auth-panel auth-form-panel white-panel left-panel${animateOut ? ' slide-out-left' : ' slide-in-left' } login-panel`}>
        <div className="login-outer-panel">
          {/* Logo higher up */}
          <div className="login-logo-container">
            <img src={logo} alt="loginlogo" className="login-logo" />
          </div>
          {/* Centered form container */}
          <div className="login-form-center">
            <h2 className="auth-title darkblue-text login-title">Login</h2>
            <div className="login-message login-panel-message">
              Please use your Aboitz email and password to login
            </div>
            <form className="login-form" onSubmit={async (e) => {
            e.preventDefault();
            setMessage("");
            setIsError(false);
            setIsLoading(true);
            const result = await loginUser(email, password);
            setIsLoading(false);
            if (result.ok) {
              setMessage("Login Successfully");
              setIsError(false);
              if (result.user) {
                localStorage.setItem('user', JSON.stringify({
                  first_name: result.user.first_name,
                  last_name: result.user.last_name,
                  email: result.user.email,
                  isAdmin: result.user.isAdmin
                }));
                localStorage.setItem('userId', result.user.user_id);
                if (authContext && authContext.setUser) {
                  authContext.setUser({
                    first_name: result.user.first_name,
                    last_name: result.user.last_name,
                    email: result.user.email,
                    isAdmin: result.user.isAdmin
                  });
                }
              }
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
            <div className="auth-field login-form-field" style={{ display: 'flex', flexDirection: 'column', alignItems: 'left' }}>
              <label htmlFor="login-email" className="darkblue-text">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="auth-input darkblue-input login-input"
              />
            </div>
            <div className="auth-field auth-password-field login-form-field" style={{ display: 'flex', flexDirection: 'column', alignItems: 'left' }}>
              <label htmlFor="login-password" className="darkblue-text">Password</label>
              <div className="auth-password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
            <button
              type="submit"
              className="login-btn"
              disabled={isLoading}
              style={{ width: '60%', alignSelf: 'center', margin: '18px 0 6px 0', background: '#5DADE2', color: '#fff', borderRadius: '18px', fontWeight: 700, fontSize: '1.08rem', padding: '10px 0', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = '#3498DB'}
              onMouseOut={e => e.currentTarget.style.background = '#5DADE2'}
            >
              {isLoading ? 'Logging in...' : 'Login'}
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

      {/* Right Panel: Welcome & Register */}
      <div className="auth-panel auth-welcome-panel right-panel split-bg-panel">
        {/* Background image only */}
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
        {/* Welcome Message */}
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
