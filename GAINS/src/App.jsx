// import React, { useEffect, useState } from "react";
// import DropdownFormUI from "./components/DropdownFormUI/index.jsx";
// import GraphBloomClone from "./components/GraphBloomClone/GraphBloomClone";
// import GISTables from "./components/GIS/GISTables.jsx";
// import GISTableDetails from "./components/GIS/GISTableDetails.jsx";
// import GISMap from "./components/GIS/GISMap.jsx";
// import ascenttLogo from "./assets/ascentt-logo.png"; // <-- add your logo file here

// export default function App() {
//   const [view, setView] = useState("forms");               // 'forms' | 'bloom' | 'gis'
//   const [showMapOverlay, setShowMapOverlay] = useState(false);

//   // GIS sub-view
//   const [gisSelection, setGisSelection] = useState(null);  // table details
//   const [gisMode, setGisMode] = useState("map");           // 'map' | 'tables'

//   useEffect(() => {
//     if (view !== "bloom") setShowMapOverlay(false);
//     if (view !== "gis") { setGisSelection(null); setGisMode("map"); }
//   }, [view]);

//   return (
//     <div className="shell">
//       <style>{`
//         html, body, #root { height: 100%; margin: 0; padding: 0; }
//         body { overflow: hidden; }
//         * { box-sizing: border-box; }
//         .shell { position: fixed; inset: 0; display: flex; flex-direction: column; background: #ffffffff; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
//         .topbar { height: 56px; padding: 8px 12px; background: #111827; color: #fff; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(0,0,0,.15); flex: 0 0 56px; }
//         .brand { display: flex; align-items: center; }
//         .brand img { height: 30px; display: block; object-fit: contain; }
//         .tabs { display: flex; gap: 8px; }
//         .tab { background: #0b1220; border: 1px solid #1f2937; color: #e5e7eb; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; }
//         .tab.active { background: #374151; border-color: #475569; color: #fff; }
//         .content { height: calc(100vh - 56px); min-height: 0; overflow: hidden; position: relative; display: flex; }
//         .content > * { flex: 1 1 auto; min-width: 0; min-height: 0; }
//         .subtabs { display: flex; gap: 8px; margin-left: 8px; }
//         .subtab { background:#0b1220; border:1px solid #334155; color:#e5e7eb; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:700; }
//         .subtab.active { background:#1f2937; border-color:#475569; }
//       `}</style>

//       <header className="topbar">
//         <div className="brand">
//           <img src={ascenttLogo} alt="Ascentt" />
//         </div>
//         <div className="tabs">
//           <button className={`tab ${view === "forms" ? "active" : ""}`} onClick={() => setView("forms")}>Forms</button>
//           <button className={`tab ${view === "bloom" ? "active" : ""}`} onClick={() => setView("bloom")}>GRAPH</button>
//           {view === "bloom" && (
//             <button className="tab" onClick={() => setShowMapOverlay(v => !v)}>Map</button>
//           )}
//           <button className={`tab ${view === "gis" ? "active" : ""}`} onClick={() => setView("gis")}>GIS</button>
//           {view === "gis" && (
//             <div className="subtabs">
//               <button className={`subtab ${gisMode === "map" ? "active" : ""}`} onClick={() => { setGisMode("map"); setGisSelection(null); }}>Map</button>
//               <button className={`subtab ${gisMode === "tables" ? "active" : ""}`} onClick={() => setGisMode("tables")}>Tables</button>
//             </div>
//           )}
//         </div>
//       </header>

//       <main className="content">
//         {view === "forms" && <DropdownFormUI />}

//         {view === "bloom" && (
//           <GraphBloomClone
//             mapOverlayVisible={showMapOverlay}
//             onRequestCloseMapOverlay={() => setShowMapOverlay(false)}
//           />
//         )}

//         {view === "gis" && (
//           gisMode === "map"
//             ? <GISMap />
//             : (gisSelection
//                 ? <GISTableDetails tableRef={gisSelection} onBack={() => setGisSelection(null)} />
//                 : <GISTables onOpenDetails={(row) => setGisSelection({ database: row.database, schema: row.schema, name: row.name })} />
//               )
//         )}
//       </main>
//     </div>
//   );
// }
import React, { useEffect, useState } from "react";
import DropdownFormUI from "./components/DropdownFormUI/index.jsx";
import GraphBloomClone from "./components/GraphBloomClone/GraphBloomClone";
import GISTables from "./components/GIS/GISTables.jsx";
import GISTableDetails from "./components/GIS/GISTableDetails.jsx";
import GISMap from "./components/GIS/GISMap.jsx";
import ascenttLogo from "./assets/ascentt-logo.png";
import ConnectPage from "./components/connects/ConnectPage.jsx";
import Login from "./components/auth/Login.jsx";

export default function App() {
  const [view, setView] = useState("forms");               // 'forms' | 'bloom' | 'gis'
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // GIS sub-view
  const [gisSelection, setGisSelection] = useState(null);  // table details
  const [gisMode, setGisMode] = useState("map");           // 'map' | 'tables'

  useEffect(() => {
    if (view !== "bloom") setShowMapOverlay(false);
    if (view !== "gis") { setGisSelection(null); setGisMode("map"); }
  }, [view]);

  // Fetch current session user
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/auth/me", { credentials: "include" });
        const d = await r.json();
        setUser(d.user || null);
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  const logout = async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
  };

  // Compute user initials (first+last from displayName; or email local-part)
  const initials = React.useMemo(() => {
    const name = (user?.displayName || user?.email || "").trim();
    if (!name) return "?";
    if (user?.displayName) {
      const parts = user.displayName.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const local = name.split("@")[0] || "";
    const sub = local.split(/[._-]+/).filter(Boolean);
    if (sub.length >= 2) return (sub[0][0] + sub[1][0]).toUpperCase();
    return (local.slice(0, 2) || "?").toUpperCase();
  }, [user]);

  // If auth check done and not logged in, render only login screen
  if (authChecked && !user) {
    return <Login />;
  }

  return (
    <div className="shell">
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        body { overflow: hidden; }
        * { box-sizing: border-box; }
        .shell { position: fixed; inset: 0; display: flex; flex-direction: column; background: #ffffffff; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
        .topbar { height: 56px; padding: 8px 12px; background: #ffffff; color: #58595B; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(0,0,0,.06); border-bottom: 1px solid #e8e4de; flex: 0 0 56px; }
        .brand { display: flex; align-items: center; }
        .brand img { height: 30px; display: block; object-fit: contain; }
        .tabs { display: flex; gap: 8px; }
        .tab { background: #f5f4f2; border: 1px solid #e8e4de; color: #58595B; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; }
        .tab.active { background: #F47920; border-color: #D4621A; color: #fff; }
        .content { height: calc(100vh - 56px); min-height: 0; overflow: hidden; position: relative; display: flex; }
        .content > * { flex: 1 1 auto; min-width: 0; min-height: 0; }
        .subtabs { display: flex; gap: 8px; margin-left: 8px; }
        .subtab { background:#f5f4f2; border:1px solid #e8e4de; color:#58595B; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:700; }
        .subtab.active { background:#F47920; border-color:#D4621A; color:#fff; }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <img src={ascenttLogo} alt="Ascentt" />
        </div>
        {/* Auth section */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <div
              title={user.email || user.displayName}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.9), #f8fafc)",
                boxShadow: "0 1px 2px rgba(0,0,0,.05)",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#0f172a",
                  background: "#e2e8f0",
                  border: "1px solid #e5e7eb",
                }}
              >
                {initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
                <span style={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
                  {user.displayName || user.email}
                </span>
                {user.email ? (
                  <span style={{ color: "#64748b", fontSize: 12 }}>
                    {user.email}
                  </span>
                ) : null}
              </div>
              <button
                onClick={logout}
                style={{
                  marginLeft: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #ef4444",
                  background: "linear-gradient(180deg, #fff, #fff)",
                  color: "#ef4444",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <a className="tab" href="/auth/google">Login with Google</a>
          )}
        </div>
        <div className="tabs">
          <a
            href="http://localhost:3000"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #e8e4de', background: '#f5f4f2',
              color: '#58595B', fontWeight: 700, fontSize: 13,
              textDecoration: 'none', cursor: 'pointer',
            }}
          >
            ← Go to Home
          </a>
          <button className={`tab ${view === "forms" ? "active" : ""}`} onClick={() => setView("forms")}>Forms</button>
          <button className={`tab ${view === "bloom" ? "active" : ""}`} onClick={() => setView("bloom")}>GRAPH</button>
          {view === "bloom" && (
            <button className="tab" onClick={() => setShowMapOverlay(v => !v)}>Map</button>
          )}
          <button className={`tab ${view === "gis" ? "active" : ""}`} onClick={() => setView("gis")}>GIS</button>
          <button className={`tab ${view === "connect" ? "active" : ""}`} onClick={() => setView("connect")}>Connect</button>
          {view === "gis" && (
            <div className="subtabs">
              <button className={`subtab ${gisMode === "map" ? "active" : ""}`} onClick={() => { setGisMode("map"); setGisSelection(null); }}>Map</button>
              <button className={`subtab ${gisMode === "tables" ? "active" : ""}`} onClick={() => setGisMode("tables")}>Tables</button> 
            </div>
          )}
        </div>
      </header>

      <main className="content">
        {/* App content */}
        <>
          {view === "forms" && <DropdownFormUI />}

     {view === "bloom" && (
  <div
    style={{
      position: "absolute",
      inset: 0,             // top:0, right:0, bottom:0, left:0
      background: "#0b0e13"
    }}
  >
    <GraphBloomClone
      mapOverlayVisible={showMapOverlay}
      onRequestCloseMapOverlay={() => setShowMapOverlay(false)}
    />
  </div>
)}

        {view === "gis" && (
          gisMode === "map"
            ? <GISMap />
            : (gisSelection
                ? <GISTableDetails tableRef={gisSelection} onBack={() => setGisSelection(null)} />
                : <GISTables onOpenDetails={(row) => setGisSelection({ database: row.database, schema: row.schema, name: row.name })} />
              )
        )}

        {view === "connect" && (
    <div style={{ position: "absolute", inset: 0 }}>
      <ConnectPage
        onSubmit={(payload) => {
          // TODO: replace with your API call
          console.log("Connect submitted:", payload);
          // e.g., show toast or redirect after success
        }}
      />
    </div>
  )}
        </>
      </main>
    </div>
  );
}
