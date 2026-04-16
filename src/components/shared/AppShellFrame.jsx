import { Sidebar } from "./ShellLayout";

export function AppShellFrame({
  sidebarProps,
  sidebarWidth,
  isMobile,
  mobileSidebarOpen,
  closeMobileSidebar,
  openMobileSidebar,
  breadcrumbs,
  topbarActions,
  activeBanner,
  viewKey,
  children,
}) {
  const resolvedSidebarWidth = typeof sidebarWidth === "number" ? `${sidebarWidth}px` : sidebarWidth;

  return (
    <div style={{ display: isMobile ? "block" : "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <div
        id="mob-overlay"
        onClick={closeMobileSidebar}
        style={{ display: mobileSidebarOpen ? "block" : "none", position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,.6)" }}
      />
      <Sidebar {...sidebarProps} />
      <main
        className="app-main"
        style={{
          marginLeft: isMobile ? 0 : sidebarWidth,
          width: "100%",
          maxWidth: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: "100vh",
          transition: "margin-left .2s",
          background: "var(--bg)",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div
          className="topbar"
          style={{
            minHeight: 64,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            padding: "0 26px",
            gap: 10,
            position: "sticky",
            top: 0,
            zIndex: 100,
            flexShrink: 0,
          }}
        >
          <button
            className="ham-btn"
            onClick={openMobileSidebar}
            style={{
              display: "none",
              background: "none",
              border: "none",
              color: "var(--wh)",
              cursor: "pointer",
              fontSize: 22,
              padding: "4px 6px",
              flexShrink: 0,
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            ☰
          </button>
          <div className="app-breadcrumbs" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.l}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {index > 0 && <span style={{ color: "var(--bdr2)", fontSize: 16 }}>/</span>}
                <span
                  onClick={crumb.fn}
                  style={{
                    fontFamily: "var(--fh)",
                    fontWeight: 700,
                    fontSize: index === breadcrumbs.length - 1 ? 15 : 11,
                    letterSpacing: index === breadcrumbs.length - 1 ? 1 : 2,
                    textTransform: "uppercase",
                    color: crumb.fn ? "var(--gr2)" : "var(--wh)",
                    cursor: crumb.fn ? "pointer" : "default",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  onMouseEnter={event => {
                    if (crumb.fn) event.target.style.color = "var(--cy)";
                  }}
                  onMouseLeave={event => {
                    if (crumb.fn) event.target.style.color = "var(--gr2)";
                  }}
                >
                  {crumb.l}
                </span>
              </span>
            ))}
          </div>
          <div className="app-actions" style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            {topbarActions}
          </div>
        </div>
        <div className="app-page" style={{ flex: 1, padding: "18px 26px 28px", display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
          {activeBanner && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 16px",
                borderRadius: 14,
                border: `1px solid ${
                  activeBanner.tone === "critical"
                    ? "#ff556640"
                    : activeBanner.tone === "warn"
                      ? "#ffcc4440"
                      : "var(--cm)"
                }`,
                background:
                  activeBanner.tone === "critical"
                    ? "#ff556615"
                    : activeBanner.tone === "warn"
                      ? "#ffcc4415"
                      : "var(--cg)",
                color:
                  activeBanner.tone === "critical"
                    ? "#ff5566"
                    : activeBanner.tone === "warn"
                      ? "#ffcc44"
                      : "var(--cy)",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>
                {activeBanner.tone === "critical" ? "⛔" : activeBanner.tone === "warn" ? "⚠️" : "ℹ️"}
              </span>
              <span style={{ whiteSpace: "pre-line" }}>{activeBanner.text}</span>
            </div>
          )}
          <div className="va" key={viewKey} style={{ width: "100%", flex: 1, minWidth: 0 }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
