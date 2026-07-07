import React, { useState } from "react";
import { Prenda, CategoriaPrenda, PerfilEstilo } from "../types";
import { Sparkles, ShoppingBag, TrendingUp, HelpCircle, Scissors, CheckCircle, Tag, DollarSign, ArrowRight, Lightbulb, ExternalLink, Search, ShoppingCart, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AsesorComprasProps {
  armario: Prenda[];
  perfilEstilo?: PerfilEstilo | null;
}

interface PropuestaTienda {
  marca: string;
  modelo: string;
  precio_aproximado: string;
  termino_busqueda: string;
}

interface MissingBasic {
  nombre_prenda: string;
  categoria: string;
  por_que_es_clave: string;
  rango_color_sugerido: string;
  propuestas_tiendas?: PropuestaTienda[];
}

interface StarPurchase {
  item: string;
  tipo: string;
  descripcion_detallada: string;
  potencial_combinaciones_explicado: string;
  rango_precio_estimado_en_euros: string;
  propuestas_tiendas?: PropuestaTienda[];
}

interface ComprasResult {
  basicos_faltantes: MissingBasic[];
  analisis_capsula: string;
  proxima_compra_estrella: StarPurchase;
}

const getZalandoSearchUrl = (query: string) => {
  return `https://www.zalando.es/catalogo/?q=${encodeURIComponent(query)}`;
};

const getAsosSearchUrl = (query: string) => {
  return `https://www.asos.com/es/search/?q=${encodeURIComponent(query)}`;
};

const getGoogleShoppingUrl = (query: string) => {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
};

export default function AsesorCompras({ armario, perfilEstilo }: AsesorComprasProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComprasResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStoreTab, setActiveStoreTab] = useState<string>("zalando");

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
        throw new Error("No se pudo conectar con el recomendador de compras inteligente.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("No se ha podido procesar el reporte de compras. Por favor reinténtalo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 font-sans text-tinta" id="seccion-asesor-compras">
      {/* Editorial Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-laton/20 bg-[#F4F4F5] text-[#18181B] text-[10px] font-bold uppercase tracking-widest mb-2.5">
          <TrendingUp size={11} className="text-laton" />
          <span>Personal Shopper & Multi-Brand Connector</span>
        </div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta animate-fade-in">
          Asesor de Compras y Tendencias
        </h2>
        <p className="text-xs text-tinta-apagada max-w-xl mx-auto mt-1 leading-relaxed">
          Nuestra Inteligencia Artificial analiza tu ropero actual, identifica qué vacíos impiden armar más looks y los conecta con propuestas de marcas reales en Zalando, ASOS y más para adquirirlos al instante.
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
            <div className="w-14 h-14 rounded-full bg-[#F4F4F5] border border-laton/20 flex items-center justify-center text-laton">
              <ShoppingBag size={24} />
            </div>
            <h3 className="font-serif text-base font-bold text-tinta">¿Qué básicos faltan en tu armario?</h3>
            <p className="text-xs text-tinta-apagada leading-relaxed max-w-sm">
              Conectar tu armario actual con Gemini permite simular un escáner de combinaciones. Descubrirás prendas conectoras clave y obtendrás enlaces de búsqueda directos a las mejores tiendas de moda.
            </p>

            {error && (
              <p className="text-[11px] text-red-600 bg-red-50 px-3 py-2 rounded leading-tight border border-red-200">
                {error}
              </p>
            )}

            <button
              onClick={handleAnalizarCompras}
              className="button-press py-3 px-5 font-serif text-xs font-bold uppercase tracking-widest rounded bg-laton/15 border border-laton/40 text-[#18181B] hover:bg-laton/25 hover:border-laton/60 shadow-md cursor-pointer transition-all flex items-center gap-2"
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
            <h4 className="font-serif text-sm font-semibold text-tinta">Preparando Análisis de Tendencias</h4>
            <p className="text-xs text-tinta-apagada max-w-xs leading-relaxed mt-1">
              Escaneando la composición cromática... Buscando alternativas en catálogos multimarca de Zalando y ASOS... Redactando veredicto de Slow Fashion...
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
                  <h3 className="font-serif text-sm font-bold text-tinta uppercase tracking-wider">
                    Veredicto Editorial de Macrotendencias
                  </h3>
                </div>
                <p className="text-xs text-tinta-apagada leading-relaxed font-sans mt-1 bg-fondo2/30 p-4 border border-linea/60 rounded">
                  {result?.analisis_capsula}
                </p>
              </div>

              {/* Absolute Star Next Purchase Spotlight */}
              {result?.proxima_compra_estrella && (
                <div className="bg-laton/5 border border-linea rounded-lg p-5 relative overflow-hidden space-y-4">
                  {/* Decorative soft background shine overlay */}
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-laton/5 filter blur-xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-laton/15 text-[#18181B] text-[9px] font-bold uppercase tracking-widest border border-linea">
                      <Lightbulb size={10} className="text-laton" />
                      <span>PRÓXIMA ADQUISICIÓN CLAVE</span>
                    </div>
                    <span className="text-[10px] text-tinta-apagada font-mono">
                      Inversión inteligente
                    </span>
                  </div>

                  <div className="space-y-1 relative z-10">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-laton/80 block">
                      {result.proxima_compra_estrella.tipo}
                    </span>
                    <h4 className="font-serif text-lg font-bold text-tinta leading-tight">
                      {result.proxima_compra_estrella.item}
                    </h4>
                  </div>

                  <p className="text-xs text-tinta-apagada leading-relaxed relative z-10">
                    {result.proxima_compra_estrella.descripcion_detallada}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-linea text-[11px] relative z-10">
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-[#52525B] block font-bold">Rango de Coste Sugerido</span>
                      <p className="text-tinta font-mono font-medium flex items-center mt-0.5 gap-0.5">
                        <DollarSign size={11} className="text-laton" />
                        {result.proxima_compra_estrella.rango_precio_estimado_en_euros}
                      </p>
                    </div>

                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-[#52525B] block font-bold">Potencial de Armonización</span>
                      <p className="text-tinta-apagada leading-relaxed mt-0.5">
                        {result.proxima_compra_estrella.potencial_combinaciones_explicado}
                      </p>
                    </div>
                  </div>

                  {/* Multi-Brand Store Integration for Star Purchase */}
                  {result.proxima_compra_estrella.propuestas_tiendas && result.proxima_compra_estrella.propuestas_tiendas.length > 0 && (
                    <div className="pt-3 border-t border-linea relative z-10">
                      <span className="text-[8.5px] uppercase tracking-wider text-tinta font-bold block mb-2">
                        🛍️ Opciones disponibles en tiendas de marca:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {result.proxima_compra_estrella.propuestas_tiendas.map((prop, idx) => (
                          <div key={idx} className="bg-tarjeta border border-linea rounded p-2.5 flex flex-col justify-between space-y-2">
                            <div>
                              <div className="flex justify-between items-start gap-1">
                                <span className="text-[9.5px] font-mono text-[#18181B] font-bold bg-[#F4F4F5] px-1.5 py-0.5 rounded border border-linea">
                                  {prop.marca}
                                </span>
                                <span className="text-[10px] font-mono text-tinta-apagada">{prop.precio_aproximado}</span>
                              </div>
                              <p className="text-[10.5px] text-tinta font-medium mt-1 line-clamp-1">{prop.modelo}</p>
                            </div>
                            
                            <div className="flex gap-1 pt-1.5 border-t border-linea">
                              <a
                                href={getZalandoSearchUrl(prop.termino_busqueda)}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer"
                                className="flex-1 py-1 px-1 bg-[#F4F4F5] hover:bg-[#FF6900]/10 hover:border-[#FF6900]/30 border border-linea rounded text-[9px] text-tinta font-bold text-center flex items-center justify-center gap-0.5 hover:text-[#FF6900] transition-colors"
                                title="Ver en Zalando"
                              >
                                <ShoppingCart size={8} />
                                <span>Zalando</span>
                              </a>
                              <a
                                href={getAsosSearchUrl(prop.termino_busqueda)}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer"
                                className="py-1 px-1.5 hover:bg-fondo hover:text-tinta rounded text-[9px] text-tinta-apagada font-bold text-center flex items-center justify-center gap-0.5 border border-linea transition-colors"
                                title="Ver en ASOS"
                              >
                                <span>ASOS</span>
                              </a>
                              <a
                                href={getGoogleShoppingUrl(prop.termino_busqueda)}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer"
                                className="py-1 px-1.5 hover:bg-fondo hover:text-tinta rounded text-[9px] text-tinta-apagada font-bold text-center flex items-center justify-center gap-0.5 border border-linea transition-colors"
                                title="Google Shopping"
                              >
                                <Globe size={8} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Wardrobe Basics Gaps (5 Cols) */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-tarjeta border border-linea rounded p-5 space-y-4">
                <div className="border-b border-linea pb-2 flex items-center justify-between">
                  <h3 className="font-serif text-sm font-bold text-tinta flex items-center gap-2">
                    <Tag size={13} className="text-laton" />
                    <span>Multiplicadores de Armario</span>
                  </h3>
                  <span className="text-[9.5px] font-bold text-laton/80 uppercase font-mono bg-[#F4F4F5] px-2 py-0.5 rounded border border-laton/10">
                    Gaps de Base
                  </span>
                </div>

                <div className="space-y-4">
                  {result?.basicos_faltantes.map((missing, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-fondo2/40 border border-linea/60 rounded space-y-3 relative"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-serif text-xs font-bold text-tinta leading-tight max-w-[180px]">
                          {missing.nombre_prenda}
                        </h4>
                        <span className="text-[8.5px] text-laton uppercase font-mono font-bold bg-[#F4F4F5] px-1.5 py-0.5 rounded">
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

                      {/* Multi-Brand Store Integration for Basics */}
                      {missing.propuestas_tiendas && missing.propuestas_tiendas.length > 0 && (
                        <div className="pt-2 border-t border-linea/20 space-y-2">
                          <span className="text-[8px] uppercase tracking-wider text-laton/70 font-bold block">
                            🛒 Comprar en Tiendas Asociadas:
                          </span>
                          <div className="space-y-1.5">
                            {missing.propuestas_tiendas.map((prop, sIdx) => (
                              <div key={sIdx} className="bg-fondo hover:bg-fondo2/60 border border-linea p-2 rounded transition-all flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-mono text-laton font-semibold uppercase">{prop.marca}</span>
                                    <span className="text-[9px] text-tinta-apagada/40">•</span>
                                    <span className="text-[9px] text-tinta-apagada font-mono font-bold">{prop.precio_aproximado}</span>
                                  </div>
                                  <p className="text-[9.5px] text-tinta truncate max-w-[170px]" title={prop.modelo}>
                                    {prop.modelo}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                  <a
                                    href={getZalandoSearchUrl(prop.termino_busqueda)}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    rel="noopener noreferrer"
                                    className="p-1 px-1.5 bg-[#F4F4F5] hover:bg-[#FF6900]/10 hover:border-[#FF6900]/30 border border-linea text-tinta rounded text-[8px] font-bold flex items-center gap-0.5 transition-all"
                                    title="Buscar en Zalando España"
                                  >
                                    <span>Zalando</span>
                                    <ExternalLink size={7} />
                                  </a>
                                  <a
                                    href={getAsosSearchUrl(prop.termino_busqueda)}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:bg-[#18181B] hover:text-white text-tinta-apagada border border-linea rounded text-[8px] font-semibold transition-all"
                                    title="Buscar en ASOS"
                                  >
                                    <span>ASOS</span>
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setResult(null);
                      setError(null);
                    }}
                    className="w-full py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-tinta-apagada hover:text-tinta transition-colors bg-fondo2/40 border border-linea rounded cursor-pointer"
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

