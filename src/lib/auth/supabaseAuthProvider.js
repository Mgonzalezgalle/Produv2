import { sb } from "./supabaseClient";
import { findActiveDomainUserByEmail, normalizeAuthEmail, resolveTenantForUser } from "./authIdentity";

function warnSupabaseAuth(message, error, extra = {}) {
  console.warn(message, {
    ...extra,
    error: error?.message || String(error || ""),
  });
}

export async function authenticateSupabaseUser({ users = [], empresas = [], email = "", password = "" }) {
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
    const domainUser = findActiveDomainUserByEmail(users, email);
    if (error || !data?.user) {
      const rawError = error?.message || "";
      const translatedError = rawError === "Email not confirmed"
        ? "Tu cuenta Auth existe, pero debes confirmar el correo antes de entrar al laboratorio."
        : rawError;
      return {
        user: null,
        empresa: null,
        error: domainUser
          ? (translatedError || "Credenciales inválidas o cuenta Auth todavía no activada.")
          : (translatedError || "No fue posible iniciar sesión con Supabase Auth."),
      };
    }
    const linkedUser = findActiveDomainUserByEmail(users, data.user.email);
    if (!linkedUser) {
      await sb.auth.signOut();
      return {
        user: null,
        empresa: null,
        error: "El usuario autenticado no está vinculado todavía al dominio de Produ.",
      };
    }
    return {
      user: linkedUser,
      empresa: resolveTenantForUser(linkedUser, empresas, null),
      error: "",
    };
  } catch (error) {
    warnSupabaseAuth("Supabase sign-in failed unexpectedly", error, {
      email: normalizeAuthEmail(email),
    });
    return {
      user: null,
      empresa: null,
      error: "Supabase Auth no respondió correctamente en el laboratorio.",
    };
  }
}

export async function activateSupabaseAccount({ users = [], empresas = [], email = "", password = "" }) {
  const safeEmail = normalizeAuthEmail(email);
  const domainUser = findActiveDomainUserByEmail(users, safeEmail);
  if (!domainUser) {
    return {
      ok: false,
      user: null,
      empresa: null,
      message: "Ese correo no está vinculado a un usuario activo del dominio.",
    };
  }
  if (String(password || "").length < 8) {
    return {
      ok: false,
      user: null,
      empresa: null,
      message: "La nueva contraseña debe tener al menos 8 caracteres.",
    };
  }
  try {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { data, error } = await sb.auth.signUp({
      email: safeEmail,
      password: String(password || ""),
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) {
      return {
        ok: false,
        user: null,
        empresa: null,
        message: error.message || "No fue posible activar la cuenta en Supabase Auth.",
      };
    }
    const empresa = resolveTenantForUser(domainUser, empresas, null);
    return {
      ok: true,
      user: data?.session ? domainUser : null,
      empresa: data?.session ? empresa : null,
      message: data?.session
        ? "Cuenta activada correctamente. Ya puedes entrar al laboratorio."
        : `Cuenta creada para ${safeEmail}. Si Supabase exige confirmación, revisa ese correo para terminar la activación.`,
    };
  } catch (error) {
    warnSupabaseAuth("Supabase account activation failed unexpectedly", error, {
      email: safeEmail,
    });
    return {
      ok: false,
      user: null,
      empresa: null,
      message: "No fue posible activar la cuenta en este entorno.",
    };
  }
}

export async function restoreSupabaseSession({ users = [], empresas = [], storedSession = null }) {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error || !data?.session?.user?.email) {
      return { user: null, empresa: null, clearSession: false };
    }
    const domainUser = findActiveDomainUserByEmail(users, data.session.user.email);
    if (!domainUser) {
      return { user: null, empresa: null, clearSession: true };
    }
    return {
      user: domainUser,
      empresa: resolveTenantForUser(domainUser, empresas, storedSession),
      clearSession: false,
    };
  } catch (error) {
    warnSupabaseAuth("Supabase session restore failed unexpectedly", error);
    return { user: null, empresa: null, clearSession: false };
  }
}

export async function signOutSupabaseUser() {
  try {
    await sb.auth.signOut();
  } catch (error) {
    warnSupabaseAuth("Supabase sign-out failed unexpectedly", error);
  }
}

export async function requestSupabasePasswordReset({ email = "" }) {
  try {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(normalizeAuthEmail(email), redirectTo ? { redirectTo } : undefined);
    if (error) {
      return {
        ok: false,
        message: error.message || "No fue posible enviar el correo de recuperación.",
      };
    }
    return {
      ok: true,
      message: `Si ${email} existe en Supabase Auth, enviamos instrucciones de recuperación.`,
    };
  } catch (error) {
    warnSupabaseAuth("Supabase password reset failed unexpectedly", error, {
      email: normalizeAuthEmail(email),
    });
    return {
      ok: false,
      message: "La recuperación de contraseña aún no está disponible en este entorno.",
    };
  }
}

export async function signInWithSupabaseGoogle() {
  try {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) {
      return {
        ok: false,
        message: error.message || "No fue posible iniciar el acceso con Google.",
      };
    }
    return {
      ok: true,
      message: "Redirigiendo a Google…",
    };
  } catch (error) {
    warnSupabaseAuth("Supabase Google sign-in failed unexpectedly", error);
    return {
      ok: false,
      message: "Google Sign-In aún no está disponible en este entorno.",
    };
  }
}
