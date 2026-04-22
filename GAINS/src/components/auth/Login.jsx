// src/components/auth/Login.jsx
import React from "react";
import ascenttLogo from "@/assets/ascentt-logo.png";

export default function Login() {
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <img src={ascenttLogo} alt="Ascentt" style={styles.logo} />
          <div style={styles.brandText}>GAINS</div>
        </div>

        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.subtitle}>Sign in to continue to your workspace.</p>

        <a href="/auth/google" style={styles.googleBtn}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" style={{ marginRight: 10 }}>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36 16.8 36 11 30.2 11 23s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.3l5.7-5.7C34.6 4.6 29.6 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5 45.5 35.9 45.5 24c0-1.2-.1-2.3-.3-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.4 16.2 18.8 13 24 13c3.3 0 6.3 1.2 8.6 3.3l5.7-5.7C34.6 4.6 29.6 2.5 24 2.5 15.2 2.5 7.6 7.4 3.7 14.7z"/>
            <path fill="#4CAF50" d="M24 45.5c5.2 0 10-1.9 13.6-5.1l-6.3-5.2C29 36.8 26.7 37.5 24 37.5c-5.2 0-9.6-3.1-11.5-7.6l-6.6 5.1C9.6 41.1 16.3 45.5 24 45.5z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.4 5.7-6.3 7.2l6.3 5.2c-3.6 2.4-7.6 3.6-11.3 3.6 7.7 0 14.4-4.4 17.7-10.8 1.3-2.6 2.2-5.6 2.2-8.7 0-1.2-.1-2.3-.3-3.5z"/>
          </svg>
          Continue with Google
        </a>

        <div style={styles.meta}>By continuing, you agree to the Terms and Privacy Policy.</div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(1200px 800px at 10% 10%, #FEF3E8 0%, #f5f4f2 40%, #ffffff 100%)",
    padding: 24,
    zIndex: 10000,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    boxShadow: "0 12px 40px rgba(0,0,0,.08)",
    padding: 28,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  logo: { height: 26 },
  brandText: { fontSize: 14, color: "#6b7280", fontWeight: 600 },
  title: { margin: "10px 0 6px", fontSize: 26, lineHeight: 1.2, color: "#0f172a" },
  subtitle: { margin: 0, color: "#475569", fontSize: 14 },
  googleBtn: {
    marginTop: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 44,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontWeight: 700,
    textDecoration: "none",
    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
    boxShadow: "0 1px 0 #e2e8f0 inset",
    cursor: "pointer",
    userSelect: "none",
  },
  meta: { marginTop: 16, fontSize: 12, color: "#64748b", textAlign: "center" },
};
