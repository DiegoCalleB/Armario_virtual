import React, { useState, useEffect } from "react";
import { Prenda, Rostro, Look, EventoConfig, HistorialLook } from "../types";
import { Sparkles, Compass, Thermometer, ChevronRight, CheckCircle2, RotateCcw, HelpCircle, Eye, AlertCircle, Camera } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fileToBase64, resizeImage } from "../utils";

interface AsesoramientoLooksProps {
  armario: Prenda[];
  rostro: Rostro | null;
  selectedHistorialItem?: HistorialLook | null;
  onLooksGenerados?: (looks: Look[], ocasion: string, clima: string) => void;
  onUpdateLookImg?: (lookTitle: string, imageUrl: string, ocasion: string, clima: string, isFullBody?: boolean) => void;
}

const OCASIONES_PREDEFINIDAS = [
  "Cena refinada de Bodas",
  "Primera cita nocturna",
  "Almuerzo casual en puerto",
  "Cóctel corporativo formal",
  "Entrevista de negocios"
];

const CLIMAS_PREDEFINIDOS = [
  "Primaveral templado (18ºC)",
  "Calor de verano soleado (30ºC)",
  "Tarde lluviosa de otoño",
  "Frío invernal intenso (5ºC)"
];

const FRASES_BARBERO = [
  "Buscando tijeras de acero templado...",
  "Calentando toalla húmeda con vapor de lavanda...",
  "Perfilando patillas a navaja clásica...",
  "Moldeando pomada artesanal con aroma a tabaco y vainilla...",
  "Ajustando el reflejo editorial del latón en el salón...",
  "Pulido final con aceites esenciales clásicos..."
];

export default function AsesoramientoLooks({
  armario,
  rostro,
  selectedHistorialItem,
  onLooksGenerados,
  onUpdateLookImg,
}: AsesoramientoLooksProps) {
  const [ocasion, setOcasion] = useState("");
  const [clima, setClima] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [looks, setLooks] = useState<Look[]>([]);
  const [activeLookIndex, setActiveLookIndex] = useState(0);

  // Sync state if historical item is selected from parent
  useEffect(() => {
    if (selectedHistorialItem) {
      setLooks([selectedHistorialItem.look]);
      setActiveLookIndex(0);
      setOcasion(selectedHistorialItem.ocasion);
      setClima(selectedHistorialItem.clima);
    }
  }, [selectedHistorialItem]);

  // Simulation states
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [currentBarberPhraseIndex, setCurrentBarberPhraseIndex] = useState(0);
  const [simulationTab, setSimulationTab] = useState<"retrato" | "cuerpo">("retrato");
  const [copiedShare, setCopiedShare] = useState(false);
  const [customFullBodyPhoto, setCustomFullBodyPhoto] = useState<string | null>(null);
  const [customFullBodyFile, setCustomFullBodyFile] = useState<File | null>(null);

  const triggerGeneradorLooks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocasion.trim() || !clima.trim()) return;

    setError(null);
    setLoading(true);
    setLooks([]);
    setActiveLookIndex(0);

    try {
      const res = await fetch("/api/generar-looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocasion,
          clima,
          formaCara: rostro?.forma_cara || "",
          peloActual: rostro?.pelo_actual || "",
          barbaActual: rostro?.barba_actual || "",
          armario,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fallo estilístico en la IA.");
      }

      const decoded = await res.json();
      if (!decoded.looks || decoded.looks.length === 0) {
        throw new Error("El sastre virtual no pudo proponer looks en base a tu actual armario.");
      }
      setLooks(decoded.looks);
      if (onLooksGenerados) {
        onLooksGenerados(decoded.looks, ocasion, clima);
      }
    } catch (err: any) {
      console.error(err);
      let errorFriendly = err.message || "Fallo en la comunicación con tu estilista virtual.";
      if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
        errorFriendly = "No se ha podido conectar con el vestidor de Espejo. Por favor, comprueba tu red o inténtalo de nuevo para que podamos coordinar tus prendas.";
      }
      setError(errorFriendly);
    } finally {
      setLoading(false);
    }
  };

  // Trigger the face and beard simulation on demand
  const triggerSimulation = async (lookIndex: number, look: Look, fullBody: boolean = false) => {
    if (!rostro?.imageSrc) return;

    setSimulationError(null);
    setSimulating(true);
    
    // Cycle beautiful progress phrases
    const interval = setInterval(() => {
      setCurrentBarberPhraseIndex((prev) => (prev + 1) % FRASES_BARBERO.length);
    }, 1800);

    try {
      let prendasTexto = "";
      if (fullBody) {
        const matchingPrendas = look.id_prendas
          .map((id) => armario.find((p) => p.id === id))
          .filter(Boolean);
        prendasTexto = matchingPrendas
          .map((p) => `${p?.nombre} (${p?.categoria})`)
          .join(" con ");
      }

      // Trigger user paid flow setting check via show_aistudio_ui under standard model requirements if key is paid,
      // but the server takes care of the configuration directly.
      const res = await fetch("/api/generar-imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceImage: rostro.imageSrc,
          estiloCabello: look.pelo_sugerido,
          estiloBarba: look.barba_sugerida,
          fullBody,
          prendasTexto,
          customFullBodyImage: fullBody && customFullBodyPhoto ? customFullBodyPhoto : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al simular la imagen de retrato.");
      }

      const parsed = await res.json();
      if (parsed.imageUrl) {
        // Safe updates 
        setLooks((oldLooks) => {
          const raw = [...oldLooks];
          raw[lookIndex] = {
            ...raw[lookIndex],
            [fullBody ? "simulatedFullBodyImageUrl" : "simulatedImageUrl"]: parsed.imageUrl,
          };
          return raw;
        });
        if (onUpdateLookImg) {
          onUpdateLookImg(look.titulo, parsed.imageUrl, ocasion, clima, fullBody);
        }
      } else {
        throw new Error("No se obtuvo URL de simulación válida.");
      }
    } catch (err: any) {
      console.error(err);
      let errorFriendly = err.message || "La simulación no pudo completarse. Valida tu conexión.";
      if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
        errorFriendly = "Error de conexión temporal al simular tu atuendo editorial. Por favor, reinténtalo transcurridos unos instantes.";
      }
      setSimulationError(errorFriendly);
    } finally {
      clearInterval(interval);
      setSimulating(false);
    }
  };

  const selectedLook = looks[activeLookIndex];

  return (
    <section id="asesoramiento-looks-sección" className="border-t border-linea pt-8 pb-12">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-laton font-medium text-lg">03</span>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta">El Evento</h2>
        </div>
        <p className="text-xs font-sans text-tinta-apagada select-none font-medium">COORDINATION ENGINE</p>
      </div>

      {!rostro && (
        <div className="p-6 bg-tarjeta/10 rounded-lg border border-linea text-center">
          <Camera size={26} className="text-laton-apagado mx-auto mb-3" />
          <h3 className="font-serif text-base font-semibold text-tinta">Espejo no calibrado</h3>
          <p className="text-xs text-tinta-apagada mt-1.5 max-w-sm mx-auto">
            Por favor, sube tu retrato facial en la sección <strong>Tu Espejo</strong> primero. El estilista necesita comprender la fisionomía de tu rostro para aconsejarte cortes y barbas.
          </p>
        </div>
      )}

      {rostro && armario.length === 0 && (
        <div className="p-6 bg-tarjeta/10 rounded-lg border border-linea text-center">
          <Sparkles size={26} className="text-laton-apagado mx-auto mb-3" />
          <h3 className="font-serif text-base font-semibold text-tinta">Armario vacío</h3>
          <p className="text-xs text-tinta-apagada mt-1.5 max-w-sm mx-auto">
            Por favor, sube un par de camisas, abrigos o pantalones en la sección <strong>Tu Armario</strong>. El asesor virtual confecciona looks reales utilizando únicamente piezas de tu propio escaparate.
          </p>
        </div>
      )}

      {rostro && armario.length > 0 && (
        <div className="space-y-8">
          {/* Form and Selection inputs */}
          <form onSubmit={triggerGeneradorLooks} className="bg-tarjeta p-6 rounded-lg border border-linea">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event input */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-laton font-medium font-sans flex items-center gap-1.5">
                  <Compass size={12} /> ¿Cuál es la ocasión o evento?
                </label>
                <input
                  type="text"
                  placeholder="Ej: Boda de Gala al atardecer, cita informal o brunch dominical"
                  value={ocasion}
                  onChange={(e) => setOcasion(e.target.value)}
                  className="w-full text-sm bg-fondo/80 border border-linea px-4 py-2.5 rounded text-tinta placeholder:text-tinta-apagada/40 focus:outline-none focus:border-laton transition"
                  required
                />
                
                {/* Predefined suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {OCASIONES_PREDEFINIDAS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      id={`ocasion-${item.replace(/\s+/g, '-')}`}
                      onClick={() => setOcasion(item)}
                      className="text-[10px] bg-fondo border border-linea/60 text-tinta-apagada hover:border-laton hover:text-laton px-2 py-1 rounded transition whitespace-nowrap"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Climate input */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-laton font-medium font-sans flex items-center gap-1.5">
                  <Thermometer size={12} /> ¿Cómo es el clima hoy?
                </label>
                <input
                  type="text"
                  placeholder="Ej: Soleado templado, viento helado de montaña o llovizna húmeda"
                  value={clima}
                  onChange={(e) => setClima(e.target.value)}
                  className="w-full text-sm bg-fondo/80 border border-linea px-4 py-2.5 rounded text-tinta placeholder:text-tinta-apagada/40 focus:outline-none focus:border-laton transition"
                  required
                />

                {/* Predefined suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {CLIMAS_PREDEFINIDOS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      id={`clima-${item.replace(/\s+/g, '-')}`}
                      onClick={() => setClima(item)}
                      className="text-[10px] bg-fondo border border-linea/60 text-tinta-apagada hover:border-laton hover:text-laton px-2 py-1 rounded transition whitespace-nowrap"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-linea/60 pt-5">
              <button
                type="submit"
                id="boton-generar-estilo"
                disabled={loading}
                className="button-press w-full sm:w-auto px-6 py-3 bg-laton text-fondo font-bold text-xs uppercase tracking-widest rounded hover:bg-white select-none shadow-lg shadow-black/40 flex items-center justify-center gap-2"
              >
                <Sparkles size={14} /> Planificar Asesoría
              </button>
            </div>
          </form>

          {/* AI Loader representation */}
          {loading && (
            <div className="py-16 bg-tarjeta/10 border border-dashed border-linea rounded-lg flex flex-col items-center justify-center">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border border-linea"></div>
                <div className="absolute inset-0 rounded-full border border-laton border-t-transparent animate-spin"></div>
              </div>
              <p className="font-serif text-lg text-tinta italic">Coordinando tu armario...</p>
              <p className="text-xs text-tinta-apagada mt-0.5 animate-pulse text-center max-w-sm">
                Confeccionando looks inteligentes, calculando balance con tu rostro {rostro?.forma_cara} y evaluando armonía climática...
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 p-4 bg-red-950/20 border border-red-900/40 text-red-300 text-xs rounded">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Render Result looks */}
          {looks.length > 0 && (
            <div className="space-y-6">
              {/* Tab Selector style */}
              <div className="flex border-b border-linea">
                {looks.map((look, index) => (
                  <button
                    key={index}
                    type="button"
                    id={`pestaña-look-${index}`}
                    onClick={() => setActiveLookIndex(index)}
                    className={`px-5 py-3 text-xs uppercase tracking-wider font-sans font-medium transition-all relative ${
                      activeLookIndex === index ? "text-laton" : "text-tinta-apagada hover:text-tinta"
                    }`}
                  >
                    <span>Look 0{index + 1}</span>
                    {activeLookIndex === index && (
                      <motion.div
                        layoutId="activeLookIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-laton"
                      />
                    )}
                  </button>
                ))}
              </div>

              {selectedLook && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column: Garments list (Magazine Collage style) */}
                  <div className="lg:col-span-7 space-y-6">
                    <div>
                      <span className="text-[10px] tracking-widest text-laton uppercase font-medium">Asesoría de Looks</span>
                      <h3 className="font-serif text-2xl font-bold text-tinta italic mt-0.5 leading-tight">
                        {selectedLook.titulo}
                      </h3>
                      <p className="text-sm font-light text-tinta/80 mt-3 leading-relaxed">
                        {selectedLook.porque}
                      </p>
                    </div>

                    <div className="h-px bg-linea" />

                    {(() => {
                      const matchingGarments = selectedLook.id_prendas
                        .map(id => armario.find(p => p.id === id))
                        .filter((p): p is Prenda => p !== undefined);

                      const tops = matchingGarments.filter(p => p.categoria === "top");
                      const pantalones = matchingGarments.filter(p => p.categoria === "pantalon");
                      const calzados = matchingGarments.filter(p => p.categoria === "calzado");
                      const accesorios = matchingGarments.filter(p => p.categoria === "accesorio");

                      const renderPrendaCardItem = (item: Prenda, compact = false) => (
                        <div key={item.id} className="bg-tarjeta border border-linea rounded-lg p-2.5 flex gap-3 items-center hover:border-[#C9A35B]/50 transition duration-200 shadow-md">
                          <div className={`${compact ? "w-9 h-9" : "w-12 h-12"} rounded overflow-hidden border border-linea/40 shrink-0 bg-fondo`}>
                            <img
                              src={item.imageSrc}
                              alt={item.nombre}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-[8px] uppercase tracking-wider text-[#C9A35B]/80 font-bold leading-none">
                                {item.categoria === "top" ? "Prenda Superior" : item.categoria === "pantalon" ? "Prenda Inferior" : item.categoria === "calzado" ? "Calzado" : "Accesorio"}
                              </p>
                              <span className="text-[8px] text-tinta-apagada px-1.5 py-0.5 rounded bg-fondo font-medium uppercase font-sans">
                                Nivel {item.formalidad}
                              </span>
                            </div>
                            <p className="font-serif text-xs font-semibold text-tinta truncate mt-0.5" title={item.nombre}>
                              {item.nombre}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-white/10"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-[9px] font-mono text-tinta-apagada font-light uppercase">
                                  {item.color}
                                </span>
                              </div>
                              <span className="text-[8.5px] text-tinta-apagada/70 italic capitalize">
                                {item.temporada === "todo" ? "Todo el año" : item.temporada}
                              </span>
                            </div>
                          </div>
                        </div>
                      );

                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-linea/60 pb-2">
                            <h4 className="text-xs uppercase tracking-widest text-[#C9A35B] font-bold">Galán de Noche (Perchero Virtual)</h4>
                            <span className="text-[9px] font-mono text-tinta-apagada">SARTORIAL SCHEMATIC</span>
                          </div>
                          
                          <div className="relative bg-[#1a1610] rounded-xl border border-linea/80 p-5 overflow-hidden">
                            {/* Decorative background brass rod */}
                            <div className="absolute top-10 bottom-10 left-1/2 w-0.5 bg-gradient-to-b from-[#C9A35B]/40 via-[#8C7440]/10 to-[#C9A35B]/40 -translate-x-1/2 hidden sm:block pointer-events-none" />

                            <div className="space-y-6 relative z-10">
                              {/* 1. TOP SLOT (CAMISETA / CHAQUETA / ETC) */}
                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="shrink-0 w-24 text-center sm:text-right">
                                  <span className="text-[9px] uppercase tracking-widest text-[#C9A35B] font-extrabold block">01 / SUPERIOR</span>
                                  <span className="text-[8px] text-tinta-apagada block italic font-light">Tops & Abrigos</span>
                                </div>
                                <div className="flex-1 w-full flex flex-col gap-2">
                                  {tops.length > 0 ? (
                                    tops.map((item) => renderPrendaCardItem(item))
                                  ) : (
                                    <p className="text-[10px] text-tinta-apagada italic border border-dashed border-linea/40 rounded p-3 text-center bg-fondo/20">Sin prenda superior para el look</p>
                                  )}
                                </div>
                              </div>

                              {/* 2. MIDDLE SLOT (PANTALÓN / BERMUDA / ETC) */}
                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="shrink-0 w-24 text-center sm:text-right">
                                  <span className="text-[9px] uppercase tracking-widest text-[#C9A35B] font-extrabold block">02 / INFERIOR</span>
                                  <span className="text-[8px] text-tinta-apagada block italic font-light">Pantalones</span>
                                </div>
                                <div className="flex-1 w-full flex flex-col gap-2">
                                  {pantalones.length > 0 ? (
                                    pantalones.map((item) => renderPrendaCardItem(item))
                                  ) : (
                                    <p className="text-[10px] text-tinta-apagada italic border border-dashed border-linea/40 rounded p-4 text-center bg-fondo/20">Sin pantalón seleccionado</p>
                                  )}
                                </div>
                              </div>

                              {/* 3. BOTTOM SLOT (CALZADO / ZAPATOS / DEPORTIVAS) */}
                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="shrink-0 w-24 text-center sm:text-right">
                                  <span className="text-[9px] uppercase tracking-widest text-[#C9A35B] font-extrabold block">03 / CALZADO</span>
                                  <span className="text-[8px] text-tinta-apagada block italic font-light">Zapatos & Sneakers</span>
                                </div>
                                <div className="flex-1 w-full flex flex-col gap-2">
                                  {calzados.length > 0 ? (
                                    calzados.map((item) => renderPrendaCardItem(item))
                                  ) : (
                                    <p className="text-[10px] text-tinta-apagada italic border border-dashed border-linea/40 rounded p-4 text-center bg-fondo/20">Sin calzado propuesto</p>
                                  )}
                                </div>
                              </div>

                              {/* 4. ACCESSORIES SHELF (ACCESORIOS) */}
                              {accesorios.length > 0 && (
                                <div className="border-t border-[#3A3225]/40 pt-4 mt-2">
                                  <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="shrink-0 w-24 text-center sm:text-right">
                                      <span className="text-[9px] uppercase tracking-widest text-[#C9A35B] font-extrabold block">DETALLES</span>
                                      <span className="text-[8px] text-tinta-apagada block italic font-light">Bespoke Accs</span>
                                    </div>
                                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {accesorios.map((item) => renderPrendaCardItem(item, true))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Column: Hairstyling, Grooming & Simulating Re-render */}
                  <div className="lg:col-span-5 bg-tarjeta border border-linea rounded-lg p-6 space-y-6">
                    <span className="font-serif italic text-laton font-semibold block text-base border-b border-linea pb-2">
                      Facciones & Barbería (04)
                    </span>

                    <div className="space-y-4">
                      {/* Hair Recommendations */}
                      <div className="space-y-1">
                        <span className="text-[10px] tracking-widest text-tinta-apagada uppercase font-medium">Corte de Cabello Recomendado</span>
                        <p className="font-serif text-base font-semibold text-tinta italic leading-tight">
                          {selectedLook.pelo_sugerido}
                        </p>
                      </div>

                      {/* Beard Recommendations */}
                      <div className="space-y-1">
                        <span className="text-[10px] tracking-widest text-tinta-apagada uppercase font-medium">Diseño de Barba Recomendado</span>
                        <p className="font-serif text-base font-semibold text-tinta italic leading-tight">
                          {selectedLook.barba_sugerida}
                        </p>
                      </div>

                      {/* Barber Tips */}
                      <div className="p-3.5 bg-fondo border border-linea rounded text-xs space-y-1 relative overflow-hidden">
                        <span className="text-[10px] tracking-widest text-laton uppercase font-medium block">
                          Consejo de Maestro Barbero
                        </span>
                        <p className="text-tinta-apagada font-light leading-relaxed">
                          {selectedLook.consejo_barberia}
                        </p>
                      </div>
                    </div>

                    {/* Simulation Section (Ver en el espejo) */}
                    <div className="h-px bg-linea" />

                    <div className="space-y-5 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-widest text-[#C9A35B] font-bold block text-left">
                          Espejo de Simulación IA
                        </span>
                        
                        <div className="flex bg-fondo p-1 rounded border border-linea/60 gap-1 w-full sm:w-auto">
                          <button
                            type="button"
                            id="tab-sim-retrato"
                            onClick={() => setSimulationTab("retrato")}
                            className={`flex-1 sm:flex-none text-[9.5px] uppercase px-3 py-1 rounded font-extrabold tracking-wider transition ${
                              simulationTab === "retrato"
                                ? "bg-laton text-fondo"
                                : "text-tinta-apagada hover:text-tinta"
                            }`}
                          >
                            Retrato (1:1)
                          </button>
                          <button
                            type="button"
                            id="tab-sim-cuerpo"
                            onClick={() => setSimulationTab("cuerpo")}
                            className={`flex-1 sm:flex-none text-[9.5px] uppercase px-3 py-1 rounded font-extrabold tracking-wider transition ${
                              simulationTab === "cuerpo"
                                ? "bg-laton text-fondo"
                                : "text-tinta-apagada hover:text-tinta"
                            }`}
                          >
                            Cuerpo Completo (3:4)
                          </button>
                        </div>
                      </div>

                      {/* Active simulation Loading representation */}
                      {simulating && (
                        <div className="p-8 bg-fondo/80 border border-linea text-center rounded flex flex-col items-center justify-center min-h-[220px]">
                          <div className="w-10 h-10 mb-4 relative">
                            <div className="absolute inset-0 rounded-full border border-linea"></div>
                            <div className="absolute inset-0 rounded-full border border-laton border-t-transparent animate-spin"></div>
                          </div>
                          <p className="font-serif text-sm text-tinta italic">
                            {simulationTab === "cuerpo" ? "Vistiendo tu silueta..." : "Grooming Virtual..."}
                          </p>
                          <p className="text-[11px] text-laton font-medium mt-1 animate-pulse min-h-[16px]">
                            {FRASES_BARBERO[currentBarberPhraseIndex]}
                          </p>
                        </div>
                      )}

                      {simulationError && !simulating && (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2.5 p-3 bg-red-950/20 border border-red-900/30 text-red-300 text-xs rounded text-left">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <p>{simulationError}</p>
                          </div>
                          <button
                            type="button"
                            id="boton-reintentar-simulacion"
                            onClick={() => triggerSimulation(activeLookIndex, selectedLook, simulationTab === "cuerpo")}
                            className="text-xs text-laton hover:underline block text-left"
                          >
                            Reintentar Proyección de {simulationTab === "cuerpo" ? "Cuerpo" : "Retrato"}
                          </button>
                        </div>
                      )}

                      {!simulating && !simulationError && (
                        <>
                          {simulationTab === "retrato" ? (
                            /* RETRATO SIMULATION */
                            !selectedLook.simulatedImageUrl ? (
                              <div className="space-y-3 text-left">
                                <p className="text-[11.5px] text-tinta-apagada leading-relaxed font-light font-sans">
                                  Ver tu fisonomía modificada. El retoque IA recreará tu rostro adaptando exactamente este peinado y barba sugeridos, ambientándote en una barbería clásica.
                                </p>
                                <button
                                  type="button"
                                  id="boton-simular-retrato"
                                  onClick={() => triggerSimulation(activeLookIndex, selectedLook, false)}
                                  className="button-press w-full py-2.5 bg-tarjeta border border-laton text-laton hover:bg-laton hover:text-fondo text-xs font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 transition active:scale-97"
                                >
                                  <Eye size={12} /> Proyectar Rostro (Barbería)
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1 text-left">
                                    <span className="text-[9px] uppercase text-tinta-apagada font-medium font-bold block">Original</span>
                                    <div className="aspect-square bg-fondo border border-linea rounded overflow-hidden">
                                      <img
                                        src={rostro.imageSrc}
                                        alt="Original face retrato"
                                        className="w-full h-full object-cover scale-x-[-1]"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1 text-left">
                                    <span className="text-[9px] uppercase text-laton font-medium font-bold block">Lifting Virtual</span>
                                    <div className="aspect-square bg-fondo border border-laton rounded overflow-hidden relative shadow-lg shadow-black/80">
                                      <img
                                        src={selectedLook.simulatedImageUrl}
                                        alt="Simulated retrato"
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute bottom-1 right-1 bg-laton text-fondo text-[8px] font-bold py-0.5 px-1.5 rounded uppercase">
                                        SIMULADO
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {selectedLook.simulatedImageUrl?.startsWith("data:image/svg+xml") && (
                                  <div className="p-3 bg-[#1e1a13] border border-laton/20 rounded-md text-left text-[11px] font-sans">
                                    <div className="flex items-center gap-1.5 text-[#C9A35B] font-bold uppercase tracking-wider text-[9.5px] mb-1">
                                      <AlertCircle size={12} className="shrink-0 text-laton" />
                                      <span>BOCETO EDITORIAL ACTIVO</span>
                                    </div>
                                    <p className="text-tinta-apagada leading-relaxed text-[10.5px]">
                                      Hemos compuesto tu fotografía en una proyección sastrera. Para habilitar un retoque fotorrealista completo sobre tu fisonomía mediante Inteligencia Artificial, se requiere autorizar la cuota de imagen en AI Studio (procediendo con la opción de Créditos/Paid Flow).
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-between items-center bg-fondo border border-linea rounded p-2.5">
                                  <span className="text-[10px] text-tinta-apagada leading-none">¿Te convence esta proyección?</span>
                                  <button
                                    type="button"
                                    onClick={() => triggerSimulation(activeLookIndex, selectedLook, false)}
                                    className="text-[10px] text-[#C9A35B] hover:underline font-bold"
                                  >
                                    Volver a Proyectar Rostro
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            /* CUERPO COMPLETO SIMULATION */
                            <div className="space-y-4 text-left">
                              <div className="p-3 bg-[#1e1a13] border border-linea/60 rounded-lg space-y-3">
                                <span className="text-[10px] text-[#C9A35B] font-bold uppercase tracking-wider block">Probador Virtual Personalizado</span>
                                <p className="text-[11px] text-tinta-apagada leading-normal">
                                  ¿Deseas probar la ropa sobre tu propio cuerpo? Sube una foto tuya de cuerpo completo de pie. Si no subes ninguna, la IA vestirá un modelo clásico con tu fisonomía facial.
                                </p>

                                {/* Custom body file picker */}
                                <div className="flex items-center gap-3 bg-fondo p-2.5 rounded border border-linea/60">
                                  <div className="w-10 h-10 rounded overflow-hidden bg-[#1e1a13] border border-linea/80 shrink-0 flex items-center justify-center relative">
                                    {customFullBodyPhoto ? (
                                      <img src={customFullBodyPhoto} alt="Cuerpo propio" className="w-full h-full object-cover" />
                                    ) : (
                                      <Camera size={14} className="text-tinta-apagada/40" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="file"
                                      id="input-cuerpo-completo-usuario"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                          const file = e.target.files[0];
                                          setCustomFullBodyFile(file);
                                          const rawB64 = await fileToBase64(file);
                                          // Resize custom body picture nicely
                                          const resized = await resizeImage(rawB64, 768);
                                          setCustomFullBodyPhoto(resized);
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById("input-cuerpo-completo-usuario")?.click()}
                                        className="px-2.5 py-1 text-[9.5px] border border-linea hover:border-laton bg-tarjeta text-tinta font-semibold rounded uppercase tracking-wider transition"
                                      >
                                        {customFullBodyPhoto ? "Cambiar foto" : "Subir mi foto"}
                                      </button>
                                      {customFullBodyPhoto && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCustomFullBodyFile(null);
                                            setCustomFullBodyPhoto(null);
                                          }}
                                          className="px-2 py-0.5 text-[9.5px] border border-red-950 hover:bg-red-950/20 text-red-100 rounded uppercase tracking-wider transition"
                                        >
                                          Quitar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {!selectedLook.simulatedFullBodyImageUrl ? (
                                <div className="space-y-3">
                                  <button
                                    type="button"
                                    id="boton-simular-cuerpo"
                                    onClick={() => triggerSimulation(activeLookIndex, selectedLook, true)}
                                    className="button-press w-full py-2.5 bg-tarjeta border border-laton text-laton hover:bg-laton hover:text-fondo text-xs font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 transition active:scale-97"
                                  >
                                    <Sparkles size={12} /> Proyectar sobre {customFullBodyPhoto ? "mi cuerpo" : "silueta clásica"} con IA
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-12 gap-3 items-center">
                                    <div className="col-span-12 sm:col-span-5 space-y-1 text-left">
                                      <span className="text-[9px] uppercase text-tinta-apagada font-medium font-bold block">Tu Referencia</span>
                                      <div className="aspect-[3/4] bg-fondo border border-linea rounded overflow-hidden">
                                        <img
                                          src={customFullBodyPhoto || rostro.imageSrc}
                                          alt="Original face or body"
                                          className="w-full h-full object-cover scale-x-[-1]"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                      <div className="text-[8px] text-tinta-apagada/70 font-mono truncate">
                                        {customFullBodyPhoto ? "CUERPO SUBIDO" : `ID: ${rostro.forma_cara}`}
                                      </div>
                                    </div>

                                    <div className="col-span-12 sm:col-span-7 space-y-1 text-left">
                                      <span className="text-[9px] uppercase text-laton font-medium font-bold block">Vestidor Virtual IA</span>
                                      <div className="aspect-[3/4] bg-fondo border border-laton rounded overflow-hidden relative shadow-lg shadow-black/80">
                                        <img
                                          src={selectedLook.simulatedFullBodyImageUrl}
                                          alt="Simulated body outfit"
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute bottom-1 right-1 bg-laton text-fondo text-[8px] font-bold py-0.5 px-1.5 rounded uppercase">
                                          VIRTUAL FIT
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {selectedLook.simulatedFullBodyImageUrl?.startsWith("data:image/svg+xml") && (
                                    <div className="p-3 bg-[#1e1a13] border border-laton/20 rounded-md text-left text-[11px] font-sans">
                                      <div className="flex items-center gap-1.5 text-[#C9A35B] font-bold uppercase tracking-wider text-[9.5px] mb-1">
                                        <AlertCircle size={12} className="shrink-0 text-laton" />
                                        <span>BOCETO EDITORIAL ACTIVO</span>
                                      </div>
                                      <p className="text-tinta-apagada leading-relaxed text-[10.5px]">
                                        Hemos compuesto tu fotografía en una proyección boutique. Para habilitar un retoque fotorrealista con cambio completo de ropa mediante Inteligencia Artificial, se requiere autorizar la cuota de imagen en AI Studio (procediendo con la opción de Créditos/Paid Flow).
                                      </p>
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center bg-fondo border border-linea rounded p-2.5">
                                    <span className="text-[10px] text-tinta-apagada leading-none">¿Te convence este Dressing?</span>
                                    <button
                                      type="button"
                                      onClick={() => triggerSimulation(activeLookIndex, selectedLook, true)}
                                      className="text-[10px] text-[#C9A35B] hover:underline font-bold"
                                    >
                                      Volver a Proyectar Look
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Portada Editorial de Revista (VIRAL FACTOR) */}
                      {!simulating && (selectedLook.simulatedImageUrl || selectedLook.simulatedFullBodyImageUrl) && (
                        <div className="bg-[#1E1A13] border border-linea p-4 rounded-lg space-y-3 font-sans text-left relative overflow-hidden mt-6">
                          <p className="text-[9.5px] uppercase tracking-widest text-[#C9A35B] font-bold">
                            Estudio Editorial ESPEJO (Ficha Viral)
                          </p>
                          <p className="text-[10px] text-tinta-apagada leading-relaxed font-light">
                            Consigue tu portada personalizada de la revista ESPEJO. Un diseño exclusivo editorial listo para presumir en tus historias de Instagram, TikTok, o para compartir con tus amigos.
                          </p>

                          {/* The actual styled magazine mockup! */}
                          <div className="relative border border-[#3A3225] bg-[#16130E] p-4.5 rounded flex flex-col items-center justify-between shadow-2xl select-none" style={{ minHeight: "330px" }}>
                            {/* Background/Backdrop simulated image */}
                            <div className="absolute inset-0 z-0 opacity-80 overflow-hidden">
                              <img
                                src={simulationTab === "cuerpo" ? (selectedLook.simulatedFullBodyImageUrl || selectedLook.simulatedImageUrl || rostro.imageSrc) : (selectedLook.simulatedImageUrl || rostro.imageSrc)}
                                alt="Magazine Model"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#16130E] via-transparent to-[#16130E]/60" />
                            </div>

                            {/* Magazine logo header */}
                            <div className="w-full text-center z-10 pt-1 pb-4">
                              <h4 className="font-serif text-3xl font-extrabold tracking-[0.25em] text-[#F3ECDD] uppercase leading-none select-none">
                                ESPEJO
                              </h4>
                              <div className="flex justify-between items-center text-[7px] text-[#A89C82] tracking-wider uppercase border-t border-b border-[#3A3225]/40 mt-1 px-1 py-0.5 font-sans">
                                <span>VOL. 04 / EDICIÓN ESPECIAL</span>
                                <span>SARTORIAL MALE</span>
                              </div>
                            </div>

                            {/* Magazine highlights and headlines */}
                            <div className="w-full z-10 text-left space-y-3 pt-8">
                              <div className="max-w-[85%] bg-[#16130E]/50 p-2.5 rounded border border-linea/20 backdrop-blur-sm">
                                <span className="text-[7.5px] bg-[#C9A35B] text-[#16130E] font-bold uppercase tracking-widest py-0.5 px-1.5 rounded-sm">
                                  PORTADA EXCLUSIVA
                                </span>
                                <h5 className="font-serif text-lg font-bold tracking-tight text-[#F3ECDD] uppercase leading-tight mt-1 italic">
                                  {selectedLook.titulo}
                                </h5>
                                <p className="text-[8.5px] text-[#A89C82] font-light leading-relaxed mt-0.5">
                                  Recibiendo asesoramiento real coordinando su armario con la IA de ESPEJO.
                                </p>
                              </div>

                              {/* Fisiognomy details sidebar */}
                              <div className="flex justify-between items-end border-t border-[#3A3225]/40 pt-1.5 w-full text-[7.5px] text-[#A89C82]">
                                <div className="space-y-0.5 text-left bg-[#16130E]/40 p-1 rounded-sm">
                                  <p className="font-bold text-[#F3ECDD] uppercase tracking-[0.05em] text-[7px]">FISIOLOGÍA REVELADA</p>
                                  <p>Forma de rostro: <span className="text-[#C9A35B]">{rostro.forma_cara}</span></p>
                                  <p>Corte: <span className="text-[#C9A35B] truncate max-w-[80px] inline-block align-bottom">{selectedLook.pelo_sugerido}</span></p>
                                </div>
                                <div className="text-right bg-[#16130E]/40 p-1 rounded-sm">
                                  <p className="font-mono text-[7px] text-[#8C7440] leading-none">00000 120531 2026</p>
                                  <p className="text-[7px] uppercase mt-0.5">{ocasion} • {clima}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Share features */}
                          <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const shareText = `📚 ¡Acabo de salir en la portada de ESPEJO! Mi look virtual premium analizado con Inteligencia Artificial. ¡Pruébalo en tu probador virtual!: ${window.location.origin}`;
                                  await navigator.clipboard.writeText(shareText);
                                  setCopiedShare(true);
                                  setTimeout(() => setCopiedShare(false), 3000);
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="flex-1 py-2 bg-laton hover:bg-white text-fondo rounded text-[10.5px] font-bold uppercase tracking-wider transition active:scale-97 text-center flex items-center justify-center gap-1.5"
                            >
                              <span>{copiedShare ? "¡Copiado para compartir! ✓" : "Copiar Enlace para Stories"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const targetUrl = simulationTab === "cuerpo" ? (selectedLook.simulatedFullBodyImageUrl || rostro.imageSrc) : (selectedLook.simulatedImageUrl || rostro.imageSrc);
                                if (!targetUrl) return;
                                const link = document.createElement("a");
                                link.href = targetUrl;
                                link.download = `ESPEJO_PortadaRevista_${selectedLook.titulo.replace(/\s+/g, '_')}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="py-2 px-3 bg-tarjeta text-tinta hover:text-laton border border-linea rounded text-[10px] font-semibold uppercase tracking-wider transition active:scale-97 text-center"
                            >
                              Descargar Foto
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
