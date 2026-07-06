import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, Check, Clipboard, Info, Sliders, Palette, ShieldAlert } from "lucide-react";
import { PerfilEstilo } from "../types";

interface DiagnosticoEstiloProps {
  userId: string;
  onPerfilGuardado: (perfil: PerfilEstilo) => void;
  perfilActual: PerfilEstilo | null;
}

export default function DiagnosticoEstilo({ userId, onPerfilGuardado, perfilActual }: DiagnosticoEstiloProps) {
  const [estiloVibe, setEstiloVibe] = useState("");
  const [formaSer, setFormaSer] = useState("");
  const [estiloObjetivo, setEstiloObjetivo] = useState("");
  const [estiloPresupuesto, setEstiloPresupuesto] = useState("");
  const [detallesLibres, setDetallesLibres] = useState("");
  
  // Quiz answers
  const [silueta, setSilueta] = useState("");
  const [colores, setColores] = useState<string[]>([]);
  const [rutina, setRutina] = useState("");
  const [edad, setEdad] = useState("");

  const [guardadoClank, setGuardadoClank] = useState(false);

  // Load from local storage or current state on mount
  useEffect(() => {
    if (perfilActual) {
      setEstiloVibe(perfilActual.estiloVibe || "");
      setFormaSer(perfilActual.formaSer || "");
      setEstiloObjetivo(perfilActual.estiloObjetivo || "");
      setEstiloPresupuesto(perfilActual.estiloPresupuesto || "");
      setDetallesLibres(perfilActual.detallesLibres || "");
      
      const resp = perfilActual.respuestasQuiz || {};
      setSilueta(resp.silueta || "");
      setColores(resp.colores || []);
      setRutina(resp.rutina || "");
      setEdad(resp.edad || "");
    } else {
      // Clear
      setEstiloVibe("");
      setFormaSer("");
      setEstiloObjetivo("");
      setEstiloPresupuesto("");
      setDetallesLibres("");
      setSilueta("");
      setColores([]);
      setRutina("");
      setEdad("");
    }
  }, [perfilActual]);

  const toggleColor = (col: string) => {
    if (colores.includes(col)) {
      setColores(colores.filter((c) => c !== col));
    } else {
      setColores([...colores, col]);
    }
  };

  const handleGuardar = () => {
    const nuevoPerfil: PerfilEstilo = {
      estiloVibe,
      formaSer,
      estiloObjetivo,
      estiloPresupuesto,
      detallesLibres,
      respuestasQuiz: {
        silueta,
        colores,
        rutina,
        edad
      }
    };
    onPerfilGuardado(nuevoPerfil);
    setGuardadoClank(true);
    setTimeout(() => setGuardadoClank(false), 2000);
  };

  return (
    <div id="diagnostico-estilo-sección" className="space-y-8">
      {/* Intro Header Card */}
      <div className="bg-tarjeta border border-linea rounded-xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-laton/5 via-transparent to-transparent pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded bg-laton/5 border border-laton/30 flex items-center justify-center text-laton shrink-0">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold uppercase tracking-wider text-[#09090B]">
              DIAGNÓSTICO & DOSSIER DE ESTILO
            </h3>
            <p className="font-mono text-[9px] text-laton uppercase tracking-widest mt-0.5">
              Personalización Sastrera por Inteligencia Artificial
            </p>
            <p className="font-sans text-xs text-tinta-apagada mt-2 leading-relaxed">
              Completa este breve cuestionario o describe tus objetivos en la caja de texto. 
              La IA acoplará esta información para calibrar con gran precisión tus looks, proponerte los básicos que te faltan y diagnosticar lo que te sobra.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Brief Questionnaire */}
        <div className="space-y-6 bg-tarjeta/60 border border-linea rounded-xl p-6">
          <div className="flex items-center gap-2 border-b border-linea pb-3">
            <Sliders size={16} className="text-laton" />
            <h4 className="font-serif text-sm font-bold uppercase tracking-wider text-white">
              Cuestionario de Estilo
            </h4>
          </div>

          {/* Rutina Diaria */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              ¿Cuál es tu rutina diaria o labor principal?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Oficina / Negocios", value: "Oficina Formal y Negocios" },
                { label: "Trabajo Remoto / Smart", value: "Remoto y Smart Casual" },
                { label: "Estudio o Entorno Creativo", value: "Estudiante o Entorno Creativo" },
                { label: "Activo / Aire Libre", value: "Trabajo Físico, Deporte o Exterior" }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRutina(item.value)}
                  className={`p-2.5 rounded text-[11px] text-left transition text-white border transition-all duration-200 cursor-pointer ${
                    rutina === item.value
                      ? "bg-laton/20 border-laton text-laton font-medium"
                      : "bg-fondo/40 border-linea/60 hover:border-laton/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Silueta Corporal */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              ¿Cuál es la forma o estructura de tu silueta?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Atlética / Trapezoide", value: "Atlética / Hombros anchos y cintura estrecha" },
                { label: "Delgada / Ectomorfa", value: "Ectomorfa / Constitución delgada y alargada" },
                { label: "Robusta / Endomorfa", value: "Endomorfa / Musculosa o de complexión ancha" },
                { label: "Corpulenta / Ovalada", value: "Ovalada / Volumen centrado en zona media" }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSilueta(item.value)}
                  className={`p-2.5 rounded text-[11px] text-left transition text-white border transition-all duration-200 cursor-pointer ${
                    silueta === item.value
                      ? "bg-laton/20 border-laton text-laton font-medium"
                      : "bg-fondo/40 border-linea/60 hover:border-laton/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-tinta-apagada italic leading-normal flex items-start gap-1">
              <Info size={11} className="text-laton shrink-0 mt-0.5" />
              La IA priorizará patrones que equilibren tus proporciones.
            </p>
          </div>

          {/* Vibe preferida */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              Estilo de Preferencia (Vibe)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Quiet Luxury / Atemporal", value: "Quiet Luxury y Clásico Minimalista" },
                { label: "Vanguardista / Moderno", value: "Vanguardista, Estilo Urbano de Diseño" },
                { label: "Cómodo y Relajado", value: "Casual Relajado y Confortable" },
                { label: "Estilo Carácter / Rock / Sastrería", value: "Rockero Sastrería con personalidad" }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setEstiloVibe(item.value)}
                  className={`p-2.5 rounded text-[11px] text-left transition text-white border transition-all duration-200 cursor-pointer ${
                    estiloVibe === item.value
                      ? "bg-laton/20 border-laton text-laton font-medium"
                      : "bg-fondo/40 border-linea/60 hover:border-laton/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rango de Edad */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              Estilo Generacional (Edad de imagen)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {["20s", "30s", "40s", "50s+"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEdad(item)}
                  className={`p-2 rounded text-[11px] text-center transition text-white border transition-all duration-200 cursor-pointer ${
                    edad === item
                      ? "bg-laton/20 border-laton text-laton font-medium"
                      : "bg-fondo/40 border-linea/60"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Colores */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B] flex items-center gap-1.5">
              <Palette size={12} className="text-laton" /> Paleta de Colores Preferida
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Monocromático (Negro, Gris, Blanco)", val: "Monocromático" },
                { label: "Tierra (Terracota, Marrón, Camel)", val: "Tonos Tierra" },
                { label: "Fríos (Azul Marino, Verde Oliva)", val: "Tonos Fríos" },
                { label: "Contraste (Toques de color vivo)", val: "Contraste Cromático" }
              ].map((item) => {
                const isSelected = colores.includes(item.val);
                return (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => toggleColor(item.val)}
                    className={`p-2 rounded text-[10px] text-left transition text-white border flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-laton/20 border-laton text-laton font-medium"
                        : "bg-fondo/40 border-linea/60"
                    }`}
                  >
                    <span>{item.label}</span>
                    {isSelected && <Check size={10} className="text-laton inline shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Style Goals & Custom Text Box */}
        <div className="space-y-6 bg-tarjeta/60 border border-linea rounded-xl p-6">
          <div className="flex items-center gap-2 border-b border-linea pb-3">
            <Clipboard size={16} className="text-laton" />
            <h4 className="font-serif text-sm font-bold uppercase tracking-wider text-white">
              Aspiraciones & Definición Libre
            </h4>
          </div>

          {/* Personalidad / Forma de Ser */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              ¿Cómo describirías tu forma de ser / personalidad?
            </label>
            <input
              type="text"
              value={formaSer}
              onChange={(e) => setFormaSer(e.target.value)}
              placeholder="Ej: Emprendedor tecnológico, minimalista práctico, creativo..."
              className="w-full bg-fondo/80 border border-linea rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-laton font-sans"
            />
          </div>

          {/* Estilo Objetivo */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              ¿Qué estilo te gustaría conseguir? (Objetivo)
            </label>
            <input
              type="text"
              value={estiloObjetivo}
              onChange={(e) => setEstiloObjetivo(e.target.value)}
              placeholder="Ej: Conseguir un look smart-casual profesional pero moderno"
              className="w-full bg-fondo/80 border border-linea rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-laton font-sans"
            />
          </div>

          {/* Budget */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B]">
              Filosofía o Presupuesto de Compra
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Slow Inversión", value: "Slow Inversión: Menos prendas pero de calidad premium" },
                { label: "Equilibrado", value: "Equilibrado: Buena relación calidad-precio" },
                { label: "Tendencias", value: "Fast Fashion: Conocer tendencias rápidamente" }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setEstiloPresupuesto(item.value)}
                  className={`p-2 rounded text-[10px] text-center transition text-white border transition-all duration-200 cursor-pointer ${
                    estiloPresupuesto === item.value
                      ? "bg-laton/20 border-laton text-laton font-medium"
                      : "bg-fondo/40 border-linea/60 hover:border-laton/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Detalles Libres Textarea */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[#52525B] flex items-center justify-between">
              <span>Descripción libre (gustos, fobias o notas)</span>
              <span className="text-[9px] text-tinta-apagada font-normal lowercase">Opcional</span>
            </label>
            <textarea
              value={detallesLibres}
              onChange={(e) => setDetallesLibres(e.target.value)}
              rows={4}
              placeholder="Escribe libremente... Ej: 'No me gustan los cuellos altos. Me encantan los abrigos estructurados de sastre. Busco colores que resalten mi tez clara. Prefiero prendas fáciles de planchar.'"
              className="w-full bg-fondo/80 border border-linea rounded p-3 text-xs text-white focus:outline-none focus:border-laton leading-relaxed font-sans placeholder-tinta-apagada/40 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleGuardar}
          disabled={guardadoClank}
          className={`px-8 py-3.5 rounded font-bold uppercase text-xs tracking-widest transition-all duration-300 w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
            guardadoClank
              ? "bg-emerald-850 hover:bg-emerald-800 text-emerald-100 border border-emerald-600/50 scale-95"
              : "bg-laton hover:bg-laton-apagado text-fondo hover:scale-[1.02] active:scale-95"
          }`}
        >
          {guardadoClank ? (
            <>
              <Check size={14} className="animate-bounce" /> Perfil Guardado Colectivamente
            </>
          ) : (
            <>
              <Sparkles size={14} /> Guardar & Registrar Mi ADN de Estilo
            </>
          )}
        </button>
      </div>

      {/* Small Advice Footer */}
      {(estiloVibe || estiloObjetivo) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-laton/5 border border-laton/20 p-4 rounded-lg flex items-start gap-2.5 text-xs font-mono text-amber-200/90"
        >
          <Sparkles size={14} className="text-laton animate-pulse mt-0.5 shrink-0" />
          <div>
            <span className="text-white uppercase font-bold text-[10px] tracking-widest block mb-1">
              Fórmula de Diagnóstico Activa
            </span>
            <span>
              La IA ahora coordinará tu corte, tus looks de fiesta, tu maleta cápsula y tus compras basándose en un perfil de tipo 
              <strong className="text-laton"> {estiloVibe || "Personalizado"}</strong> persiguiendo un objetivo de 
              <strong className="text-white"> {estiloObjetivo || "Elegancia natural"}</strong>.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
