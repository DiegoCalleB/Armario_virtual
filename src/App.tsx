import { useState, useEffect } from "react";
import { Rostro, Prenda, HistorialLook } from "./types";
import TuEspejo from "./components/TuEspejo";
import TuArmario from "./components/TuArmario";
import AsesoramientoLooks from "./components/AsesoramientoLooks";
import HistorialLooks from "./components/HistorialLooks";
import AuditoriaArmario from "./components/AuditoriaArmario";
import { Sparkles, Eye, Scissors, Bookmark, ShieldAlert, Check } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [rostro, setRostro] = useState<Rostro | null>(() => {
    try {
      const saved = localStorage.getItem("espejo_rostro");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [prendas, setPrendas] = useState<Prenda[]>(() => {
    try {
      const saved = localStorage.getItem("espejo_prendas");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [historial, setHistorial] = useState<HistorialLook[]>(() => {
    try {
      const saved = localStorage.getItem("espejo_historial");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedHistorialItem, setSelectedHistorialItem] = useState<HistorialLook | null>(null);

  // Keep state synchronized with localStorage
  useEffect(() => {
    try {
      if (rostro) {
        localStorage.setItem("espejo_rostro", JSON.stringify(rostro));
      } else {
        localStorage.removeItem("espejo_rostro");
      }
    } catch (e) {
      console.error("Storage error:", e);
    }
  }, [rostro]);

  useEffect(() => {
    try {
      localStorage.setItem("espejo_prendas", JSON.stringify(prendas));
    } catch (e) {
      console.error("Storage error:", e);
    }
  }, [prendas]);

  useEffect(() => {
    try {
      localStorage.setItem("espejo_historial", JSON.stringify(historial));
    } catch (e) {
      console.error("Storage error:", e);
    }
  }, [historial]);

  const handleAnalizado = (nuevoRostro: Rostro) => {
    setRostro(nuevoRostro);
  };

  const handleBorrarRostro = () => {
    setRostro(null);
  };

  const handlePrendaAgregada = (nuevaPrenda: Prenda) => {
    setPrendas((prev) => [nuevaPrenda, ...prev]);
  };

  const handlePrendaEliminada = (id: string) => {
    setPrendas((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePrendaActualizada = (prendaActualizada: Prenda) => {
    setPrendas((prev) =>
      prev.map((p) => (p.id === prendaActualizada.id ? prendaActualizada : p))
    );
  };

  const handleLooksGenerados = (nuevosLooks: any[], ocasionValor: string, climaValor: string) => {
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

    setHistorial((prev) => [...nuevosItems, ...prev]);
  };

  const handleUpdateLookImg = (lookTitle: string, imageUrl: string, ocasionValue: string, climaValue: string, isFullBody?: boolean) => {
    setHistorial((prev) =>
      prev.map((item) => {
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
      })
    );
  };

  const handleEliminarHistorial = (id: string) => {
    setHistorial((prev) => prev.filter((item) => item.id !== id));
    if (selectedHistorialItem?.id === id) {
      setSelectedHistorialItem(null);
    }
  };

  const handleToggleFavorito = (id: string) => {
    setHistorial((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, favorito: !item.favorito };
        }
        return item;
      })
    );
  };

  const handleSeleccionarHistorial = (item: HistorialLook) => {
    setSelectedHistorialItem(item);
    const section = document.getElementById("asesoramiento-looks-sección");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Reset entire application data for clean slate
  const handleResetApp = () => {
    if (window.confirm("¿Seguro que deseas vaciar tu Espejo, Armario e Historial? Esta acción es irreversible.")) {
      setRostro(null);
      setPrendas([]);
      setHistorial([]);
      setSelectedHistorialItem(null);
      localStorage.removeItem("espejo_rostro");
      localStorage.removeItem("espejo_prendas");
      localStorage.removeItem("espejo_historial");
    }
  };

  return (
    <div className="grain min-h-screen bg-fondo text-tinta font-sans relative pb-16 selection:bg-laton selection:text-fondo">
      {/* Background radial highlight matching luxurious brass lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-radial from-laton/5 via-transparent to-transparent pointer-events-none" />

      {/* Main Container bento styled */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 space-y-12">
        
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

        {/* Section 01: Tu Espejo - Orchestrated Entrance No.2 (~70ms gap) */}
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8, delay: 0.07 }}
          className="relative"
        >
          <TuEspejo
            rostro={rostro}
            onAnalizado={handleAnalizado}
            onBorrar={handleBorrarRostro}
          />
        </motion.div>

        {/* Section 02: Tu Armario - Orchestrated Entrance No.3 (~140ms gap) */}
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8, delay: 0.14 }}
        >
          <TuArmario
            prendas={prendas}
            onPrendaAgregada={handlePrendaAgregada}
            onPrendaEliminada={handlePrendaEliminada}
            onPrendaActualizada={handlePrendaActualizada}
          />
        </motion.div>

        {/* Section 03: Event Looks - Orchestrated Entrance No.4 (~210ms gap) */}
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8, delay: 0.21 }}
        >
          <AsesoramientoLooks
            armario={prendas}
            rostro={rostro}
            selectedHistorialItem={selectedHistorialItem}
            onLooksGenerados={handleLooksGenerados}
            onUpdateLookImg={handleUpdateLookImg}
          />
        </motion.div>

        {/* Section 04: Historial de Looks - Orchestrated Entrance No.5 (~280ms gap) */}
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8, delay: 0.28 }}
        >
          <HistorialLooks
            historial={historial}
            armario={prendas}
            onEliminar={handleEliminarHistorial}
            onToggleFavorito={handleToggleFavorito}
            onSeleccionar={handleSeleccionarHistorial}
          />
        </motion.div>

        {/* Section 05: Auditoría Inteligente de Armario y Vinted - Orchestrated Entrance No.6 (~350ms gap) */}
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.8, delay: 0.35 }}
        >
          <AuditoriaArmario
            armario={prendas}
            rostro={rostro}
            onPrendaEliminada={handlePrendaEliminada}
          />
        </motion.div>

        {/* Clear Data Reset */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center pt-8 border-t border-linea"
        >
          <button
            type="button"
            id="boton-limpiar-aplicacion"
            onClick={handleResetApp}
            className="button-press border border-linea hover:border-red-900/40 text-tinta-apagada hover:text-red-400 font-sans text-[11px] uppercase tracking-wider px-4 py-2 bg-tarjeta/15 rounded"
          >
            Restaurar Aplicación (Vaciar Datos)
          </button>
        </motion.div>

        {/* Footnote */}
        <footer className="text-center pt-8 text-[11px] font-sans text-tinta-apagada/50 leading-relaxed max-w-sm mx-auto select-none">
          <p className="font-serif italic font-medium text-laton">ESPEJO</p>
          <p>Barbería & Sastrería Digital Inteligente con Gemini AI.</p>
          <p className="mt-1">© 2026. Todos los derechos reservados.</p>
        </footer>

      </main>
    </div>
  );
}
