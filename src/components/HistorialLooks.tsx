import React, { useState } from "react";
import { HistorialLook, Prenda } from "../types";
import { Trash2, Heart, Clock, Sparkles, Shirt, ChevronDown, ChevronUp, Eye, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HistorialLooksProps {
  historial: HistorialLook[];
  armario: Prenda[];
  onEliminar: (id: string) => void;
  onToggleFavorito: (id: string) => void;
  onSeleccionar: (item: HistorialLook) => void;
}

export default function HistorialLooks({
  historial,
  armario,
  onEliminar,
  onToggleFavorito,
  onSeleccionar,
}: HistorialLooksProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCompartir = async (item: HistorialLook, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const textToShare = `✨ *Atelier Espejo - Estilista Personal IA* ✨\n\n` +
      `Look Propuesto para: *${item.ocasion}* (${item.clima})\n` +
      `• Estilo: ${item.look.titulo}\n` +
      `• Corte o peinado: ${item.look.pelo_sugerido}\n` +
      `• Rasgos / Estilo facial: ${item.look.barba_sugerida}\n` +
      `• Por qué funciona: "${item.look.porque}"\n\n` +
      `Descubre tu estilista personal virtual en Atelier Espejo.`;

    const shareUrl = `${window.location.origin}/?look=${encodeURIComponent(item.look.titulo)}&event=${encodeURIComponent(item.ocasion)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Look Espejo - ${item.look.titulo}`,
          text: textToShare,
          url: shareUrl,
        });
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 3000);
        return;
      } catch (err) {
        console.log("Navigator Share cancelado o fallido:", err);
      }
    }

    // Fallback: copy to clipboard
    try {
      const fullShareContent = `${textToShare}\n\nEnlace del Look: ${shareUrl}`;
      await navigator.clipboard.writeText(fullShareContent);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      console.error("No se pudo copiar el texto", err);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  const sortedHistorial = [...historial].sort((a, b) => {
    // Favorites first, then newest
    if (a.favorito && !b.favorito) return -1;
    if (!a.favorito && b.favorito) return 1;
    return new Date(b.id.split("_")[1] ? parseInt(b.id.split("_")[1]) : 0).getTime() - 
           new Date(a.id.split("_")[1] ? parseInt(a.id.split("_")[1]) : 0).getTime();
  });

  return (
    <section id="historial-looks-seccion" className="border-t border-linea pt-8 pb-4">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-laton font-medium text-lg">04</span>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta">Historial de Looks</h2>
        </div>
        <p className="text-xs font-sans text-tinta-apagada select-none font-medium">SAVED IMPRESSIONS</p>
      </div>

      {historial.length === 0 ? (
        <div className="p-8 bg-tarjeta/10 rounded-lg border border-linea text-center">
          <Clock size={24} className="text-laton-apagado mx-auto mb-3 opacity-60" />
          <h3 className="font-serif text-base font-semibold text-tinta">Historial vacío</h3>
          <p className="text-xs text-tinta-apagada mt-1.5 max-w-sm mx-auto leading-relaxed">
            Tus combinaciones y asesorías planificadas aparecerán aquí. Cuando generes estilismos, se registrarán automáticamente para que puedas recuperarlos del sastre en cualquier momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-tinta-apagada uppercase tracking-wider font-medium mb-1">
            Looks Guardados ({historial.length})
          </p>
          
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {sortedHistorial.map((item) => {
                const isExpanded = expandedId === item.id;
                
                // Get clothing items that exist in our current wardrobe
                const itemsEncontrados = item.look.id_prendas
                  .map((id) => armario.find((p) => p.id === id))
                  .filter((p): p is Prenda => !!p);

                // Determine thumbnail image
                let miniaturaSrc = "";
                if (item.look.simulatedImageUrl) {
                  miniaturaSrc = item.look.simulatedImageUrl;
                } else if (itemsEncontrados.length > 0) {
                  miniaturaSrc = itemsEncontrados[0].imageSrc;
                }

                return (
                  <motion.div
                    key={item.id}
                    layout="position"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
                    className={`bg-tarjeta rounded-lg border transition-all duration-300 overflow-hidden ${
                      isExpanded ? "border-laton/50 shadow-lg shadow-black/30" : "border-linea hover:border-laton-apagado/50"
                    }`}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={(e) => toggleExpand(item.id, e)}
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail or Icon */}
                        <div className="w-12 h-12 rounded overflow-hidden bg-fondo border border-linea/60 shrink-0 flex items-center justify-center relative">
                          {miniaturaSrc ? (
                            <img
                              src={miniaturaSrc}
                              alt={item.look.titulo}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Shirt size={16} className="text-laton-apagado" />
                          )}
                          {item.look.simulatedImageUrl && (
                            <div className="absolute inset-x-0 bottom-0 bg-laton/90 text-fondo text-[6px] font-bold text-center py-0.5 uppercase tracking-wide">
                              Espejo
                            </div>
                          )}
                        </div>

                        {/* Event title and occasion metadata */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-tinta-apagada font-mono tracking-wide">
                              {item.fecha}
                            </span>
                            {item.favorito && (
                              <span className="inline-block px-1 py-0.5 text-[8px] bg-laton/10 border border-laton/30 text-laton rounded uppercase font-medium">
                                Favorito
                              </span>
                            )}
                          </div>
                          <h3 className="font-serif text-[15px] font-bold text-tinta truncate max-w-[200px] sm:max-w-xs mt-0.5">
                            {item.ocasion}
                          </h3>
                          <p className="text-[11px] text-tinta-apagada font-light truncate max-w-[180px] sm:max-w-xs leading-none">
                            Clima: {item.clima}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Favorite button */}
                        <button
                          type="button"
                          id={`boton-favorito-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorito(item.id);
                          }}
                          className={`button-press p-2 rounded-full border transition-colors ${
                            item.favorito
                              ? "bg-laton/10 border-laton text-laton"
                              : "border-linea text-tinta-apagada/60 hover:text-laton hover:border-laton-apagado"
                          }`}
                          title="Marcar como favorito"
                        >
                          <Heart size={14} className={item.favorito ? "fill-laton" : ""} />
                        </button>

                        {/* Select/Load Look button */}
                        <button
                          type="button"
                          id={`boton-cargar-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSeleccionar(item);
                          }}
                          className="button-press flex items-center gap-1 px-2.5 py-1.5 bg-fondo border border-linea hover:border-laton hover:text-laton text-tinta-apagada text-[10px] uppercase font-semibold tracking-wide rounded select-none"
                          title="Cargar look en visualizador"
                        >
                          <Eye size={12} /> Cargar
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          id={`boton-eliminar-historial-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("¿Seguro que deseas eliminar este look del historial?")) {
                              onEliminar(item.id);
                            }
                          }}
                          className="button-press p-2 rounded-full border border-linea text-tinta-apagada/60 hover:text-red-400 hover:border-red-900/30 transition-colors"
                          title="Eliminar del historial"
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* Toggle Expand arrow */}
                        <div className="text-tinta-apagada hover:text-tinta ml-1">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Details */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.4 }}
                          className="border-t border-linea bg-fondo2/40"
                        >
                          <div className="p-4 space-y-4">
                            {/* Detailed description */}
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-laton font-medium font-sans">
                                Estilismo Planificado: {item.look.titulo}
                              </span>
                              <p className="text-xs text-tinta-apagada leading-relaxed italic mt-1 font-light">
                                "{item.look.porque}"
                              </p>
                            </div>

                            {/* Hair and Beard suggestions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-linea/60">
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium">
                                  Corte o peinado sugerido
                                </span>
                                <p className="font-serif text-xs font-semibold text-tinta leading-snug">
                                  {item.look.pelo_sugerido}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium">
                                  Estilo facial / rasgos sugeridos
                                </span>
                                <p className="font-serif text-xs font-semibold text-tinta leading-snug">
                                  {item.look.barba_sugerida}
                                </p>
                              </div>
                            </div>

                            {/* Combined Garments */}
                            <div className="pt-3 border-t border-linea/60">
                              <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium block mb-2">
                                Prendas asociadas de tu armario ({itemsEncontrados.length})
                              </span>
                              
                              {itemsEncontrados.length === 0 ? (
                                <p className="text-[10px] text-tinta-apagada/60 italic">
                                  Las prendas asociadas a este look ya no existen en tu armario.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {itemsEncontrados.map((prenda) => (
                                    <div 
                                      key={prenda.id} 
                                      className="flex items-center gap-2 bg-tarjeta/80 border border-linea/60 rounded px-2 py-1 max-w-[200px]"
                                    >
                                      <div className="w-6 h-6 rounded overflow-hidden border border-linea/40 bg-fondo shrink-0">
                                        <img
                                          src={prenda.imageSrc}
                                          alt={prenda.nombre}
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-serif text-[10px] font-bold text-tinta truncate leading-tight">
                                          {prenda.nombre}
                                        </p>
                                        <p className="text-[7px] text-laton-apagado uppercase tracking-wider font-medium leading-none">
                                          {prenda.categoria}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Deep links */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-linea/40 mt-1">
                              <div>
                                {copiedId === item.id ? (
                                  <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-[10px] font-mono text-laton font-medium flex items-center gap-1"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-laton animate-ping" />
                                    ¡Look copiado con éxito!
                                  </motion.span>
                                ) : (
                                  <span className="text-[10px] text-tinta-apagada font-sans font-light">
                                    Comparte este look en tus redes sociales.
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  id={`boton-compartir-look-${item.id}`}
                                  onClick={(e) => handleCompartir(item, e)}
                                  className="button-press flex items-center gap-1.5 px-3 py-1.5 bg-tarjeta border border-linea hover:border-laton hover:text-laton text-tinta-apagada font-bold text-[10px] uppercase tracking-wider rounded select-none"
                                >
                                  <Share2 size={11} /> Compartir look
                                </button>
                                <button
                                  type="button"
                                  id={`boton-cargar-expandido-${item.id}`}
                                  onClick={() => onSeleccionar(item)}
                                  className="button-press flex items-center gap-1 px-3 py-1.5 bg-laton text-fondo font-bold text-[10px] uppercase tracking-wider rounded select-none hover:bg-white"
                                >
                                  Ver en el Espejo Principal <Sparkles size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
}
