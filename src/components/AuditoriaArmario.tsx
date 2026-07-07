import React, { useState, useEffect } from "react";
import { Prenda, Rostro, AuditoriaArmarioResult, AuditoriaPrendaExceso, AuditoriaGap, PerfilEstilo } from "../types";
import { Sparkles, Tag, TrendingUp, AlertCircle, Check, Clipboard, ArrowRight, Hourglass, ExternalLink, RotateCcw, HelpCircle, CornerDownRight, Coins, Percent, Shirt, ChevronRight, ShoppingBag, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AsistenteMaleta from "./AsistenteMaleta";
import AsesorCompras from "./AsesorCompras";

interface AuditoriaArmarioProps {
  armario: Prenda[];
  rostro: Rostro | null;
  onPrendaEliminada: (id: string) => void;
  perfilEstilo?: PerfilEstilo | null;
}

export default function AuditoriaArmario({
  armario,
  rostro,
  onPrendaEliminada,
  perfilEstilo,
}: AuditoriaArmarioProps) {
  const [subTab, setSubTab] = useState<"auditoria" | "maleta" | "compras">("auditoria");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditoriaArmarioResult | null>(() => {
    try {
      const saved = localStorage.getItem("espejo_auditoria");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Saving state
  useEffect(() => {
    if (auditResult) {
      try {
        localStorage.setItem("espejo_auditoria", JSON.stringify(auditResult));
      } catch (e) {
        console.warn("Storage quota exceeded for auditoria. Unable to save audit result.", e);
      }
    } else {
      localStorage.removeItem("espejo_auditoria");
    }
  }, [auditResult]);

  // Vinted Sincronizador states
  const [selectedVintedPrenda, setSelectedVintedPrenda] = useState<Prenda | null>(null);
  const [vintedDraft, setVintedDraft] = useState<{
    titulo: string;
    precio: number;
    descripcion: string;
  } | null>(null);

  const [syncStatus, setSyncStatus] = useState<"idle" | "connecting" | "uploading" | "success">("idle");
  const [copiedText, setCopiedText] = useState(false);
  const [copiedTitulo, setCopiedTitulo] = useState(false);
  const [copiedPrecio, setCopiedPrecio] = useState(false);
  const [copiedDescripcion, setCopiedDescripcion] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const handleAuditar = async () => {
    if (armario.length === 0) {
      setError("Necesitas tener prendas registradas en tu armario para que la IA pueda evaluarlas.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auditar-armario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armario, rostro, perfilEstilo }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo recibir el asesoramiento de auditoría.");
      }

      const data: AuditoriaArmarioResult = await res.json();
      setAuditResult(data);
    } catch (err: any) {
      console.error(err);
      let errorFriendly = err.message || "Fallo en la comunicación con la IA de auditoría.";
      if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
        errorFriendly = "No se pudo conectar con el servidor de Espejo. Por favor, comprueba tu conexión o reinténtalo transcurridos unos segundos.";
      }
      setError(errorFriendly);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVintedCustom = (prenda: Prenda) => {
    const existingSobrante = auditResult?.sobran.find((s) => s.id_prenda === prenda.id);

    if (existingSobrante) {
      setSelectedVintedPrenda(prenda);
      setVintedDraft({
        titulo: existingSobrante.titulo_vinted,
        precio: existingSobrante.precio_sugerido_vinted,
        descripcion: existingSobrante.descripcion_vinted,
      });
    } else {
      // Generate standard fallback info for non-flagged elements
      setSelectedVintedPrenda(prenda);
      setVintedDraft({
        titulo: `Prenda Elegante - ${prenda.nombre}`,
        precio: prenda.formalidad * 15 + 10,
        descripcion: `Magnífico ${prenda.nombre.toLowerCase()} en buen estado. Ideal para estilo casual y combinaciones cómodas.\n\n#slowfashion #estiloymoda #ropadesegundamano #armario`,
      });
    }
    setSyncStatus("idle");
    setActiveStep(0);
  };

  const executeVintedSync = () => {
    setSyncStatus("connecting");
    setActiveStep(0);

    // Beautiful step progression simulating API sync
    const timer1 = setTimeout(() => {
      setActiveStep(1);
    }, 1200);

    const timer2 = setTimeout(() => {
      setSyncStatus("uploading");
      setActiveStep(2);
    }, 2400);

    const timer3 = setTimeout(() => {
      setActiveStep(3);
    }, 3600);

    const timer4 = setTimeout(() => {
      setSyncStatus("success");
    }, 4500);
  };

  const handleCopyDraft = async () => {
    if (!vintedDraft) return;
    const content = `Título: ${vintedDraft.titulo}\nPrecio sugerido: ${vintedDraft.precio}€\n\nDescripción:\n${vintedDraft.descripcion}`;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.error("Error al copiar borrador", err);
    }
  };

  return (
    <section id="auditoria-armario-seccion" className="border-t border-linea pt-8 pb-4">
      {/* Selector de sub-suites de Inteligencia Sastrera */}
      <div className="flex gap-1.5 p-1 bg-fondo border border-linea/60 max-w-lg mx-auto rounded-full mb-8 font-serif text-[10px] uppercase tracking-wider">
        <button
          onClick={() => setSubTab("auditoria")}
          className={`flex-1 text-center py-2 px-3 rounded-full transition-all cursor-pointer font-bold flex items-center justify-center gap-1.5 ${
            subTab === "auditoria" ? "bg-laton/15 text-laton border border-laton/20 shadow-md" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <Clipboard size={12} />
          <span>Auditoría & Vinted</span>
        </button>

        <button
          onClick={() => setSubTab("maleta")}
          className={`flex-1 text-center py-2 px-3 rounded-full transition-all cursor-pointer font-bold flex items-center justify-center gap-1.5 ${
            subTab === "maleta" ? "bg-laton/15 text-laton border border-laton/20 shadow-md" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <Briefcase size={12} />
          <span>Maletas</span>
        </button>

        <button
          onClick={() => setSubTab("compras")}
          className={`flex-1 text-center py-2 px-3 rounded-full transition-all cursor-pointer font-bold flex items-center justify-center gap-1.5 ${
            subTab === "compras" ? "bg-laton/15 text-laton border border-laton/20 shadow-md" : "text-tinta-apagada hover:text-white"
          }`}
        >
          <TrendingUp size={12} />
          <span>Tendencias</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {subTab === "maleta" && (
          <motion.div
            key="maleta"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <AsistenteMaleta armario={armario} perfilEstilo={perfilEstilo} />
          </motion.div>
        )}

        {subTab === "compras" && (
          <motion.div
            key="compras"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <AsesorCompras armario={armario} perfilEstilo={perfilEstilo} />
          </motion.div>
        )}

        {subTab === "auditoria" && (
          <motion.div
            key="auditoria"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-baseline justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="font-serif italic text-laton font-medium text-lg">05</span>
                <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta">Auditoría de tu Armario & Vinted</h2>
              </div>
              <p className="text-xs font-sans text-tinta-apagada select-none font-medium">OPTIMIZER & REDUNDANCIES</p>
            </div>

            {/* Intro pitch explanation */}
      <div className="bg-tarjeta border border-linea rounded p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
          <div className="space-y-1 max-w-xl">
            <h3 className="font-serif text-base font-semibold text-tinta flex items-center gap-2">
              <TrendingUp size={16} className="text-laton" /> Armario Inteligente Circular
            </h3>
            <p className="text-xs text-tinta-apagada leading-relaxed font-sans font-light">
              ¿Quieres saber qué te falta para tener el armario perfecto? ¿Sabes qué prendas ya no encajan con tu estilo? Nuestro recomendador inteligente de <span className="text-laton font-medium">ESPEJO</span> analiza todas tus piezas juntas para proponerte prendas clave que te faltan y listar lo que te sobra directamente para vender en <span className="text-[#09b1ba] font-semibold">Vinted</span> con descripciones automáticas creadas con IA.
            </p>
          </div>
          <button
            type="button"
            id="boton-ejecutar-auditoria"
            disabled={loading || armario.length === 0}
            onClick={handleAuditar}
            className={`button-press whitespace-nowrap px-4 py-2 bg-laton text-fondo font-bold text-xs uppercase tracking-wider rounded select-none flex items-center gap-2 ${
              loading ? "opacity-60 cursor-not-allowed" : "hover:bg-white"
            }`}
          >
            {loading ? (
              <>
                <Hourglass size={14} className="animate-spin" /> Auditando armario...
              </>
            ) : (
              <>
                Analizar Armario <Sparkles size={13} />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/20 border border-red-900/40 rounded flex items-center gap-2 text-xs text-red-200">
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {auditResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Visual Cohesion Score Card */}
            <div className="bg-tarjeta border border-linea p-5 rounded flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[160px]">
              <div className="absolute top-2 right-2 text-[8px] font-mono text-tinta-apagada">COHESION INDEX</div>
              <div className="relative flex items-center justify-center w-24 h-24 mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    className="stroke-linea/40"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    className="stroke-laton"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * auditResult.grado_cohesion_porcentaje) / 100 }}
                    transition={{ duration: 1.5, cubicBezier: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="font-serif text-3xl font-bold text-tinta">{auditResult.grado_cohesion_porcentaje}%</span>
                  <span className="text-[8px] uppercase font-mono text-laton tracking-widest font-semibold">Sinergia</span>
                </div>
              </div>
              <p className="text-[10px] text-tinta-apagada">Grado de versatilidad de tus prendas</p>
            </div>

            {/* Editorial tailors review */}
            <div className="bg-tarjeta border border-linea p-5 rounded md:col-span-2 relative min-h-[160px] flex flex-col justify-between">
              <div className="absolute top-2 right-2 text-[8px] font-mono text-tinta-apagada">CRÍTICA DE NUESTRA IA</div>
              <div className="space-y-2 pr-4 pt-1">
                <p className="font-serif text-[13px] text-tinta font-medium leading-relaxed italic">
                  "{auditResult.analisis_editorial}"
                </p>
              </div>
              <div className="border-t border-linea/60 pt-3 mt-3 flex items-center justify-between text-[10px] text-tinta-apagada">
                <span>Evaluación de {armario.length} prendas</span>
                <span className="text-laton flex items-center gap-1">ESPEJO Exclusive Audit <Check size={11} /></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Needs / Gaps Analysis Card */}
            <div className="space-y-3">
              <h3 className="font-serif text-lg font-bold text-tinta flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-laton" /> Prendas de las que Careces (Huecos de Armario)
              </h3>
              <p className="text-[11px] text-tinta-apagada leading-relaxed mb-2 font-sans font-light">
                Estas prendas son las mejores opciones para multiplicar tus combinaciones y aprovechar más la ropa que ya tienes:
              </p>

              <div className="space-y-3">
                {auditResult.necesita.length === 0 ? (
                  <p className="text-xs text-tinta-apagada italic p-4 bg-tarjeta/40 border border-linea rounded">Tu armario está sumamente equilibrado, no se detectan huecos críticos.</p>
                ) : (
                  auditResult.necesita.map((item, index) => (
                    <div key={index} className="bg-tarjeta border border-linea p-4 rounded relative overflow-hidden">
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 text-[7px] bg-laton/10 border border-laton/30 text-laton rounded uppercase font-medium">
                        {item.categoria}
                      </div>
                      <div className="flex gap-3">
                        <div className="w-10 h-10 shrink-0 rounded bg-fondo2 border border-linea flex items-center justify-center text-laton">
                          <Shirt size={18} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-serif text-sm font-bold text-tinta">{item.prenda_sugerida}</h4>
                          <p className="text-xs text-tinta-apagada leading-relaxed italic">"{item.por_que_falta}"</p>
                          <div className="flex gap-1.5 items-start mt-2 pt-2 border-t border-linea/40 text-[10px] text-laton font-medium">
                            <CornerDownRight size={10} className="mt-0.5 shrink-0" />
                            <span>Consejo: {item.consejo_estilovital}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Redundancies & Extras (Vinted listings suggestions) */}
            <div className="space-y-3">
              <h3 className="font-serif text-lg font-bold text-tinta flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Prendas Redundantes (Oportunidades Vinted)
              </h3>
              <p className="text-[11px] text-tinta-apagada leading-relaxed mb-2 font-sans font-light">
                Estas piezas tienen baja sinergia o rompen la estética. Despréndete de ellas y recicla para financiar nuevas compras recomendadas:
              </p>

              <div className="space-y-3">
                {auditResult.sobran.length === 0 ? (
                  <div className="p-4 bg-tarjeta/40 border border-linea rounded text-center">
                    <p className="text-xs text-tinta-apagada italic">No se detectaron prendas redundantes en el análisis primario.</p>
                  </div>
                ) : (
                  auditResult.sobran.map((item) => {
                    const originalPrenda = armario.find((p) => p.id === item.id_prenda);
                    if (!originalPrenda) return null;

                    return (
                      <div key={item.id_prenda} className="bg-tarjeta border border-linea rounded overflow-hidden">
                        <div className="p-4 flex gap-4">
                          {/* Image */}
                          <div className="w-14 h-14 bg-fondo rounded overflow-hidden border border-linea/60 shrink-0">
                            <img
                              src={originalPrenda.imageSrc}
                              alt={originalPrenda.nombre}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-serif text-sm font-bold text-tinta truncate">{originalPrenda.nombre}</h4>
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#09b1ba]/10 text-[#09b1ba] border border-[#09b1ba]/20">
                                Sugerido: {item.precio_sugerido_vinted}€
                              </span>
                            </div>
                            <p className="text-xs text-tinta-apagada leading-snug"><span className="text-laton font-medium">Motivo de descarte:</span> {item.motivo_descarte}</p>
                          </div>
                        </div>

                        {/* Actions for the redundant piece */}
                        <div className="bg-fondo2/60 border-t border-linea/60 p-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            id={`boton-borrar-sobrante-${item.id_prenda}`}
                            onClick={() => {
                              if (window.confirm("¿Deseas desterrar esta prenda de tu Armario directamente?")) {
                                onPrendaEliminada(item.id_prenda);
                              }
                            }}
                            className="button-press text-[10px] text-tinta-apagada hover:text-red-400 font-semibold tracking-wider uppercase flex items-center gap-1"
                          >
                            Quitar del Armario
                          </button>

                          <button
                            type="button"
                            id={`boton-preparar-vinted-${item.id_prenda}`}
                            onClick={() => handleSelectVintedCustom(originalPrenda)}
                            className="button-press px-3 py-1 bg-[#09b1ba] text-white hover:bg-[#0aa2ac] font-bold text-[10px] tracking-wider uppercase rounded flex items-center gap-1"
                          >
                            <ShoppingBag size={11} /> Subir a Vinted
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Wardrobe Search to Upload anything to Vinted */}
      {!loading && (
        <div className="mt-8 border-t border-linea/80 pt-6">
          <div className="p-4 bg-tarjeta/30 rounded border border-linea flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="font-serif text-sm font-bold text-tinta">¿Quieres vender otra pieza en Vinted?</h4>
              <p className="text-xs text-tinta-apagada">Puedes listar cualquier prenda de tu armario existente para generar un anuncio automático con IA.</p>
            </div>
            
            {armario.length > 0 ? (
              <div className="relative w-full sm:w-64">
                <select
                  id="select-vinted-general"
                  onChange={(e) => {
                    const selected = armario.find((p) => p.id === e.target.value);
                    if (selected) {
                      handleSelectVintedCustom(selected);
                      // Reset select index
                      e.target.value = "";
                    }
                  }}
                  className="w-full text-xs font-serif bg-fondo border border-linea text-tinta hover:border-laton font-medium rounded p-2 focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>Selecciona una prenda...</option>
                  {armario.map((prenda) => (
                    <option key={prenda.id} value={prenda.id}>
                      {prenda.nombre} ({prenda.categoria})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-tinta-apagada italic">No hay prendas que listar.</p>
            )}
          </div>
        </div>
      )}

      {/* Vinted Sync Modal Backdrop Drawer */}
      <AnimatePresence>
        {selectedVintedPrenda && vintedDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fondo/90 backdrop-blur-md">
            <div 
              className="absolute inset-0 cursor-default" 
              onClick={() => setSelectedVintedPrenda(null)} 
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              className="relative w-full max-w-lg bg-tarjeta border border-linea rounded overflow-hidden shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-linea/60 bg-fondo2/40">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#09b1ba]" />
                  <span className="font-sans text-[10px] tracking-widest text-[#09b1ba] uppercase font-bold">
                    Vinted Express Integrator
                  </span>
                </div>
                <button
                  type="button"
                  id="vinted-modal-close"
                  onClick={() => setSelectedVintedPrenda(null)}
                  className="text-tinta-apagada hover:text-laton p-1 rounded transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Visual smartphone mockups */}
                <div className="p-5 border-r border-linea/60 bg-fondo">
                  <div className="border border-linea/80 rounded-2xl w-full aspect-[9/16] bg-[#f2f2f2] text-black overflow-hidden flex flex-col shadow-inner relative max-w-[220px] mx-auto">
                    {/* Top Notch/Speaker */}
                    <div className="h-4 bg-[#F4F4F5] w-full flex justify-center items-center">
                      <div className="w-16 h-2 bg-[#333] rounded-full mt-1" />
                    </div>

                    {/* Vinted Navbar */}
                    <div className="bg-white p-2.5 border-b border-gray-200 flex items-center justify-between shrink-0">
                      <span className="text-xs font-extrabold text-[#09b1ba] tracking-tight">vinted</span>
                      <span className="text-[8px] bg-gray-100 font-semibold px-2 py-0.5 rounded-full text-gray-500">Borradores</span>
                    </div>

                    {/* App Listing Visual container */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {/* Photo preview */}
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gray-200 border border-gray-300">
                        {selectedVintedPrenda ? (
                          <img
                            src={selectedVintedPrenda.imageSrc}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <div className="absolute bottom-1 right-1 bg-black/50 px-1 py-0.5 rounded text-[7px] text-white">1 / 1</div>
                      </div>

                      {/* Mocked Info Fields */}
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm space-y-1.5 text-[9px]">
                        <div className="font-bold text-gray-800 text-[10px] break-words leading-tight">
                          {vintedDraft.titulo}
                        </div>
                        <div className="font-extrabold text-[#09b1ba] text-xs">
                          {vintedDraft.precio},00 €
                        </div>
                        <div className="border-t border-gray-100 pt-1.5 mt-1.5 text-[8px] text-gray-500 leading-normal line-clamp-4 break-words font-sans">
                          {vintedDraft.descripcion}
                        </div>
                      </div>

                      {/* Vinted Tags Details block */}
                      <div className="bg-white p-2 rounded-lg border border-gray-200 text-[7px] text-gray-400 space-y-1">
                        <div><strong className="text-gray-600">Categoría:</strong> Moda / Prendas</div>
                        <div><strong className="text-gray-600">Estado:</strong> Muy bueno</div>
                        <div><strong className="text-gray-600">Sincronizador:</strong> Espejo AI Premium</div>
                      </div>
                    </div>

                    {/* Simulate Status Bar or Button inside Phone */}
                    <div className="bg-white p-2 border-t border-gray-200 flex justify-center shrink-0">
                      {syncStatus === "success" ? (
                        <div className="w-full py-1 text-center bg-emerald-500 rounded text-[9px] font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1">
                          <Check size={10} /> ¡Subido con éxito!
                        </div>
                      ) : syncStatus === "connecting" || syncStatus === "uploading" ? (
                        <div className="w-full py-1 text-center bg-[#09b1ba]/20 rounded text-[9px] font-bold text-[#09b1ba] uppercase tracking-wider animate-pulse">
                          Sincronizando...
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="mock-vinted-boton-celular"
                          onClick={executeVintedSync}
                          className="w-full py-1 bg-[#09b1ba] hover:bg-[#0aa2ac] rounded text-[9px] font-bold text-white uppercase tracking-wider"
                        >
                          Conoctar Vinted
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sincronizador detailed side options controls */}
                <div className="p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[8.5px] font-bold uppercase tracking-widest text-laton">Título de Vinted</span>
                      <input
                        type="text"
                        value={vintedDraft.titulo}
                        onChange={(e) => setVintedDraft({ ...vintedDraft, titulo: e.target.value })}
                        className="w-full text-xs font-sans bg-fondo border border-linea text-tinta p-2 rounded focus:border-laton focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8.5px] font-bold uppercase tracking-widest text-laton">Precio Seleccionado (€)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={vintedDraft.precio}
                          onChange={(e) => setVintedDraft({ ...vintedDraft, precio: parseInt(e.target.value) || 0 })}
                          className="w-24 text-xs font-sans bg-fondo border border-linea text-tinta p-2 rounded focus:border-laton focus:outline-none"
                        />
                        <span className="text-xs text-tinta-apagada">Tasación recomendada para venta rápida</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8.5px] font-bold uppercase tracking-widest text-laton">Descripción de venta (Estilo SEO)</span>
                      <textarea
                        value={vintedDraft.descripcion}
                        onChange={(e) => setVintedDraft({ ...vintedDraft, descripcion: e.target.value })}
                        className="w-full h-24 text-xs font-sans bg-fondo border border-linea text-tinta p-2 rounded focus:border-laton focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Connection Steps status visually animated */}
                  <div className="bg-fondo/60 border border-linea/60 p-3 rounded">
                    {syncStatus === "idle" ? (
                      <div className="text-center py-2 space-y-2">
                        <span className="text-[10px] text-tinta-apagada block">Sincronizador integrado virtual con Vinted API</span>
                        <button
                          type="button"
                          id="vinted-conectar-api"
                          onClick={executeVintedSync}
                          className="button-press w-full py-2 bg-tinta text-fondo hover:bg-white text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1.5"
                        >
                          Sincronizar Anuncio <ArrowRight size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-[10px]">
                        <div className="flex items-center justify-between text-[9px] text-tinta-apagada font-bold uppercase tracking-wider pb-1 border-b border-linea/40">
                          <span>Progreso del Sello</span>
                          <span className="text-[#09b1ba]">
                            {syncStatus === "connecting" && "Conectando..."}
                            {syncStatus === "uploading" && "Subiendo..."}
                            {syncStatus === "success" && "¡Listo!"}
                          </span>
                        </div>

                        <div className="space-y-1.5 font-mono">
                          <div className={`flex items-center gap-2 ${activeStep >= 1 ? "text-laton" : "text-tinta-apagada/40"}`}>
                            {activeStep >= 1 ? <Check size={10} className="stroke-[3]" /> : <span className="w-1.5 h-1.5 rounded-full bg-linea shrink-0" />}
                            <span>1. Autenticando canal seguro ESPEJO-Vinted</span>
                          </div>
                          <div className={`flex items-center gap-2 ${activeStep >= 2 ? "text-laton" : "text-tinta-apagada/40"}`}>
                            {activeStep >= 2 ? <Check size={10} className="stroke-[3]" /> : <span className="w-1.5 h-1.5 rounded-full bg-linea shrink-0" />}
                            <span>2. Formateando imágenes y metadatos con IA</span>
                          </div>
                          <div className={`flex items-center gap-2 ${activeStep >= 3 ? "text-laton" : "text-tinta-apagada/40"}`}>
                            {activeStep >= 3 ? <Check size={10} className="stroke-[3]" /> : <span className="w-1.5 h-1.5 rounded-full bg-linea shrink-0" />}
                            <span>3. Subiendo borrador optimizado</span>
                          </div>
                        </div>

                        {syncStatus === "success" && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3 mt-2 font-sans"
                          >
                            <div className="p-2 bg-emerald-950/20 border border-emerald-900/40 text-emerald-200 text-[10px] leading-relaxed rounded">
                              <strong>¡Anuncio automatizado!</strong> Debido a las limitaciones de seguridad de Vinted, la carga de datos se ha unificado en la <strong>Sincronización Express de 1-Clic</strong>:
                            </div>

                            <div className="bg-tarjeta p-2.5 border border-linea rounded space-y-2">
                              <div className="flex items-center gap-1.5 p-1.5 bg-fondo rounded border border-linea/60 text-[10px]">
                                <span className="w-4 h-4 rounded-full bg-laton text-fondo flex items-center justify-center font-bold text-[8.5px] shrink-0">1</span>
                                <span className="font-semibold text-tinta">Foto guardada automáticamente</span>
                              </div>
                              <div className="flex items-center gap-1.5 p-1.5 bg-fondo rounded border border-linea/60 text-[10px]">
                                <span className="w-4 h-4 rounded-full bg-laton text-fondo flex items-center justify-center font-bold text-[8.5px] shrink-0">2</span>
                                <span className="font-semibold text-tinta text-left">Ficha SEO copiada en Portapapeles (Título, Precio y Hashtags)</span>
                              </div>
                              <div className="flex items-center gap-1.5 p-1.5 bg-[#09b1ba]/10 rounded border border-[#09b1ba]/30 text-[10px]">
                                <span className="w-4 h-4 rounded-full bg-[#09b1ba] text-white flex items-center justify-center font-bold text-[8.5px] shrink-0">3</span>
                                <span className="font-semibold text-[#09b1ba]">Redirección lista para pegar</span>
                              </div>
                            </div>

                            {/* Fast Copy Individual Fields Board */}
                            <div className="bg-[#1C1813] p-2.5 border border-linea rounded space-y-2.5 text-left">
                              <p className="text-[8.5px] uppercase tracking-widest text-[#18181B] font-bold">
                                Copias Individuales Rápidas:
                              </p>
                              <p className="text-[7.5px] text-tinta-apagada -mt-2">
                                Haz clic en cada campo para rellenar en Vinted en segundos.
                              </p>
                              
                              <div className="space-y-1.5">
                                {/* Título */}
                                <div className="flex items-center gap-2 bg-tarjeta p-1 px-1.5 border border-linea/50 rounded justify-between">
                                  <div className="overflow-hidden w-full text-left">
                                    <span className="text-[6.5px] text-tinta-apagada block uppercase font-bold tracking-wider">Título</span>
                                    <span className="text-[9px] text-tinta truncate block">{vintedDraft?.titulo}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (vintedDraft) {
                                        await navigator.clipboard.writeText(vintedDraft.titulo);
                                        setCopiedTitulo(true);
                                        setTimeout(() => setCopiedTitulo(false), 2000);
                                      }
                                    }}
                                    className="text-[8px] font-bold uppercase shrink-0 px-2 py-0.5 bg-laton hover:bg-white text-fondo rounded transition active:scale-95"
                                  >
                                    {copiedTitulo ? "Hecho" : "Copiar"}
                                  </button>
                                </div>

                                {/* Precio */}
                                <div className="flex items-center gap-2 bg-tarjeta p-1 px-1.5 border border-linea/50 rounded justify-between">
                                  <div className="overflow-hidden w-full text-left">
                                    <span className="text-[6.5px] text-tinta-apagada block uppercase font-bold tracking-wider">Precio limpio (Sugerido)</span>
                                    <span className="text-[9px] text-laton font-bold block">{vintedDraft?.precio} €</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (vintedDraft) {
                                        await navigator.clipboard.writeText(vintedDraft.precio.toString());
                                        setCopiedPrecio(true);
                                        setTimeout(() => setCopiedPrecio(false), 2000);
                                      }
                                    }}
                                    className="text-[8px] font-bold uppercase shrink-0 px-2 py-0.5 bg-laton hover:bg-white text-fondo rounded transition active:scale-95"
                                  >
                                    {copiedPrecio ? "Hecho" : "Copiar"}
                                  </button>
                                </div>

                                {/* Descripción */}
                                <div className="flex flex-col gap-1 bg-tarjeta p-1.5 border border-linea/50 rounded">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[6.5px] text-tinta-apagada uppercase font-bold tracking-wider">Descripción del anuncio</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (vintedDraft) {
                                          await navigator.clipboard.writeText(vintedDraft.descripcion);
                                          setCopiedDescripcion(true);
                                          setTimeout(() => setCopiedDescripcion(false), 2000);
                                        }
                                      }}
                                      className="text-[8px] font-bold uppercase px-2 py-0.5 bg-laton hover:bg-white text-fondo rounded transition active:scale-95"
                                    >
                                      {copiedDescripcion ? "Hecho" : "Copiar Descripción"}
                                    </button>
                                  </div>
                                  <div className="text-[8px] text-tinta-apagada leading-normal bg-fondo/40 p-1 rounded border border-linea/20 mt-0.5 max-h-12 overflow-y-auto break-words text-left font-mono">
                                    {vintedDraft?.descripcion}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action and Copy footer bar */}
              <div className="flex items-center justify-between p-4 border-t border-linea/60 bg-fondo2/40">
                <button
                  type="button"
                  id="vinted-copy-anuncio"
                  onClick={handleCopyDraft}
                  className="button-press flex items-center gap-1.5 px-3 py-1.5 bg-tarjeta border border-linea hover:border-laton text-[10.5px] text-tinta font-bold uppercase tracking-wider rounded"
                >
                  {copiedText ? (
                    <>
                      <Check size={12} className="text-laton" /> ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Clipboard size={12} /> Copiar Ficha SEO
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVintedPrenda(null)}
                    className="px-3 py-1.5 border border-linea hover:border-tinta text-tinta-apagada hover:text-tinta text-xs font-semibold rounded uppercase tracking-wider"
                  >
                    Cerrar
                  </button>
                  {syncStatus === "success" && (
                    <button
                      type="button"
                      id="abrir-vinted-externo"
                      onClick={async () => {
                        // 1. Descargar la imagen automáticamente
                        if (selectedVintedPrenda) {
                          const link = document.createElement("a");
                          link.href = selectedVintedPrenda.imageSrc;
                          link.download = `${selectedVintedPrenda.nombre.toLowerCase().replace(/\s+/g, "_")}_espejo.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }

                        // 2. Copiar todo el bloque de texto (Título, precio, descripción) al portapapeles
                        if (vintedDraft) {
                          const content = `Título: ${vintedDraft.titulo}\nPrecio sugerido: ${vintedDraft.precio}€\n\nDescripción:\n${vintedDraft.descripcion}`;
                          try {
                            await navigator.clipboard.writeText(content);
                          } catch (e) {
                            console.error("Autocopy falló", e);
                          }
                        }

                        // 3. Abrir Vinted listo para subir
                        window.open("https://www.vinted.es/items/new", "_blank");
                      }}
                      className="px-4 py-1.5 bg-[#09b1ba] text-white hover:bg-[#0aa2ac] font-bold text-xs rounded flex items-center gap-1.5 uppercase tracking-wider select-none"
                    >
                      Crear Anuncio en Vinted <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
