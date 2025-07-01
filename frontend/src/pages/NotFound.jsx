import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
    <div style={{ background: "#fff", padding: "2.5rem 2rem", borderRadius: "12px", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", textAlign: "center" }}>
      <h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: 20, marginBottom: 24 }}>Page Not Found</p>
      <Link to="/" style={{ color: "#2563eb", textDecoration: "underline", fontSize: 16 }}>Go to Login</Link>
    </div>
  </div>
);

export default NotFound;
