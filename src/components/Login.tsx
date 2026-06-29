import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../supabase";
import { motion } from "motion/react";
import { Sparkles, KeyRound, Mail, LogIn, UserPlus, Eye, EyeOff, AlertCircle, HelpCircle, CheckCircle } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: { id: string; email: string }, isMock?: boolean) => void;
}

const GoogleLogomark = () => (
  <svg className="w-4 h-4 mr-2.5 flex-shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  const [forceLocalDemo, setForceLocalDemo] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  // Listen to message from OAuth popup for seamless cross-window sign in completion
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data === "supabase-oauth-success" && isSupabaseConfigured && supabase) {
        console.log("Parent window received oauth-success. Fetching session...");
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            onLoginSuccess({
              id: sessionData.session.user.id,
              email: sessionData.session.user.email || "usuario@espejo.ai",
            }, false);
          }
        } catch (err) {
          console.error("Failed to recover session on postMessage trigger:", err);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onLoginSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor, introduce tu correo y contraseña.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    const useRealSupabase = isSupabaseConfigured && !forceLocalDemo;

    try {
      if (useRealSupabase && supabase) {
        // REAL SUPABASE AUTHENTICATION
        if (isSignUp) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });
          if (error) throw error;
          
          if (data.user) {
            if (data.session) {
              onLoginSuccess({
                id: data.user.id,
                email: data.user.email || email,
              }, false);
            } else {
              setInfoMsg("¡Registro exitoso! De ser requerido, confirma tu cuenta por correo electrónico. Ya puedes acceder introduciendo tus credenciales.");
              setIsSignUp(false);
              setPassword("");
            }
          } else {
            throw new Error("No se pudo registrar.");
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          
          if (data.user) {
            onLoginSuccess({
              id: data.user.id,
              email: data.user.email || email,
            }, false);
          }
        }
      } else {
        // SIMULATED AUTHENTICATION FOR LOCAL DEMO MODE
        // This is extremely safe and won't crash when testing locally before configuring Env keys
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        if (isSignUp) {
          // Simulate registration
          setInfoMsg("¡Registro Simulado Exitoso! Ya puedes iniciar sesión con esta cuenta demo.");
          setIsSignUp(false);
          setPassword("");
        } else {
          // Simulate login with a deterministic user ID based on the email
          const cleanEmailId = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
          onLoginSuccess({
            id: `usr_mock_${cleanEmailId}`,
            email: email,
          }, true);
        }
      }
    } catch (err: any) {
      let friendlyError = err.message || "Ocurrió un error al procesar tu solicitud.";
      if (err.message && err.message.includes("Database error")) {
        friendlyError = "Error de base de datos. Si persiste, activa el conmutador 'Forzar Modo Demo (Desconectar Supabase)' para guardar tus progresos localmente.";
      }
      setErrorMsg(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    const useRealSupabase = isSupabaseConfigured && !forceLocalDemo;

    try {
      if (useRealSupabase && supabase) {
        // SUPABASE GOOGLE AUTHENTICATION
        // We use skipBrowserRedirect: true to manually open popup, avoiding iframe blockade
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;

        if (data?.url) {
          const width = 500;
          const height = 600;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          const popup = window.open(
            data.url,
            "supabase_oauth_popup",
            `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
          );

          if (!popup) {
            setErrorMsg(
              "El navegador ha bloqueado la ventana emergente de Google. Para poder acceder con Google en AI Studio: 1) Permite las ventanas emergentes (popups) en la configuración de la barra de direcciones de tu navegador, o 2) Abre este probador en una Pestaña Nueva haciendo clic en el botón con una flecha saliente en la esquina superior derecha del simulador. También puedes registrarte o entrar usando un Correo y Contraseña abajo sin restricciones."
            );
            return;
          }

          // Poll for completion
          const interval = setInterval(async () => {
            if (popup.closed) {
              clearInterval(interval);
              // Check session now
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData.session?.user) {
                onLoginSuccess({
                  id: sessionData.session.user.id,
                  email: sessionData.session.user.email || "usuario@espejo.ai",
                }, false);
              }
            }
          }, 1000);
        } else {
          throw new Error("No se pudo iniciar el flujo de autenticación de Google.");
        }
      } else {
        // SIMULATED AUTHENTICATION FOR LOCAL DEMO MODE
        await new Promise((resolve) => setTimeout(resolve, 850));
        setInfoMsg("Acceso simulado con Google en Modo Demo.");
        onLoginSuccess({
          id: "usr_mock_diego_sartorial_gmail_com",
          email: "diego.sartorial@gmail.com",
        }, true);
      }
    } catch (err: any) {
      let friendlyError = err.message || "Ocurrió un error al iniciar sesión con Google.";
      if (err.message && (err.message.includes("provider is not enabled") || err.message.includes("Unsupported provider"))) {
        friendlyError = "El inicio de sesión con Google no está habilitado en tu panel de control de Supabase (Authentication -> Providers -> Google -> Habilitar). No te preocupes: puedes registrarte e ingresar escribiendo cualquier Correo y Contraseña abajo en 2 segundos, o presionar el botón 'Entrar como Invitado' para explorar toda la suite de inmediato.";
      }
      setErrorMsg(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setErrorMsg("Por favor, introduce tu Correo Electrónico arriba primero.");
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    const useRealSupabase = isSupabaseConfigured && !forceLocalDemo;

    try {
      if (useRealSupabase && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setInfoMsg(`¡Enlace enviado! Hemos enviado un correo de acceso seguro a ${email}. Revisa tu bandeja de entrada o carpeta de correo no deseado (spam) y haz clic en el botón o enlace para iniciar sesión instantáneamente.`);
      } else {
        // Mock magic link flow
        await new Promise((resolve) => setTimeout(resolve, 800));
        setInfoMsg(`[MODO DEMO] Se simuló el envío de un enlace de acceso a ${email}. Inicia sesión con cualquier contraseña o pulsa Entrar como Invitado.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo enviar el enlace de acceso por email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    onLoginSuccess({
      id: "usr_guest",
      email: "invitado@espejo.ai",
    }, true); // Always enforce local mock for guest mode to prevent Supabase fetching
  };

  const activeSupabase = isSupabaseConfigured && !forceLocalDemo;

  return (
    <div className="grain min-h-screen bg-fondo text-tinta font-sans flex flex-col items-center justify-center p-4 relative selection:bg-laton selection:text-fondo overflow-y-auto">
      {/* Background illumination */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-radial from-laton/5 via-transparent to-transparent pointer-events-none" />

      {isIframe && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mb-4 bg-amber-950/25 border border-laton/30 rounded-xl p-4 text-xs text-amber-200/95 leading-relaxed text-center space-y-3 shadow-xl relative z-20"
        >
          <div className="flex items-start gap-2 text-left">
            <Sparkles size={14} className="text-laton shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-serif text-xs font-bold tracking-wider text-white uppercase mb-1">
                ¿PROBAR DESDE FUERA DE AI STUDIO?
              </p>
              <p className="text-[11px] opacity-90 leading-normal">
                Para eludir bloqueos de ventanas emergentes o restricciones de cookies y usar cómodamente servicios completos como el acceso con Google, haz clic abajo:
              </p>
            </div>
          </div>
          
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 bg-laton hover:bg-laton-apagado text-fondo text-[10px] font-bold uppercase tracking-widest rounded text-center transition flex items-center justify-center gap-1.5 focus:outline-none shadow-md"
          >
            Abrir Probador en Pestaña Externa ↗
          </a>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8 }}
        className="w-full max-w-md bg-tarjeta border border-linea rounded-xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6"
      >
        {/* Connection status header */}
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-fondo/50 border border-linea/60 rounded px-3 py-1.5 text-[9.5px] uppercase tracking-wider font-semibold">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${activeSupabase ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className={activeSupabase ? "text-emerald-400" : "text-amber-400"}>
                {activeSupabase ? "SUPABASE CLOUD ACTIVO" : "MODO DEMO LOCAL (OFFLINE)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowConfigHelp(!showConfigHelp)}
              className="text-laton hover:underline flex items-center gap-1 focus:outline-none"
            >
              <HelpCircle size={11} className="shrink-0" />
              Configurar
            </button>
          </div>

          {isSupabaseConfigured && (
            <div className="flex items-center justify-between px-3 py-1 bg-tarjeta/40 border border-linea/40 rounded text-[10px] text-tinta-apagada">
              <span className="font-medium">¿Usar almacenamiento local?</span>
              <button
                type="button"
                onClick={() => {
                  setForceLocalDemo(!forceLocalDemo);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider transition ${
                  forceLocalDemo ? "bg-amber-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {forceLocalDemo ? "Sí, Modo Local" : "No, Usar Cloud"}
              </button>
            </div>
          )}
        </div>

        {/* Brand visual header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-laton/40 bg-tarjeta text-laton mb-2">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <h1 className="font-serif text-4xl font-extrabold tracking-tight text-white uppercase">
            ESPEJO
          </h1>
          <div className="w-12 h-px bg-laton mx-auto opacity-70" />
          <p className="font-sans text-[10.5px] uppercase tracking-widest text-tinta-apagada">
            ACCESO CONFIDENCIAL • ESTILISMO MASCULINO
          </p>
        </div>

        {/* Configuration help banner */}
        {showConfigHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-fondo border border-linea/80 rounded p-4 text-[11px] text-tinta-apagada space-y-3"
          >
            <p className="text-white font-semibold">¿Cómo conectar tu propia base de datos Supabase?</p>
            <p className="leading-relaxed">
              Es muy sencillo. Solo debes configurar las siguientes claves en la sección de <strong>Secrets (Configuración)</strong> de tu AI Studio:
            </p>
            <div className="bg-tarjeta border border-linea rounded p-2 text-[10px] font-mono space-y-1 block text-left">
              <div>VITE_SUPABASE_URL="tu-url-de-supabase"</div>
              <div>VITE_SUPABASE_ANON_KEY="tu-clave-anonima"</div>
            </div>
            <p className="leading-relaxed">
              Una vez configuradas en AI Studio, la aplicación sincronizará automáticamente tu Espejo, prendas de vestir e historial de looks en tiempo real en la nube segura de Supabase.
            </p>
            <button
              type="button"
              onClick={() => setShowConfigHelp(false)}
              className="text-[#C9A35B] hover:underline font-bold"
            >
              Entendido, cerrar
            </button>
          </motion.div>
        )}

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded flex gap-2 text-left text-xs text-red-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Error de Acceso</p>
              <p className="text-[11px] opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}

        {infoMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded flex gap-2 text-left text-xs text-emerald-200">
            <CheckCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Notificación</p>
              <p className="text-[11px] opacity-90">{infoMsg}</p>
            </div>
          </div>
        )}

        {/* Mode alert if working locally */}
        {!activeSupabase && !infoMsg && !errorMsg && (
          <div className="p-3 bg-amber-950/20 border border-amber-920/40 rounded text-left text-[11.5px] leading-relaxed text-amber-200">
            <p className="font-semibold text-amber-300 flex items-center gap-1">
              <AlertCircle size={12} /> Entorno Autónomo
            </p>
            <p className="text-[10.5px] opacity-80 mt-0.5">
              {forceLocalDemo 
                ? "Has forzado el MODO DEMO LOCAL en este dispositivo. Tu armario, peinado y registro se guardarán offline de forma segura en este navegador."
                : "No se han detectado variables de Supabase. La autenticación y la base de datos se simularán síncronamente a través de local storage. ¡Puedes usar cualquier credencial para iniciar o registrarte!"
              }
            </p>
          </div>
        )}

        {/* Google Authentication Section */}
        <div className="space-y-3.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleLogin}
            className="w-full py-2.5 bg-white hover:bg-neutral-50 active:scale-97 text-zinc-900 border border-zinc-200 text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:pointer-events-none shadow-sm cursor-pointer"
          >
            <GoogleLogomark />
            Acceder con Google
          </button>

          <p className="text-[10.5px] text-amber-200/80 bg-amber-950/20 border border-amber-920/10 rounded p-2.5 text-center leading-relaxed">
            ⚠️ <strong>Entorno Seguro Iframe:</strong> Si este botón no abre la ventana de Google, se debe a restricciones del simulador de AI Studio. Permite las <strong>ventanas emergentes (popups)</strong> en la barra de tu navegador, o abre la app en una <strong>Pestaña Nueva</strong> desde el botón superior derecho. ¡O usa el registro manual con contraseña abajo sin trabas!
          </p>

          {/* Toggleable Google Credentials Step-by-Step Guide */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowGoogleHelp(!showGoogleHelp)}
              className="text-xs text-[#C9A35B] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              🔑 {showGoogleHelp ? "Ocultar guía de configuración" : "¿Cómo configurar el acceso con Google paso a paso?"}
            </button>
          </div>

          {showGoogleHelp && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-900 border border-linea/60 rounded p-4 text-[11px] text-tinta-apagada space-y-3.5 text-left leading-relaxed"
            >
              <p className="text-white font-serif font-semibold text-[11.5px] tracking-wide uppercase border-b border-linea/20 pb-1.5 flex items-center justify-between">
                <span>🛠️ GUÍA RÁPIDA DE CONFIGURACIÓN</span>
                <span className="text-[9px] text-[#C9A35B] font-mono lowercase">google cloud &supabase</span>
              </p>
              
              <div className="space-y-3 text-tinta-apagada/90">
                <div>
                  <p className="text-white font-semibold">1. Pantalla de Consentimiento (OAuth Consent Screen)</p>
                  <p className="mt-0.5">
                    Ve a <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#C9A35B] underline">Google Cloud Console</a>. Selecciona o crea un proyecto arriba, busca <strong>"OAuth consent screen"</strong> en el buscador de arriba y:
                  </p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10.5px]">
                    <li>Elige el tipo de usuario <strong>Externo (External)</strong> y haz clic en <i>Crear</i>.</li>
                    <li>Completa solo lo mínimo requerido: <b>Nombre de app</b>, tu <b>correo</b> de soporte y tu <b>correo</b> de contacto de desarrollador abajo del todo.</li>
                    <li>Guarda y avanza hasta el final del asistente (no necesitas agregar "scopes" ni "test users").</li>
                  </ul>
                </div>

                <div>
                  <p className="text-white font-semibold">2. Obtener Client ID & Client Secret</p>
                  <p className="mt-0.5">
                    Haz clic en <strong>"Credenciales" (Credentials)</strong> en el panel izquierdo de Google Cloud:
                  </p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10.5px]">
                    <li>Haz clic en <strong>"+ Crear credenciales"</strong> en la parte superior y elige <strong>"ID de cliente de OAuth"</strong>.</li>
                    <li>En <i>Tipo de aplicación</i> selecciona <strong>Aplicación web (Web application)</strong>.</li>
                    <li>En la sección <b>"URI de redireccionamiento autorizados"</b>, añade la URL que te proporciona Supabase.</li>
                    <li className="text-amber-200/90 list-none mt-1 pl-1 font-mono text-[9.5px] bg-zinc-950/60 p-1.5 rounded border border-linea/30">
                      💡 Copia esta URL desde tu panel de Supabase en <i>Authentication &rarr; Providers &rarr; Google &rarr; Redirect URI</i>.
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-white font-semibold">3. Activar en Supabase</p>
                  <p className="mt-0.5">
                    Una vez guardado en Google Cloud, se te mostrará una ventana flotante con tu <strong>ID de cliente (Client ID)</strong> y <strong>Secreto de cliente (Client Secret)</strong>:
                  </p>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10.5px]">
                    <li>Copia ambos códigos y ve a tu proyecto en <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#C9A35B] underline">Supabase</a>.</li>
                    <li>Entra en <strong>Authentication &rarr; Providers &rarr; Google</strong>.</li>
                    <li>Activa la casilla <strong>"Enable Google Provider"</strong>, pega el <i>Client ID</i> y el <i>Client Secret</i>, y haz clic en <strong>Save</strong>.</li>
                  </ul>
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-920/30 p-2 rounded text-[10px] text-amber-200/90">
                🔒 <strong>¿Prefieres omitir esto?</strong> Si no deseas configurar Google Cloud, puedes usar el <strong>Enlace de Acceso Rápido (Magic Link)</strong> abajo escribiendo tu correo, ¡o registrarte con una contraseña sencilla en 2 segundos!
              </div>
            </motion.div>
          )}

          {/* Vercel Guidance Card */}
          <div className="bg-zinc-950/50 border border-linea/60 rounded p-3 text-[10.5px] text-tinta-apagada space-y-2 text-left">
            <p className="text-white font-serif font-semibold text-[11px] tracking-wide uppercase flex items-center gap-1">
              🚀 ¿Desplegando en Vercel?
            </p>
            <p className="leading-relaxed">
              Para que el acceso con Google funcione en <strong>Vercel</strong>, debes configurar los redireccionamientos permitidos en Supabase:
            </p>
            <ul className="list-decimal list-inside space-y-1 text-tinta-apagada/90 pl-1">
              <li>Entra al panel de <strong>Supabase</strong> de tu proyecto.</li>
              <li>Ve a <strong>Authentication</strong> &rarr; <strong>URL Configuration</strong>.</li>
              <li>Añade la URL de Vercel (ej: <code className="bg-zinc-800 text-amber-200 px-1 py-0.5 rounded font-mono">https://tu-proyecto.vercel.app/**</code>) en la sección de <strong>Redirect URLs</strong>.</li>
              <li>Asegúrate de configurar los Secrets <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> y <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> en la configuración de variables de Vercel.</li>
            </ul>
          </div>

          <div className="relative flex py-1.5 items-center">
            <div className="flex-grow border-t border-linea/30"></div>
            <span className="flex-shrink mx-4 text-[9px] text-tinta-apagada/40 uppercase tracking-widest font-bold">
              o con credenciales
            </span>
            <div className="flex-grow border-t border-linea/30"></div>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest text-tinta-apagada font-bold block">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-tinta-apagada/40">
                <Mail size={13} />
              </span>
              <input
                type="email"
                required
                placeholder="ej: sarto@espejo.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-fondo border border-linea focus:border-laton rounded px-3 py-2 pl-9 text-xs font-sans text-tinta placeholder-tinta-apagada/30 outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] uppercase tracking-widest text-tinta-apagada font-bold block">
                Contraseña (Mínimo 6 caracteres)
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-tinta-apagada/40">
                <KeyRound size={13} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-fondo border border-linea focus:border-laton rounded px-3 py-2 pl-9 pr-9 text-xs font-sans text-tinta placeholder-tinta-apagada/30 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-tinta-apagada/65 hover:text-laton focus:outline-none"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 mt-2 bg-laton hover:bg-laton-apagado text-fondo text-xs font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 transition active:scale-97 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-fondo border-t-transparent rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus size={14} /> Crear Mi Atelier Personal
              </>
            ) : (
              <>
                <LogIn size={14} /> Acceder Al Boutique
              </>
            )}
          </button>

          {!isSignUp && (
            <div className="text-center pt-1 border-t border-linea/20 mt-3">
              <span className="text-[10px] text-tinta-apagada">¿Prefieres no usar contraseña?</span>
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={isLoading}
                className="block w-full text-center text-[11px] text-[#C9A35B] hover:underline font-bold mt-1"
              >
                🪄 Enviar Enlace de Acceso Rápido a tu Gmail
              </button>
            </div>
          )}
        </form>

        {/* Footer actions of Login card */}
        <div className="space-y-4 pt-4 border-t border-linea/60 text-center text-xs">
          <div>
            <span className="text-tinta-apagada">
              {isSignUp ? "¿Ya posees un armario?" : "¿Primera vez en Espejo?"}
            </span>{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="text-[#C9A35B] hover:underline font-bold"
            >
              {isSignUp ? "Inicia Sesión" : "Crea tu Cuenta"}
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-linea/30"></div>
            <span className="flex-shrink mx-4 text-[9px] text-tinta-apagada/40 uppercase tracking-widest">
              Ó CONTINÚA SIN REGISTRO
            </span>
            <div className="flex-grow border-t border-linea/30"></div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-2 bg-fondo border border-linea/80 hover:border-laton text-tinta text-[10px] font-bold uppercase tracking-widest rounded transition duration-200 button-press"
          >
            Entrar como Invitado (Modo Demo)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
