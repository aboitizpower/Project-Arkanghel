import React, { useState } from "react";
import { Link } from "react-router-dom";

const Register = () => {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
      <div style={{ background: "#fff", padding: "2.5rem 2rem", borderRadius: "12px", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: "100%", maxWidth: 400 }}>
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>Register</h2>
        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <input
              name="first_name"
              placeholder="First Name"
              value={form.first_name}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              name="last_name"
              placeholder="Last Name"
              value={form.last_name}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16, position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
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
            style={{ width: "100%", padding: "10px", borderRadius: 6, background: "#16a34a", color: "#fff", border: "none", fontWeight: 600, fontSize: 16, marginBottom: 8, cursor: "pointer" }}
          >
            Register
          </button>
        </form>
        <div style={{ textAlign: "center", margin: "12px 0" }}>
          <span>Already have an account? </span>
          <Link to="/" style={{ color: "#2563eb", textDecoration: "underline" }}>Login</Link>
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

export default Register;