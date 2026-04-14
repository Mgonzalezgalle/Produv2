import { Suspense } from "react";
import { LoadingScreen } from "./ShellLayout";
import { StyleTag } from "./AppCore";

export function AppBootScreen({ css }) {
  return <div style={{ background: "#080809", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#00d4e8", fontFamily: "monospace" }}>
    <StyleTag css={css} />
    Iniciando Produ...
  </div>;
}

export function AppLoginScreen({
  css,
  LoginView,
  domainUsers,
  domainEmpresas,
  login,
  saveUsers,
  BrandLockup,
  sha256Hex,
  dbHelpers,
  authGateway,
  authModeLabel,
  releaseMode,
}) {
  return <>
    <StyleTag css={css} />
    <Suspense fallback={<LoadingScreen label="Cargando acceso" note="Estamos preparando el ingreso seguro a Produ." />}>
      <LoginView
        users={domainUsers}
        empresas={domainEmpresas}
        onLogin={login}
        saveUsers={saveUsers}
        BrandLockup={BrandLockup}
        sha256Hex={sha256Hex}
        dbHelpers={dbHelpers}
        authGateway={authGateway}
        authModeLabel={authModeLabel}
        releaseMode={releaseMode}
      />
    </Suspense>
  </>;
}

export function AppSuperAdminSelectorScreen({
  css,
  EmpresaSelectorView,
  domainEmpresas,
  selectEmp,
  setAdminOpen,
  BrandLockup,
  ini,
}) {
  return <>
    <StyleTag css={css} />
    <Suspense fallback={<LoadingScreen label="Cargando selector" note="Estamos preparando la entrada a Torre de Control o a un tenant." />}>
      <EmpresaSelectorView
        empresas={domainEmpresas}
        onSelect={selectEmp}
        onSelectSuperAdmin={() => {
          setAdminOpen(false);
          selectEmp("__super__");
        }}
        BrandLockup={BrandLockup}
        ini={ini}
      />
    </Suspense>
  </>;
}
