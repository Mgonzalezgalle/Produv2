import React, { useEffect, useState } from "react";
import { Badge, Btn, FG, FI, GBtn, SearchBar } from "../../lib/ui/components";
import { completeLocalPasswordReset } from "../../lib/auth/localAuthProvider";
import { useLabSelfServeAccess } from "../../hooks/useLabSelfServeAccess";
import QRCode from "qrcode";
import {
  buildSecondFactorSessionMeta,
  challengeExpired,
  consumeChallengeAttempt,
  consumeRecoveryCode,
  createOtpAuthUrl,
  createPendingTwoFactorState,
  createRecoveryCodes,
  createTwoFactorSecret,
  formatTwoFactorSecret,
  hashRecoveryCodes,
  verifyTotpCode,
} from "../../lib/auth/localTwoFactor";

class AuthModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || "No pudimos renderizar este flujo.") };
  }

  componentDidCatch(error) {
    console.error("Auth modal render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:18,width:560,maxWidth:"100%",padding:28}}>
            <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,marginBottom:8}}>No pudimos abrir este flujo</div>
            <div style={{fontSize:12,color:"var(--gr2)",lineHeight:1.7,marginBottom:18}}>
              El login siguió estable, pero el wizard de contratación encontró un error de render. Ya lo tomamos para corregirlo sin tocar `productivo`.
            </div>
            <div style={{padding:"12px 14px",borderRadius:12,border:"1px solid #ff556635",background:"#ff556615",color:"var(--red)",fontSize:12,marginBottom:18}}>
              {this.state.message}
            </div>
            <GBtn onClick={this.props.onClose}>Cerrar</GBtn>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Login({ users, onLogin, saveUsers, empresas = [], BrandLockup, sha256Hex, dbHelpers, authGateway, authModeLabel = "", releaseMode = false }) {
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [load,setLoad]=useState(false);
  const [showPass,setShowPass]=useState(false);
  const { solOpen, solF, solSent, setSolF, setSolSent, open: openSelfServe, close: closeSelfServe } = useLabSelfServeAccess();
  const [SelfServeModalView, setSelfServeModalView] = useState(null);
  const [selfServeLoading, setSelfServeLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [resetInfo, setResetInfo] = useState("");
  const [resetRevealCode, setResetRevealCode] = useState("");
  const [pending2FA, setPending2FA] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [setupSecret, setSetupSecret] = useState("");
  const [setupOtpUrl, setSetupOtpUrl] = useState("");
  const [setupQr, setSetupQr] = useState("");
  const [acceptedRecovery, setAcceptedRecovery] = useState(false);
  const isLocalAuth = authGateway?.strategy !== "supabase";
  const platformApi = dbHelpers?.platformApi || null;

  const resetTwoFactorFlow = () => {
    setPending2FA(null);
    setOtpCode("");
    setRecoveryCodes([]);
    setSetupSecret("");
    setSetupOtpUrl("");
    setSetupQr("");
    setAcceptedRecovery(false);
  };

  const resetForgotFlow = () => {
    setForgotMode(false);
    setForgotEmail("");
    setResetCode("");
    setNewPass("");
    setNewPass2("");
    setResetInfo("");
    setResetRevealCode("");
  };

  const handleOpenSelfServe = async () => {
    if (!SelfServeModalView) {
      setSelfServeLoading(true);
      try {
        const module = await import("./SelfServeAcquisitionWizard");
        setSelfServeModalView(() => module.SelfServeAcquisitionWizard);
      } catch (error) {
        console.error("Self-serve wizard load error", error);
        setErr("No pudimos abrir la contratación guiada. Intenta nuevamente.");
        return;
      } finally {
        setSelfServeLoading(false);
      }
    }
    openSelfServe();
  };

  useEffect(() => {
    let cancelled = false;
    if (!setupOtpUrl) {
      setSetupQr("");
      return;
    }
    QRCode.toDataURL(setupOtpUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).then(url => {
      if (!cancelled) setSetupQr(url);
    }).catch(() => {
      if (!cancelled) setSetupQr("");
    });
    return () => {
      cancelled = true;
    };
  }, [setupOtpUrl]);

  const startSecondFactorFlow = (user) => {
    const hasConfiguredSecondFactor = !!(user?.mfaEnabled && user?.mfaSecret);
    if (hasConfiguredSecondFactor) {
      setPending2FA(createPendingTwoFactorState(user, "verify"));
      setErr("");
      return;
    }
    const secret = createTwoFactorSecret();
    const recovery = createRecoveryCodes(6);
    setRecoveryCodes(recovery);
    setSetupSecret(secret);
    setSetupOtpUrl(createOtpAuthUrl({ user, secret }));
    setPending2FA(createPendingTwoFactorState(user, "setup", secret));
    setErr("");
  };

  const restartSecondFactorSetup = () => {
    const currentUser = (users || []).find(entry => entry.id === pending2FA?.userId);
    if (!currentUser) {
      setErr("No pudimos reiniciar tu segundo factor. Intenta ingresar nuevamente.");
      return;
    }
    const secret = createTwoFactorSecret();
    const recovery = createRecoveryCodes(6);
    setAcceptedRecovery(false);
    setOtpCode("");
    setRecoveryCodes(recovery);
    setSetupSecret(secret);
    setSetupOtpUrl(createOtpAuthUrl({ user: currentUser, secret }));
    setPending2FA(createPendingTwoFactorState(currentUser, "setup", secret));
    setErr("");
  };

  const login=async()=>{
    setLoad(true);setErr("");
    resetTwoFactorFlow();
    await new Promise(r=>setTimeout(r,400));
    const { user, error, requiresSecondFactor, updatedUser } = await (
      platformApi?.auth?.loginWithPassword
        ? platformApi.auth.loginWithPassword({ email, password: pass })
        : authGateway.authenticate({ users, empresas, email, password: pass })
    );
    if(updatedUser){
      await saveUsers((users || []).map(entry => entry.id === updatedUser.id ? updatedUser : entry));
    }
    if(user && authGateway.supportsTwoFactorSetup() && requiresSecondFactor) startSecondFactorFlow(user);
    else if(user) onLogin(user, { authStrength: authGateway.strategy === "supabase" ? "supabase" : "password_only", requiresSecondFactor: false });
    else setErr(error || "Email o contraseña incorrectos");
    setLoad(false);
  };

  const requestReset = async () => {
    setLoad(true);
    setErr("");
    setResetInfo("");
    setResetRevealCode("");
    const { ok, message, revealedCode, updatedUser } = await (
      platformApi?.auth?.requestPasswordReset
        ? platformApi.auth.requestPasswordReset({ email: forgotEmail })
        : authGateway.requestPasswordReset({ users, email: forgotEmail })
    );
    let deliveryMessage = "";
    if (updatedUser) {
      await saveUsers((users || []).map(entry => entry.id === updatedUser.id ? updatedUser : entry));
    }
    if (isLocalAuth && revealedCode && platformApi?.notifications?.sendTransactionalEmail) {
      try {
        const delivery = await platformApi.notifications.sendTransactionalEmail({
          templateKey: "password_reset",
          subject: "Recuperación de contraseña en Produ",
          to: [{ email: forgotEmail }],
          text: `Tu código temporal de recuperación es ${revealedCode}. Válido por 15 minutos.`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a"><p>Tu código temporal de recuperación en <strong>Produ</strong> es:</p><p style="font-size:22px;font-weight:700;letter-spacing:2px">${revealedCode}</p><p>Válido por 15 minutos.</p></div>`,
          entityType: "auth_password_reset",
          entityId: forgotEmail,
          metadata: {
            authMode: authGateway?.strategy || "local",
          },
        });
        if (delivery?.ok) {
          deliveryMessage = delivery.status === "accepted"
            ? " También registramos el envío en el gateway transaccional."
            : " También dejamos preparado el envío transaccional en modo laboratorio.";
        }
      } catch {
        deliveryMessage = "";
      }
    }
    setResetInfo((message || (ok ? "Revisa tu recuperación." : "No fue posible iniciar la recuperación.")) + deliveryMessage);
    setResetRevealCode(revealedCode || "");
    setLoad(false);
  };

  const submitPasswordReset = async () => {
    if (!isLocalAuth) {
      setResetInfo("Si el correo existe en Auth, enviamos instrucciones externas de recuperación.");
      return;
    }
    if (!forgotEmail || !resetCode || !newPass) {
      setErr("Completa correo, código y nueva contraseña.");
      return;
    }
    if (newPass.length < 8) {
      setErr("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPass !== newPass2) {
      setErr("Las contraseñas nuevas no coinciden.");
      return;
    }
    setLoad(true);
    setErr("");
    const result = await completeLocalPasswordReset({
      users,
      email: forgotEmail,
      code: resetCode,
      newPassword: newPass,
    });
    if (result.updatedUser) {
      await saveUsers((users || []).map(entry => entry.id === result.updatedUser.id ? result.updatedUser : entry));
    }
    setLoad(false);
    if (!result.ok) {
      setErr(result.message || "No fue posible actualizar la contraseña.");
      return;
    }
    setResetInfo(result.message || "Contraseña actualizada.");
    setResetRevealCode("");
    setResetCode("");
    setNewPass("");
    setNewPass2("");
  };

  const submitSecondFactor = async () => {
    if (!pending2FA?.userId) return;
    if (challengeExpired(pending2FA)) {
      setErr("La verificación expiró. Ingresa nuevamente con tu contraseña.");
      resetTwoFactorFlow();
      return;
    }
    setLoad(true);
    setErr("");
    const currentUser = (users || []).find(entry => entry.id === pending2FA.userId);
    if (!currentUser) {
      setLoad(false);
      setErr("No pudimos recuperar tu usuario. Intenta iniciar sesión nuevamente.");
      resetTwoFactorFlow();
      return;
    }

    if (pending2FA.mode === "setup") {
      if (!acceptedRecovery) {
        setLoad(false);
        setErr("Confirma que guardaste los códigos de recuperación antes de continuar.");
        return;
      }
      const validSetupCode = await verifyTotpCode(setupSecret, otpCode);
      if (!validSetupCode) {
        const nextChallenge = consumeChallengeAttempt(pending2FA);
        setPending2FA(nextChallenge);
        setLoad(false);
        if ((nextChallenge?.attemptsLeft || 0) <= 0) {
          setErr("Demasiados intentos fallidos. Debes volver a iniciar sesión.");
          resetTwoFactorFlow();
          return;
        }
        setErr(`Código inválido. Te quedan ${nextChallenge.attemptsLeft} intentos.`);
        return;
      }
      const recoveryHashes = await hashRecoveryCodes(recoveryCodes);
      const updatedUser = {
        ...currentUser,
        mfaEnabled: true,
        mfaSecret: setupSecret,
        mfaRecoveryHashes: recoveryHashes,
        mfaEnrolledAt: new Date().toISOString(),
      };
      await saveUsers((users || []).map(entry => entry.id === updatedUser.id ? updatedUser : entry));
      setLoad(false);
      resetTwoFactorFlow();
      onLogin(updatedUser, buildSecondFactorSessionMeta());
      return;
    }

    const validOtp = currentUser?.mfaSecret ? await verifyTotpCode(currentUser.mfaSecret, otpCode) : false;
    let verified = validOtp;
    let updatedUser = currentUser;
    if (!verified) {
      const recoveryResult = await consumeRecoveryCode(currentUser?.mfaRecoveryHashes || [], otpCode);
      if (recoveryResult.matched) {
        verified = true;
        updatedUser = { ...currentUser, mfaRecoveryHashes: recoveryResult.remaining };
        await saveUsers((users || []).map(entry => entry.id === updatedUser.id ? updatedUser : entry));
      }
    }
    if (!verified) {
      const nextChallenge = consumeChallengeAttempt(pending2FA);
      setPending2FA(nextChallenge);
      setLoad(false);
      if ((nextChallenge?.attemptsLeft || 0) <= 0) {
        setErr("Demasiados intentos fallidos. Debes volver a iniciar sesión.");
        resetTwoFactorFlow();
        return;
      }
      setErr(`Código inválido. Te quedan ${nextChallenge.attemptsLeft} intentos.`);
      return;
    }
    setLoad(false);
    resetTwoFactorFlow();
    onLogin(updatedUser, buildSecondFactorSessionMeta());
  };

  const GRID="linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px)";
  return <><div className="login-shell" style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:GRID,backgroundSize:"44px 44px",opacity:.4}}/>
    <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 50%,var(--cg) 0%,transparent 70%)"}}/>
    <div className="login-card" style={{position:"relative",width:"min(1040px,100%)",display:"grid",gridTemplateColumns:"1.05fr .95fr",gap:18}}>
      <div className="login-promo" style={{background:"linear-gradient(145deg,color-mix(in srgb,var(--cy) 10%, var(--card)),var(--card))",border:"1px solid var(--bdr2)",borderRadius:20,padding:32,boxShadow:"0 24px 80px #0009",display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:540}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:999,border:"1px solid var(--cm)",background:"var(--cg)",color:"var(--cy)",fontSize:11,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:20}}>Contratación guiada</div>
          <div className="login-title" style={{fontFamily:"var(--fh)",fontSize:42,lineHeight:1,fontWeight:800,maxWidth:420,marginBottom:14}}>Activa tu empresa en Produ</div>
          <div className="login-promo-copy" style={{fontSize:14,color:"var(--gr2)",lineHeight:1.7,maxWidth:460,marginBottom:16}}>Completa los datos de tu empresa, define el primer administrador y elige los addons que necesitas hoy. Ideal para productoras, agencias y equipos de contenido.</div>
          <div className="login-promo-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
            {[["Módulos","Activa solo lo que necesitas"],["Equipo","Invita usuarios y crew"],["Comercial","Presupuestos e invoices"]].map(([title,sub])=><div key={title} style={{padding:"14px 14px",borderRadius:16,background:"rgba(8,8,9,.28)",border:"1px solid var(--bdr2)"}}><div style={{fontSize:12,fontWeight:800,color:"var(--wh)",marginBottom:6}}>{title}</div><div style={{fontSize:11,color:"var(--gr2)",lineHeight:1.5}}>{sub}</div></div>)}
          </div>
        </div>
          <div className="login-promo-footer" style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:12,alignItems:"end"}}>
          <div style={{padding:18,borderRadius:18,background:"rgba(6,10,18,.5)",border:"1px solid var(--bdr2)"}}>
            <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.3,marginBottom:8}}>Qué incluye</div>
            <div style={{display:"grid",gap:8,fontSize:12,color:"var(--gr3)"}}>
              <div>• Base Produ: dashboard, calendario, clientes y proyectos</div>
              <div>• Addons según tu operación comercial, financiera u operativa</div>
              <div>• Activación guiada y supervisada por el equipo de Produ</div>
            </div>
          </div>
          <button type="button" onClick={() => { void handleOpenSelfServe(); }} style={{padding:"14px 18px",borderRadius:14,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:selfServeLoading?"wait":"pointer",fontSize:14,fontWeight:800,boxShadow:"0 14px 40px var(--cm)",opacity:selfServeLoading?0.8:1}}>{selfServeLoading?"Cargando...":"¿Quieres contratar Produ?"}</button>
        </div>
      </div>
      <div className="login-form" style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:20,padding:40,boxShadow:"0 24px 80px #0009"}}>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (pending2FA) submitSecondFactor();
          else if (forgotMode) {
            if (isLocalAuth) submitPasswordReset();
            else requestReset();
          } else {
            login();
          }
        }}
      >
      <div className="login-logo" style={{textAlign:"center",marginBottom:32}}>
        <BrandLockup size="md" align="center" />
      </div>
        {!pending2FA && !forgotMode && <>
        <div style={{fontSize:17,fontWeight:700,fontFamily:"var(--fh)",marginBottom:4,textAlign:"center"}}>Bienvenido de vuelta</div>
        <div className="login-subcopy" style={{fontSize:12,color:"var(--gr2)",textAlign:"center",marginBottom:24}}>Ingresa a tu espacio de trabajo</div>
        <FG label="Email"><FI type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.cl" onKeyDown={e=>e.key==="Enter"&&login()}/></FG>
        <FG label="Contraseña">
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center"}}>
            <FI type={showPass?"text":"password"} autoComplete="current-password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()}/>
            <button type="button" onClick={()=>setShowPass(v=>!v)} style={{height:38,padding:"0 12px",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
              {showPass?"Ocultar":"Ver"}
            </button>
          </div>
        </FG>
      </>}
      {!pending2FA && forgotMode && <>
        <div style={{fontSize:17,fontWeight:700,fontFamily:"var(--fh)",marginBottom:4,textAlign:"center"}}>Recuperar contraseña</div>
        <div className="login-subcopy" style={{fontSize:12,color:"var(--gr2)",textAlign:"center",marginBottom:18}}>
          {isLocalAuth
            ? "En laboratorio, el código temporal se muestra una vez porque no hay correo transaccional conectado."
            : "Solicita el restablecimiento y el proveedor de autenticación enviará las instrucciones al correo asociado."}
        </div>
          <FG label="Email">
            <FI type="email" autoComplete="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="tu@email.cl" />
          </FG>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <Btn onClick={requestReset} disabled={load} style={{flex:1}}>Generar código</Btn>
          <GBtn onClick={resetForgotFlow} disabled={load} style={{flex:1}}>Volver</GBtn>
        </div>
        {resetInfo && <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"10px 12px",fontSize:12,color:"var(--gr3)",marginBottom:12}}>{resetInfo}</div>}
        {isLocalAuth && resetRevealCode && <div style={{background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>Código temporal</div>
          <div style={{fontFamily:"var(--fm)",fontSize:18,color:"var(--cy)",fontWeight:700}}>{resetRevealCode}</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:8}}>Válido por 15 minutos. Se invalida después de varios intentos fallidos.</div>
        </div>}
          {isLocalAuth && <>
          <FG label="Código de recuperación">
            <FI autoComplete="one-time-code" value={resetCode} onChange={e=>setResetCode(e.target.value.toUpperCase())} placeholder="ABCD1234" />
          </FG>
          <FG label="Nueva contraseña">
            <FI type="password" autoComplete="new-password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </FG>
          <FG label="Repetir nueva contraseña">
            <FI type="password" autoComplete="new-password" value={newPass2} onChange={e=>setNewPass2(e.target.value)} placeholder="Repite la contraseña" onKeyDown={e=>e.key==="Enter"&&submitPasswordReset()} />
          </FG>
        </>}
      </>}
      {pending2FA?.mode === "setup" && <>
        <div style={{fontSize:17,fontWeight:700,fontFamily:"var(--fh)",marginBottom:4,textAlign:"center"}}>Configura tu segundo factor</div>
        <div className="login-subcopy" style={{fontSize:12,color:"var(--gr2)",textAlign:"center",marginBottom:18}}>Antes de entrar, protege tu acceso con una app autenticadora. Este paso es obligatorio para administradores.</div>
        <div style={{padding:"12px 14px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>Clave manual TOTP</div>
          <div style={{fontFamily:"var(--fm)",fontSize:16,color:"var(--cy)",wordBreak:"break-word"}}>{formatTwoFactorSecret(setupSecret)}</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:8,lineHeight:1.6}}>Añade esta clave en Google Authenticator, 1Password o Authy. Si tu app soporta URI manual, usa: <span style={{fontFamily:"var(--fm)",fontSize:10}}>{setupOtpUrl}</span></div>
        </div>
        <div style={{padding:"12px 14px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Código QR</div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
            {setupQr
              ? <img src={setupQr} alt="QR de configuración 2FA" style={{width:220,height:220,borderRadius:14,background:"#fff",padding:10,border:"1px solid var(--bdr2)"}} />
              : <div style={{width:220,height:220,borderRadius:14,background:"var(--card)",border:"1px solid var(--bdr2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--gr2)"}}>Generando QR...</div>}
          </div>
          <div style={{fontSize:11,color:"var(--gr2)",textAlign:"center"}}>Escanea este QR con tu app autenticadora o usa la clave manual si prefieres configurarlo a mano.</div>
        </div>
        <div style={{padding:"12px 14px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Códigos de recuperación</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {recoveryCodes.map(code => <div key={code} style={{fontFamily:"var(--fm)",fontSize:13,padding:"8px 10px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--card)"}}>{code}</div>)}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
            <input type="checkbox" checked={acceptedRecovery} onChange={e=>setAcceptedRecovery(e.target.checked)}/>
            Confirmo que guardé estos códigos en un lugar seguro.
          </label>
        </div>
        <FG label="Código de 6 dígitos">
          <FI value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder="123456" onKeyDown={e=>e.key==="Enter"&&submitSecondFactor()}/>
        </FG>
      </>}
      {pending2FA?.mode === "verify" && <>
        <div style={{fontSize:17,fontWeight:700,fontFamily:"var(--fh)",marginBottom:4,textAlign:"center"}}>Verificación en dos pasos</div>
        <div className="login-subcopy" style={{fontSize:12,color:"var(--gr2)",textAlign:"center",marginBottom:18}}>Ingresa el código de tu app autenticadora o un código de recuperación. Esta verificación expira en pocos minutos.</div>
        <FG label="Código TOTP o recuperación">
          <FI value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder="123456 o ABCD-EFGH" onKeyDown={e=>e.key==="Enter"&&submitSecondFactor()}/>
        </FG>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:12}}>Intentos restantes: {pending2FA.attemptsLeft}</div>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:16,lineHeight:1.6}}>
          Si el código de tu app siempre falla, verifica que tu teléfono use hora automática o reconfigura el autenticador con un QR nuevo.
        </div>
      </>}
      {err&&<div style={{background:"#ff556615",border:"1px solid #ff556635",borderRadius:6,padding:"8px 12px",color:"var(--red)",fontSize:12,marginBottom:12}}>{err}</div>}
      {!forgotMode && <button type="submit" disabled={load} style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:14,fontWeight:700,opacity:load?.7:1,marginBottom:16}}>{load?"Verificando...":pending2FA?"Verificar segundo factor →":"Ingresar →"}</button>}
      {forgotMode && <button type="submit" disabled={load} style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:14,fontWeight:700,opacity:load?.7:1,marginBottom:16}}>{load?"Procesando...":isLocalAuth?"Actualizar contraseña →":"Enviar instrucciones →"}</button>}
      {pending2FA
        ? <div style={{textAlign:"center"}}>
            {pending2FA.mode === "verify" && (
              <button type="button" onClick={restartSecondFactorSetup} style={{background:"none",border:"none",color:"var(--cy)",cursor:"pointer",fontSize:12,fontWeight:700,textDecoration:"underline",marginBottom:10}}>
                Reconfigurar autenticador
              </button>
            )}
            <div>
            <button type="button" onClick={resetTwoFactorFlow} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:12,fontWeight:600,textDecoration:"underline"}}>Volver al ingreso</button>
            </div>
          </div>
        : <div style={{textAlign:"center"}}>
            {!forgotMode && <>
              {authGateway.supportsPasswordReset() && <button type="button" onClick={()=>{setErr("");setResetInfo("");setResetRevealCode("");setForgotEmail(email);setForgotMode(true);}} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:12,fontWeight:600,textDecoration:"underline",marginBottom:10}}>Olvidé mi contraseña</button>}
              <div>
                <>
                  <span style={{fontSize:12,color:"var(--gr2)"}}>¿No tienes cuenta? </span>
                  <button type="button" onClick={() => { void handleOpenSelfServe(); }} style={{background:"none",border:"none",color:"var(--cy)",cursor:selfServeLoading?"wait":"pointer",fontSize:12,fontWeight:600,textDecoration:"underline",opacity:selfServeLoading?0.8:1}}>Solicitar acceso</button>
                </>
              </div>
            </>}
            {forgotMode && <button type="button" onClick={resetForgotFlow} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:12,fontWeight:600,textDecoration:"underline"}}>Volver al ingreso</button>}
          </div>}
      </form>
      </div>
    </div>
  </div>
  {solOpen&&<AuthModalErrorBoundary onClose={closeSelfServe}>
    {SelfServeModalView
      ? <SelfServeModalView onClose={closeSelfServe} solF={solF} setSolF={setSolF} solSent={solSent} setSolSent={setSolSent} empresas={empresas} helpers={dbHelpers} releaseMode={releaseMode}/>
      : null}
  </AuthModalErrorBoundary>}
  </>;
}

export function EmpresaSelector({ empresas, onSelect, onSelectSuperAdmin, BrandLockup, ini }) {
  const [q,setQ]=useState("");
  const fd=(empresas||[]).filter(e=>e.nombre.toLowerCase().includes(q.toLowerCase()));
  return <div className="company-shell" style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{marginBottom:6}}>
      <BrandLockup size="md" align="center" subtitleColor="rgba(255,255,255,.82)" />
    </div>
    <div style={{fontSize:12,color:"var(--gr2)",letterSpacing:1,textTransform:"uppercase",marginBottom:28,textAlign:"center"}}>Super Admin · Seleccionar empresa</div>
    <div className="company-card" style={{width:"min(460px,100%)"}}>
      <SearchBar value={q} onChange={setQ} placeholder="Buscar empresa..."/>
      <div style={{marginTop:12}}>
        {fd.map(emp=>(
          <div key={emp.id} onClick={()=>onSelect(emp)} style={{display:"flex",alignItems:"center",gap:14,background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--cy)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}>
            <div style={{width:46,height:46,borderRadius:10,background:emp.color+"30",border:`2px solid ${emp.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:17,fontWeight:800,color:emp.color,flexShrink:0,overflow:"hidden"}}>
              {emp.logo ? <img src={emp.logo} style={{width:46,height:46,objectFit:"contain",borderRadius:8}} alt={emp.nombre}/> : ini(emp.nombre)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{emp.nombre}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{emp.rut}</div>
              <div style={{fontSize:10,color:"var(--gr)",marginTop:3}}>Addons: {emp.addons?.join(", ")||"ninguno"}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
              <Badge label={emp.active?"Activa":"Inactiva"} color={emp.active?"green":"red"} sm/>
              <Badge label={emp.plan} color="gray" sm/>
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,padding:"12px 16px",background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"var(--gr2)"}}>Panel de control global</span>
        <Btn onClick={()=>onSelectSuperAdmin ? onSelectSuperAdmin() : onSelect("__super__")} sm>⚙ Panel SuperAdmin</Btn>
      </div>
    </div>
  </div>;
}
