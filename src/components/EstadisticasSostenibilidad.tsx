import React, { useState } from "react";
import { Prenda } from "../types";
import { DollarSign, Tag, Award, Sparkles, AlertCircle, TrendingDown, Trash2, Edit2, Check, RefreshCw, Layers, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface EstadisticasSostenibilidadProps {
  armario: Prenda[];
  onActualizarPrenda: (id: string, updates: Partial<Prenda>) => void;
}

export default function EstadisticasSostenibilidad({
  armario,
  onActualizarPrenda,
}: EstadisticasSostenibilidadProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editWorn, setEditWorn] = useState<string>("");
  const [editMaterial, setEditMaterial] = useState<string>("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const startEditing = (pr: Prenda) => {
    setEditingId(pr.id);
    setEditPrice(String(pr.precio_compra ?? ""));
    setEditWorn(String(pr.veces_puesto ?? "0"));
    setEditMaterial(pr.composicion_tejido ?? pr.tejido ?? "Algodón");
  };

  const saveEdits = (id: string) => {
    const priceNum = parseFloat(editPrice);
    const wornNum = parseInt(editWorn);
    
    onActualizarPrenda(id, {
      precio_compra: isNaN(priceNum) ? undefined : priceNum,
      veces_puesto: isNaN(wornNum) ? 0 : wornNum,
      composicion_tejido: editMaterial || undefined
    });
    setEditingId(null);
  };

  // Calculations
  const totalInvertido = armario.reduce((acc, pr) => acc + (pr.precio_compra ?? 0), 0);
  const totalUsos = armario.reduce((acc, pr) => acc + (pr.veces_puesto ?? 0), 0);
  const promedioCpW = totalUsos > 0 ? (totalInvertido / totalUsos) : 0;

  // Sorter helpers
  const getCPW = (pr: Prenda) => {
    const price = pr.precio_compra ?? 0;
    const uses = pr.veces_puesto ?? 0;
    if (price === 0) return 0;
    if (uses === 0) return price; // cost is full price
    return price / uses;
  };

  const prendasConPrecio = armario.filter(p => (p.precio_compra ?? 0) > 0);

  // Amortized Heroes (lowest CPW, but must be worn at least once)
  const heroesAmortizados = [...prendasConPrecio]
    .filter(p => (p.veces_puesto ?? 0) > 0)
    .sort((a, b) => getCPW(a) - getCPW(b))
    .slice(0, 3);

  // Forgotten / Underutilized (highest CPW or never worn but expensive)
  const prendasOlvidadas = [...armario]
    .filter(p => (p.precio_compra ?? 0) > 0)
    .sort((a, b) => getCPW(b) - getCPW(a))
    .slice(0, 3);

  // Materials analysis for eco score
  const getMaterialCategory = (p: Prenda) => {
    const mat = (p.composicion_tejido || p.tejido || "").toLowerCase();
    if (mat.includes("lana") || mat.includes("seda") || mat.includes("lino") || mat.includes("cache") || mat.includes("alpaca")) {
      return "organic_noble"; // High durability, natural noble
    }
    if (mat.includes("algod") || mat.includes("denim") || mat.includes("sarga") || mat.includes("cuero")) {
      return "organic_standard"; // Natural standard
    }
    if (mat.includes("poliester") || mat.includes("sintet") || mat.includes("nylon") || mat.includes("acrilico") || mat.includes("poliamida")) {
      return "synthetic"; // Synthetic
    }
    return "standard";
  };

  const countMaterials = () => {
    let noble = 0;
    let standard = 0;
    let synthetic = 0;

    armario.forEach(p => {
      const cat = getMaterialCategory(p);
      if (cat === "organic_noble") noble++;
      else if (cat === "organic_standard") standard++;
      else if (cat === "synthetic") synthetic++;
    });

    const total = armario.length || 1;
    return {
      noblePct: Math.round((noble / total) * 100),
      standardPct: Math.round((standard / total) * 100),
      syntheticPct: Math.round((synthetic / total) * 100)
    };
  };

  const materialsStats = countMaterials();

  // Sustainability score calculated out of 100
  // Formula: noble weight * 1.0 + standard weight * 0.7 + synthetic weight * 0.2 + (promedio CPW weight)
  const calculateEcoScore = () => {
    if (armario.length === 0) return 0;
    let score = 50; // base score
    
    // Fiber contribution
    score += (materialsStats.noblePct * 0.4);
    score += (materialsStats.standardPct * 0.2);
    score -= (materialsStats.syntheticPct * 0.3);

    // Circularity contribution: wear counts
    const wearRatio = totalUsos / (armario.length || 1);
    if (wearRatio > 15) score += 10;
    else if (wearRatio > 5) score += 5;
    else score -= 5;

    return Math.min(Math.max(Math.round(score), 10), 100);
  };

  const ecoScore = calculateEcoScore();

  const handleFetchAiFinance = async () => {
    setLoadingAdvice(true);
    try {
      const response = await fetch("/api/sarto-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_invertido: totalInvertido,
          promedio_cpw: promedioCpW,
          total_usos: totalUsos,
          prendas: armario.map(p => ({
            nombre: p.nombre,
            categoria: p.categoria,
            precio: p.precio_compra || 0,
            usos: p.veces_puesto || 0,
            tejido: p.composicion_tejido || p.tejido || "Algodón"
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.consejo) {
          setAiAdvice(data.consejo);
        }
      } else {
        setAiAdvice("Atelier Financiero: Te sugerimos amortizar aquellas americanas y zapatos que superen los 50€ por uso. Trata de incorporarlos en looks relajados para tus salidas informales.");
      }
    } catch (err) {
      console.error(err);
      setAiAdvice("Atelier Financiero: Te sugerimos amortizar aquellas americanas y zapatos que superen los 50€ por uso. Trata de incorporarlos en looks relajados para tus salidas informales.");
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-laton/20 bg-[#F4F4F5] text-[#18181B] text-[10px] font-bold uppercase tracking-widest mb-2.5">
          <TrendingDown size={11} className="text-laton animate-pulse" />
          <span>Sartorial Finances & Cost-per-Wear Tracker</span>
        </div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta animate-fade-in">
          Coste Por Uso (CPW) y Sostenibilidad
        </h2>
        <p className="text-xs text-tinta-apagada max-w-xl mx-auto mt-1 leading-relaxed">
          Logra un armario sostenible y de alto rendimiento. Introduce el precio de compra de tus prendas y haz un seguimiento de sus usos para calcular el Coste por Uso real (CPW) y la pureza textil de tus fibras.
        </p>
      </div>

      {/* CLOSET FINANCIAL METRICS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-tarjeta/40 border border-linea/60 rounded-xl p-4 space-y-1">
          <span className="text-[8px] uppercase tracking-wider text-laton font-bold block">Valor Total Invertido</span>
          <p className="text-2xl font-serif font-black text-tinta">{totalInvertido.toFixed(2)} €</p>
          <p className="text-[10px] text-tinta-apagada">Suma de todas las adquisiciones registradas.</p>
        </div>

        <div className="bg-tarjeta/40 border border-linea/60 rounded-xl p-4 space-y-1">
          <span className="text-[8px] uppercase tracking-wider text-laton font-bold block">Total Usos Registrados</span>
          <p className="text-2xl font-serif font-black text-tinta">{totalUsos} usos</p>
          <p className="text-[10px] text-tinta-apagada">Incrementado automáticamente al marcar looks.</p>
        </div>

        <div className="bg-tarjeta/40 border border-linea/60 rounded-xl p-4 space-y-1">
          <span className="text-[8px] uppercase tracking-wider text-laton font-bold block">Coste Promedio por Uso (CPW)</span>
          <p className="text-2xl font-serif font-black text-laton">{promedioCpW.toFixed(2)} €</p>
          <p className="text-[10px] text-tinta-apagada">Inversión amortizada global de tu atelier.</p>
        </div>

        {/* ECO-SCORE BENTO BLOCK */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[8px] uppercase tracking-wider text-emerald-800 font-bold">Índice Circular y Eco-Score</span>
              <ShieldCheck size={14} className="text-emerald-700" />
            </div>
            <p className="text-2xl font-serif font-black text-emerald-800 mt-1">{ecoScore} / 100</p>
          </div>
          <div className="w-full bg-emerald-100 rounded-full h-1.5 mt-2 overflow-hidden border border-emerald-200">
            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${ecoScore}%` }} />
          </div>
          <p className="text-[9px] text-emerald-800/80 mt-1 leading-tight">
            Premia fibras naturales nobles (lana, seda, lino) y alta frecuencia de uso de tus prendas.
          </p>
        </div>
      </div>

      {/* HIGHLIGHTS: HEROES & FORGOTTEN ONES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HEROES */}
        <div className="bg-tarjeta/40 border border-linea/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-amber-500/10 text-laton">
              <Award size={14} />
            </div>
            <h3 className="font-serif text-sm font-semibold text-tinta">Prendas Más Amortizadas (Héroes del Armario)</h3>
          </div>

          {heroesAmortizados.length === 0 ? (
            <p className="text-[11px] text-tinta-apagada italic">Comienza a registrar precios de compra y marcas "Vestido" en el planificador para ver qué prendas se amortizan mejor.</p>
          ) : (
            <div className="space-y-2">
              {heroesAmortizados.map((p) => (
                <div key={p.id} className="bg-fondo hover:bg-fondo2/50 border border-linea p-2.5 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-fondo border border-linea rounded overflow-hidden flex-shrink-0">
                      {p.imageSrc ? (
                        <img src={p.imageSrc} alt={p.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: p.color }}>
                          {p.categoria[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-tinta truncate">{p.nombre}</p>
                      <p className="text-[9px] text-tinta-apagada font-mono uppercase">{p.categoria} • {p.veces_puesto} usos</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[8px] uppercase tracking-wider text-emerald-700 font-bold block">Coste/Uso</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">{getCPW(p).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FORGOTTEN / UNDERUTILIZED */}
        <div className="bg-tarjeta/40 border border-linea/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-red-500/10 text-red-600">
              <AlertCircle size={14} />
            </div>
            <h3 className="font-serif text-sm font-semibold text-tinta">Prendas Olvidadas u Costosas</h3>
          </div>

          {prendasOlvidadas.length === 0 ? (
            <p className="text-[11px] text-tinta-apagada italic">No hay suficientes prendas con precios asignados para calcular.</p>
          ) : (
            <div className="space-y-2">
              {prendasOlvidadas.map((p) => (
                <div key={p.id} className="bg-fondo hover:bg-fondo2/50 border border-linea p-2.5 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-fondo border border-linea rounded overflow-hidden flex-shrink-0">
                      {p.imageSrc ? (
                        <img src={p.imageSrc} alt={p.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: p.color }}>
                          {p.categoria[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-tinta truncate">{p.nombre}</p>
                      <p className="text-[9px] text-tinta-apagada font-mono uppercase">{p.categoria} • {p.veces_puesto || 0} usos</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[8px] uppercase tracking-wider text-red-600 font-bold block">Coste/Uso</span>
                    <span className="text-xs font-mono font-bold text-red-600">{getCPW(p).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI FINANCIAL COACHING VERDICT */}
      <div className="bg-tarjeta/30 border border-linea/60 rounded-xl p-4 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 text-laton/20">
          <Sparkles size={40} />
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <Sparkles size={16} className="text-laton animate-pulse" />
          <h3 className="font-serif text-sm font-bold text-tinta">Análisis Financiero de Sastre AI</h3>
        </div>

        {aiAdvice ? (
          <p className="text-xs text-tinta leading-relaxed font-serif italic bg-[#F4F4F5] p-3 rounded border border-linea animate-fade-in relative z-10">
            {aiAdvice}
          </p>
        ) : (
          <div className="space-y-2 relative z-10">
            <p className="text-xs text-tinta-apagada">
              Genera una recomendación de sastre totalmente personalizada para balancear tu inversión de moda y planificar de forma inteligente tus próximas adquisiciones estelares.
            </p>
            <button
              onClick={handleFetchAiFinance}
              disabled={loadingAdvice}
              className="py-1.5 px-3.5 bg-[#18181B] hover:bg-black text-white font-bold uppercase tracking-wider rounded text-[9.5px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loadingAdvice ? (
                <>
                  <RefreshCw size={10} className="animate-spin" /> Elaborando Informe...
                </>
              ) : (
                <>
                  <Sparkles size={10} /> Solicitar Informe Financiero
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* EDITABLE CLOSET ITEMS TABLE */}
      <div className="bg-tarjeta/40 border border-linea/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-laton" />
            <h3 className="font-serif text-sm font-semibold text-tinta">Administrador de Precios y Fibras</h3>
          </div>
          <span className="text-[9px] text-tinta-apagada font-mono uppercase">CLOSET DATABASE ({armario.length} ITEMS)</span>
        </div>

        {armario.length === 0 ? (
          <p className="text-xs text-tinta-apagada italic text-center py-6">Tu armario está vacío. Registra prendas primero para configurar sus costes.</p>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-linea/60 text-laton font-bold uppercase text-[8px] tracking-wider">
                  <th className="py-2">Prenda</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Tejido / Composición</th>
                  <th className="py-2">Precio (€)</th>
                  <th className="py-2">Usos (veces)</th>
                  <th className="py-2">CPW (€/uso)</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea/20">
                {armario.map((p) => {
                  const isEditing = editingId === p.id;
                  const currentCPW = getCPW(p);

                  return (
                    <tr key={p.id} className="hover:bg-fondo2/30 transition duration-150">
                      <td className="py-3 flex items-center gap-2.5 max-w-[180px]">
                        <div className="w-7 h-7 bg-fondo border border-linea rounded overflow-hidden flex-shrink-0">
                          {p.imageSrc ? (
                            <img src={p.imageSrc} alt={p.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: p.color }} />
                          )}
                        </div>
                        <span className="font-medium text-tinta truncate text-[11px]">{p.nombre}</span>
                      </td>

                      <td className="py-3 text-[10px] text-tinta-apagada font-mono uppercase">
                        {p.categoria}
                      </td>

                      <td className="py-3 text-[11px] text-tinta">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMaterial}
                            onChange={(e) => setEditMaterial(e.target.value)}
                            className="bg-fondo border border-linea rounded px-1.5 py-0.5 text-xs text-tinta w-24 focus:outline-none focus:border-laton"
                          />
                        ) : (
                          p.composicion_tejido || p.tejido || "Algodón"
                        )}
                      </td>

                      <td className="py-3 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="bg-fondo border border-linea rounded px-1.5 py-0.5 text-xs text-tinta w-16 focus:outline-none focus:border-laton font-mono"
                          />
                        ) : p.precio_compra !== undefined ? (
                          `${p.precio_compra.toFixed(2)} €`
                        ) : (
                          <span className="text-tinta-apagada/40">Sin precio</span>
                        )}
                      </td>

                      <td className="py-3 font-mono text-tinta">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editWorn}
                            onChange={(e) => setEditWorn(e.target.value)}
                            className="bg-fondo border border-linea rounded px-1.5 py-0.5 text-xs text-tinta w-14 focus:outline-none focus:border-laton font-mono"
                          />
                        ) : (
                          p.veces_puesto || 0
                        )}
                      </td>

                      <td className="py-3 font-mono font-bold">
                        {currentCPW > 0 ? (
                          <span className={currentCPW < 10 ? "text-emerald-700" : currentCPW < 30 ? "text-amber-700" : "text-tinta"}>
                            {currentCPW.toFixed(2)} €
                          </span>
                        ) : (
                          <span className="text-tinta-apagada/30">-</span>
                        )}
                      </td>

                      <td className="py-3 text-right">
                        {isEditing ? (
                          <button
                            onClick={() => saveEdits(p.id)}
                            className="p-1 bg-laton text-white rounded hover:bg-white/80 transition"
                            title="Guardar"
                          >
                            <Check size={11} />
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditing(p)}
                            className="p-1 hover:bg-white/10 text-tinta hover:text-laton rounded transition"
                            title="Editar coste y fibra"
                          >
                            <Edit2 size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
