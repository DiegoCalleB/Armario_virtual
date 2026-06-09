import { useState, useEffect } from "react";
import { Rostro, Prenda, HistorialLook } from "./types";
import TuEspejo from "./components/TuEspejo";
import TuArmario from "./components/TuArmario";
import AsesoramientoLooks from "./components/AsesoramientoLooks";
import HistorialLooks from "./components/HistorialLooks";
import AuditoriaArmario from "./components/AuditoriaArmario";
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
import { Sparkles, LogOut, Cloud, CloudOff, RefreshCw, Database, Scissors, Shirt, History, ClipboardList } from "lucide-react";
import { motion } from "motion/react";

type ActiveTab = "espejo" | "armario" | "asesor" | "historial" | "auditoria";

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isAuthMock, setIsAuthMock] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Bottom Navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>("espejo");

  // Normal App States
  const [rostro, setRostro] = useState<Rostro | null>(null);
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [historial, setHistorial] = useState<HistorialLook[]>([]);
  const [selectedHistorialItem, setSelectedHistorialItem] = useState<HistorialLook | null>(null);

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
    setIsAuthMock(false);
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
    <div className="grain min-h-screen bg-fondo text-tinta font-sans relative pb-32 selection:bg-laton selection:text-fondo">
      {/* Background radial highlight matching luxurious brass lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-radial from-laton/5 via-transparent to-transparent pointer-events-none" />

      {/* Main Container bento styled */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 space-y-12">
        
        {/* User profile & sync indicator bar inside page layout */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-tarjeta/60 border border-linea rounded-lg p-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded bg-fondo text-laton border border-linea">
              {isSupabaseConfigured && !isAuthMock ? <Cloud size={12} /> : <CloudOff size={11} />}
            </span>
            <div className="text-left">
              <p className="text-[10px] text-tinta-apagada font-bold uppercase tracking-wider leading-none">
                {isSupabaseConfigured && !isAuthMock ? "ATELIER CLOUD ACTIVO" : "ATELIER DEMO SECRETO"}
              </p>
              <p className="text-[11px] font-mono text-tinta font-medium leading-tight max-w-[220px] truncate">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {isSupabaseConfigured && !isAuthMock ? (
              <span className="text-[9.5px] uppercase tracking-widest text-emerald-400 bg-emerald-950/20 px-2 py-0.5 border border-emerald-900/40 rounded font-bold">
                Nube Sincronizada
              </span>
            ) : (
              <span className="text-[9.5px] uppercase tracking-widest text-amber-400 bg-amber-950/20 px-2 py-0.5 border border-amber-900/40 rounded font-bold">
                Memoria Local
              </span>
            )}

            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-fondo border border-linea hover:border-red-900 text-tinta-apagada hover:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-1.5 transition button-press"
            >
              <LogOut size={11} /> Salir
            </button>
          </div>
        </div>

        {/* Header - Orchestrated Fade in No.1 */}
        <motion.header
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8 }}
          className="text-center relative pb-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-tarjeta/60 border border-linea rounded mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-laton animate-ping" />
            <span className="text-[10px] tracking-widest text-laton uppercase font-medium">Estilista Virtual de Lujo</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-black tracking-tight text-tinta select-none uppercase">
            Espejo
          </h1>
          
          {/* Accent Line */}
          <div className="w-20 h-px bg-laton mx-auto mt-3 mb-4 opacity-70" />

          <p className="font-sans text-xs sm:text-sm uppercase tracking-widest text-tinta-apagada font-normal max-w-lg mx-auto leading-relaxed">
            Asesor de imagen masculina confidencial. Calibra tu corte de pelo, barba y coordina looks impecables usando las prendas reales de tu armario.
          </p>
        </motion.header>

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
              />
            </motion.div>
          )}
        </div>

        {/* Clear Data Reset */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center pt-8 border-t border-linea"
        >
          <button
            type="button"
            id="boton-limpiar-aplicacion"
            onClick={handleResetApp}
            className="button-press border border-linea hover:border-red-900/40 text-tinta-apagada hover:text-red-400 font-sans text-[11px] uppercase tracking-wider px-4 py-2 bg-tarjeta/15 rounded animate-duration-300"
          >
            Restaurar Aplicación (Vaciar Datos de este Atelier)
          </button>
        </motion.div>

        {/* Footnote */}
        <footer className="text-center pt-8 text-[11px] font-sans text-tinta-apagada/50 leading-relaxed max-w-sm mx-auto select-none">
          <p className="font-serif italic font-medium text-laton">ESPEJO</p>
          <p>Barbería & Sastrería Digital Inteligente con Gemini AI.</p>
          <p className="mt-1">© 2026. Todos los derechos reservados.</p>
        </footer>

      </main>

      {/* Floating Bottom Nav Dock */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg bg-tarjeta/95 backdrop-blur-md border border-linea/80 rounded-full px-3 py-2.5 shadow-[0_10px_25px_rgba(0,0,0,0.8)] flex justify-around items-center">
        <button
          onClick={() => setActiveTab("espejo")}
          className={`flex flex-col items-center gap-1 focus:outline-none transition-all ${
            activeTab === "espejo" ? "text-laton scale-105" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <Scissors size={16} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Espejo</span>
        </button>
        
        <button
          onClick={() => setActiveTab("armario")}
          className={`flex flex-col items-center gap-1 focus:outline-none transition-all ${
            activeTab === "armario" ? "text-laton scale-105" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <Shirt size={16} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Armario</span>
        </button>
        
        <button
          onClick={() => setActiveTab("asesor")}
          className={`flex flex-col items-center gap-1 focus:outline-none transition-all ${
            activeTab === "asesor" ? "text-laton scale-105" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <Sparkles size={16} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Asesoría</span>
        </button>
        
        <button
          onClick={() => setActiveTab("historial")}
          className={`flex flex-col items-center gap-1 focus:outline-none transition-all ${
            activeTab === "historial" ? "text-laton scale-105" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <History size={16} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Historial</span>
        </button>
        
        <button
          onClick={() => setActiveTab("auditoria")}
          className={`flex flex-col items-center gap-1 focus:outline-none transition-all ${
            activeTab === "auditoria" ? "text-laton scale-105" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <ClipboardList size={16} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Auditoría</span>
        </button>
      </div>
    </div>
  );
}
