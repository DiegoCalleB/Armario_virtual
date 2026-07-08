import React, { useState } from "react";
import { Prenda, PerfilEstilo } from "../types";
import { Sparkles, Briefcase, MapPin, Calendar, Sun, CloudRain, Thermometer, ShoppingBag, CheckCircle, Flame, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { obtenerCapaDePrenda } from "../utils";

interface AsistenteMaletaProps {
  armario: Prenda[];
  perfilEstilo?: PerfilEstilo | null;
}

interface SelectedGarmentWhy {
  prenda_id: string;
  motivo_seleccion: string;
}

interface OutfitPlan {
  dia_numero: number;
  titulo_actividad: string;
  prendas_combinadas: string[];
  explicacion_outfit: string;
}

interface MaletaResult {
  analisis_destino: string;
  prendas_seleccionadas: string[];
  por_que_seleccion_garment: SelectedGarmentWhy[];
  combinaciones: OutfitPlan[];
  recomendaciones_extras: string[];
}

export default function AsistenteMaleta({ armario, perfilEstilo }: AsistenteMaletaProps) {
  const [destino, setDestino] = useState("");
  const [dias, setDias] = useState(4);
  const [clima, setClima] = useState("Modera y primaveral (18ºC)");
  const [actividades, setActividades] = useState("Cenas elegantes, turismo, caminatas");
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MaletaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerarMaleta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (armario.length === 0) {
      setError("Primero debes subir o escanear prendas en tu armario virtual.");
      return;
    }
    if (!destino.trim()) {
      setError("Por favor, especifica un destino para el viaje.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/asistente-maleta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          armario,
          destino,
          dias,
          clima,
          actividades,
          perfilEstilo,
        }),
      });

      if (!res.ok) {
        throw new Error("Fallo en la conexión con el asistente de maletas.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError("Ocurrió un error al procesar tu maleta. Por favor reinténtalo.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to find clothing item details by ID
  const findPrenda = (id: string): Prenda | undefined => {
    return armario.find((p) => p.id === id);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 font-sans text-tinta" id="seccion-asistente-maleta">
      {/* Intro Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-laton/20 bg-[#F4F4F5] text-[#18181B] text-[10px] font-bold uppercase tracking-widest mb-2.5">
          <Briefcase size={11} className="text-laton" />
          <span>Equipaje de Cápsula Minimalista</span>
        </div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta">
          Asistente de Maletas Inteligente
        </h2>
        <p className="text-xs text-tinta-apagada max-w-xl mx-auto mt-1">
          Introduce tu próximo destino y deja que nuestro estilista automatizado analice tu armario virtual para estructurar la maleta perfecta: máxima elegancia viajando ligero.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side Column - Config Form */}
        <div className="lg:col-span-5 bg-tarjeta border border-linea rounded p-5 space-y-4">
          <h3 className="font-serif text-sm font-bold text-tinta border-b border-linea/60 pb-2 flex items-center gap-2">
            Planificar Ruta de Viaje
          </h3>

          <form onSubmit={handleGenerarMaleta} className="space-y-4 text-xs">
            {/* Destino */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-laton flex items-center gap-1">
                <MapPin size={12} /> Ciudad o Región de Destino
              </label>
              <input
                type="text"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Ej: Florencia, Tokio, San Sebastián..."
                className="w-full bg-fondo text-tinta placeholder-tinta-apagada/30 text-xs border border-linea rounded p-2.5 focus:border-laton focus:outline-none transition-all font-sans"
                required
              />
            </div>

            {/* Duración (Días) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-laton flex items-center gap-1">
                <Calendar size={12} /> Duración de la Estancia (Días)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="14"
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                  className="w-full accent-laton bg-linea cursor-pointer"
                />
                <span className="font-serif text-sm font-bold text-tinta bg-fondo px-3 py-1 rounded min-w-[50px] text-center border border-linea/20">
                  {dias} {dias === 1 ? "día" : "días"}
                </span>
              </div>
            </div>

            {/* Clima de Destino */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-laton flex items-center gap-1">
                <Sun size={12} /> Atmósfera y Clima del Destino
              </label>
              <select
                value={clima}
                onChange={(e) => setClima(e.target.value)}
                className="w-full bg-fondo text-tinta border border-linea rounded p-2.5 focus:border-laton focus:outline-none transition-all font-sans"
              >
                <option value="Templado primaveral (18ºC)">Primaveral / Templado (15ºC - 22ºC)</option>
                <option value="Calor de verano soleado (30ºC)">Estío Soleado / Playa (25ºC - 35ºC)</option>
                <option value="Húmedo y lluvioso otoñal">Húmedo / Lluvia / Viento</option>
                <option value="Frío invernal severo (5ºC)">Frío Severo / Nieve (-5ºC - 10ºC)</option>
                <option value="Clima variable con noches frías">Transición Variable (Noches Frías)</option>
              </select>
            </div>

            {/* Tipo de Actividades */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-laton flex items-center gap-1">
                <ShoppingBag size={12} /> Propósito y Agenda de Actividades
              </label>
              <textarea
                value={actividades}
                onChange={(e) => setActividades(e.target.value)}
                placeholder="Ej: Reuniones de negocios formales, cenas boutique por la noche, caminatas de turismo intenso..."
                className="w-full bg-fondo text-tinta placeholder-tinta-apagada/30 border border-linea rounded p-2.5 focus:border-laton focus:outline-none transition-all min-h-[60px] resize-none leading-relaxed font-sans"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded text-[11px] leading-normal font-sans">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 font-serif text-xs font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 border shadow-lg cursor-pointer transition-all ${
                loading
                  ? "bg-tarjeta border-linea text-tinta-apagada"
                  : "bg-laton/15 border-laton/40 text-[#18181B] hover:bg-laton/25 hover:border-laton/60 active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-laton border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Cargando Estilo de Viaje...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} className="animate-pulse" />
                  <span>Planificar Maleta de Viaje</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side Column - Results View */}
        <div className="lg:col-span-7 space-y-4 min-h-[400px]">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col items-center justify-center border border-linea/60 bg-tarjeta rounded p-8 text-center"
              >
                <Briefcase size={40} className="text-laton-apagado animate-bounce mb-3" />
                <h4 className="font-serif text-sm font-semibold text-tinta">Organización de Equipaje Activa</h4>
                <p className="text-[11px] text-tinta-apagada max-w-[280px] mt-1 leading-relaxed">
                  Evaluando la cohesión térmica de tus prendas e ideando outfits atemporales para vestir en {destino || "tu viaje"}. Por favor espera un momento bajo el hilo del Gemini-3.5 master...
                </p>
              </motion.div>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Destino Card Analysis */}
                <div className="bg-tarjeta border border-linea rounded p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-[#F4F4F5] border border-laton/20 flex items-center justify-center text-laton shrink-0">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h4 className="font-serif text-base font-bold text-tinta tracking-tight">
                        Cuaderno de Viaje: {destino}
                      </h4>
                      <p className="text-[11px] text-tinta-apagada/80 leading-relaxed font-sans mt-1">
                        {result.analisis_destino}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seleccion de Prendas Reales */}
                <div className="bg-tarjeta border border-linea rounded p-5 space-y-3">
                  <h4 className="font-serif text-xs font-bold text-tinta uppercase tracking-wider pb-1 border-b border-linea/60 flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-[#18181B]" />
                    <span>Prendas de tu Armario para Empacar ({result.prendas_seleccionadas.length})</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {result.prendas_seleccionadas.map((id) => {
                      const p = findPrenda(id);
                      if (!p) return null;
                      return (
                        <div
                          key={id}
                          className="bg-fondo/60 border border-linea/60 rounded p-2 flex flex-col items-center text-center space-y-1"
                        >
                          <img
                            src={p.imageSrc}
                            alt={p.nombre}
                            className="w-14 h-14 object-cover rounded bg-fondo2 border border-linea/30"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-[10px] text-tinta font-medium line-clamp-1 w-full" title={p.nombre}>
                            {p.nombre}
                          </p>
                          <span className="text-[8px] uppercase tracking-wider text-laton/80 font-mono">
                            {p.tejido || "Algodón mixto"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Why this selection justifications */}
                  <div className="mt-3 bg-fondo/40 p-3 rounded border border-linea/30 space-y-2 max-h-[160px] overflow-y-auto scrollbar-none">
                    {result.por_que_seleccion_garment.map((just, idx) => {
                      const p = findPrenda(just.prenda_id);
                      if (!p) return null;
                      return (
                        <div key={idx} className="text-[10.5px] leading-relaxed flex gap-1.5">
                          <span className="text-laton font-serif shrink-0 font-bold">•</span>
                          <span className="text-tinta">
                            <strong className="text-tinta font-bold">{p.nombre}:</strong> {just.motivo_seleccion}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daily Combinations */}
                <div className="bg-tarjeta border border-linea rounded p-5 space-y-3">
                  <h4 className="font-serif text-xs font-bold text-tinta uppercase tracking-wider pb-1 border-b border-linea/60 flex items-center gap-1.5">
                    <Flame size={13} className="text-[#18181B]" />
                    <span>Propuestas de Outfit por Jornada ({result.combinaciones.length})</span>
                  </h4>

                  <div className="space-y-4">
                    {result.combinaciones.map((comb, idx) => (
                      <div
                        key={idx}
                        className="bg-fondo/60 border border-linea/40 rounded p-4 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-sm font-semibold text-laton">
                            Día {comb.dia_numero}
                          </span>
                          <span className="text-[10px] text-tinta-apagada bg-fondo border border-linea px-2 py-0.5 rounded font-sans font-medium">
                            {comb.titulo_actividad}
                          </span>
                        </div>

                        <p className="text-[10.5px] text-tinta leading-relaxed">
                          {comb.explicacion_outfit}
                        </p>

                        {/* Combined thumbnail indicators */}
                        <div className="flex items-center gap-2 pt-1 border-t border-linea/20">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-tinta-apagada font-mono pr-2 shrink-0">Combinación:</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const resolved = comb.prendas_combinadas
                                .map(findPrenda)
                                .filter((p): p is Prenda => !!p)
                                .sort((a, b) => {
                                  const order = { top: 1, pantalon: 2, calzado: 3, accesorio: 4 };
                                  const catA = order[a.categoria as keyof typeof order] || 5;
                                  const catB = order[b.categoria as keyof typeof order] || 5;
                                  if (catA !== catB) return catA - catB;
                                  if (a.categoria === "top" && b.categoria === "top") {
                                    return obtenerCapaDePrenda(a).nivel - obtenerCapaDePrenda(b).nivel;
                                  }
                                  return 0;
                                });
                              return resolved.map((p) => {
                                const capaInfo = obtenerCapaDePrenda(p);
                                const isTop = p.categoria === "top";
                                const tooltipTitle = isTop ? `${p.nombre} (${capaInfo.etiqueta})` : p.nombre;
                                return (
                                  <div key={p.id} className="relative group shrink-0" title={tooltipTitle}>
                                    <img
                                      src={p.imageSrc}
                                      alt={p.nombre}
                                      className="w-8 h-8 rounded-full border border-linea object-cover bg-fondo2 hover:scale-110 transition duration-150"
                                      referrerPolicy="no-referrer"
                                    />
                                    {isTop && (
                                      <span className={`absolute -bottom-1 -right-1 text-[6.5px] font-mono font-extrabold px-1 rounded uppercase tracking-tighter shadow-sm border ${capaInfo.color} ${capaInfo.bg} border-linea/20`}>
                                        C{capaInfo.nivel}
                                      </span>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extras Checklist Recommendations */}
                <div className="bg-tarjeta border border-linea rounded p-5 space-y-3">
                  <h4 className="font-serif text-xs font-bold text-tinta uppercase tracking-wider pb-1 border-b border-linea/60">
                    Sugerencias Sencillas y Equipaje Extra
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] text-tinta-apagada leading-normal">
                    {result.recomendaciones_extras.map((extra, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-normal">
                        <CheckCircle size={11} className="text-laton shrink-0 mt-0.5" />
                        <span>{extra}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center border border-dashed border-linea rounded text-center p-8 bg-tarjeta/40">
                <Briefcase size={44} className="text-tinta-apagada/40 mb-3" />
                <h4 className="font-serif text-sm font-semibold text-tinta">Maleta en Blanco</h4>
                <p className="text-[11.5px] text-tinta-apagada max-w-xs mt-1 leading-relaxed">
                  Completa el panel de control de viaje a la izquierda y presiona el botón dorado para planificar tu maleta utilizando las prendas reales de tu armario.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
