import React, { useState } from "react";
import { Prenda, LookPlanificado, HistorialLook } from "../types";
import { Calendar, Sun, Cloud, CloudRain, CloudLightning, Thermometer, Sparkles, Plus, Trash2, Check, ArrowRight, Eye, RefreshCw, Shirt, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PlanificadorLooksProps {
  armario: Prenda[];
  historial: HistorialLook[];
  planificaciones: LookPlanificado[];
  onAgregarPlanificacion: (plan: LookPlanificado) => void;
  onEliminarPlanificacion: (id: string) => void;
  onMarcarComoVestido: (prendasIds: string[]) => void;
}

const CIUDADES_PRESETS = [
  { nombre: "Madrid", baseTemp: 18, clima: "soleado" },
  { nombre: "Barcelona", baseTemp: 21, clima: "nublado" },
  { nombre: "Londres", baseTemp: 13, clima: "lluvioso" },
  { nombre: "París", baseTemp: 15, clima: "nublado" },
  { nombre: "Buenos Aires", baseTemp: 22, clima: "soleado" },
];

const CLIMAS_INFO = {
  soleado: { icon: Sun, color: "text-amber-400", bg: "bg-amber-500/10", label: "Soleado", desc: "Día despejado, ideal para prendas transpirables y accesorios como gafas de sol." },
  nublado: { icon: Cloud, color: "text-blue-300", bg: "bg-blue-500/10", label: "Nublado", desc: "Cielo cubierto. Ideal para looks de entretiempo con capas ligeras." },
  lluvioso: { icon: CloudRain, color: "text-sky-400", bg: "bg-sky-500/10", label: "Lluvioso", desc: "Precipitación activa. Se requiere calzado impermeable, gabardina o cortavientos." },
  tormenta: { icon: CloudLightning, color: "text-purple-400", bg: "bg-purple-500/10", label: "Tormenta", desc: "Clima adverso. Elige abrigos protectores, calzado cerrado de cuero y evita prendas delicadas de ante o seda." },
  frio: { icon: Thermometer, color: "text-teal-300", bg: "bg-teal-500/10", label: "Frío Extremo", desc: "Temperaturas bajo mínimos. Prioriza lana merina, abrigos estructurados gruesos y bufandas." }
};

export const getClimaDia = (ciudad: string, index: number) => {
  const baseCity = CIUDADES_PRESETS.find(c => c.nombre === ciudad) || CIUDADES_PRESETS[0];
  const tempOffsets = [0, 2, -1, -3, 1, 3, 2];
  const conds: ("soleado" | "nublado" | "lluvioso" | "tormenta" | "frio")[] = 
    ["soleado", "soleado", "nublado", "lluvioso", "soleado", "soleado", "nublado"];

  let finalTemp = baseCity.baseTemp + tempOffsets[index % 7];
  let finalCond = conds[index % 7];

  if (ciudad === "Barcelona") {
    const offsets = [0, 1, -2, -1, 2, 1, 0];
    const c: typeof finalCond[] = ["nublado", "soleado", "soleado", "lluvioso", "nublado", "soleado", "soleado"];
    finalTemp = baseCity.baseTemp + offsets[index % 7];
    finalCond = c[index % 7];
  } else if (ciudad === "Londres") {
    const offsets = [0, -2, -1, -3, 1, 0, -2];
    const c: typeof finalCond[] = ["lluvioso", "nublado", "lluvioso", "tormenta", "nublado", "lluvioso", "frio"];
    finalTemp = baseCity.baseTemp + offsets[index % 7];
    finalCond = c[index % 7];
  } else if (ciudad === "París") {
    const offsets = [0, 1, -2, -3, 0, 2, -1];
    const c: typeof finalCond[] = ["nublado", "lluvioso", "nublado", "soleado", "soleado", "nublado", "frio"];
    finalTemp = baseCity.baseTemp + offsets[index % 7];
    finalCond = c[index % 7];
  } else if (ciudad === "Buenos Aires") {
    const offsets = [0, 3, 1, -2, 4, 2, -1];
    const c: typeof finalCond[] = ["soleado", "soleado", "tormenta", "nublado", "soleado", "soleado", "nublado"];
    finalTemp = baseCity.baseTemp + offsets[index % 7];
    finalCond = c[index % 7];
  }

  return {
    temp: finalTemp,
    condicion: finalCond
  };
};

export default function PlanificadorLooks({
  armario,
  historial,
  planificaciones,
  onAgregarPlanificacion,
  onEliminarPlanificacion,
  onMarcarComoVestido,
}: PlanificadorLooksProps) {
  const [selectedCity, setSelectedCity] = useState("Madrid");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState<string | null>(null);
  
  // Form states
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [selectedPrendasIds, setSelectedPrendasIds] = useState<string[]>([]);
  const [modalCiudad, setModalCiudad] = useState("Madrid");
  const [modalClima, setModalClima] = useState<"soleado" | "nublado" | "lluvioso" | "tormenta" | "frio">("soleado");
  const [modalTemp, setModalTemp] = useState(18);

  const getDaysOfWeek = () => {
    const days = [];
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const nombresDias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const formatStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        nombre: nombresDias[i],
        fechaStr: formatStr,
        diaMes: d.getDate(),
        mesName: d.toLocaleString("es-ES", { month: "short" }).toUpperCase().replace(".", "")
      });
    }
    return days;
  };

  const diasSemana = getDaysOfWeek();

  const handleOpenAddModal = (fecha: string, temp: number, clima: "soleado" | "nublado" | "lluvioso" | "tormenta" | "frio") => {
    setModalDate(fecha);
    setModalTitle("");
    setSelectedPrendasIds([]);
    
    setModalCiudad(selectedCity);
    setModalClima(clima);
    setModalTemp(temp);
    
    setShowModal(true);
  };

  const handleCreatePlan = async () => {
    if (!modalTitle.trim()) {
      alert("Por favor, introduce un nombre para el look o plan.");
      return;
    }

    const newPlan: LookPlanificado = {
      id: "plan_" + Date.now(),
      fecha: modalDate,
      nombre_look: modalTitle,
      prendasIds: selectedPrendasIds,
      clima_simulado: {
        temp: modalTemp,
        condicion: modalClima,
        ciudad: modalCiudad
      }
    };

    // Generate smart local sarto-advisory first
    newPlan.comentarios_sastre = generateLocalSartoAdvice(newPlan);

    onAgregarPlanificacion(newPlan);
    setShowModal(false);

    // Now trigger async AI advice from Gemini
    triggerAiAdvice(newPlan.id);
  };

  const generateLocalSartoAdvice = (plan: LookPlanificado) => {
    const selectedPrendas = armario.filter(p => plan.prendasIds.includes(p.id));
    if (selectedPrendas.length === 0) {
      return "Planificador vacío. Selecciona prendas de tu armario para evaluar el grado de protección climática.";
    }

    const calzado = selectedPrendas.find(p => p.categoria === "calzado");
    const abrigo = selectedPrendas.find(p => p.categoria === "top" && (p.nombre.toLowerCase().includes("abrigo") || p.nombre.toLowerCase().includes("chaqueta") || p.nombre.toLowerCase().includes("blazer") || p.tejido?.toLowerCase().includes("lana") || p.tejido?.toLowerCase().includes("cuero")));
    const pantalón = selectedPrendas.find(p => p.categoria === "pantalon");

    let advice = `Atelier climatológico (${plan.clima_simulado.ciudad}, ${plan.clima_simulado.temp}°C): `;

    if (plan.clima_simulado.condicion === "lluvioso" || plan.clima_simulado.condicion === "tormenta") {
      if (calzado && (calzado.nombre.toLowerCase().includes("lona") || calzado.nombre.toLowerCase().includes("ante") || calzado.tejido?.toLowerCase().includes("ante"))) {
        advice += "⚠️ Alerta de calzado: El ante y la lona se dañarán con la lluvia. Te recomendamos encarecidamente cambiar a calzado de charol o cuero impermeable. ";
      } else {
        advice += "✓ Tu calzado es apto para el asfalto mojado. ";
      }
      if (!abrigo) {
        advice += "⚠️ Te falta una capa exterior impermeable o un cortavientos clásico en tu composición superior.";
      } else {
        advice += "✓ Excelente elección de prenda de abrigo.";
      }
    } else if (plan.clima_simulado.condicion === "frio") {
      if (plan.clima_simulado.temp < 10) {
        const tieneLana = selectedPrendas.some(p => p.tejido?.toLowerCase().includes("lana") || p.nombre.toLowerCase().includes("lana"));
        if (!tieneLana) {
          advice += "⚠️ Protección térmica baja: Las prendas seleccionadas carecen de fibras naturales de abrigo como lana o cachemira. Pasarás frío.";
        } else {
          advice += "✓ Capas térmicas correctas: Sintonía de lana para el frío siberiano.";
        }
      }
    } else if (plan.clima_simulado.condicion === "soleado") {
      if (plan.clima_simulado.temp > 24) {
        const tieneLanaGruesa = selectedPrendas.some(p => p.categoria === "top" && (p.tejido?.toLowerCase().includes("lana") || p.nombre.toLowerCase().includes("lana") || p.nombre.toLowerCase().includes("invierno")));
        if (tieneLanaGruesa) {
          advice += "⚠️ Alerta de sofoco: Llevas lana gruesa a más de 24°C. Busca camisas de lino o algodón orgánico ligero.";
        } else {
          advice += "✓ Confort estival: Selección ligera, fresca y transpirable.";
        }
      } else {
        advice += "✓ Confort térmico excelente para pasear bajo el sol de sastre.";
      }
    } else {
      advice += "✓ Composición equilibrada de capas medias para clima variable.";
    }

    return advice;
  };

  const triggerAiAdvice = async (planId: string) => {
    const planObj = planificaciones.find(p => p.id === planId) || planificaciones[planificaciones.length - 1];
    if (!planObj) return;

    setLoadingAdvice(planId);
    try {
      const selectedPrendas = armario.filter(p => planObj.prendasIds.includes(p.id));
      const response = await fetch("/api/plan-clima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciudad: planObj.clima_simulado.ciudad,
          temperatura: planObj.clima_simulado.temp,
          condicion: planObj.clima_simulado.condicion,
          nombre_look: planObj.nombre_look,
          prendas: selectedPrendas.map(p => ({
            nombre: p.nombre,
            categoria: p.categoria,
            color: p.color,
            tejido: p.tejido || "Algodón",
            temporada: p.temporada
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.consejo) {
          // Update the specific plan
          planObj.comentarios_sastre = data.consejo;
        }
      }
    } catch (err) {
      console.error("Failed to fetch AI climate advice:", err);
    } finally {
      setLoadingAdvice(null);
    }
  };

  const togglePrendaInModal = (id: string) => {
    setSelectedPrendasIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const selectHistorialLook = (look: HistorialLook) => {
    setModalTitle(look.look.titulo);
    setSelectedPrendasIds(look.look.id_prendas);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-laton/20 bg-[#1e1a13] text-[#C9A35B] text-[10px] font-bold uppercase tracking-widest mb-2.5">
          <Calendar size={11} className="text-laton animate-pulse" />
          <span>Sartorial Agenda & Weather Tracker</span>
        </div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-white animate-fade-in">
          Planificador Semanal de Looks
        </h2>
        <p className="text-xs text-tinta-apagada max-w-xl mx-auto mt-1 leading-relaxed">
          Diseña tu elegancia de lunes a domingo. Consulta el clima simulado de las principales capitales de moda y recibe un informe de idoneidad térmica elaborado por el Sastre AI.
        </p>

        {/* Global city selector */}
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {CIUDADES_PRESETS.map((city) => (
            <button
              key={city.nombre}
              onClick={() => setSelectedCity(city.nombre)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                selectedCity === city.nombre
                  ? "bg-laton text-fondo"
                  : "bg-tarjeta text-tinta-apagada hover:text-white hover:bg-tarjeta/80 border border-linea/60"
              }`}
            >
              📍 {city.nombre} ({city.baseTemp}°C)
            </button>
          ))}
        </div>
      </div>

      {/* THE WEEK VIEW GRID */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {diasSemana.map((dia, index) => {
          const planesDia = planificaciones.filter(p => p.fecha === dia.fechaStr);
          const isToday = new Date().toISOString().split("T")[0] === dia.fechaStr;
          const climaDia = getClimaDia(selectedCity, index);
          const ClimaIcon = CLIMAS_INFO[climaDia.condicion]?.icon || Sun;

          return (
            <div
              key={dia.fechaStr}
              className={`rounded-lg border p-3 flex flex-col justify-between min-h-[220px] transition duration-200 relative ${
                isToday
                  ? "bg-laton/10 border-laton shadow-md shadow-amber-950/10"
                  : "bg-tarjeta/40 border-linea/80 hover:border-linea"
              }`}
            >
              {/* Day header */}
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-laton font-bold block">
                      {dia.nombre}
                    </span>
                    <span className="text-lg font-serif font-extrabold text-white">
                      {dia.diaMes}
                    </span>
                    <span className="text-[8px] font-mono text-tinta-apagada ml-1">
                      {dia.mesName}
                    </span>
                  </div>

                  {/* Weather badge simulated */}
                  <div className="text-right">
                    <div className={`p-1 rounded ${CLIMAS_INFO[climaDia.condicion]?.bg || "bg-white/5"}`} title={CLIMAS_INFO[climaDia.condicion]?.label}>
                      <ClimaIcon size={12} className={CLIMAS_INFO[climaDia.condicion]?.color} />
                      <span className="text-[8.5px] font-mono text-white block mt-0.5">{climaDia.temp}°C</span>
                    </div>
                  </div>
                </div>

                {/* Planned Outfit Details */}
                <div className="mt-3.5 space-y-2">
                  {planesDia.length === 0 ? (
                    <button
                      onClick={() => handleOpenAddModal(dia.fechaStr, climaDia.temp, climaDia.condicion)}
                      className="w-full py-2 border border-dashed border-linea/80 hover:border-laton/50 rounded flex flex-col items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-tinta-apagada hover:text-white transition duration-150"
                    >
                      <Plus size={10} className="text-laton" />
                      <span>Agendar Outfit</span>
                    </button>
                  ) : (
                    planesDia.map((plan) => {
                      const planPrendas = armario.filter(pr => plan.prendasIds.includes(pr.id));
                      return (
                        <div key={plan.id} className="p-2 bg-fondo border border-linea rounded text-left space-y-2.5 relative">
                          <div>
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider line-clamp-1">{plan.nombre_look}</p>
                            <span className="text-[7.5px] text-laton uppercase tracking-wider font-mono">
                              {plan.clima_simulado.ciudad} ({plan.clima_simulado.temp}°C)
                            </span>
                          </div>

                          {/* Previews of items */}
                          <div className="flex flex-wrap gap-1">
                            {planPrendas.map(pr => (
                              <div
                                key={pr.id}
                                className="w-5 h-5 rounded border border-linea bg-tarjeta/60 flex items-center justify-center overflow-hidden"
                                title={pr.nombre}
                              >
                                {pr.imageSrc ? (
                                  <img src={pr.imageSrc} alt={pr.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.color }} />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Sarto Climatic coaching summary */}
                          {plan.comentarios_sastre && (
                            <div className="text-[8.5px] text-tinta leading-snug bg-tarjeta/30 p-1.5 border border-linea/40 rounded italic font-serif">
                              {plan.comentarios_sastre}
                            </div>
                          )}

                          {/* Interactions */}
                          <div className="flex items-center justify-between pt-1 border-t border-linea/40 gap-1.5">
                            <button
                              onClick={() => {
                                onMarcarComoVestido(plan.prendasIds);
                                alert("¡Prendas marcadas como puestas! Su contador de usos se incrementó en +1 y su Coste-por-Uso se recalculó instantáneamente.");
                              }}
                              className="text-[8px] bg-laton hover:bg-white text-fondo font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition flex items-center gap-0.5"
                              title="Marca que usaste este look hoy para amortizar su coste de compra en las estadísticas"
                            >
                              <Check size={8} /> Vestido
                            </button>
                            <button
                              onClick={() => onEliminarPlanificacion(plan.id)}
                              className="text-red-400 hover:text-red-300 p-0.5"
                              title="Eliminar planificación"
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD AGENDA MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-tarjeta border border-linea rounded-xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto no-scrollbar space-y-4"
            >
              <div className="flex justify-between items-center border-b border-linea pb-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-white">Agendar Combinación Sastrera</h3>
                  <p className="text-[10px] text-tinta-apagada font-mono">FECHA SELECCIONADA: {modalDate}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 text-tinta-apagada hover:text-white border border-linea rounded"
                >
                  ✕
                </button>
              </div>

              {/* Title / Ocasion Form */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-laton font-bold block">Título del Look o Evento</label>
                <input
                  type="text"
                  placeholder="ej: Reunión Ejecutiva, Brunch de Fin de Semana, Cóctel de Gala"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full p-2.5 bg-fondo border border-linea rounded text-xs text-white focus:outline-none focus:border-laton"
                />
              </div>

              {/* Weather simulation selectors inside modal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-fondo/50 border border-linea/60 p-3 rounded">
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-laton font-bold block mb-1">Simular Ciudad</label>
                  <select
                    value={modalCiudad}
                    onChange={(e) => {
                      const cityPreset = CIUDADES_PRESETS.find(c => c.nombre === e.target.value) || CIUDADES_PRESETS[0];
                      setModalCiudad(cityPreset.nombre);
                      setModalClima(cityPreset.clima as any);
                      setModalTemp(cityPreset.baseTemp);
                    }}
                    className="w-full bg-tarjeta border border-linea rounded p-1.5 text-xs text-white"
                  >
                    {CIUDADES_PRESETS.map(c => (
                      <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-laton font-bold block mb-1">Simular Clima</label>
                  <select
                    value={modalClima}
                    onChange={(e) => setModalClima(e.target.value as any)}
                    className="w-full bg-tarjeta border border-linea rounded p-1.5 text-xs text-white"
                  >
                    <option value="soleado">Soleado</option>
                    <option value="nublado">Nublado</option>
                    <option value="lluvioso">Lluvioso</option>
                    <option value="tormenta">Tormenta</option>
                    <option value="frio">Frío Extremo</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-laton font-bold block mb-1">Temperatura (°C)</label>
                  <input
                    type="number"
                    value={modalTemp}
                    onChange={(e) => setModalTemp(parseInt(e.target.value) || 15)}
                    className="w-full bg-tarjeta border border-linea rounded p-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Fast presets from saved Looks inside history */}
              {historial.length > 0 && (
                <div className="space-y-1.5 bg-laton/5 p-3 rounded border border-laton/10">
                  <span className="text-[8px] uppercase tracking-wider text-laton font-bold block">
                    ✨ Elegir rápidamente de un look guardado:
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {historial.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectHistorialLook(item)}
                        className="px-2.5 py-1.5 bg-tarjeta/60 border border-linea hover:border-laton rounded text-[10px] text-white shrink-0 transition text-left"
                      >
                        <strong className="block text-[8px] text-laton uppercase">{item.ocasion}</strong>
                        {item.look.titulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Wardrobe garment selections */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-laton font-bold block">
                  Selecciona Prendas de tu Armario ({selectedPrendasIds.length} elegidas)
                </label>
                {armario.length === 0 ? (
                  <p className="text-[10px] text-tinta-apagada italic">No tienes prendas registradas en tu vestidor digital para seleccionar.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar border border-linea/60 p-2 rounded bg-black/15">
                    {armario.map((pr) => {
                      const isSelected = selectedPrendasIds.includes(pr.id);
                      return (
                        <div
                          key={pr.id}
                          onClick={() => togglePrendaInModal(pr.id)}
                          className={`p-2 rounded border cursor-pointer transition flex items-center gap-2.5 ${
                            isSelected ? "border-laton bg-laton/10" : "border-linea bg-tarjeta/40 hover:bg-tarjeta/70"
                          }`}
                        >
                          <div className="w-8 h-8 rounded border border-linea bg-fondo flex-shrink-0 overflow-hidden">
                            {pr.imageSrc ? (
                              <img src={pr.imageSrc} alt={pr.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: pr.color }}>
                                {pr.categoria[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9.5px] text-white truncate leading-tight font-medium">{pr.nombre}</p>
                            <span className="text-[7.5px] font-mono text-tinta-apagada block uppercase leading-none">{pr.categoria}</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-laton bg-laton text-fondo" : "border-linea bg-black/25"
                          }`}>
                            {isSelected && <Check size={8} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-end pt-3 border-t border-linea">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-linea text-tinta-apagada hover:text-white rounded text-xs font-bold uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreatePlan}
                  className="px-4 py-2 bg-laton hover:bg-white text-fondo font-bold rounded text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Plus size={12} /> Agendar Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
