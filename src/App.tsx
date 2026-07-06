import { useState, useEffect } from "react";
import { Rostro, Prenda, HistorialLook, PerfilEstilo, Look, LookPlanificado } from "./types";
import TuEspejo from "./components/TuEspejo";
import TuArmario from "./components/TuArmario";
import AsesoramientoLooks from "./components/AsesoramientoLooks";
import HistorialLooks from "./components/HistorialLooks";
import AuditoriaArmario from "./components/AuditoriaArmario";
import AsistenteMaleta from "./components/AsistenteMaleta";
import AsesorCompras from "./components/AsesorCompras";
import DiagnosticoEstilo from "./components/DiagnosticoEstilo";
import PlanificadorLooks from "./components/PlanificadorLooks";
import EstadisticasSostenibilidad from "./components/EstadisticasSostenibilidad";
import Login from "./components/Login";
import { publishWardrobeToRegistry } from "./utils/share";
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
  resetUserAllData,
  fetchUserPerfil,
  saveUserPerfil,
  fetchUserPlanificaciones,
  saveUserPlanificacion,
  deleteUserPlanificacion
} from "./supabase";
import { Sparkles, LogOut, Cloud, CloudOff, RefreshCw, Database, Scissors, Shirt, History, ClipboardList, Briefcase, TrendingUp, Sliders, Menu, AlertTriangle, X, Check, Copy, Calendar, Coins } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ActiveTab = "espejo" | "armario" | "asesor" | "historial" | "auditoria" | "maleta" | "compras" | "diagnostico" | "planificador" | "costeperwear";

function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    const isQuotaError = 
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014;

    if (isQuotaError) {
      console.warn("localStorage quota exceeded for key:", key, ". Attempting mitigation...");

      if (key.includes("espejo_historial")) {
        try {
          const items = JSON.parse(value);
          if (Array.isArray(items) && items.length > 0) {
            let prunedItems = [...items];
            
            // Limit length
            if (prunedItems.length > 3) {
              const favorites = prunedItems.filter(item => item.favorito);
              const nonFavorites = prunedItems.filter(item => !item.favorito);
              const maxNonFavs = Math.max(1, 3 - favorites.length);
              const allowedNonFavs = nonFavorites.slice(0, maxNonFavs);
              prunedItems = [...allowedNonFavs, ...favorites].sort((a, b) => b.id.localeCompare(a.id));
            }

            // Strip out large base64 image simulations for non-favorites (or older items)
            prunedItems = prunedItems.map((item, idx) => {
              if (idx > 0 && !item.favorito) {
                return {
                  ...item,
                  look: {
                    ...item.look,
                    simulatedImageUrl: undefined,
                    simulatedFullBodyImageUrl: undefined
                  }
                };
              }
              return item;
            });

            const prunedValue = JSON.stringify(prunedItems);
            try {
              localStorage.setItem(key, prunedValue);
              console.log("Pruned history saved successfully under key:", key);
              return true;
            } catch (innerErr) {
              // If still failing, drop base64 image strings completely for ALL except the absolute first one
              const ultraPruned = prunedItems.map((item, idx) => {
                if (idx > 0) {
                  return {
                    ...item,
                    look: {
                      ...item.look,
                      simulatedImageUrl: undefined,
                      simulatedFullBodyImageUrl: undefined
                    }
                  };
                }
                return item;
              });
              try {
                localStorage.setItem(key, JSON.stringify(ultraPruned));
                console.log("Ultra-pruned history saved successfully under key:", key);
                return true;
              } catch (extremeErr) {
                try {
                  localStorage.setItem(key, JSON.stringify(prunedItems.slice(0, 1)));
                  return true;
                } catch (e) {}
              }
            }
          }
        } catch (parseErr) {
          console.error("Error parsing history in mitigation:", parseErr);
        }
      }

      // Try cleaning up old unneeded storage keys
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key) {
            if (k.includes("usr_guest") || k.includes("auditoria") || k.includes("perfil")) {
              keysToRemove.push(k);
            }
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, value);
        return true;
      } catch (cleaningErr) {
        console.error("Failed to clean secondary keys for storage:", cleaningErr);
      }
    }
    console.error("Failed to store key:", key, error);
    return false;
  }
}

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
  const [planificaciones, setPlanificaciones] = useState<LookPlanificado[]>([]);
  
  // Style Profile State
  const [perfilEstilo, setPerfilEstilo] = useState<PerfilEstilo | null>(null);

  const handleAgregarPlanificacion = (plan: LookPlanificado) => {
    setPlanificaciones((prev) => {
      const updated = [...prev, plan];
      if (user) {
        safeSetLocalStorage(`espejo_plan_semanal_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    if (user && isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
      saveUserPlanificacion(user.id, plan).catch(e => console.error("Error saving plan:", e));
    }
  };

  const handleEliminarPlanificacion = (id: string) => {
    setPlanificaciones((prev) => {
      const updated = prev.filter(p => p.id !== id);
      if (user) {
        safeSetLocalStorage(`espejo_plan_semanal_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    if (user && isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
      deleteUserPlanificacion(user.id, id).catch(e => console.error("Error deleting plan:", e));
    }
  };

  const handleMarcarComoVestido = (prendasIds: string[]) => {
    setPrendas((prev) => {
      const updated = prev.map((p) => {
        if (prendasIds.includes(p.id)) {
          return {
            ...p,
            veces_puesto: (p.veces_puesto ?? 0) + 1
          };
        }
        return p;
      });
      if (user) {
        safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          updated.forEach(async (p) => {
            if (prendasIds.includes(p.id)) {
              await updateUserPrenda(user.id, p).catch(e => console.error("Failed to update garment count in db:", e));
            }
          });
        }
      }
      return updated;
    });
  };

  const handleActualizarPrenda = (id: string, updates: Partial<Prenda>) => {
    setPrendas((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const item = { ...p, ...updates };
          if (user && isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
            updateUserPrenda(user.id, item).catch(e => console.error("Failed to sync garment updates in db:", e));
          }
          return item;
        }
        return p;
      });
      if (user) {
        safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Storage bucket RLS/error state
  const [storageError, setStorageError] = useState<{ error: string; buckets: string[] } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedSecureSql, setCopiedSecureSql] = useState(false);

  // Mobile drawer state
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Listen to Supabase storage upload errors to notify RLS instructions
  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const customEvent = e as CustomEvent;
      setStorageError({
        error: customEvent.detail?.error || "Error desconocido",
        buckets: customEvent.detail?.buckets || ["prendas", "prendas-imagenes"]
      });
    };
    window.addEventListener("supabase-storage-error", handleStorageError);
    return () => {
      window.removeEventListener("supabase-storage-error", handleStorageError);
    };
  }, []);

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

  // Handle automatic closure and synchronization if this is an OAuth popup window
  useEffect(() => {
    const isOAuthPopup = window.opener && (
      window.name === "supabase_oauth_popup" ||
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("id_token=") ||
      window.location.hash.includes("error_description=") ||
      window.location.search.includes("code=")
    );

    if (isOAuthPopup) {
      console.log("OAuth popup detected. Syncing session and self-closing...");
      const timer = setTimeout(() => {
        try {
          window.opener.postMessage("supabase-oauth-success", "*");
          window.close();
        } catch (err) {
          console.error("Failed to post message or close popup:", err);
          try {
            window.close();
          } catch (_) {}
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Sync user state changes (fetching database or local backup on Login / Load)
  useEffect(() => {
    if (!user) return;

    async function loadUserData() {
      setIsDataLoading(true);
      try {
        // Load local style profile first as a quick start
        const dbPerfilKey = `espejo_perfil_${user.id}`;
        const savedPerfil = localStorage.getItem(dbPerfilKey);
        setPerfilEstilo(savedPerfil ? JSON.parse(savedPerfil) : null);

        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          // Cloud Supabase sync
          let dbRostro: Rostro | null = null;
          let dbPrendas: Prenda[] = [];
          let dbHistorial: HistorialLook[] = [];
          let dbPerfil: PerfilEstilo | null = null;
          let dbPlanificaciones: LookPlanificado[] = [];

          try {
            const results = await Promise.allSettled([
              fetchUserRostro(user.id),
              fetchUserPrendas(user.id),
              fetchUserHistorial(user.id),
              fetchUserPerfil(user.id),
              fetchUserPlanificaciones(user.id)
            ]);

            if (results[0].status === "fulfilled") {
              dbRostro = results[0].value as Rostro | null;
            }
            if (results[1].status === "fulfilled") {
              dbPrendas = (results[1].value as Prenda[]) || [];
            }
            if (results[2].status === "fulfilled") {
              dbHistorial = (results[2].value as HistorialLook[]) || [];
            }
            if (results[3].status === "fulfilled") {
              dbPerfil = results[3].value as PerfilEstilo | null;
            }
            if (results[4].status === "fulfilled") {
              dbPlanificaciones = (results[4].value as LookPlanificado[]) || [];
            }
          } catch (syncErr) {
            console.error("Supabase load error, falling back:", syncErr);
          }

          // Force load representation from local storage cache if the database returned empty/failed
          const cachedRostro = localStorage.getItem(`espejo_rostro_${user.id}`);
          const cachedPrendas = localStorage.getItem(`espejo_prendas_${user.id}`);
          const cachedHistorial = localStorage.getItem(`espejo_historial_${user.id}`);
          const cachedPerfil = localStorage.getItem(`espejo_perfil_${user.id}`);
          const cachedPlanes = localStorage.getItem(`espejo_plan_semanal_${user.id}`);

          if (!dbRostro && cachedRostro) {
            try { dbRostro = JSON.parse(cachedRostro); } catch (_) {}
          }
          if (dbPrendas.length === 0 && cachedPrendas) {
            try {
              const parsed = JSON.parse(cachedPrendas);
              if (Array.isArray(parsed) && parsed.length > 0) {
                dbPrendas = parsed;
              }
            } catch (_) {}
          }
          if (dbHistorial.length === 0 && cachedHistorial) {
            try {
              const parsed = JSON.parse(cachedHistorial);
              if (Array.isArray(parsed) && parsed.length > 0) {
                dbHistorial = parsed;
              }
            } catch (_) {}
          }
          if (!dbPerfil && cachedPerfil) {
            try { dbPerfil = JSON.parse(cachedPerfil); } catch (_) {}
          }
          if (dbPlanificaciones.length === 0 && cachedPlanes) {
            try {
              const parsed = JSON.parse(cachedPlanes);
              if (Array.isArray(parsed) && parsed.length > 0) {
                dbPlanificaciones = parsed;
              }
            } catch (_) {}
          }
          
          // Auto-migrate from guest local session if the Cloud account starts completely empty
          if (dbPrendas.length === 0) {
            const guestPrendas = localStorage.getItem("espejo_prendas_usr_guest");
            if (guestPrendas) {
              const parsedGuest = JSON.parse(guestPrendas);
              if (parsedGuest.length > 0) {
                dbPrendas = [];
                for (const p of parsedGuest) {
                  try {
                    const saved = await saveUserPrenda(user.id, p);
                    dbPrendas.push(saved);
                  } catch (e) {
                    console.error("Migration error for garment:", e);
                    dbPrendas.push(p);
                  }
                }
              }
            }
          }

          if (!dbRostro) {
            const guestRostro = localStorage.getItem("espejo_rostro_usr_guest");
            if (guestRostro) {
              const parsedRostro = JSON.parse(guestRostro);
              if (parsedRostro) {
                try {
                  dbRostro = await saveUserRostro(user.id, parsedRostro);
                } catch (e) {
                  console.error("Migration error for rostro:", e);
                  dbRostro = parsedRostro;
                }
              }
            }
          }

          if (dbHistorial.length === 0) {
            const guestHistorial = localStorage.getItem("espejo_historial_usr_guest");
            if (guestHistorial) {
              const parsedGuestHist = JSON.parse(guestHistorial);
              if (parsedGuestHist.length > 0) {
                dbHistorial = parsedGuestHist;
                await saveMultipleUserHistorialItems(user.id, dbHistorial).catch(e => console.error(e));
              }
            }
          }

          // Enrich wardrobe with default prices/usages for immediate premium financial stats
          const enrichedPrendas = dbPrendas.map((p, idx) => ({
            ...p,
            precio_compra: p.precio_compra ?? [145, 89, 185, 45, 220, 75][idx % 6],
            veces_puesto: p.veces_puesto ?? [8, 14, 1, 0, 19, 3][idx % 6],
            composicion_tejido: p.composicion_tejido || p.tejido || ["100% Lana de Sastre", "100% Algodón Egipcio", "Cuero Premium", "Mezcla de Lino", "Ante Italiano", "Sarga Fina"][idx % 6]
          }));

          // Load weekly plan
          const planKey = `espejo_plan_semanal_${user.id}`;
          if (dbPlanificaciones.length === 0 && enrichedPrendas.length > 0) {
            // Generate some elegant default plans for the current week
            const todayStr = new Date().toISOString().split("T")[0];
            dbPlanificaciones = [
              {
                id: "plan_default_1",
                fecha: todayStr,
                nombre_look: "Reunión Ejecutiva & Almuerzo",
                prendasIds: enrichedPrendas.slice(0, 3).map(p => p.id),
                clima_simulado: {
                  temp: 17,
                  condicion: "nublado",
                  ciudad: "Madrid"
                },
                comentarios_sastre: "Atelier climatológico (Madrid, 17°C): El blazer desestructurado en sintonía de lana es idóneo para el viento fresco de la capital. Resguardo óptimo."
              }
            ];
            safeSetLocalStorage(planKey, JSON.stringify(dbPlanificaciones));
            await saveUserPlanificacion(user.id, dbPlanificaciones[0]).catch(e => console.error(e));
          }

          // Update local cache for safety and offline work
          if (dbRostro) {
            safeSetLocalStorage(`espejo_rostro_${user.id}`, JSON.stringify(dbRostro));
          }
          if (enrichedPrendas.length > 0) {
            safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(enrichedPrendas));
          }
          if (dbHistorial.length > 0) {
            safeSetLocalStorage(`espejo_historial_${user.id}`, JSON.stringify(dbHistorial));
          }
          if (dbPerfil) {
            safeSetLocalStorage(`espejo_perfil_${user.id}`, JSON.stringify(dbPerfil));
          }
          if (dbPlanificaciones.length > 0) {
            safeSetLocalStorage(planKey, JSON.stringify(dbPlanificaciones));
          }
          
          setRostro(dbRostro);
          setPrendas(enrichedPrendas);
          setHistorial(dbHistorial);
          setPerfilEstilo(dbPerfil);
          setPlanificaciones(dbPlanificaciones);
        } else {
          // Local storage user-specific sync
          const rostroKey = `espejo_rostro_${user.id}`;
          const prendasKey = `espejo_prendas_${user.id}`;
          const historialKey = `espejo_historial_${user.id}`;
          const planKey = `espejo_plan_semanal_${user.id}`;

          let finalRostro = localStorage.getItem(rostroKey);
          let finalPrendas = localStorage.getItem(prendasKey);
          let finalHistorial = localStorage.getItem(historialKey);
          let finalPlanes = localStorage.getItem(planKey);

          let parsedRostro = finalRostro ? JSON.parse(finalRostro) : null;
          let parsedPrendas = finalPrendas ? JSON.parse(finalPrendas) : [];
          let parsedHistorial = finalHistorial ? JSON.parse(finalHistorial) : [];
          let parsedPlanes = finalPlanes ? JSON.parse(finalPlanes) : [];

          // Auto-migrate Guest local data to the newly logged-in/registered mock user
          if (user.id !== "usr_guest") {
            const guestPrendas = localStorage.getItem("espejo_prendas_usr_guest");
            const guestRostro = localStorage.getItem("espejo_rostro_usr_guest");
            const guestHistorial = localStorage.getItem("espejo_historial_usr_guest");

            if (parsedPrendas.length === 0 && guestPrendas) {
              const parsedGuest = JSON.parse(guestPrendas);
              if (parsedGuest.length > 0) {
                parsedPrendas = parsedGuest;
                safeSetLocalStorage(prendasKey, JSON.stringify(parsedPrendas));
              }
            }

            if (!parsedRostro && guestRostro) {
              parsedRostro = JSON.parse(guestRostro);
              safeSetLocalStorage(rostroKey, JSON.stringify(parsedRostro));
            }

            if (parsedHistorial.length === 0 && guestHistorial) {
              const parsedGuestHist = JSON.parse(guestHistorial);
              if (parsedGuestHist.length > 0) {
                parsedHistorial = parsedGuestHist;
                safeSetLocalStorage(historialKey, JSON.stringify(parsedHistorial));
              }
            }
          }

          // Enrich local wardrobe items with default prices and textiles
          const enrichedLocalPrendas = parsedPrendas.map((p: any, idx: number) => ({
            ...p,
            precio_compra: p.precio_compra ?? [145, 89, 185, 45, 220, 75][idx % 6],
            veces_puesto: p.veces_puesto ?? [8, 14, 1, 0, 19, 3][idx % 6],
            composicion_tejido: p.composicion_tejido || p.tejido || ["100% Lana de Sastre", "100% Algodón Egipcio", "Cuero Premium", "Mezcla de Lino", "Ante Italiano", "Sarga Fina"][idx % 6]
          }));

          if (parsedPlanes.length === 0 && enrichedLocalPrendas.length > 0) {
            const todayStr = new Date().toISOString().split("T")[0];
            parsedPlanes = [
              {
                id: "plan_default_1",
                fecha: todayStr,
                nombre_look: "Reunión Ejecutiva & Almuerzo",
                prendasIds: enrichedLocalPrendas.slice(0, 3).map((p: any) => p.id),
                clima_simulado: {
                  temp: 17,
                  condicion: "nublado",
                  ciudad: "Madrid"
                },
                comentarios_sastre: "Atelier climatológico (Madrid, 17°C): El blazer desestructurado en sintonía de lana es idóneo para el viento fresco de la capital. Resguardo óptimo."
              }
            ];
            safeSetLocalStorage(planKey, JSON.stringify(parsedPlanes));
          }

          setRostro(parsedRostro);
          setPrendas(enrichedLocalPrendas);
          setHistorial(parsedHistorial);
          setPlanificaciones(parsedPlanes);
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

  const handlePerfilGuardado = async (nuevoPerfil: PerfilEstilo) => {
    setPerfilEstilo(nuevoPerfil);
    if (user) {
      safeSetLocalStorage(`espejo_perfil_${user.id}`, JSON.stringify(nuevoPerfil));
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        try {
          await saveUserPerfil(user.id, nuevoPerfil);
        } catch (err) {
          console.error("Error saving style profile to Supabase:", err);
        }
      }
    }
  };

  const handleAnalizado = async (nuevoRostro: Rostro) => {
    setRostro(nuevoRostro);
    if (user) {
      // Local backup first (Always)
      safeSetLocalStorage(`espejo_rostro_${user.id}`, JSON.stringify(nuevoRostro));
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        try {
          const savedRostro = await saveUserRostro(user.id, nuevoRostro);
          setRostro(savedRostro);
          safeSetLocalStorage(`espejo_rostro_${user.id}`, JSON.stringify(savedRostro));
        } catch (err) {
          console.error("Error saving rostro:", err);
        }
      }
    }
  };

  const handleBorrarRostro = async () => {
    setRostro(null);
    if (user) {
      localStorage.removeItem(`espejo_rostro_${user.id}`);
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await deleteUserRostro(user.id);
      }
    }
  };

  const handlePrendaAgregada = async (nuevaPrendaOrArray: Prenda | Prenda[]) => {
    const nuevas = Array.isArray(nuevaPrendaOrArray) ? nuevaPrendaOrArray : [nuevaPrendaOrArray];
    if (nuevas.length === 0) return;

    // Primero agregamos localmente para visualización instantánea (Base64)
    setPrendas((prev) => {
      const filteredPrev = prev.filter(p => !nuevas.some(n => n.id === p.id));
      const updated = [...nuevas, ...filteredPrev];
      if (user) {
        safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (user && isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
      const updatedPrendasWithUrls: Prenda[] = [];
      for (const p of nuevas) {
        try {
          const saved = await saveUserPrenda(user.id, p);
          updatedPrendasWithUrls.push(saved);
        } catch (dbErr) {
          console.error("Error guardando prenda en DB:", dbErr);
          updatedPrendasWithUrls.push(p);
        }
      }

      // Reemplazamos las prendas locales con la versión que tiene URL pública del Storage
      setPrendas((prev) => {
        const updated = prev.map(p => {
          const matchingUpdated = updatedPrendasWithUrls.find(u => u.id === p.id);
          return matchingUpdated ? matchingUpdated : p;
        });
        safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handlePrendaEliminada = async (id: string) => {
    const updated = prendas.filter((p) => p.id !== id);
    setPrendas(updated);
    if (user) {
      safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await deleteUserPrenda(user.id, id);
      }
    }
  };

  const handlePrendaActualizada = async (prendaActualizada: Prenda) => {
    // Primero actualizamos localmente
    setPrendas((prev) => {
      const updated = prev.map((p) => (p.id === prendaActualizada.id ? prendaActualizada : p));
      if (user) {
        safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (user && isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
      try {
        const saved = await updateUserPrenda(user.id, prendaActualizada);
        // Actualizamos de nuevo con la URL final del storage
        setPrendas((prev) => {
          const updated = prev.map((p) => (p.id === saved.id ? saved : p));
          safeSetLocalStorage(`espejo_prendas_${user.id}`, JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error("Error updating prenda:", err);
      }
    }
  };

  // Automatically publish user's wardrobe to shared registry whenever it changes
  useEffect(() => {
    if (user && user.email) {
      publishWardrobeToRegistry(user.email, user.id, prendas);
    }
  }, [user, prendas]);

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
      safeSetLocalStorage(`espejo_historial_${user.id}`, JSON.stringify(updated));
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await saveMultipleUserHistorialItems(user.id, nuevosItems);
      }
    }
  };

  const handleUpdateLookImg = async (updatedLook: Look, ocasionValue: string, climaValue: string, isFullBody?: boolean) => {
    const oVal = ocasionValue || "Uso Diario / Casual";
    const cVal = climaValue || "Templado";
    const lookTitle = updatedLook.titulo;

    const matchedIdx = historial.findIndex((item) => 
      item.ocasion === oVal &&
      item.clima === cVal &&
      item.look.titulo === lookTitle
    );

    let updatedHistorial = [...historial];

    if (matchedIdx !== -1) {
      const existingItem = updatedHistorial[matchedIdx];
      const nextLook = {
        ...existingItem.look,
        ...updatedLook
      };
      
      updatedHistorial[matchedIdx] = {
        ...existingItem,
        look: nextLook
      };
      setHistorial(updatedHistorial);

      if (user) {
        safeSetLocalStorage(`espejo_historial_${user.id}`, JSON.stringify(updatedHistorial));
        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          const imgUrl = isFullBody ? nextLook.simulatedFullBodyImageUrl : nextLook.simulatedImageUrl;
          if (imgUrl) {
            await updateUserHistorialItemImage(user.id, existingItem.id, !!isFullBody, imgUrl);
          }
        }
      }
    } else {
      // It does not exist yet (e.g. they projected an instant look!). Create on the fly!
      const fechaActual = new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const newItem: HistorialLook = {
        id: `look_${Date.now()}_instant_${Math.floor(Math.random() * 1000)}`,
        fecha: fechaActual,
        ocasion: oVal,
        clima: cVal,
        look: updatedLook,
        favorito: false
      };

      updatedHistorial = [newItem, ...updatedHistorial];
      setHistorial(updatedHistorial);

      if (user) {
        safeSetLocalStorage(`espejo_historial_${user.id}`, JSON.stringify(updatedHistorial));
        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          await saveMultipleUserHistorialItems(user.id, [newItem]);
        }
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
      safeSetLocalStorage(`espejo_historial_${user.id}`, JSON.stringify(updated));
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        await deleteUserHistorialItem(user.id, id);
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
      safeSetLocalStorage(`espejo_historial_${user.id}`, JSON.stringify(updated));
      if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
        if (matched) {
          await toggleUserHistorialItemFavorito(user.id, id, !matched.favorito);
        }
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
        localStorage.removeItem(`espejo_rostro_${user.id}`);
        localStorage.removeItem(`espejo_prendas_${user.id}`);
        localStorage.removeItem(`espejo_historial_${user.id}`);
        if (isSupabaseConfigured && !isAuthMock && user.id !== "usr_guest" && !user.id.startsWith("usr_mock")) {
          await resetUserAllData(user.id);
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
          <h2 className="font-serif text-xl font-bold uppercase tracking-widest text-[#09090B]">
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
      <aside className="hidden lg:flex flex-col w-72 h-screen fixed top-0 left-0 bg-tarjeta border-r border-linea z-40 p-6 flex-shrink-0 justify-between">
        <div className="space-y-8 overflow-y-auto no-scrollbar py-2">
          {/* Brand/Logo */}
          <div className="text-left py-2 border-b border-linea pb-4">
            <span className="text-[10px] tracking-widest text-laton uppercase font-bold block mb-1">ATELIER ESPEJO</span>
            <h1 className="font-serif text-xl sm:text-2xl font-black tracking-tight text-tinta uppercase select-none leading-tight">
              Armario Digital
            </h1>
            <p className="font-sans text-[9px] tracking-wider text-tinta-apagada uppercase mt-1">Estilismo & Imagen Personal IA</p>
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
              { id: "armario", label: "Tú Armario", desc: "Digital & Inteligente", icon: Shirt },
              { id: "asesor", label: "✨ Probador IA", desc: "Pruébate Ropa con IA", icon: Sparkles },
              { id: "historial", label: "Catálogo Looks", desc: "Historial Guardado", icon: History },
              { id: "espejo", label: "Tú Espejo", desc: "Análisis Fisiognómico", icon: Scissors },
              { id: "diagnostico", label: "ADN Estilo", desc: "Preferencias y Silueta", icon: Sliders },
              { id: "planificador", label: "Agenda Looks", desc: "Agenda de Estilo & Clima", icon: Calendar },
              { id: "costeperwear", label: "CPW & Sostenibilidad", desc: "Rentabilidad & Tejidos", icon: Coins },
              { id: "maleta", label: "Equipaje Smart", desc: "Cápsula de Viajes", icon: Briefcase },
              { id: "compras", label: "Tendencias", desc: "Asesor de Compras", icon: TrendingUp },
              { id: "auditoria", label: "Plan Auditoría", desc: "Auditar Mi Armario", icon: ClipboardList }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`group w-full flex items-center gap-3.5 px-4 py-2.5 rounded text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-laton/15 border-l-2 border-laton text-laton font-medium shadow-md shadow-amber-950/5"
                      : "text-tinta-apagada hover:text-tinta hover:bg-fondo2 border-l-2 border-transparent"
                  }`}
                >
                  <Icon size={15} className={isSelected ? "text-laton animate-pulse" : "text-tinta-apagada group-hover:text-tinta"} />
                  <div className="leading-tight">
                    <p className={`text-[11px] uppercase tracking-wider font-bold ${isSelected ? "text-tinta" : "group-hover:text-tinta"}`}>
                      {tab.label}
                    </p>
                    <p className="text-[9px] text-[#52525B]/70 font-mono">
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
            <h1 className="font-serif text-sm font-black uppercase tracking-wider text-[#09090B]">
              ARMARIO INTELIGENTE
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

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-3xl font-extrabold tracking-tight text-tinta select-none uppercase">
              {activeTab === "espejo" && "TÚ ESPEJO VIRTUAL"}
              {activeTab === "armario" && "TÚ ARMARIO DIGITAL"}
              {activeTab === "planificador" && "AGENDA DE LOOKS"}
              {activeTab === "costeperwear" && "COSTE POR USO"}
              {activeTab === "asesor" && "✨ PROBADOR IA"}
              {activeTab === "historial" && "HISTORIAL DE LOOKS"}
              {activeTab === "auditoria" && "AUDITORÍA"}
              {activeTab === "maleta" && "EQUIPAJE SMART"}
              {activeTab === "compras" && "TENDENCIAS"}
              {activeTab === "diagnostico" && "ADN DE ESTILO"}
            </h1>
            
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#52525B] font-normal max-w-3xl mx-auto mt-2 leading-relaxed">
              {activeTab === "espejo" && "Analiza tu rostro para optimizar tu estilo."}
              {activeTab === "armario" && "Registra tu colección de prendas."}
              {activeTab === "planificador" && "Planifica tus atuendos semanales según el clima."}
              {activeTab === "costeperwear" && "Conoce la rentabilidad y sostenibilidad de tu ropa."}
              {activeTab === "asesor" && "Pruébate cualquier combinación con inteligencia artificial."}
              {activeTab === "historial" && "Guarda tus looks favoritos."}
              {activeTab === "auditoria" && "Analiza lo que realmente usas y lo que te sobra."}
              {activeTab === "maleta" && "Tu cápsula sastrera inteligente para viajar ligero."}
              {activeTab === "compras" && "Prendas recomendadas que encajan con tu perfil."}
              {activeTab === "diagnostico" && "Tu silueta, preferencias y metas estéticas."}
            </p>
          </motion.div>

          {/* Storage Policy Helper Banner */}
          {storageError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-950/20 border border-red-900/40 rounded-xl p-5 space-y-4 text-left shadow-lg overflow-hidden relative z-20"
            >
              <button
                onClick={() => setStorageError(null)}
                className="absolute top-4 right-4 text-tinta-apagada hover:text-white transition cursor-pointer"
                title="Cerrar aviso"
              >
                <X size={16} />
              </button>

              <div className="flex gap-3">
                <span className="p-2 bg-red-900/30 text-red-400 rounded-lg shrink-0 flex items-center justify-center h-10 w-10">
                  <AlertTriangle size={20} />
                </span>
                <div className="space-y-1">
                  <h3 className="font-serif text-sm font-bold tracking-wider text-red-200 uppercase">
                    Error de Almacenamiento
                  </h3>
                  <p className="text-[11px] text-tinta-apagada">
                    No se pudo guardar la imagen de tu prenda en el servidor de almacenamiento. Por favor, comprueba tu conexión o contacta al administrador de tu atelier.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  onClick={() => setStorageError(null)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[10px] uppercase tracking-widest text-tinta-apagada hover:text-white rounded border border-linea/60 cursor-pointer transition font-bold"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          )}

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
                  userEmail={user?.email}
                />
              </motion.div>
            )}

            {activeTab === "planificador" && (
              <motion.div
                key="planificador"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <PlanificadorLooks
                  armario={prendas}
                  historial={historial}
                  planificaciones={planificaciones}
                  onAgregarPlanificacion={handleAgregarPlanificacion}
                  onEliminarPlanificacion={handleEliminarPlanificacion}
                  onMarcarComoVestido={handleMarcarComoVestido}
                />
              </motion.div>
            )}

            {activeTab === "costeperwear" && (
              <motion.div
                key="costeperwear"
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              >
                <EstadisticasSostenibilidad
                  armario={prendas}
                  onActualizarPrenda={handleActualizarPrenda}
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
            <p className="font-serif italic font-medium text-laton">Atelier Espejo</p>
            <p>Atelier de Asesoría de Imagen & Estilismo Digital Inclusivo.</p>
            <p className="mt-0.5 text-laton/80 font-medium">Diseñado y Desarrollado por <span className="font-bold">AIron Labs</span>.</p>
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
                  { id: "planificador", label: "Agenda Looks", desc: "Clima y Agenda", icon: Calendar },
                  { id: "costeperwear", label: "Coste x Uso", desc: "Rentabilidad", icon: Coins },
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
          { id: "armario", label: "Armario", icon: Shirt },
          { id: "asesor", label: "Probador IA", icon: Sparkles },
          { id: "historial", label: "Historial", icon: History },
          { id: "espejo", label: "Espejo", icon: Scissors },
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
            ["diagnostico", "planificador", "costeperwear", "maleta", "compras", "auditoria"].includes(activeTab) || showMoreMenu
              ? "text-laton scale-105 font-bold"
              : "text-tinta-apagada hover:text-white"
          }`}
          title="Opciones adicionales"
        >
          <Menu size={18} className={["diagnostico", "planificador", "costeperwear", "maleta", "compras", "auditoria"].includes(activeTab) || showMoreMenu ? "text-laton animate-pulse" : "text-tinta-apagada"} />
          <span className="text-[8.5px] uppercase tracking-wider font-bold mt-0.5">Más</span>
        </button>
      </nav>
    </div>
  );
}

