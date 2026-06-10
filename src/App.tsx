import { useState, useEffect } from "react";
import { Rostro, Prenda, HistorialLook, PerfilEstilo } from "./types";
import TuEspejo from "./components/TuEspejo";
import TuArmario from "./components/TuArmario";
import AsesoramientoLooks from "./components/AsesoramientoLooks";
import HistorialLooks from "./components/HistorialLooks";
import AuditoriaArmario from "./components/AuditoriaArmario";
import AsistenteMaleta from "./components/AsistenteMaleta";
import AsesorCompras from "./components/AsesorCompras";
import DiagnosticoEstilo from "./components/DiagnosticoEstilo";
import Login from "./components/Login";
import { 
  supabase, 
  isSupabaseConfigured,
  fetchUserRostro,
  saveUserRostro,
  deleteUserRostro,
  fetchUserPrendas,
  saveUserPrenda,
  updateUserPrenda,
  deleteUserPrenda,
  fetchUserHistorial,
  saveMultipleUserHistorialItems,
  updateUserHistorialItemImage,
  toggleUserHistorialItemFavorito,
  deleteUserHistorialItem,
  resetUserAllData
} from "./supabase";
import { Sparkles, LogOut, Cloud, CloudOff, RefreshCw, Database, Scissors, Shirt, History, ClipboardList, Briefcase, TrendingUp, Sliders, Menu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ActiveTab = "espejo" | "armario" | "asesor" | "historial" | "auditoria" | "maleta" | "compras" | "diagnostico";

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isAuthMock, setIsAuthMock] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Bottom Navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>("armario");

  // Normal App States
  const [rostro, setRostro] = useState<Rostro | null>(null);
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [historial, setHistorial] = useState<HistorialLook[]>([]);
  const [selectedHistorialItem, setSelectedHistorialItem] = useState<HistorialLook | null>(null);
  
  // Style Profile State
  const [perfilEstilo, setPerfilEstilo] = useState<PerfilEstilo | null>(null);

  // Mobile drawer state
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Monitor Supabase connection and auth state changes
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // 1. Check current session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || "usuario@espejo.ai"
          });
          setIsAuthMock(false);
        }
      }).catch((err) => {
        console.error("Session restoration failed:", err);
      });

      // 2. Set up auth state change listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "usuario@espejo.ai"
          });
          setIsAuthMock(false);
        } else {
          // If no active session, clear the user ONLY if they are NOT a guest or mock user
          setUser((currentUser) => {
            if (currentUser && !currentUser.id.startsWith("usr_mock") && currentUser.id !== "usr_guest") {
              return null;
            }
            return currentUser;
          });
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Sync user state changes (fetching database or local backup on Login / Load)
  useEffect(() => {
    if (!user) return;

    async function loadUserData() {
      setIsDataLoading(true);
      try {
        // Load style profile for all user sessions
        const dbPerfilKey = `espejo_perfil_${user.id}`;
        const savedPerfil = localStorage.getItem(dbPerfilKey);
        setPerfilEstilo(savedPerfil ? JSON.parse(savedPerfil) : null);

        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          // Cloud Supabase sync
          const [dbRostro, dbPrendas, dbHistorial] = await Promise.all([
            fetchUserRostro(user.id),
            fetchUserPrendas(user.id),
            fetchUserHistorial(user.id)
          ]);
          
          setRostro(dbRostro);
          setPrendas(dbPrendas);
          setHistorial(dbHistorial);
        } else {
          // Local storage user-specific sync
          const rostroKey = `espejo_rostro_${user.id}`;
          const prendasKey = `espejo_prendas_${user.id}`;
          const historialKey = `espejo_historial_${user.id}`;

          const savedRostro = localStorage.getItem(rostroKey);
          const savedPrendas = localStorage.getItem(prendasKey);
          const savedHistorial = localStorage.getItem(historialKey);

          setRostro(savedRostro ? JSON.parse(savedRostro) : null);
          setPrendas(savedPrendas ? JSON.parse(savedPrendas) : []);
          setHistorial(savedHistorial ? JSON.parse(savedHistorial) : []);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setIsDataLoading(false);
      }
    }

    loadUserData();
  }, [user, isAuthMock]);

  const handleLoginSuccess = (loggedInUser: { id: string; email: string }, isMock: boolean) => {
    setIsAuthMock(isMock);
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase && !isAuthMock && user && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
      await supabase.auth.signOut();
    }
    // Clean states
    setUser(null);
    setRostro(null);
    setPrendas([]);
    setHistorial([]);
    setSelectedHistorialItem(null);
    setPerfilEstilo(null);
    setIsAuthMock(false);
  };

  const handlePerfilGuardado = (nuevoPerfil: PerfilEstilo) => {
    setPerfilEstilo(nuevoPerfil);
    if (user) {
      localStorage.setItem(`espejo_perfil_${user.id}`, JSON.stringify(nuevoPerfil));
    }
  };

  const handleAnalizado = async (nuevoRostro: Rostro) => {
    setRostro(nuevoRostro);
    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await saveUserRostro(user.id, nuevoRostro);
      } else {
        localStorage.setItem(`espejo_rostro_${user.id}`, JSON.stringify(nuevoRostro));
      }
    }
  };

  const handleBorrarRostro = async () => {
    setRostro(null);
    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await deleteUserRostro(user.id);
      } else {
        localStorage.removeItem(`espejo_rostro_${user.id}`);
      }
    }
  };

  const handlePrendaAgregada = async (nuevaPrendaOrArray: Prenda | Prenda[]) => {
    const nuevas = Array.isArray(nuevaPrendaOrArray) ? nuevaPrendaOrArray : [nuevaPrendaOrArray];
    if (nuevas.length === 0) return;

    setPrendas((prev) => {
      const filteredPrev = prev.filter(p => !nuevas.some(n => n.id === p.id));
      const updated = [...nuevas, ...filteredPrev];
      if (user) {
        if (!isSupabaseConfigured || isAuthMock || user.id === "usr_guest" || user.id.startsWith("usr_mock")) {
          localStorage.setItem(`espejo_prendas_${user.id}`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    if (user && isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
      for (const p of nuevas) {
        try {
          await saveUserPrenda(user.id, p);
        } catch (dbErr) {
          console.error("Error guardando prenda en DB:", dbErr);
        }
      }
    }
  };

  const handlePrendaEliminada = async (id: string) => {
    const updated = prendas.filter((p) => p.id !== id);
    setPrendas(updated);
    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await deleteUserPrenda(user.id, id);
      } else {
        localStorage.setItem(`espejo_prendas_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handlePrendaActualizada = async (prendaActualizada: Prenda) => {
    const updated = prendas.map((p) => (p.id === prendaActualizada.id ? prendaActualizada : p));
    setPrendas(updated);
    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await updateUserPrenda(user.id, prendaActualizada);
      } else {
        localStorage.setItem(`espejo_prendas_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleLooksGenerados = async (nuevosLooks: any[], ocasionValor: string, climaValor: string) => {
    const fechaActual = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const nuevosItems: HistorialLook[] = nuevosLooks.map((look, i) => ({
      id: `look_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
      fecha: fechaActual,
      ocasion: ocasionValor,
      clima: climaValor,
      look: look,
      favorito: false
    }));

    const updated = [...nuevosItems, ...historial];
    setHistorial(updated);

    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await saveMultipleUserHistorialItems(user.id, nuevosItems);
      } else {
        localStorage.setItem(`espejo_historial_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleUpdateLookImg = async (lookTitle: string, imageUrl: string, ocasionValue: string, climaValue: string, isFullBody?: boolean) => {
    const updated = historial.map((item) => {
      if (
        item.ocasion === ocasionValue &&
        item.clima === climaValue &&
        item.look.titulo === lookTitle
      ) {
        return {
          ...item,
          look: {
            ...item.look,
            [isFullBody ? "simulatedFullBodyImageUrl" : "simulatedImageUrl"]: imageUrl
          }
        };
      }
      return item;
    });
    setHistorial(updated);

    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        const matchedItem = historial.find((item) => 
          item.ocasion === ocasionValue &&
          item.clima === climaValue &&
          item.look.titulo === lookTitle
        );
        if (matchedItem) {
          await updateUserHistorialItemImage(user.id, matchedItem.id, !!isFullBody, imageUrl);
        }
      } else {
        localStorage.setItem(`espejo_historial_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleEliminarHistorial = async (id: string) => {
    const updated = historial.filter((item) => item.id !== id);
    setHistorial(updated);
    if (selectedHistorialItem?.id === id) {
      setSelectedHistorialItem(null);
    }
    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await deleteUserHistorialItem(user.id, id);
      } else {
        localStorage.setItem(`espejo_historial_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleToggleFavorito = async (id: string) => {
    const matched = historial.find((h) => h.id === id);
    const updated = historial.map((item) => {
      if (item.id === id) {
        return { ...item, favorito: !item.favorito };
      }
      return item;
    });
    setHistorial(updated);

    if (user) {
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        if (matched) {
          await toggleUserHistorialItemFavorito(user.id, id, !matched.favorito);
        }
      } else {
        localStorage.setItem(`espejo_historial_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleSeleccionarHistorial = (item: HistorialLook) => {
    setSelectedHistorialItem(item);
    setActiveTab("asesor");
    setTimeout(() => {
      const section = document.getElementById("asesoramiento-looks-sección");
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    }, 150);
  };

  const handleResetApp = async () => {
    if (window.confirm("¿Seguro que deseas vaciar tu Espejo, Armario e Historial de este atelier? Esta acción es irreversible.")) {
      setRostro(null);
      setPrendas([]);
      setHistorial([]);
      setSelectedHistorialItem(null);
      
      if (user) {
        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          await resetUserAllData(user.id);
        } else {
          localStorage.removeItem(`espejo_rostro_${user.id}`);
          localStorage.removeItem(`espejo_prendas_${user.id}`);
          localStorage.removeItem(`espejo_historial_${user.id}`);
        }
      }
    }
  };

  // Rendering screen 1: If User is not logged in, render credentials portal
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Rendering screen 2: Luxury animated loading screen during cloud database syncing
  if (isDataLoading) {
    return (
      <div className="grain min-h-screen bg-fondo text-tinta flex flex-col items-center justify-center p-4">
        {/* Glow point */}
        <div className="w-[300px] h-[300px] bg-radial from-laton/5 via-transparent to-transparent absolute pointer-events-none" />
        <div className="text-center relative space-y-4">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full border border-laton/20 flex items-center justify-center bg-tarjeta">
              <RefreshCw className="text-laton animate-spin" size={24} />
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-tarjeta border border-linea flex items-center justify-center">
              <Database size={8} className="text-laton" />
            </span>
          </div>
          <h2 className="font-serif text-xl font-bold uppercase tracking-widest text-[#F3ECDD]">
            SARTORÍAL SYNC
          </h2>
          <div className="w-12 h-px bg-laton mx-auto opacity-50" />
          <p className="font-sans text-[11px] uppercase tracking-widest text-tinta-apagada max-w-xs animate-pulse">
            Sincronizando el armario clasificado con tu atelier privado...
          </p>
        </div>
      </div>
    );
  }

  // Rendering screen 3: Main dashboard of Espejo with session controls and Database synced handlers
  return (
    <div className="grain min-h-screen bg-fondo text-tinta font-sans flex flex-col lg:flex-row relative pb-28 lg:pb-0 selection:bg-laton selection:text-fondo">
      {/* Background radial highlight matching luxurious brass lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-radial from-laton/5 via-transparent to-transparent pointer-events-none z-0" />

      {/* 1. PERSISTENT SIDEBAR FOR LAPTOPS / DESKTOPS */}
      <aside className="hidden lg:flex flex-col w-72 h-screen fixed top-0 left-0 bg-tarjeta/95 border-r border-linea/80 z-40 p-6 flex-shrink-0 justify-between">
        <div className="space-y-8 overflow-y-auto no-scrollbar py-2">
          {/* Brand/Logo */}
          <div className="text-left py-2 border-b border-linea/40 pb-4">
            <span className="text-[10px] tracking-widest text-[#C9A35B] uppercase font-bold block mb-1">ATELIER PRIVADO</span>
            <h1 className="font-serif text-3xl font-black tracking-tight text-tinta uppercase select-none leading-none">
              Espejo
            </h1>
            <p className="font-sans text-[9px] tracking-wider text-tinta-apagada uppercase mt-1">Estilismo Inteligente</p>
          </div>

          {/* Sync Stats Bar */}
          <div className="bg-fondo/60 border border-linea/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-tarjeta text-laton border border-linea/80">
                {isSupabaseConfigured && !isAuthMock ? <Cloud size={10} /> : <CloudOff size={10} />}
              </span>
              <div className="text-left w-full overflow-hidden">
                <p className="text-[9px] text-tinta-apagada font-bold uppercase tracking-wider leading-none">
                  {isSupabaseConfigured && !isAuthMock ? "ATELIER CLOUD" : "MEMORIA INTEGRADA"}
                </p>
                <p className="text-[10px] font-mono text-tinta/80 truncate mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
            {isSupabaseConfigured && !isAuthMock ? (
              <div className="text-[8.5px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 border border-emerald-950/30 rounded text-center">
                Atelier Sincronizado
              </div>
            ) : (
              <div className="text-[8.5px] uppercase tracking-wider text-amber-500 font-bold bg-amber-950/10 px-2 py-0.5 border border-amber-950/20 rounded text-center">
                Datos Locales Guardados
              </div>
            )}
          </div>

          {/* Vertical Menu Links */}
          <nav className="space-y-1.5">
            {[
              { id: "espejo", label: "Tú Espejo", desc: "Análisis Fisiognómico", icon: Scissors },
              { id: "diagnostico", label: "ADN Estilo", desc: "Preferencias y Silueta", icon: Sliders },
              { id: "armario", label: "Tú Armario", desc: "Digital & Inteligente", icon: Shirt },
              { id: "asesor", label: "Asesor Sastre", desc: "Generador de Looks", icon: Sparkles },
              { id: "maleta", label: "Equipaje Smart", desc: "Cápsula de Viajes", icon: Briefcase },
              { id: "compras", label: "Tendencias", desc: "Asesor de Compras", icon: TrendingUp },
              { id: "historial", label: "Catálogo Looks", desc: "Historial Guardado", icon: History },
              { id: "auditoria", label: "Plan Auditoría", desc: "Auditar Mi Armario", icon: ClipboardList }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-laton/15 border-l-2 border-laton text-laton font-medium shadow-md shadow-amber-950/5"
                      : "text-tinta-apagada hover:text-white hover:bg-tarjeta border-l-2 border-transparent"
                  }`}
                >
                  <Icon size={16} className={isSelected ? "text-laton animate-pulse" : "text-tinta-apagada"} />
                  <div className="leading-tight">
                    <p className={`text-[11px] uppercase tracking-wider font-bold ${isSelected ? "text-white" : ""}`}>
                      {tab.label}
                    </p>
                    <p className="text-[9px] text-[#A89C82]/70 font-mono">
                      {tab.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info/Reset at the bottom of the sidebar */}
        <div className="space-y-4 pt-4 border-t border-linea/40">
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-fondo border border-linea hover:border-red-900/50 text-tinta-apagada hover:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
          >
            <LogOut size={12} /> Cerrar Atelier
          </button>
          
          <button
            onClick={handleResetApp}
            className="w-full text-center hover:underline text-[9px] uppercase tracking-wider font-mono text-tinta-apagada/40 hover:text-red-400 transition"
          >
            Resetear atelier
          </button>
        </div>
      </aside>

      {/* 2. BODY CONTENT PANE (Scrolls on the right of the sidebar on Desktop/Laptops, and is full screen on mobile) */}
      <div className="flex-1 lg:ml-72 min-h-screen flex flex-col z-10 w-full overflow-hidden">
        
        {/* COMPACT TOP BAR FOR MOBILE/TABLET */}
        <div className="lg:hidden flex items-center justify-between bg-tarjeta/95 border-b border-linea/60 px-4 py-3 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-black uppercase tracking-widest text-[#F3ECDD]">
              ESPEJO
            </h1>
            <span className="text-[8px] font-mono text-laton uppercase tracking-[0.2em] bg-laton/5 border border-laton/25 px-1.5 py-0.5 rounded leading-none shrink-0">
              A.I.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded flex items-center justify-center bg-fondo text-laton border border-linea text-[10px]" title={user.email}>
              {isSupabaseConfigured && !isAuthMock ? <Cloud size={10} /> : <CloudOff size={10} />}
            </span>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 bg-fondo border border-linea/60 hover:border-red-950 text-tinta-apagada text-[9px] font-bold uppercase tracking-wider rounded flex items-center gap-1 cursor-pointer transition"
            >
              <LogOut size={10} /> Salir
            </button>
          </div>
        </div>

        {/* Dynamic header / contents inside main grid panel */}
        <main className="w-full max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-8 py-4 lg:py-12 space-y-6 lg:space-y-10 flex-1">
          
          {/* Main Title Banner Header (We will show this beautifully, but smaller on desktop so it doesn't take too much vertical space) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8 }}
            className="hidden lg:block text-center relative pb-3 border-b border-linea/30"
          >
            <div className="inline-flex lg:hidden items-center gap-2 px-3 py-1 bg-tarjeta/60 border border-linea rounded mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-laton animate-ping" />
              <span className="text-[9px] tracking-widest text-laton uppercase font-medium">Estilista Virtual de Lujo</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-3xl font-extrabold tracking-tight text-white select-none uppercase">
              {activeTab === "espejo" && "TÚ ESPEJO VIRTUAL"}
              {activeTab === "armario" && "TÚ ARMARIO DIGITAL"}
              {activeTab === "asesor" && "COORDINADOR DE LOOKS"}
              {activeTab === "historial" && "HISTORIAL DE LOOKS"}
              {activeTab === "auditoria" && "AUDITORÍA DE ARMARIO"}
              {activeTab === "maleta" && "EQUIPAJE CÁPSULA SMART"}
              {activeTab === "compras" && "RECOMENDADOR DE TENDENCIAS"}
              {activeTab === "diagnostico" && "ADN DE ESTILO PERSONAL"}
            </h1>
            
            <p className="font-sans text-[11px] sm:text-xs uppercase tracking-widest text-[#A89C82] font-normal max-w-3xl mx-auto mt-2 leading-relaxed">
              {activeTab === "espejo" && "Calibración fisionómica por I.A.: Analiza la forma de tu rostro para optimizar tu corte de cabello, barba y sintonizarlo con tu estilo."}
              {activeTab === "armario" && "Tu atelier digital: Registra tu colección de prendas reales con la inteligencia de categorización rápida por visión computacional."}
              {activeTab === "asesor" && "Estilismo sartorial automatizado: Diseña combinaciones editoriales de alta costura adaptadas al clima y tu perfil."}
              {activeTab === "historial" && "Colección privada de atuendos de gala: Guarda tus propuestas favoritas de cada ocasión o evento."}
              {activeTab === "auditoria" && "Estudio crítico de tu ropero: Descubre el coeficiente de cohesión, lo que realmente necesitas y lo que te sobra."}
              {activeTab === "maleta" && "Planificador de maletas inteligente: Viaja ultra-ligero con un ropero de cápsula sastrera para cada día de viaje."}
              {activeTab === "compras" && "Cazador de tendencias y Personal Shopper virtual: Recibe propuestas exclusivas con las compras que encajan con tu ADN."}
              {activeTab === "diagnostico" && "Estudio de silueta, preferencias, colores activos y metas estéticas para sincronizar todo el atelier virtual."}
            </p>
          </motion.div>

          {/* Section Render - Conditionally switch based on activeTab with clean micro-animations */}
          <div className="relative min-h-[300px]">
            {activeTab === "espejo" && (
              <motion.div
                key="espejo"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
                className="relative"
              >
                <TuEspejo
                  rostro={rostro}
                  onAnalizado={handleAnalizado}
                  onBorrar={handleBorrarRostro}
                />
              </motion.div>
            )}

            {activeTab === "armario" && (
              <motion.div
                key="armario"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <TuArmario
                  prendas={prendas}
                  onPrendaAgregada={handlePrendaAgregada}
                  onPrendaEliminada={handlePrendaEliminada}
                  onPrendaActualizada={handlePrendaActualizada}
                />
              </motion.div>
            )}

            {activeTab === "asesor" && (
              <motion.div
                key="asesor"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <AsesoramientoLooks
                  armario={prendas}
                  rostro={rostro}
                  selectedHistorialItem={selectedHistorialItem}
                  onLooksGenerados={handleLooksGenerados}
                  onUpdateLookImg={handleUpdateLookImg}
                  perfilEstilo={perfilEstilo}
                />
              </motion.div>
            )}

            {activeTab === "historial" && (
              <motion.div
                key="historial"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <HistorialLooks
                  historial={historial}
                  armario={prendas}
                  onEliminar={handleEliminarHistorial}
                  onToggleFavorito={handleToggleFavorito}
                  onSeleccionar={handleSeleccionarHistorial}
                />
              </motion.div>
            )}

            {activeTab === "auditoria" && (
              <motion.div
                key="auditoria"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <AuditoriaArmario
                  armario={prendas}
                  rostro={rostro}
                  onPrendaEliminada={handlePrendaEliminada}
                  perfilEstilo={perfilEstilo}
                />
              </motion.div>
            )}

            {activeTab === "maleta" && (
              <motion.div
                key="maleta"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <AsistenteMaleta
                  armario={prendas}
                  perfilEstilo={perfilEstilo}
                />
              </motion.div>
            )}

            {activeTab === "compras" && (
              <motion.div
                key="compras"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <AsesorCompras
                  armario={prendas}
                  perfilEstilo={perfilEstilo}
                />
              </motion.div>
            )}

            {activeTab === "diagnostico" && (
              <motion.div
                key="diagnostico"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <DiagnosticoEstilo
                  userId={user.id}
                  perfilActual={perfilEstilo}
                  onPerfilGuardado={handlePerfilGuardado}
                />
              </motion.div>
            )}
          </div>

          {/* Reset App on Mobile view only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center pt-6 border-t border-linea/30 lg:hidden"
          >
            <button
              type="button"
              onClick={handleResetApp}
              className="button-press border border-linea hover:border-red-900/40 text-tinta-apagada hover:text-red-400 font-sans text-[10px] uppercase tracking-wider px-4 py-2 bg-tarjeta/15 rounded"
            >
              Restaurar Aplicación (Vaciar Datos)
            </button>
          </motion.div>

          {/* Footnote inside Main Panel */}
          <footer className="text-center pt-10 pb-8 text-[11px] font-sans text-tinta-apagada/40 leading-relaxed max-w-sm mx-auto select-none">
            <p className="font-serif italic font-medium text-laton">ESPEJO</p>
            <p>Atelier de Asesoría de Imagen Masculina & Sastrería Digital Inteligente.</p>
            <p className="mt-1">© 2026. Todos los derechos reservados.</p>
          </footer>
        </main>
      </div>

      {/* "Más" Options Popover Drawer for Mobile */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreMenu(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            {/* Drawer Container */}
            <motion.div
              initial={{ opacity: 0, y: 100, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 100, x: "-50%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed bottom-24 left-1/2 z-50 w-[92%] max-w-sm bg-tarjeta/98 border border-linea/80 rounded-2xl p-5 shadow-[0_15px_50px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
              <h3 className="text-[10px] tracking-wider text-laton uppercase font-bold border-b border-linea/30 pb-2 mb-3 text-center">
                MÁS HERRAMIENTAS DE ESTILO
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "diagnostico", label: "ADN Estilo", desc: "Preferencias", icon: Sliders },
                  { id: "maleta", label: "Equipaje Smart", desc: "Maleta Cápsula", icon: Briefcase },
                  { id: "compras", label: "Tendencias", desc: "Asesor Compras", icon: TrendingUp },
                  { id: "auditoria", label: "Plan Auditoría", desc: "Optimizar Armario", icon: ClipboardList }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as ActiveTab);
                        setShowMoreMenu(false);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-laton/20 border-laton text-laton"
                          : "bg-fondo/40 border-linea/50 text-tinta hover:bg-tarjeta"
                      }`}
                    >
                      <Icon size={18} className="mb-1 text-laton" />
                      <span className="text-[10px] uppercase tracking-wider font-extrabold block text-white">{item.label}</span>
                      <span className="text-[8px] text-tinta-apagada font-mono mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. MOBILE BOTTOM NAV DOCK (ONLY FOR MOBILE & TABLETS) */}
      <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-tarjeta/95 backdrop-blur-md border border-linea/80 rounded-full px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.95)] flex items-center justify-around">
        {[
          { id: "espejo", label: "Espejo", icon: Scissors },
          { id: "armario", label: "Armario", icon: Shirt },
          { id: "asesor", label: "Asesoría", icon: Sparkles },
          { id: "historial", label: "Historial", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ActiveTab);
                setShowMoreMenu(false);
              }}
              className={`flex flex-col items-center gap-1 focus:outline-none transition-all cursor-pointer ${
                isSelected ? "text-laton scale-105" : "text-tinta-apagada hover:text-white"
              }`}
              title={tab.label}
            >
              <Icon size={18} className={isSelected ? "text-laton animate-pulse" : "text-tinta-apagada"} />
              <span className="text-[8.5px] uppercase tracking-wider font-bold mt-0.5">{tab.label}</span>
            </button>
          );
        })}
        
        {/* Toggle button for others */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`flex flex-col items-center gap-1 focus:outline-none transition-all cursor-pointer ${
            ["diagnostico", "maleta", "compras", "auditoria"].includes(activeTab) || showMoreMenu
              ? "text-laton scale-105 font-bold"
              : "text-tinta-apagada hover:text-white"
          }`}
          title="Opciones adicionales"
        >
          <Menu size={18} className={["diagnostico", "maleta", "compras", "auditoria"].includes(activeTab) || showMoreMenu ? "text-laton animate-pulse" : "text-tinta-apagada"} />
          <span className="text-[8.5px] uppercase tracking-wider font-bold mt-0.5">Más</span>
        </button>
      </nav>
    </div>
  );
}

