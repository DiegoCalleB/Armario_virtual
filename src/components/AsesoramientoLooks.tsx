import React, { useState, useEffect } from "react";
import { Prenda, Rostro, Look, EventoConfig, HistorialLook, PerfilEstilo } from "../types";
import { Sparkles, Compass, Thermometer, ChevronRight, CheckCircle2, RotateCcw, HelpCircle, Eye, AlertCircle, Camera, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fileToBase64, resizeImage } from "../utils";

// Resiliently resolve garments from requested IDs
const getResilientMatchingGarments = (id_prendas: string[] | undefined, armario: Prenda[]): Prenda[] => {
  if (!id_prendas || !Array.isArray(id_prendas)) return [];
  
  const resolved: Prenda[] = [];
  const matchedIds = new Set<string>();

  for (const rawId of id_prendas) {
    if (!rawId) continue;
    const strId = String(rawId).trim();

    // 1. Exact match by ID
    let found = armario.find(p => p.id === strId);

    // 2. Try by 1-based index (sometimes AI outputs "1", "2" instead of actual IDs)
    if (!found) {
      const idx = parseInt(strId, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= armario.length) {
        found = armario[idx - 1];
      }
    }

    // 3. Try to match by ID normalization (removing non-alphanumeric, case-insensitive)
    if (!found) {
      const normStrId = strId.toLowerCase().replace(/[^a-z0-9]/g, "");
      found = armario.find(p => p.id.toLowerCase().replace(/[^a-z0-9]/g, "") === normStrId);
    }

    // 4. Try matching by garment name contained or containing the ID string
    if (!found) {
      const lowerStrId = strId.toLowerCase();
      found = armario.find(p => 
        p.nombre.toLowerCase().includes(lowerStrId) || 
        lowerStrId.includes(p.nombre.toLowerCase())
      );
    }

    if (found && !matchedIds.has(found.id)) {
      resolved.push(found);
      matchedIds.add(found.id);
    }
  }

  // 5. Smart fallback: if look is completely empty of essential categories
  // (e.g. no "top" or "pantalon" matched but they correspond to what the look talks about, 
  // or if we just have some garments in the look but some essential piece is missing), 
  // we do a category-based matching to make sure the model has clothes of the appropriate categories
  // mentioned in the title/porque of the look.
  const hasTop = resolved.some(p => p.categoria === "top");
  const hasPantalon = resolved.some(p => p.categoria === "pantalon");
  const hasCalzado = resolved.some(p => p.categoria === "calzado");

  const topsInArmario = armario.filter(p => p.categoria === "top");
  const pantalonesInArmario = armario.filter(p => p.categoria === "pantalon");
  const calzadosInArmario = armario.filter(p => p.categoria === "calzado");

  if (!hasTop && topsInArmario.length > 0) {
    // Look for a top that might match keywords in look's title/porque
    const matchedTop = topsInArmario.find(p => 
      resolved.length === 0 || // take first if none resolved
      p.nombre.split(" ").some(word => word.length > 3 && (p.nombre.toLowerCase().includes(word)))
    ) || topsInArmario[0];
    
    if (matchedTop && !matchedIds.has(matchedTop.id)) {
      resolved.push(matchedTop);
      matchedIds.add(matchedTop.id);
    }
  }

  if (!hasPantalon && pantalonesInArmario.length > 0) {
    const matchedPant = pantalonesInArmario.find(p => 
      resolved.length === 0 ||
      p.nombre.split(" ").some(word => word.length > 3 && (p.nombre.toLowerCase().includes(word)))
    ) || pantalonesInArmario[0];
    
    if (matchedPant && !matchedIds.has(matchedPant.id)) {
      resolved.push(matchedPant);
      matchedIds.add(matchedPant.id);
    }
  }

  if (!hasCalzado && calzadosInArmario.length > 0) {
    const matchedCalzado = calzadosInArmario.find(p => 
      resolved.length === 0 ||
      p.nombre.split(" ").some(word => word.length > 3 && (p.nombre.toLowerCase().includes(word)))
    ) || calzadosInArmario[0];
    
    if (matchedCalzado && !matchedIds.has(matchedCalzado.id)) {
      resolved.push(matchedCalzado);
      matchedIds.add(matchedCalzado.id);
    }
  }

  return resolved;
};

const renderSafeImageOrSvg = (url: string | undefined, alt: string, className: string) => {
  if (!url) return null;
  if (url.startsWith("data:image/svg+xml;base64,")) {
    try {
      const base64Data = url.substring("data:image/svg+xml;base64,".length);
      const decodedSvg = atob(base64Data);
      return (
        <div 
          className={`${className} flex items-center justify-center overflow-hidden`}
          dangerouslySetInnerHTML={{ __html: decodedSvg }} 
        />
      );
    } catch (e) {
      console.error("Error decoding SVG base64:", e);
    }
  } else if (url.startsWith("data:image/svg+xml,")) {
    try {
      const svgContent = decodeURIComponent(url.substring("data:image/svg+xml,".length));
      return (
        <div 
          className={`${className} flex items-center justify-center overflow-hidden`}
          dangerouslySetInnerHTML={{ __html: svgContent }} 
        />
      );
    } catch (e) {
      console.error("Error decoding SVG raw:", e);
    }
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
};

interface AsesoramientoLooksProps {
  armario: Prenda[];
  rostro: Rostro | null;
  selectedHistorialItem?: HistorialLook | null;
  onLooksGenerados?: (looks: Look[], ocasion: string, clima: string) => void;
  onUpdateLookImg?: (updatedLook: Look, ocasion: string, clima: string, isFullBody?: boolean) => void;
  perfilEstilo?: PerfilEstilo | null;
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

const FRASES_ESTILISTA = [
  "Analizando simetría y armonía facial...",
  "Estudiando fisonomía de rostro para cortes y peinados...",
  "Configurando drapeado de colores ideales para tu tono...",
  "Definiendo paleta cromática sutil y elegante...",
  "Esculpiendo volúmenes capilares personalizados...",
  "Ajustando el reflejo editorial en el espejo...",
  "Armonizando acabados de alta peluquería..."
];

export default function AsesoramientoLooks({
  armario,
  rostro,
  selectedHistorialItem,
  onLooksGenerados,
  onUpdateLookImg,
  perfilEstilo,
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

  // Generate instant classic looks from active wardrobe if user hasn't called the AI yet
  useEffect(() => {
    if (selectedHistorialItem) return;

    const hasOnlyInstantOrEmpty = looks.length === 0 || looks.every(l => l.titulo.includes("Sugerencia Rápida"));
    
    if (armario.length > 0 && hasOnlyInstantOrEmpty && !loading) {
      const tops = armario.filter((p) => p.categoria === "top");
      const pantalones = armario.filter((p) => p.categoria === "pantalon");
      const calzados = armario.filter((p) => p.categoria === "calzado");
      const accesorios = armario.filter((p) => p.categoria === "accesorio");

      const generatedInstantLooks: Look[] = [];

      // 1. Atuendo Boutique Esencial
      if (tops.length > 0 || pantalones.length > 0) {
        generatedInstantLooks.push({
          titulo: "Atuendo Esencial (Sugerencia Rápida)",
          id_prendas: [
            ...(tops.length > 0 ? [tops[0].id] : []),
            ...(pantalones.length > 0 ? [pantalones[0].id] : []),
            ...(calzados.length > 0 ? [calzados[0].id] : []),
            ...(accesorios.length > 0 ? [accesorios[0].id] : [])
          ],
          porque: "Una combinación clásica e inmediata. Hemos emparejado tus mejores prendas para conseguir un look equilibrado y limpio de manera instantánea y sin esperas.",
          pelo_sugerido: "Corte o peinado texturizado con movimiento natural",
          barba_sugerida: "Estilo facial despejado, hidratado y luminoso",
          consejo_barberia: "Aplica protector térmico y crema de peinado para un acabado sedoso y flexible."
        });
      }

      // 2. Silueta Urbana de Contraste
      if (pantalones.length > 0 && (tops.length > 1 || calzados.length > 0)) {
        generatedInstantLooks.push({
          titulo: "Conjunto Urbano con Contraste (Sugerencia Rápida)",
          id_prendas: [
            ...(tops.length > 1 ? [tops[1].id] : tops.length > 0 ? [tops[0].id] : []),
            ...[pantalones[0].id],
            ...(calzados.length > 1 ? [calzados[1].id] : calzados.length > 0 ? [calzados[0].id] : []),
            ...(accesorios.length > 1 ? [accesorios[1].id] : accesorios.length > 0 ? [accesorios[0].id] : [])
          ],
          porque: "Un conjunto cómodo e ideal para salir de tarde o para reuniones de trabajo informales. El contraste de colores resalta tu estilo de forma natural.",
          pelo_sugerido: "Estilo moderno con volumen suave",
          barba_sugerida: "Rasgos limpios o maquillaje ligero satinado",
          consejo_barberia: "Una bruma hidratante o bálsamo facial mantendrá tu piel impecable y radiante."
        });
      }

      // 3. Línea Purificada de Gala
      if (tops.length > 0 || pantalones.length > 0) {
        generatedInstantLooks.push({
          titulo: "Conjunto Formal de Gala (Sugerencia Rápida)",
          id_prendas: [
            ...(tops.length > 2 ? [tops[2].id] : tops.length > 0 ? [tops[0].id] : []),
            ...(pantalones.length > 1 ? [pantalones[1].id] : pantalones.length > 0 ? [pantalones[0].id] : []),
            ...(calzados.length > 0 ? [calzados[0].id] : []),
            ...(accesorios.length > 0 ? [accesorios[0].id] : [])
          ],
          porque: "Estilo distinguido de máxima formalidad. Ideal para eventos importantes que requieran un aspecto serio y bien arreglado.",
          pelo_sugerido: "Peinado pulido de alta peluquería",
          barba_sugerida: "Facciones definidas o maquillaje de contorno sutil",
          consejo_barberia: "Utiliza un cepillo suave para esculpir perfectamente cada volumen de forma fluida."
        });
      }

      setLooks(generatedInstantLooks);
    }
  }, [armario, selectedHistorialItem]);

  // Simulation states
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [currentBarberPhraseIndex, setCurrentBarberPhraseIndex] = useState(0);
  const [simulationTab, setSimulationTab] = useState<"retrato" | "cuerpo">("cuerpo");
  const [copiedShare, setCopiedShare] = useState(false);
  const [customFullBodyPhoto, setCustomFullBodyPhoto] = useState<string | null>(null);
  const [customFullBodyFile, setCustomFullBodyFile] = useState<File | null>(null);

  // Load custom full body photo from localStorage on mount or when rostro changes
  useEffect(() => {
    const key = rostro?.clave ? `espejo_cuerpo_${rostro.clave}` : "espejo_cuerpo_guest";
    const cached = localStorage.getItem(key);
    if (cached) {
      setCustomFullBodyPhoto(cached);
    } else {
      setCustomFullBodyPhoto(null);
    }
  }, [rostro]);

  const handleSetCustomFullBodyPhoto = (photo: string | null) => {
    setCustomFullBodyPhoto(photo);
    const key = rostro?.clave ? `espejo_cuerpo_${rostro.clave}` : "espejo_cuerpo_guest";
    if (photo) {
      try {
        localStorage.setItem(key, photo);
      } catch (e) {
        console.warn("Storage quota exceeded or storage unavailable, falling back to local memory simulation", e);
      }
    } else {
      localStorage.removeItem(key);
    }
  };

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
          perfilEstilo,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fallo en la Inteligencia Artificial.");
      }

      const decoded = await res.json();
      if (!decoded.looks || decoded.looks.length === 0) {
        throw new Error("La Inteligencia Artificial no pudo proponer combinaciones con las prendas de tu armario.");
      }
      setLooks(decoded.looks);
      if (onLooksGenerados) {
        onLooksGenerados(decoded.looks, ocasion, clima);
      }
    } catch (err: any) {
      console.error(err);
      let errorFriendly = err.message || "Fallo en la comunicación con tu asesor de imagen virtual.";
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
    const hasImage = fullBody ? (customFullBodyPhoto || rostro?.imageSrc) : rostro?.imageSrc;
    if (!hasImage) {
      setSimulationError("Por favor, sube tu foto de rostro en 'Tu espejo' o tu foto de cuerpo completo primero.");
      return;
    }

    setSimulationError(null);
    setSimulating(true);
    
    // Cycle beautiful progress phrases
    const interval = setInterval(() => {
      setCurrentBarberPhraseIndex((prev) => (prev + 1) % FRASES_ESTILISTA.length);
    }, 1800);

    try {
      let prendasTexto = "";
      let matchingPrendas: any[] = [];
      if (fullBody) {
        matchingPrendas = getResilientMatchingGarments(look.id_prendas, armario);
        prendasTexto = matchingPrendas
          .map((p) => `${p?.nombre} (categoría: ${p?.categoria === "top" ? "prenda superior" : p?.categoria === "pantalon" ? "prenda inferior" : p?.categoria === "calzado" ? "calzado" : "accesorio"}, color: ${p?.color}${p?.tejido ? `, tejido: ${p?.tejido}` : ""})`)
          .join(", combinado con ");
      }

      // Trigger user paid flow setting check via show_aistudio_ui under standard model requirements if key is paid,
      // but the server takes care of the configuration directly.
      const res = await fetch("/api/generar-imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceImage: rostro?.imageSrc || undefined,
          estiloCabello: look.pelo_sugerido,
          estiloBarba: look.barba_sugerida,
          fullBody,
          prendasTexto,
          prendasDetalle: matchingPrendas,
          customFullBodyImage: fullBody && customFullBodyPhoto ? customFullBodyPhoto : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al simular la imagen de retrato.");
      }

      const parsed = await res.json();
      if (parsed.imageUrl) {
        // Construct the updated look on the fly
        const updatedNextLook = {
          ...look,
          [fullBody ? "simulatedFullBodyImageUrl" : "simulatedImageUrl"]: parsed.imageUrl,
        };

        // Safe updates 
        setLooks((oldLooks) => {
          const raw = [...oldLooks];
          raw[lookIndex] = updatedNextLook;
          return raw;
        });

        if (onUpdateLookImg) {
          onUpdateLookImg(updatedNextLook, ocasion, clima, fullBody);
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

  // Interactive wardrobe try-on positions
  const [cuerpoMode, setCuerpoMode] = useState<"interactivo" | "ia">("ia");
  const [garmentPositions, setGarmentPositions] = useState<Record<string, {
    id: string;
    x: number;
    y: number;
    scale: number;
    scaleX?: number;
    scaleY?: number;
    rotation: number;
    zIndex: number;
    flip: boolean;
    visible: boolean;
    blendMode?: "normal" | "multiply" | "screen" | "darken";
    brightness?: number;
    contrast?: number;
    opacity?: number;
  }>>({});
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);

  // Auto-initialize standard body coordinates when active look or wardrobe changes
  useEffect(() => {
    if (!selectedLook) return;
    const matching = getResilientMatchingGarments(selectedLook.id_prendas, armario);
    const newPositions: Record<string, {
      id: string;
      x: number;
      y: number;
      scale: number;
      scaleX?: number;
      scaleY?: number;
      rotation: number;
      zIndex: number;
      flip: boolean;
      visible: boolean;
      blendMode?: "normal" | "multiply" | "screen" | "darken";
      brightness?: number;
      contrast?: number;
      opacity?: number;
    }> = {};

    matching.forEach((garment, idx) => {
      let defaultY = 40;
      let defaultScale = 100;

      switch (garment.categoria) {
        case "top":
          defaultY = 32;
          defaultScale = 110;
          break;
        case "pantalon":
          defaultY = 62;
          defaultScale = 110;
          break;
        case "calzado":
          defaultY = 85;
          defaultScale = 75;
          break;
        case "accesorio":
          defaultY = 18;
          defaultScale = 45;
          break;
      }

      newPositions[garment.id] = {
        id: garment.id,
        x: 50,
        y: defaultY,
        scale: defaultScale,
        scaleX: 100,
        scaleY: 100,
        rotation: 0,
        zIndex: 10 + idx,
        flip: false,
        visible: true,
        // Set multiply by default so white background clothing photos automatically strip out white boxes
        blendMode: "multiply",
        brightness: 100,
        contrast: 100,
        opacity: 100
      };
    });

    setGarmentPositions(newPositions);
    if (matching.length > 0) {
      setSelectedGarmentId(matching[0].id);
    } else {
      setSelectedGarmentId(null);
    }
  }, [activeLookIndex, looks, armario, selectedLook]);

  // Dragging and touch movement logic
  const [draggedGarmentId, setDraggedGarmentId] = useState<string | null>(null);

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggedGarmentId || !garmentPositions[draggedGarmentId]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    setGarmentPositions(prev => ({
      ...prev,
      [draggedGarmentId]: {
        ...prev[draggedGarmentId],
        x: Math.min(100, Math.max(0, parseFloat(currentX.toFixed(1)))),
        y: Math.min(100, Math.max(0, parseFloat(currentY.toFixed(1))))
      }
    }));
  };

  const handlePointerUp = () => {
    setDraggedGarmentId(null);
  };

  const handleSwapGarment = (oldId: string, newId: string) => {
    setLooks(prev => {
      const updated = [...prev];
      const currentLook = { ...updated[activeLookIndex] };
      if (currentLook && currentLook.id_prendas) {
        currentLook.id_prendas = currentLook.id_prendas.map(id => String(id) === String(oldId) ? newId : id);
        updated[activeLookIndex] = currentLook;
      }
      return updated;
    });

    if (garmentPositions[oldId]) {
      setGarmentPositions(prev => {
        const copy = { ...prev };
        copy[newId] = {
          ...copy[oldId],
          id: newId
        };
        delete copy[oldId];
        return copy;
      });
    }
    setSelectedGarmentId(newId);
  };

  const matchingGarments = selectedLook ? getResilientMatchingGarments(selectedLook.id_prendas, armario) : [];
  const tops = matchingGarments.filter(p => p.categoria === "top");
  const pantalones = matchingGarments.filter(p => p.categoria === "pantalon");
  const calzados = matchingGarments.filter(p => p.categoria === "calzado");
  const accesorios = matchingGarments.filter(p => p.categoria === "accesorio");

  const renderPrendaCardItem = (item: Prenda, compact = false) => (
    <div key={item.id} className="bg-tarjeta border border-linea rounded-lg p-2.5 flex gap-3 items-center hover:border-[#18181B]/50 transition duration-200 shadow-md">
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
          <p className="text-[8px] uppercase tracking-wider text-[#18181B]/80 font-bold leading-none">
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
            Por favor, sube tu retrato facial en la sección <strong>Tu Espejo</strong> primero. El estilista necesita comprender la fisionomía de tu rostro para aconsejarte estilos idóneos, y servirá de referencia de identidad para que el extractor de prendas te reconozca con precisión al subir tus fotos personales.
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
                <div className="space-y-6">
                  {/* Title & Description of active Look */}
                  <div>
                    {selectedLook.titulo.includes("Sugerencia Rápida") ? (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[9px] bg-laton/15 text-laton border border-laton/30 px-2.5 py-1 rounded font-extrabold tracking-wider uppercase font-sans">
                          Catálogo Rápido (Sin Espera)
                        </span>
                        <span className="text-[10px] text-tinta-apagada">Combinación Automática de Armario</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[9px] bg-[#18181B] text-fondo px-2.5 py-1 rounded font-extrabold tracking-wider uppercase font-sans animate-pulse">
                          Diseñado por la Inteligencia Artificial de Espejo
                        </span>
                        <span className="text-[10px] text-laton font-medium">Estilo Exclusivo</span>
                      </div>
                    )}
                    <h3 className="font-serif text-2xl font-bold text-tinta italic mt-1 leading-tight">
                      {selectedLook.titulo.replace(" (Sugerencia Rápida)", "")}
                    </h3>
                    <p className="text-sm font-light text-tinta/80 mt-3 leading-relaxed">
                      {selectedLook.porque}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Garments list (Magazine Collage style) */}
                    <div className="lg:col-span-7 space-y-6">
                      {(() => {
                        const matchingGarments = getResilientMatchingGarments(selectedLook.id_prendas, armario);

                      const tops = matchingGarments.filter(p => p.categoria === "top");
                      const pantalones = matchingGarments.filter(p => p.categoria === "pantalon");
                      const calzados = matchingGarments.filter(p => p.categoria === "calzado");
                      const accesorios = matchingGarments.filter(p => p.categoria === "accesorio");

                      const renderPrendaCardItem = (item: Prenda, compact = false) => (
                        <div key={item.id} className="bg-tarjeta border border-linea rounded-lg p-2.5 flex gap-3 items-center hover:border-[#18181B]/50 transition duration-200 shadow-md">
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
                              <p className="text-[8px] uppercase tracking-wider text-[#18181B]/80 font-bold leading-none">
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
                             <h4 className="text-xs uppercase tracking-widest text-[#18181B] font-bold">Tu Conjunto Elegido (Perchero Virtual)</h4>
                             <span className="text-[9px] font-mono text-tinta-apagada">VISTA DETALLADA</span>
                          </div>
                          
                          <div className="relative bg-[#1a1610] rounded-xl border border-linea/80 p-5 overflow-hidden">
                            {/* Decorative background brass rod */}
                            <div className="absolute top-10 bottom-10 left-1/2 w-0.5 bg-gradient-to-b from-[#18181B]/40 via-[#71717A]/10 to-[#18181B]/40 -translate-x-1/2 hidden sm:block pointer-events-none" />

                            <div className="space-y-6 relative z-10">
                              {/* 1. TOP SLOT (CAMISETA / CHAQUETA / ETC) */}
                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="shrink-0 w-24 text-center sm:text-right">
                                  <span className="text-[9px] uppercase tracking-widest text-[#18181B] font-extrabold block">01 / SUPERIOR</span>
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
                                  <span className="text-[9px] uppercase tracking-widest text-[#18181B] font-extrabold block">02 / INFERIOR</span>
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
                                  <span className="text-[9px] uppercase tracking-widest text-[#18181B] font-extrabold block">03 / CALZADO</span>
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
                                <div className="border-t border-[#E4E4E7]/40 pt-4 mt-2">
                                  <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="shrink-0 w-24 text-center sm:text-right">
                                      <span className="text-[9px] uppercase tracking-widest text-[#18181B] font-extrabold block">DETALLES</span>
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

                  {/* Right Column: Hairstyling, Estilismo & Simulating Re-render */}
                  <div className="lg:col-span-5 order-first lg:order-none bg-tarjeta border border-laton/50 rounded-lg p-6 space-y-6">
                    <span className="font-serif italic text-laton font-semibold block text-base border-b border-linea pb-2">
                      Visajismo & Estilismo Facial (04)
                    </span>

                    <div className="space-y-4">
                      {/* Hair Recommendations */}
                      <div className="space-y-1">
                        <span className="text-[10px] tracking-widest text-tinta-apagada uppercase font-medium">Corte o Peinado Recomendado</span>
                        <p className="font-serif text-base font-semibold text-tinta italic leading-tight">
                          {selectedLook.pelo_sugerido}
                        </p>
                      </div>

                      {/* Beard Recommendations */}
                      <div className="space-y-1">
                        <span className="text-[10px] tracking-widest text-tinta-apagada uppercase font-medium">Rasgos o Estilo Facial Sugerido</span>
                        <p className="font-serif text-base font-semibold text-tinta italic leading-tight">
                          {selectedLook.barba_sugerida}
                        </p>
                      </div>

                      {/* Barber Tips */}
                      <div className="p-3.5 bg-fondo border border-linea rounded text-xs space-y-1 relative overflow-hidden">
                        <span className="text-[10px] tracking-widest text-laton uppercase font-medium block">
                          Consejo del Estilista Personal
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
                        <span className="text-xs uppercase tracking-widest text-[#18181B] font-bold block text-left">
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
                            {simulationTab === "cuerpo" ? "Vistiendo tu silueta..." : "Estilismo Virtual..."}
                          </p>
                          <p className="text-[11px] text-laton font-medium mt-1 animate-pulse min-h-[16px]">
                            {FRASES_ESTILISTA[currentBarberPhraseIndex]}
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
                                  Ver tu estilo adaptado. El retoque IA recreará tu rostro adaptando exactamente este peinado y estilo facial sugeridos, mostrándote cómo te quedaría.
                                </p>
                                <button
                                  type="button"
                                  id="boton-simular-retrato"
                                  onClick={() => triggerSimulation(activeLookIndex, selectedLook, false)}
                                  className="button-press w-full py-2.5 bg-tarjeta border border-laton text-laton hover:bg-laton hover:text-fondo text-xs font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 transition active:scale-97"
                                >
                                  <Eye size={12} /> Proyectar Rostro (Estilismo)
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1 text-left">
                                    <span className="text-[9px] uppercase text-tinta-apagada font-medium font-bold block">Original</span>
                                    <div className="aspect-square bg-fondo border border-linea rounded overflow-hidden">
                                      <img
                                        src={rostro?.imageSrc}
                                        alt="Original face retrato"
                                        className="w-full h-full object-cover scale-x-[-1]"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1 text-left">
                                    <span className="text-[9px] uppercase text-laton font-medium font-bold block">Lifting Virtual</span>
                                    <div className="aspect-square bg-fondo border border-laton rounded overflow-hidden relative shadow-lg shadow-black/80">
                                      {renderSafeImageOrSvg(selectedLook.simulatedImageUrl, "Simulated retrato", "w-full h-full object-cover")}
                                      <div className="absolute bottom-1 right-1 bg-laton text-fondo text-[8px] font-bold py-0.5 px-1.5 rounded uppercase">
                                        SIMULADO
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {selectedLook.simulatedImageUrl?.startsWith("data:image/svg+xml") && (
                                  <div className="p-3 bg-[#F4F4F5] border border-laton/20 rounded-md text-left text-[11px] font-sans">
                                    <div className="flex items-center gap-1.5 text-[#18181B] font-bold uppercase tracking-wider text-[9.5px] mb-1">
                                      <AlertCircle size={12} className="shrink-0 text-laton" />
                                      <span>BOCETO EDITORIAL ACTIVO</span>
                                    </div>
                                    <p className="text-tinta-apagada leading-relaxed text-[10.5px]">
                                      Hemos creado una simulación visual con tu fotografía. Para habilitar un retoque fotorrealista completo sobre tu rostro mediante Inteligencia Artificial, se requiere autorizar la cuota de imagen en AI Studio (procediendo con la opción de Créditos/Paid Flow).
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-between items-center bg-fondo border border-linea rounded p-2.5">
                                  <span className="text-[10px] text-tinta-apagada leading-none">¿Te convence esta proyección?</span>
                                  <button
                                    type="button"
                                    onClick={() => triggerSimulation(activeLookIndex, selectedLook, false)}
                                    className="text-[10px] text-[#18181B] hover:underline font-bold"
                                  >
                                    Volver a Proyectar Rostro
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            /* CUERPO COMPLETO SIMULATION */
                            <div className="space-y-4 text-left">
                              <div className="p-3 bg-[#F4F4F5] border border-linea/60 rounded-lg space-y-3">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                  <span className="text-[10px] text-[#18181B] font-bold uppercase tracking-wider block">Probador de Ropa Virtual</span>
                                  
                                  {/* Custom Switcher between Interactive and AI modes */}
                                  <div className="flex gap-1 bg-fondo p-0.5 rounded border border-linea">
                                    <button
                                      type="button"
                                      onClick={() => setCuerpoMode("interactivo")}
                                      className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded transition ${
                                        cuerpoMode === "interactivo" ? "bg-laton text-fondo" : "text-tinta-apagada hover:text-tinta"
                                      }`}
                                    >
                                      ✨ Interactivo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCuerpoMode("ia")}
                                      className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded transition ${
                                        cuerpoMode === "ia" ? "bg-laton text-fondo" : "text-tinta-apagada hover:text-tinta"
                                      }`}
                                    >
                                      🤖 Neural IA
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[11px] text-tinta-apagada leading-normal">
                                  {cuerpoMode === "interactivo" 
                                    ? "Coloca, escala y ajusta las prendas reales de tu armario directamente sobre tu silueta en tiempo real para un control total."
                                    : "Genera una sesión fotográfica editorial completa vistiendo este look con retoque fotorrealista de inteligencia artificial."}
                                </p>

                                {/* Custom body file picker */}
                                <div className="flex items-center gap-3 bg-fondo p-2.5 rounded border border-linea/60">
                                  <div className="w-10 h-10 rounded overflow-hidden bg-[#F4F4F5] border border-linea/80 shrink-0 flex items-center justify-center relative">
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
                                          handleSetCustomFullBodyPhoto(resized);
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById("input-cuerpo-completo-usuario")?.click()}
                                        className="px-2.5 py-1 text-[9.5px] border border-linea hover:border-laton bg-tarjeta text-tinta font-semibold rounded uppercase tracking-wider transition"
                                      >
                                        {customFullBodyPhoto ? "Cambiar foto de cuerpo" : "Subir mi foto de cuerpo"}
                                      </button>
                                      {customFullBodyPhoto && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCustomFullBodyFile(null);
                                            handleSetCustomFullBodyPhoto(null);
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

                              {cuerpoMode === "interactivo" ? (
                                /* INTERACTIVE DRESSING WORKBENCH */
                                <div className="space-y-4">
                                  {/* Absolute Placement Canvas in 3:4 */}
                                  <div 
                                    className="relative w-full max-w-[320px] mx-auto aspect-[3/4] bg-tarjeta border border-laton/40 rounded-lg overflow-hidden shadow-2xl shadow-black/90 select-none cursor-crosshair touch-none"
                                    onPointerMove={handleCanvasPointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerLeave={handlePointerUp}
                                  >
                                    {/* Canvas Background Image (Your body photo, or beautiful high-fashion template outline) */}
                                    {customFullBodyPhoto ? (
                                      <img 
                                        src={customFullBodyPhoto} 
                                        alt="Cuerpo de fondo" 
                                        className="w-full h-full object-cover pointer-events-none select-none"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#F4F4F5]/90 to-[#FAFAFA] relative pointer-events-none">
                                        {/* Vector sketch mannequin background */}
                                        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100" fill="none" stroke="#18181B" strokeWidth="0.5">
                                          <circle cx="50" cy="18" r="8" />
                                          <line x1="50" y1="26" x2="50" y2="75" />
                                          <line x1="30" y1="36" x2="70" y2="36" />
                                          <line x1="30" y1="36" x2="25" y2="60" />
                                          <line x1="70" y1="36" x2="75" y2="60" />
                                          <line x1="42" y1="75" x2="38" y2="92" />
                                          <line x1="58" y1="75" x2="62" y2="92" />
                                          <path d="M 20 10 L 80 90 M 80 10 L 20 90" strokeWidth="0.1" strokeDasharray="2,2" />
                                        </svg>
                                        <Camera size={26} className="text-laton-apagado/40 mb-2" />
                                        <p className="font-serif italic text-xs text-tinta-apagada">Modo Silueta Base</p>
                                        <p className="text-[10px] text-tinta-apagada/60 mt-2 max-w-[180px]">
                                          Sube una foto tuya de cuerpo de pie arriba para ver tus prendas reales puestas sobre tu verdadera imagen física.
                                        </p>
                                      </div>
                                    )}

                                    {/* Viewfinder corner brackets for professional design look */}
                                    <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-laton/45 pointer-events-none" />
                                    <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-laton/45 pointer-events-none" />
                                    <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-laton/45 pointer-events-none" />
                                    <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-laton/45 pointer-events-none" />

                                    {/* Gentle crosshairs centering guidelines */}
                                    <div className="absolute top-1/2 left-0 w-full h-[0.5px] border-t border-dashed border-laton/15 pointer-events-none" />
                                    <div className="absolute top-0 left-1/2 w-[0.5px] h-full border-l border-dashed border-laton/15 pointer-events-none" />

                                    {/* Overlaid Garments of current Look */}
                                    {getResilientMatchingGarments(selectedLook.id_prendas, armario).map((garment) => {
                                      const pos = garmentPositions[garment.id];
                                      if (!pos || !pos.visible) return null;
                                      
                                      const bVal = pos.brightness ?? 100;
                                      const cVal = pos.contrast ?? 100;
                                      const oVal = (pos.opacity ?? 100) / 100;
                                      // Soft shadow + customizable filters
                                      const filterStyle = `brightness(${bVal}%) contrast(${cVal}%) opacity(${oVal})`;
                                      
                                      const bMode = pos.blendMode ?? "multiply";
                                      
                                      const sSpace = pos.scale / 100;
                                      const sX = (pos.scaleX ?? 100) / 100;
                                      const sY = (pos.scaleY ?? 100) / 100;

                                      return (
                                        <div
                                          key={garment.id}
                                          style={{
                                            position: "absolute",
                                            left: `${pos.x}%`,
                                            top: `${pos.y}%`,
                                            zIndex: pos.zIndex,
                                            transform: `translate(-50%, -50%) rotate(${pos.rotation}deg) scaleX(${(pos.flip ? -1 : 1) * sX * sSpace}) scaleY(${sY * sSpace})`,
                                            touchAction: "none"
                                          }}
                                          onPointerDown={(e) => {
                                            e.stopPropagation();
                                            setSelectedGarmentId(garment.id);
                                            setDraggedGarmentId(garment.id);
                                          }}
                                          className={`absolute cursor-move select-none p-1 transition-shadow ${
                                            selectedGarmentId === garment.id
                                              ? "ring-2 ring-laton rounded bg-laton/5"
                                              : "hover:ring-1 hover:ring-laton/30"
                                          }`}
                                        >
                                          <img
                                            src={garment.imageSrc}
                                            alt={garment.nombre}
                                            style={{
                                              mixBlendMode: bMode as any,
                                              filter: filterStyle
                                            }}
                                            className="max-h-[160px] max-w-[160px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] pointer-events-none"
                                            draggable={false}
                                            referrerPolicy="no-referrer"
                                          />
                                          {selectedGarmentId === garment.id && (
                                            <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-laton text-fondo text-[7px] font-bold px-1 rounded uppercase tracking-wider">
                                              ACTIVA
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    
                                    <div className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[8px] text-[#52525B] font-mono tracking-widest select-none uppercase">
                                      PROBADOR REAL
                                    </div>
                                  </div>

                                  <p className="text-[10px] text-tinta-apagada/80 font-mono text-center cursor-default uppercase tracking-wide">
                                    💡 Arrastra las prendas o pulsa una para seleccionarla y editarla abajo
                                  </p>

                                  {/* Garment Selector Row */}
                                  <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                                    {getResilientMatchingGarments(selectedLook.id_prendas, armario).map((garment) => (
                                      <button
                                        key={garment.id}
                                        type="button"
                                        onClick={() => setSelectedGarmentId(garment.id)}
                                        className={`p-1.5 rounded-lg border flex items-center gap-2 transition text-left ${
                                          selectedGarmentId === garment.id ? "border-laton bg-laton/10" : "border-linea hover:border-laton-apagado bg-fondo"
                                        }`}
                                      >
                                        <div className="w-8 h-8 rounded overflow-hidden bg-fondo2 shrink-0 border border-linea">
                                          <img src={garment.imageSrc} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0 pr-1 flex-1">
                                          <p className="text-[9px] font-bold text-laton truncate leading-tight uppercase font-mono">{garment.categoria}</p>
                                          <p className="text-[9.5px] text-tinta truncate leading-none font-medium">{garment.nombre}</p>
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  {/* Adjustment Sliders and Layer Actions */}
                                  {selectedGarmentId && garmentPositions[selectedGarmentId] && (
                                    <div className="bg-[#1e1a14] p-3.5 rounded-lg border border-linea/80 space-y-4 font-sans text-tinta shadow-lg">
                                      <div className="flex justify-between items-center border-b border-linea/40 pb-2 flex-wrap gap-2">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] uppercase text-laton font-bold tracking-widest font-mono">Ajuste de Prenda Virtual</span>
                                          <span className="text-[8px] text-tinta-apagada font-mono uppercase mt-0.5">Prenda: {armario.find(p => p.id === selectedGarmentId)?.nombre || "Cargada"}</span>
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], flip: !prev[selectedGarmentId!].flip }
                                              }));
                                            }}
                                            className={`px-2 py-0.5 text-[8px] uppercase font-bold rounded border tracking-wider transition ${
                                              garmentPositions[selectedGarmentId!].flip ? "border-laton bg-laton text-fondo" : "border-linea/80 text-tinta-apagada hover:text-tinta bg-fondo"
                                            }`}
                                          >
                                            Invertir
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], zIndex: (prev[selectedGarmentId!]?.zIndex || 10) + 1 }
                                              }));
                                            }}
                                            className="px-2 py-0.5 text-[8px] uppercase font-bold rounded border border-linea/80 text-tinta-apagada hover:text-tinta bg-fondo transition"
                                          >
                                            Bajar Capa
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], zIndex: Math.max(1, (prev[selectedGarmentId!]?.zIndex || 10) - 1) }
                                              }));
                                            }}
                                            className="px-2 py-0.5 text-[8px] uppercase font-bold rounded border border-linea/80 text-tinta-apagada hover:text-tinta bg-fondo transition"
                                          >
                                            Subir Capa
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const g = armario.find(p => p.id === selectedGarmentId!);
                                              let defaultY = 40;
                                              let defaultScale = 100;
                                              if (g) {
                                                if (g.categoria === "top") { defaultY = 32; defaultScale = 110; }
                                                else if (g.categoria === "pantalon") { defaultY = 62; defaultScale = 110; }
                                                else if (g.categoria === "calzado") { defaultY = 85; defaultScale = 75; }
                                                else { defaultY = 18; defaultScale = 45; }
                                              }
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: {
                                                  ...prev[selectedGarmentId!],
                                                  x: 50,
                                                  y: defaultY,
                                                  scale: defaultScale,
                                                  scaleX: 100,
                                                  scaleY: 100,
                                                  rotation: 0,
                                                  flip: false,
                                                  blendMode: "multiply",
                                                  brightness: 100,
                                                  contrast: 100,
                                                  opacity: 100
                                                }
                                              }));
                                            }}
                                            className="px-2 py-0.5 text-[8px] uppercase font-bold rounded border border-linea/60 text-tinta-apagada hover:text-red-300 hover:border-red-500 bg-fondo transition"
                                          >
                                            Reset
                                          </button>
                                        </div>
                                      </div>

                                      {/* REPLACEMENT SELECTOR */}
                                      {(() => {
                                        const currentGarment = armario.find(p => p.id === selectedGarmentId);
                                        if (!currentGarment) return null;
                                        const alternatives = armario.filter(p => p.categoria === currentGarment.categoria && p.id !== currentGarment.id);
                                        if (alternatives.length === 0) return null;
                                        return (
                                          <div className="w-full bg-fondo/60 border border-linea/50 rounded-lg p-2.5 space-y-2 mt-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-[#18181B] font-bold uppercase tracking-wider">
                                              <RefreshCw size={11} className="text-laton animate-spin-slow" />
                                              <span>Sustituir prenda ({currentGarment.categoria})</span>
                                            </div>
                                            <p className="text-[8.5px] text-tinta-apagada">
                                              Sustituye esta prenda por otra de la misma categoría en tu armario. Se heredarán las posiciones para un encaje inmediato.
                                            </p>
                                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
                                              {alternatives.map(alt => (
                                                <button
                                                  key={alt.id}
                                                  type="button"
                                                  onClick={() => handleSwapGarment(selectedGarmentId, alt.id)}
                                                  className="flex items-center gap-2 px-2.5 py-1.5 bg-tarjeta/80 border border-linea hover:border-laton rounded-md text-left shrink-0 transition"
                                                >
                                                  <div className="w-6 h-6 rounded overflow-hidden bg-black/20 shrink-0 border border-linea/60">
                                                    <img src={alt.imageSrc} alt="" className="w-full h-full object-cover" />
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-[9.5px] text-white font-medium truncate max-w-[120px]">{alt.nombre}</p>
                                                    <span className="text-[7px] text-tinta-apagada uppercase tracking-wide block leading-none font-mono">{alt.tejido || "Textil"} · {alt.color}</span>
                                                  </div>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Blend & Transparancy options (Remover Fondos) */}
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-baseline">
                                          <span className="text-[9px] text-[#52525B] font-mono uppercase tracking-wider">Acople de Fondo (Fusión Inteligente)</span>
                                          <span className="text-[8px] text-laton font-mono uppercase">
                                            {(garmentPositions[selectedGarmentId].blendMode === "multiply") ? "Limpia fondo blanco" : (garmentPositions[selectedGarmentId].blendMode === "screen") ? "Limpia fondo negro" : "Fondo original"}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5 p-0.5 bg-fondo rounded-md border border-linea/40">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], blendMode: "multiply" }
                                              }));
                                            }}
                                            className={`py-1 text-[8.5px] uppercase font-bold rounded tracking-wide transition-all ${
                                              (garmentPositions[selectedGarmentId].blendMode ?? "multiply") === "multiply"
                                                ? "bg-laton text-fondo shadow-inner"
                                                : "text-tinta-apagada hover:text-tinta"
                                            }`}
                                          >
                                            Quitar Blanco
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], blendMode: "screen" }
                                              }));
                                            }}
                                            className={`py-1 text-[8.5px] uppercase font-bold rounded tracking-wide transition-all ${
                                              garmentPositions[selectedGarmentId].blendMode === "screen"
                                                ? "bg-laton text-fondo shadow-inner"
                                                : "text-tinta-apagada hover:text-tinta"
                                            }`}
                                          >
                                            Quitar Negro
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], blendMode: "normal" }
                                              }));
                                            }}
                                            className={`py-1 text-[8.5px] uppercase font-bold rounded tracking-wide transition-all ${
                                              garmentPositions[selectedGarmentId].blendMode === "normal"
                                                ? "bg-laton text-fondo shadow-inner"
                                                : "text-tinta-apagada hover:text-tinta"
                                            }`}
                                          >
                                            Fondo Normal
                                          </button>
                                        </div>
                                      </div>

                                      {/* Position controls */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-1 border-t border-linea/40">
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[9px] text-[#52525B]">
                                            <span>Mover Horizontal (X)</span>
                                            <span className="font-mono text-[#18181B]">{garmentPositions[selectedGarmentId].x}%</span>
                                          </div>
                                          <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={garmentPositions[selectedGarmentId].x}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], x: val }
                                              }));
                                            }}
                                            className="w-full accent-[#18181B] h-1.5 bg-fondo rounded cursor-ew-resize"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[9px] text-[#52525B]">
                                            <span>Mover Vertical (Y)</span>
                                            <span className="font-mono text-[#18181B]">{garmentPositions[selectedGarmentId].y}%</span>
                                          </div>
                                          <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={garmentPositions[selectedGarmentId].y}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], y: val }
                                              }));
                                            }}
                                            className="w-full accent-[#18181B] h-1.5 bg-fondo rounded cursor-ns-resize"
                                          />
                                        </div>

                                        {/* Aspect ratio control toggles */}
                                        <div className="sm:col-span-2 flex items-center justify-between py-1 border-b border-linea/30">
                                          <span className="text-[9px] text-[#52525B] font-mono uppercase tracking-wider">Dimensiones de Prenda</span>
                                          <button
                                            type="button"
                                            onClick={() => setLockAspectRatio(!lockAspectRatio)}
                                            className="flex items-center gap-1.5 text-[8.5px] uppercase font-bold tracking-wider text-laton bg-fondo hover:bg-laton/10 border border-laton/20 px-2 py-0.5 rounded transition"
                                          >
                                            <span>{lockAspectRatio ? "🔒 Aspecto Bloqueado" : "🔓 Aspecto Libre"}</span>
                                          </button>
                                        </div>

                                        {lockAspectRatio ? (
                                          <div className="sm:col-span-2 space-y-1">
                                            <div className="flex justify-between text-[9px] text-[#52525B]">
                                              <span>Avanzado: Escala / Tamaño Completo</span>
                                              <span className="font-mono text-[#18181B]">{garmentPositions[selectedGarmentId].scale}%</span>
                                            </div>
                                            <input
                                              type="range"
                                              min="30"
                                              max="250"
                                              step="1"
                                              value={garmentPositions[selectedGarmentId].scale}
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setGarmentPositions(prev => ({
                                                  ...prev,
                                                  [selectedGarmentId!]: { 
                                                    ...prev[selectedGarmentId!], 
                                                    scale: val,
                                                    scaleX: 100,
                                                    scaleY: 100
                                                  }
                                                }));
                                              }}
                                              className="w-full accent-[#18181B] h-1.5 bg-fondo rounded cursor-pointer"
                                            />
                                          </div>
                                        ) : (
                                          <>
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[9px] text-[#52525B]">
                                                <span>Ajustar Ancho (Hombro/Cintura)</span>
                                                <span className="font-mono text-[#18181B]">{garmentPositions[selectedGarmentId].scaleX ?? 100}%</span>
                                              </div>
                                              <input
                                                type="range"
                                                min="30"
                                                max="250"
                                                step="1"
                                                value={garmentPositions[selectedGarmentId].scaleX ?? 100}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value, 10);
                                                  setGarmentPositions(prev => ({
                                                    ...prev,
                                                    [selectedGarmentId!]: { ...prev[selectedGarmentId!], scaleX: val }
                                                  }));
                                                }}
                                                className="w-full accent-[#18181B] h-1.5 bg-fondo rounded cursor-pointer"
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[9px] text-[#52525B]">
                                                <span>Ajustar Alto (Manga/Pierna)</span>
                                                <span className="font-mono text-[#18181B]">{garmentPositions[selectedGarmentId].scaleY ?? 100}%</span>
                                              </div>
                                              <input
                                                type="range"
                                                min="30"
                                                max="250"
                                                step="1"
                                                value={garmentPositions[selectedGarmentId].scaleY ?? 100}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value, 10);
                                                  setGarmentPositions(prev => ({
                                                    ...prev,
                                                    [selectedGarmentId!]: { ...prev[selectedGarmentId!], scaleY: val }
                                                  }));
                                                }}
                                                className="w-full accent-[#18181B] h-1.5 bg-fondo rounded cursor-pointer"
                                              />
                                            </div>
                                          </>
                                        )}

                                        <div className="space-y-1 border-t border-linea/20 pt-2 sm:col-span-2">
                                          <div className="flex justify-between text-[9px] text-[#52525B]">
                                            <span>Rotar Prenda (Orientación / Ángulo)</span>
                                            <span className="font-mono text-[#18181B]">{garmentPositions[selectedGarmentId].rotation}°</span>
                                          </div>
                                          <input
                                            type="range"
                                            min="-180"
                                            max="180"
                                            step="1"
                                            value={garmentPositions[selectedGarmentId].rotation}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value, 10);
                                              setGarmentPositions(prev => ({
                                                ...prev,
                                                [selectedGarmentId!]: { ...prev[selectedGarmentId!], rotation: val }
                                              }));
                                            }}
                                            className="w-full accent-[#18181B] h-1.5 bg-fondo rounded"
                                          />
                                        </div>

                                        {/* Photographic tuning filters */}
                                        <div className="sm:col-span-2 pt-2 border-t border-linea/40">
                                          <span className="text-[9px] text-[#52525B] font-mono uppercase tracking-wider block mb-2">Integración Fotográfica (Ajustes de Luz)</span>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] text-tinta-apagada font-mono">
                                                <span>BRILLO / LUZ</span>
                                                <span>{garmentPositions[selectedGarmentId].brightness ?? 100}%</span>
                                              </div>
                                              <input
                                                type="range"
                                                min="60"
                                                max="140"
                                                step="1"
                                                value={garmentPositions[selectedGarmentId].brightness ?? 100}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value, 10);
                                                  setGarmentPositions(prev => ({
                                                    ...prev,
                                                    [selectedGarmentId!]: { ...prev[selectedGarmentId!], brightness: val }
                                                  }));
                                                }}
                                                className="w-full accent-[#18181B] h-1 bg-fondo rounded cursor-pointer"
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] text-tinta-apagada font-mono">
                                                <span>CONTRASTE</span>
                                                <span>{garmentPositions[selectedGarmentId].contrast ?? 100}%</span>
                                              </div>
                                              <input
                                                type="range"
                                                min="60"
                                                max="140"
                                                step="1"
                                                value={garmentPositions[selectedGarmentId].contrast ?? 100}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value, 10);
                                                  setGarmentPositions(prev => ({
                                                    ...prev,
                                                    [selectedGarmentId!]: { ...prev[selectedGarmentId!], contrast: val }
                                                  }));
                                                }}
                                                className="w-full accent-[#18181B] h-1 bg-fondo rounded cursor-pointer"
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] text-tinta-apagada font-mono">
                                                <span>OPACIDAD</span>
                                                <span>{garmentPositions[selectedGarmentId].opacity ?? 100}%</span>
                                              </div>
                                              <input
                                                type="range"
                                                min="20"
                                                max="100"
                                                step="1"
                                                value={garmentPositions[selectedGarmentId].opacity ?? 100}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value, 10);
                                                  setGarmentPositions(prev => ({
                                                    ...prev,
                                                    [selectedGarmentId!]: { ...prev[selectedGarmentId!], opacity: val }
                                                  }));
                                                }}
                                                className="w-full accent-[#18181B] h-1 bg-fondo rounded cursor-pointer"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* IA DRESSING OPTION */
                                !selectedLook.simulatedFullBodyImageUrl ? (
                                  <div className="space-y-3">
                                    <button
                                      type="button"
                                      id="boton-simular-cuerpo"
                                      onClick={() => {
                                        setSimulationTab("cuerpo");
                                        triggerSimulation(activeLookIndex, selectedLook, true);
                                      }}
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
                                            src={customFullBodyPhoto || rostro?.imageSrc}
                                            alt="Original face or body"
                                            className="w-full h-full object-cover scale-x-[-1]"
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                        <div className="text-[8px] text-tinta-apagada/70 font-mono truncate">
                                          {customFullBodyPhoto ? "CUERPO SUBIDO" : `ID: ${rostro?.forma_cara || 'Retrato'}`}
                                        </div>
                                      </div>

                                      <div className="col-span-12 sm:col-span-7 space-y-1 text-left">
                                        <span className="text-[9px] uppercase text-laton font-medium font-bold block">Vestidor Virtual IA</span>
                                        <div className="aspect-[3/4] bg-fondo border border-laton rounded overflow-hidden relative shadow-lg shadow-black/80">
                                          {renderSafeImageOrSvg(selectedLook.simulatedFullBodyImageUrl, "Simulated body outfit", "w-full h-full object-cover")}
                                          <div className="absolute bottom-1 right-1 bg-laton text-fondo text-[8px] font-bold py-0.5 px-1.5 rounded uppercase">
                                            VIRTUAL FIT
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {selectedLook.simulatedFullBodyImageUrl?.startsWith("data:image/svg+xml") && (
                                      <div className="p-3 bg-[#F4F4F5] border border-laton/20 rounded-md text-left text-[11px] font-sans">
                                        <div className="flex items-center gap-1.5 text-[#18181B] font-bold uppercase tracking-wider text-[9.5px] mb-1.5">
                                          <AlertCircle size={12} className="shrink-0 text-laton" />
                                          <span>BOCETO EDITORIAL ACTIVO (MODO DE RESERVA)</span>
                                        </div>
                                        <p className="text-tinta-apagada leading-relaxed text-[10.5px]">
                                          Esta vista previa utiliza nuestro diseño de Asesor de Imagen AI para ilustrar la combinación: tu foto original se mantiene a la izquierda ("Foto Base") y el maniquí a la derecha ("Modelo de Ajuste") **se viste digitalmente con los colores y prendas sugeridas para tu look**.
                                        </p>
                                        <p className="text-tinta-apagada/80 leading-relaxed text-[10px] mt-1.5 border-t border-linea/20 pt-1.5">
                                          Para realizar una proyección fotorrealista directa que modifique y reemplace visualmente la ropa de tu foto real mediante inteligencia artificial generativa, se requiere autorizar la cuota en el panel de AI Studio (Dressing-credits flow).
                                        </p>
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center bg-fondo border border-linea rounded p-2.5">
                                      <span className="text-[10px] text-tinta-apagada leading-none">¿Te convence esta combinación?</span>
                                      <button
                                        type="button"
                                        onClick={() => triggerSimulation(activeLookIndex, selectedLook, true)}
                                        className="text-[10px] text-[#18181B] hover:underline font-bold"
                                      >
                                        Volver a Proyectar Look con IA
                                      </button>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Portada Editorial de Revista (VIRAL FACTOR) */}
                      {!simulating && (selectedLook.simulatedImageUrl || selectedLook.simulatedFullBodyImageUrl) && (
                        <div className="bg-[#F4F4F5] border border-linea p-4 rounded-lg space-y-3 font-sans text-left relative overflow-hidden mt-6">
                          <p className="text-[9.5px] uppercase tracking-widest text-[#18181B] font-bold">
                            Estudio Editorial ESPEJO (Ficha Viral)
                          </p>
                          <p className="text-[10px] text-tinta-apagada leading-relaxed font-light">
                            Consigue tu portada personalizada de la revista ESPEJO. Un diseño exclusivo editorial listo para presumir en tus historias de Instagram, TikTok, o para compartir con tus amigos.
                          </p>

                          {/* The actual styled magazine mockup! */}
                          <div className="relative border border-[#E4E4E7] bg-[#FAFAFA] p-4.5 rounded flex flex-col items-center justify-between shadow-2xl select-none" style={{ minHeight: "330px" }}>
                            {/* Background/Backdrop simulated image */}
                            <div className="absolute inset-0 z-0 opacity-80 overflow-hidden">
                              {renderSafeImageOrSvg(
                                simulationTab === "cuerpo" 
                                  ? (selectedLook.simulatedFullBodyImageUrl || selectedLook.simulatedImageUrl || rostro?.imageSrc || undefined) 
                                  : (selectedLook.simulatedImageUrl || rostro?.imageSrc || undefined),
                                "Magazine Model",
                                "w-full h-full object-cover"
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-[#FAFAFA] via-transparent to-[#FAFAFA]/60" />
                            </div>

                            {/* Magazine logo header */}
                            <div className="w-full text-center z-10 pt-1 pb-4">
                              <h4 className="font-serif text-3xl font-extrabold tracking-[0.25em] text-[#09090B] uppercase leading-none select-none">
                                ESPEJO
                              </h4>
                              <div className="flex justify-between items-center text-[7px] text-[#52525B] tracking-wider uppercase border-t border-b border-[#E4E4E7]/40 mt-1 px-1 py-0.5 font-sans">
                                <span>VOL. 04 / EDICIÓN ESPECIAL</span>
                                <span>EDICIÓN ESTILO</span>
                              </div>
                            </div>

                            {/* Magazine highlights and headlines */}
                            <div className="w-full z-10 text-left space-y-3 pt-8">
                              <div className="max-w-[85%] bg-[#FAFAFA]/50 p-2.5 rounded border border-linea/20 backdrop-blur-sm">
                                <span className="text-[7.5px] bg-[#18181B] text-[#FAFAFA] font-bold uppercase tracking-widest py-0.5 px-1.5 rounded-sm">
                                  PORTADA EXCLUSIVA
                                </span>
                                <h5 className="font-serif text-lg font-bold tracking-tight text-[#09090B] uppercase leading-tight mt-1 italic">
                                  {selectedLook.titulo}
                                </h5>
                                <p className="text-[8.5px] text-[#52525B] font-light leading-relaxed mt-0.5">
                                  Recibiendo asesoramiento real coordinando su armario con la IA de ESPEJO.
                                </p>
                              </div>

                              {/* Fisiognomy details sidebar */}
                              <div className="flex justify-between items-end border-t border-[#E4E4E7]/40 pt-1.5 w-full text-[7.5px] text-[#52525B]">
                                <div className="space-y-0.5 text-left bg-[#FAFAFA]/40 p-1 rounded-sm">
                                  <p className="font-bold text-[#09090B] uppercase tracking-[0.05em] text-[7px]">FISIOLOGÍA REVELADA</p>
                                  <p>Forma de rostro: <span className="text-[#18181B]">{rostro?.forma_cara || "Clásico"}</span></p>
                                  <p>Corte: <span className="text-[#18181B] truncate max-w-[80px] inline-block align-bottom">{selectedLook.pelo_sugerido}</span></p>
                                </div>
                                <div className="text-right bg-[#FAFAFA]/40 p-1 rounded-sm">
                                  <p className="font-mono text-[7px] text-[#71717A] leading-none">00000 120531 2026</p>
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
                                const targetUrl = simulationTab === "cuerpo" ? (selectedLook.simulatedFullBodyImageUrl || rostro?.imageSrc) : (selectedLook.simulatedImageUrl || rostro?.imageSrc);
                                if (!targetUrl) return;
                                const isSvg = targetUrl.startsWith("data:image/svg+xml");
                                const ext = isSvg ? "svg" : "png";
                                const link = document.createElement("a");
                                link.href = targetUrl;
                                link.download = `ESPEJO_PortadaRevista_${selectedLook.titulo.replace(/\s+/g, '_')}.${ext}`;
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
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </section>
  );
}
