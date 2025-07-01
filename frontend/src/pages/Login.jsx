import React, { useState } from "react";
import { Link } from "react-router-dom";

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    const result = await loginUser(email, password);
    if (result.ok) {
      setMessage(result.success);
      setIsError(false);
      // Optionally, save user info or redirect
    } else {
      setMessage(result.error ? result.error : "Unknown error.");
      setIsError(true);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
      <div style={{ background: "#fff", padding: "2.5rem 2rem", borderRadius: "12px", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: "100%", maxWidth: 350 }}>
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>Login</h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16, position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #d1d5db" }}
            />
            <span
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 10, top: 10, cursor: "pointer", color: "#6b7280", fontSize: 14 }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>
          <button
            type="submit"
            style={{ width: "100%", padding: "10px", borderRadius: 6, background: "#2563eb", color: "#fff", border: "none", fontWeight: 600, fontSize: 16, marginBottom: 8, cursor: "pointer" }}
          >
            Login
          </button>
        </form>
        <div style={{ textAlign: "center", margin: "12px 0" }}>
          <span>Don't have an account? </span>
          <Link to="/register" style={{ color: "#2563eb", textDecoration: "underline" }}>Register</Link>
        </div>
        {message && (
          <div style={{
            background: isError ? "#fee2e2" : "#dcfce7",
            color: isError ? "#b91c1c" : "#166534",
            padding: "8px 12px",
            borderRadius: 6,
            marginTop: 8,
            textAlign: "center",
            fontSize: 14,
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
