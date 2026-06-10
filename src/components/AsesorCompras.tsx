import React, { useState } from "react";
import { Prenda, CategoriaPrenda, PerfilEstilo } from "../types";
import { Sparkles, ShoppingBag, TrendingUp, HelpCircle, Scissors, CheckCircle, Tag, DollarSign, ArrowRight, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AsesorComprasProps {
  armario: Prenda[];
  perfilEstilo?: PerfilEstilo | null;
}

interface MissingBasic {
  nombre_prenda: string;
  categoria: string;
  por_que_es_clave: string;
  rango_color_sugerido: string;
}

interface StarPurchase {
  item: string;
  tipo: string;
  descripcion_detallada: string;
  potencial_combinaciones_explicado: string;
  rango_precio_estimado_en_euros: string;
}

interface ComprasResult {
  basicos_faltantes: MissingBasic[];
  analisis_capsula: string;
  proxima_compra_estrella: StarPurchase;
}

export default function AsesorCompras({ armario, perfilEstilo }: AsesorComprasProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComprasResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalizarCompras = async () => {
    if (armario.length === 0) {
      setError("Necesitas primero subir prendas a tu armario para analizar tendencias de compra.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analizar-compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armario, perfilEstilo }),
      });

      if (!res.ok) {
        throw new Error("No se pudo conectar con el recomendador de compras sastreras.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("No se ha podido procesar el reporte de compras en el atelier. Por favor reinténtalo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 font-sans text-tinta" id="seccion-asesor-compras">
      {/* Editorial Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-laton/20 bg-[#1e1a13] text-[#C9A35B] text-[10px] font-bold uppercase tracking-widest mb-2.5">
          <TrendingUp size={11} className="text-laton" />
          <span>Personal Shopper & Trend Spotter</span>
        </div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-white animate-fade-in">
          Asesor de Compras y Tendencias
        </h2>
        <p className="text-xs text-tinta-apagada max-w-xl mx-auto mt-1 leading-relaxed">
          Nuestra Inteligencia Artificial analiza el volumen, colores y materiales de tu ropero actual, identifica qué vacíos impiden armar más looks y traza tus próximas adquisiciones estelares de alta costura.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!result && !loading ? (
          /* Landing Action View */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="border border-dashed border-linea rounded-lg bg-tarjeta/60 p-10 text-center max-w-xl mx-auto flex flex-col items-center space-y-4"
          >
            <div className="w-14 h-14 rounded-full bg-[#1e1a13] border border-laton/20 flex items-center justify-center text-laton">
              <ShoppingBag size={24} />
            </div>
            <h3 className="font-serif text-base font-bold text-white">¿Qué básicos faltan en tu armario?</h3>
            <p className="text-xs text-tinta-apagada leading-relaxed max-w-sm">
              Conectar tu armario actual con Gemini permite simular un escáner de combinaciones. Descubrirás de 2 a 3 prendas conectoras clave y obtendrás una reseña del estilo sastrero ideal para ti.
            </p>

            {error && (
              <p className="text-[11px] text-red-300 bg-red-950/30 px-3 py-2 rounded leading-tight border border-red-900/40">
                {error}
              </p>
            )}

            <button
              onClick={handleAnalizarCompras}
              className="button-press py-3 px-5 font-serif text-xs font-bold uppercase tracking-widest rounded bg-laton/15 border border-laton/40 text-laton hover:bg-laton/25 hover:border-laton/60 shadow-md cursor-pointer transition-all flex items-center gap-2"
            >
              <Sparkles size={12} className="animate-pulse" />
              <span>Generar Informe de Inversión</span>
            </button>
          </motion.div>
        ) : loading ? (
          /* Loading Animation state */
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-linea" />
              <div className="absolute inset-0 rounded-full border-2 border-laton border-t-transparent animate-spin" />
              <Scissors size={24} className="text-laton animate-pulse" />
            </div>
            <h4 className="font-serif text-sm font-semibold text-white">Hilvanando Análisis de Tendencias</h4>
            <p className="text-xs text-tinta-apagada max-w-xs leading-relaxed mt-1">
              Escaneando la composición cromática... Calculando huecos de formalidad sastrera... Redactando veredicto de Slow Fashion en el Gemini Master-3.5 engine...
            </p>
          </motion.div>
        ) : (
          /* Results Dashboard View */
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
          >
            {/* Left Column: Trend Analysis & Next Purchase (7 Cols) */}
            <div className="md:col-span-7 space-y-6">
              {/* Editorial Trend Card */}
              <div className="bg-tarjeta border border-linea rounded p-5 space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-laton" />
                  <h3 className="font-serif text-sm font-bold text-white uppercase tracking-wider">
                    Veredicto Editorial de Macrotendencias
                  </h3>
                </div>
                <p className="text-xs text-tinta-apagada leading-relaxed font-sans mt-1 bg-fondo2/30 p-4 border border-linea/60 rounded">
                  {result?.analisis_capsula}
                </p>
              </div>

              {/* Absolute Star Next Purchase Spotlight */}
              {result?.proxima_compra_estrella && (
                <div className="bg-[#1c1811] border border-laton/30 rounded-lg p-5 relative overflow-hidden space-y-4">
                  {/* Decorative gold background shine overlay */}
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-laton/5 filter blur-xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-laton/20 text-laton text-[9px] font-bold uppercase tracking-widest border border-laton/30">
                      <Lightbulb size={10} className="text-laton" />
                      <span>PRÓXIMA ADQUISICIÓN CLAVE</span>
                    </div>
                    <span className="text-[10px] text-tinta-apagada font-mono">
                      Inversión inteligente
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-laton/80 block">
                      {result.proxima_compra_estrella.tipo}
                    </span>
                    <h4 className="font-serif text-lg font-bold text-white leading-tight">
                      {result.proxima_compra_estrella.item}
                    </h4>
                  </div>

                  <p className="text-xs text-tinta leading-relaxed">
                    {result.proxima_compra_estrella.descripcion_detallada}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-laton/10 text-[11px]">
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-laton/80 block font-bold">Rango de Coste Sugerido</span>
                      <p className="text-white font-mono font-medium flex items-center mt-0.5 gap-0.5">
                        <DollarSign size={11} className="text-laton" />
                        {result.proxima_compra_estrella.rango_price_estimado_en_euros || result.proxima_compra_estrella.rango_precio_estimado_en_euros}
                      </p>
                    </div>

                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-laton/80 block font-bold">Potencial de Armonización</span>
                      <p className="text-tinta leading-relaxed mt-0.5">
                        {result.proxima_compra_estrella.potencial_combinaciones_explicado}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Wardrobe Basics Gaps (5 Cols) */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-tarjeta border border-linea rounded p-5 space-y-4">
                <div className="border-b border-linea pb-2 flex items-center justify-between">
                  <h3 className="font-serif text-sm font-bold text-white flex items-center gap-2">
                    <Tag size={13} className="text-laton" />
                    <span>Multiplicadores de Armario</span>
                  </h3>
                  <span className="text-[9.5px] font-bold text-laton/80 uppercase font-mono bg-[#1e1a13] px-2 py-0.5 rounded border border-laton/10">
                    Gaps de Base
                  </span>
                </div>

                <div className="space-y-3">
                  {result?.basicos_faltantes.map((missing, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-fondo2/40 border border-linea/60 rounded space-y-2 relative"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-serif text-xs font-bold text-white leading-tight max-w-[180px]">
                          {missing.nombre_prenda}
                        </h4>
                        <span className="text-[8.5px] text-laton uppercase font-mono font-bold bg-[#1e1a13] px-1.5 py-0.5 rounded">
                          {missing.categoria}
                        </span>
                      </div>

                      <p className="text-[10.5px] text-tinta-apagada leading-relaxed">
                        {missing.por_que_es_clave}
                      </p>

                      <div className="text-[9.5px] flex items-center gap-1.5 pt-1.5 border-t border-linea/20">
                        <span className="font-bold text-laton/80 uppercase">Paleta Recomendada:</span>
                        <span className="text-tinta font-medium">{missing.rango_color_sugerido}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setResult(null);
                      setError(null);
                    }}
                    className="w-full py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-tinta-apagada hover:text-white transition-colors bg-fondo2/40 border border-linea rounded cursor-pointer"
                  >
                    Volver a Analizar / Repetir Escaneo
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
