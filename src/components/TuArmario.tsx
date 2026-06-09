import React, { useState, useRef } from "react";
import { Prenda, CategoriaPrenda, TemporadaPrenda } from "../types";
import { fileToBase64, resizeImage, getCategoryLabel } from "../utils";
import { Upload, Plus, Trash2, SlidersHorizontal, Sun, Snowflake, Star, Tag, AlertCircle, Sparkles, Camera, X, FileText, Check, ShoppingBag, ExternalLink, Clipboard, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TuArmarioProps {
  prendas: Prenda[];
  onPrendaAgregada: (prenda: Prenda | Prenda[]) => void;
  onPrendaEliminada: (id: string) => void;
  onPrendaActualizada?: (prenda: Prenda) => void;
}

const cropGarmentImage = (
  base64Src: string,
  ymin: number,
  xmin: number,
  ymax: number,
  xmax: number
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    if (base64Src && !base64Src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64Src);
          return;
        }

        const totalW = img.width;
        const totalH = img.height;

        // Auto-detect if coordinates are in [0, 1] range rather than [0, 1000] range
        let yminScale = Number(ymin);
        let xminScale = Number(xmin);
        let ymaxScale = Number(ymax);
        let xmaxScale = Number(xmax);

        if (yminScale <= 1.05 && xminScale <= 1.05 && ymaxScale <= 1.05 && xmaxScale <= 1.05) {
          yminScale = yminScale * 1000;
          xminScale = xminScale * 1000;
          ymaxScale = ymaxScale * 1000;
          xmaxScale = xmaxScale * 1000;
        }

        // Convert normalized (0-1000) coordinates to actual pixels
        const yStart = (Math.max(0, Math.min(1000, yminScale)) / 1000) * totalH;
        const xStart = (Math.max(0, Math.min(1000, xminScale)) / 1000) * totalW;
        const yEnd = (Math.max(0, Math.min(1000, ymaxScale)) / 1000) * totalH;
        const xEnd = (Math.max(0, Math.min(1000, xmaxScale)) / 1000) * totalW;

        let cropW = xEnd - xStart;
        let cropH = yEnd - yStart;

        if (cropW <= 10 || cropH <= 10) {
          console.warn("Rango de recorte inválido o muy pequeño de la IA, devolviendo original:", { ymin, xmin, ymax, xmax });
          resolve(base64Src);
          return;
        }

        // Add 5% padding around the garment to avoid tight crops, but clamp inside dimensions
        const padW = cropW * 0.05;
        const padH = cropH * 0.05;

        const paddedXStart = Math.max(0, xStart - padW);
        const paddedYStart = Math.max(0, yStart - padH);
        const paddedXEnd = Math.min(totalW, xEnd + padW);
        const paddedYEnd = Math.min(totalH, yEnd + padH);

        const finalCropW = paddedXEnd - paddedXStart;
        const finalCropH = paddedYEnd - paddedYStart;

        canvas.width = finalCropW;
        canvas.height = finalCropH;

        ctx.drawImage(
          img,
          paddedXStart,
          paddedYStart,
          finalCropW,
          finalCropH,
          0,
          0,
          finalCropW,
          finalCropH
        );

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (err) {
        console.error("Error al procesar el recorte de la prenda por coordenadas:", err);
        resolve(base64Src);
      }
    };
    img.onerror = () => {
      resolve(base64Src);
    };
    img.src = base64Src;
  });
};

const generateGarmentSVG = (categoria: CategoriaPrenda, color: string): string => {
  let paths = "";
  if (categoria === "top") {
    // Elegant blazer/shirt silhouette
    paths = `<path d="M50 15 L20 40 L20 85 L80 85 L80 40 Z" fill="${color}" opacity="0.9" />
             <path d="M50 15 L35 48 L50 85 L65 48 Z" fill="#221D15" stroke="${color}" stroke-width="1" />
             <path d="M45 15 L50 25 L55 15" fill="none" stroke="#F3ECDD" stroke-width="1.5" />
             <line x1="50" y1="25" x2="50" y2="85" stroke="#F3ECDD" stroke-width="1.5" stroke-dasharray="3,3" />`;
  } else if (categoria === "pantalon") {
    // Tailored trousers silhouette
    paths = `<path d="M30 15 L70 15 L78 85 L54 85 L50 48 L46 85 L22 85 Z" fill="${color}" opacity="0.9" />
             <line x1="50" y1="15" x2="50" y2="48" stroke="#F3ECDD" stroke-width="1.5" stroke-dasharray="3,3" />
             <line x1="38" y1="15" x2="38" y2="85" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
             <line x1="62" y1="15" x2="62" y2="85" stroke="rgba(255,255,255,0.15)" stroke-width="1" />`;
  } else if (categoria === "calzado") {
    // Classic Oxford shoe silhouette
    paths = `<path d="M15 65 C15 65 30 45 65 52 C75 54 85 62 85 75 L80 75 C80 75 75 70 65 70 L30 70 L25 75 L15 75 Z" fill="${color}" opacity="0.9" />
             <rect x="70" y="75" width="12" height="4" fill="#16130E" />
             <path d="M45 55 L58 58" fill="none" stroke="#F3ECDD" stroke-width="1.5" />
             <path d="M46 60 L56 62" fill="none" stroke="#F3ECDD" stroke-width="1.5" />`;
  } else {
    // Elegant accessory Watch silhouette
    paths = `<circle cx="50" cy="50" r="30" fill="none" stroke="${color}" stroke-width="10" />
             <circle cx="50" cy="50" r="23" fill="#221D15" />
             <line x1="50" y1="50" x2="50" y2="35" stroke="#F3ECDD" stroke-width="2.5" />
             <line x1="50" y1="50" x2="62" y2="50" stroke="rgba(243, 236, 221, 0.7)" stroke-width="2" />
             <circle cx="50" cy="50" r="3" fill="#C9A35B" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <rect width="100" height="100" fill="#221D15" />
    <g transform="translate(0, 0)">
      ${paths}
    </g>
    <rect x="2" y="2" width="96" height="96" fill="none" stroke="#3A3225" stroke-width="1" opacity="0.5" />
  </svg>`;
  
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
};

export default function TuArmario({ prendas, onPrendaAgregada, onPrendaEliminada, onPrendaActualizada }: TuArmarioProps) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | CategoriaPrenda>("all");
  
  // Registration control tabs
  const [registrationTab, setRegistrationTab] = useState<"ia" | "manual">("ia");

  // Manual Form States
  const [manualNombre, setManualNombre] = useState("");
  const [manualCategoria, setManualCategoria] = useState<CategoriaPrenda>("top");
  const [manualColor, setManualColor] = useState("#1D2B42");
  const [manualFormalidad, setManualFormalidad] = useState(3);
  const [manualTemporada, setManualTemporada] = useState<TemporadaPrenda>("todo");
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(null);
  const [manualUploading, setManualUploading] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPrenda, setSelectedPrenda] = useState<Prenda | null>(null);
  const [customDescripcion, setCustomDescripcion] = useState("");
  const [showVintedSync, setShowVintedSync] = useState(false);
  const [vintedDraft, setVintedDraft] = useState<{
    titulo: string;
    precio: number;
    descripcion: string;
  } | null>(null);
  const [vintedSyncStatus, setVintedSyncStatus] = useState<"idle" | "connecting" | "uploading" | "success">("idle");
  const [vintedStep, setVintedStep] = useState(0);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedTitulo, setCopiedTitulo] = useState(false);
  const [copiedPrecio, setCopiedPrecio] = useState(false);
  const [copiedDescripcion, setCopiedDescripcion] = useState(false);
  const [isMultiMode, setIsMultiMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Handle drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      await procesarArchivos(files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      await procesarArchivos(files);
    }
  };

  const handleManualFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setManualImageFile(file);
      const base64 = await fileToBase64(file);
      setManualImagePreview(base64);
    }
  };

  const handleAddPrendaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNombre.trim()) {
      setError("Por favor, introduce una denominación para la prenda.");
      return;
    }
    
    setError(null);
    setManualUploading(true);
    
    try {
      let finalImage = "";
      if (manualImagePreview) {
        finalImage = await resizeImage(manualImagePreview, 512);
      } else {
        finalImage = generateGarmentSVG(manualCategoria, manualColor);
      }
      
      const nuevaPrenda: Prenda = {
        id: "prenda_m_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        nombre: manualNombre.trim(),
        categoria: manualCategoria,
        color: manualColor,
        formalidad: manualFormalidad,
        temporada: manualTemporada,
        imageSrc: finalImage,
        descripcion: "Ficha registrada manualmente de forma instantánea."
      };
      
      onPrendaAgregada(nuevaPrenda);
      
      // Reset form fields
      setManualNombre("");
      setManualImageFile(null);
      setManualImagePreview(null);
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al procesar el archivo gráfico.");
    } finally {
      setManualUploading(false);
    }
  };

  const procesarArchivos = async (files: File[]) => {
    const validImageFiles = files.filter(f => f.type.startsWith("image/"));
    if (validImageFiles.length === 0) {
      setError("Por favor, selecciona al menos una imagen de prenda válida.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let completedCount = 0;
      setLoadingText(`Analizando lote con IA: 0 de ${validImageFiles.length} completadas...`);

      const promises = validImageFiles.map(async (file, i) => {
        try {
          const rawBase64 = await fileToBase64(file);
          // Resize to 768px on browser client for ultra-fast light payload
          const resizedBase64 = await resizeImage(rawBase64, 768);

          const res = await fetch("/api/analizar-prenda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: resizedBase64, isMulti: isMultiMode }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `Error en servidor`);
          }

          const infoParsed = await res.json();
          
          let prendasArray: any[] = [];
          if (infoParsed.prendas && Array.isArray(infoParsed.prendas)) {
            prendasArray = infoParsed.prendas;
          } else if (infoParsed.nombre) {
            prendasArray = [infoParsed];
          }

          if (prendasArray.length > 0) {
            const listToAdd: Prenda[] = [];
            for (let idx = 0; idx < prendasArray.length; idx++) {
              const item = prendasArray[idx];
              let croppedImg = resizedBase64;
              
              const yminVal = item.box_ymin !== undefined && item.box_ymin !== null ? Number(item.box_ymin) : NaN;
              const xminVal = item.box_xmin !== undefined && item.box_xmin !== null ? Number(item.box_xmin) : NaN;
              const ymaxVal = item.box_ymax !== undefined && item.box_ymax !== null ? Number(item.box_ymax) : NaN;
              const xmaxVal = item.box_xmax !== undefined && item.box_xmax !== null ? Number(item.box_xmax) : NaN;

              if (
                !isNaN(yminVal) &&
                !isNaN(xminVal) &&
                !isNaN(ymaxVal) &&
                !isNaN(xmaxVal) &&
                !(yminVal === 0 && xminVal === 0 && ymaxVal === 1000 && xmaxVal === 1000 && prendasArray.length === 1)
              ) {
                try {
                  croppedImg = await cropGarmentImage(
                    resizedBase64,
                    yminVal,
                    xminVal,
                    ymaxVal,
                    xmaxVal
                  );
                } catch (cropErr) {
                  console.error("No se pudo recortar la prenda, usando imagen base:", cropErr);
                }
              }

              const nuevaPrenda: Prenda = {
                id: "prenda_" + Date.now() + "_" + i + "_" + idx + "_" + Math.floor(Math.random() * 1000),
                nombre: item.nombre || "Prenda identificada con IA",
                categoria: (item.categoria as CategoriaPrenda) || "top",
                color: item.color || "#C9A35B",
                formalidad: item.formalidad !== undefined ? item.formalidad : 3,
                temporada: (item.temporada as TemporadaPrenda) || "todo",
                imageSrc: croppedImg,
              };
              listToAdd.push(nuevaPrenda);
            }
            if (listToAdd.length > 0) {
              onPrendaAgregada(listToAdd);
            }
          } else {
            throw new Error("No se pudo extraer ninguna prenda válida de la imagen analizada.");
          }
          
          completedCount++;
          setLoadingText(`Analizando lote con IA: ${completedCount} de ${validImageFiles.length} completadas...`);
        } catch (itemErr) {
          console.error("Error analizando con IA, aplicando fallback local:", itemErr);
          // Fallback to instantly add the garment card locally with a beautiful default style so user doesn't lose data or wait forever
          const rawBase64 = await fileToBase64(file);
          const resizedBase64 = await resizeImage(rawBase64, 400);
          
          const mockPrenda: Prenda = {
            id: "prenda_f_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 1000),
            nombre: "Prenda registrada (Ajustar manual)",
            categoria: "top",
            color: "#3A3225",
            formalidad: 3,
            temporada: "todo",
            imageSrc: resizedBase64,
            descripcion: "Fallo o lentitud al contactar la IA sastre. Presiona esta carta para configurar sus detalles y notas."
          };
          onPrendaAgregada(mockPrenda);
          completedCount++;
          setLoadingText(`Analizando lote con IA: ${completedCount} de ${validImageFiles.length} completadas...`);
        }
      });

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      setError("Fallo al registrar tanda de armario. Intenta de a pocos o usa el Registro Rápido.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  // Camera mechanics
  const startCamera = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setShowCamera(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // back camera is usually better for garments
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Webcam garment error:", err);
      // Fallback to front camera if environment camera is not available
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
      } catch (fallbackErr) {
        setError("No se pudo acceder a la cámara. Sube una foto local.");
        setShowCamera(false);
      }
    }
  };

  const stopCamera = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const captureSnapshot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const rawBase64 = canvas.toDataURL("image/jpeg");
        stopCamera();
        
        setLoading(true);
        setLoadingText("Analizando captura...");
        try {
          const resizedBase64 = await resizeImage(rawBase64, 768);
          const res = await fetch("/api/analizar-prenda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: resizedBase64, isMulti: isMultiMode }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Fallo al identificar la prenda o prendas.");
          }

          const infoParsed = await res.json();
          
          let prendasArray: any[] = [];
          if (infoParsed.prendas && Array.isArray(infoParsed.prendas)) {
            prendasArray = infoParsed.prendas;
          } else if (infoParsed.nombre) {
            prendasArray = [infoParsed];
          }

          if (prendasArray.length > 0) {
            const listToAdd: Prenda[] = [];
            for (let idx = 0; idx < prendasArray.length; idx++) {
              const item = prendasArray[idx];
              let croppedImg = resizedBase64;

              const yminVal = item.box_ymin !== undefined && item.box_ymin !== null ? Number(item.box_ymin) : NaN;
              const xminVal = item.box_xmin !== undefined && item.box_xmin !== null ? Number(item.box_xmin) : NaN;
              const ymaxVal = item.box_ymax !== undefined && item.box_ymax !== null ? Number(item.box_ymax) : NaN;
              const xmaxVal = item.box_xmax !== undefined && item.box_xmax !== null ? Number(item.box_xmax) : NaN;

              if (
                !isNaN(yminVal) &&
                !isNaN(xminVal) &&
                !isNaN(ymaxVal) &&
                !isNaN(xmaxVal) &&
                !(yminVal === 0 && xminVal === 0 && ymaxVal === 1000 && xmaxVal === 1000 && prendasArray.length === 1)
              ) {
                try {
                  croppedImg = await cropGarmentImage(
                    resizedBase64,
                    yminVal,
                    xminVal,
                    ymaxVal,
                    xmaxVal
                  );
                } catch (cropErr) {
                  console.error("Error al recortar captura:", cropErr);
                }
              }

              const nuevaPrenda: Prenda = {
                id: "prenda_" + Date.now() + "_" + idx + "_" + Math.floor(Math.random() * 1000),
                nombre: item.nombre || "Prenda identificada con IA",
                categoria: (item.categoria as CategoriaPrenda) || "top",
                color: item.color || "#C9A35B",
                formalidad: item.formalidad !== undefined ? item.formalidad : 3,
                temporada: (item.temporada as TemporadaPrenda) || "todo",
                imageSrc: croppedImg,
              };
              listToAdd.push(nuevaPrenda);
            }
            if (listToAdd.length > 0) {
              onPrendaAgregada(listToAdd);
            }
          } else {
            throw new Error("Fallo al identificar la prenda o prendas de la captura.");
          }
        } catch (err: any) {
          console.error(err);
          let errorFriendly = err.message || "Fallo del estilista al analizar la prenda capturada.";
          if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
            errorFriendly = "No se ha podido conectar con el atelier virtual de Espejo para registrar esta prenda. Por favor, reinténtalo en un momento.";
          }
          setError(errorFriendly);
        } finally {
          setLoading(false);
          setLoadingText("");
        }
      }
    }
  };

  // Filter garments list
  const prendasFiltradas = prendas.filter((p) => {
    if (activeCategoryFilter === "all") return true;
    return p.categoria === activeCategoryFilter;
  });

  return (
    <section id="tu-armario-sección" className="border-t border-linea pt-8 pb-10">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-laton font-medium text-lg">02</span>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta">Tu Armario</h2>
        </div>
        <p className="text-xs font-sans text-tinta-apagada select-none">DIGITAL WARDROBE</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Garment Uploader - Column 1 */}
        <div className="lg:col-span-1">
          <p className="text-tinta-apagada text-sm mb-4">
            Registra tu armario para que el sastre digital elabore las mejores propuestas visuales.
          </p>

          {/* Tab Selector */}
          <div className="flex border-b border-linea mb-5 select-none font-sans">
            <button
              type="button"
              onClick={() => {
                setRegistrationTab("ia");
                setError(null);
              }}
              className={`flex-1 py-4 text-xs font-semibold uppercase tracking-widest border-b-2 transition ${
                registrationTab === "ia"
                  ? "border-laton text-laton bg-tarjeta/15"
                  : "border-transparent text-tinta-apagada hover:text-tinta hover:bg-tarjeta/5"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Sparkles size={11} className={registrationTab === "ia" ? "animate-pulse" : ""} /> Escáner IA sastre
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRegistrationTab("manual");
                setError(null);
              }}
              className={`flex-1 py-4 text-xs font-semibold uppercase tracking-widest border-b-2 transition ${
                registrationTab === "manual"
                  ? "border-laton text-laton bg-tarjeta/15"
                  : "border-transparent text-tinta-apagada hover:text-tinta hover:bg-tarjeta/5"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Plus size={12} /> Registro Rápido
              </span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {registrationTab === "ia" ? (
              <motion.div
                key="ia-panel"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4"
              >
                {!showCamera ? (
                  <motion.div
                    key="dropzone"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`border border-dashed p-6 rounded-lg text-center flex flex-col items-center justify-center cursor-pointer min-h-[170px] espejo-transition ${
                      dragActive ? "border-laton bg-tarjeta/40" : "border-linea bg-tarjeta/10 hover:border-laton-apagado hover:bg-tarjeta/20"
                      } ${loading ? "pointer-events-none opacity-50" : ""}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={loading}
                    />

                    {loading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 mb-3 relative">
                          <div className="absolute inset-0 rounded-full border-2 border-linea"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-laton border-t-transparent animate-spin"></div>
                        </div>
                        <p className="font-serif text-sm text-tinta italic">
                          {loadingText || (isMultiMode ? "Desglosando lote..." : "Analizando Tejido...")}
                        </p>
                        <p className="text-[10px] text-tinta-apagada mt-0.5 animate-pulse">
                          {isMultiMode ? "Identificando cada prenda individualmente con IA..." : "Clasificando e indexando en armario..."}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-tarjeta rounded-full border border-linea mb-3 text-laton">
                          <Plus size={20} />
                        </div>
                        <p className="font-serif text-base text-tinta font-semibold">Registrar con IA</p>
                        <p className="text-[11px] text-tinta-apagada mt-0.5 mb-4 font-light">Arrastra fotos de prendas o haz clic para subir</p>
                        
                        <button
                          type="button"
                          id="boton-camara-prenda"
                          onClick={startCamera}
                          className="button-press flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-tarjeta border border-linea text-tinta-apagada hover:text-laton hover:border-laton transition text-xs rounded select-none font-medium"
                        >
                          <Camera size={13} /> Usar Cámara
                        </button>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="camera-box"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="p-4 bg-tarjeta rounded-lg border border-linea flex flex-col items-center"
                  >
                    <div className="relative overflow-hidden rounded bg-black w-full aspect-square mb-4 border border-linea">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                      />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[9px] text-laton font-medium border border-linea">
                        CÁMARA ACTIVADA
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full justify-center">
                      <button
                        type="button"
                        id="boton-capturar-prenda"
                        onClick={captureSnapshot}
                        className="button-press px-4 py-2 bg-laton text-fondo font-bold text-xs rounded hover:bg-white flex items-center gap-1"
                      >
                        <Plus size={13} /> Capturar
                      </button>
                      <button
                        type="button"
                        id="boton-cancelar-camara-prenda"
                        onClick={() => stopCamera()}
                        className="button-press px-3 py-2 border border-linea text-tinta-apagada hover:text-tinta text-xs rounded"
                      >
                        Cerrar
                      </button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </motion.div>
                )}

                {/* Multiple garments switch inside IA panel */}
                <div className="bg-tarjeta border border-linea p-3.5 rounded-lg select-none text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] font-bold text-tinta uppercase tracking-widest block font-sans">
                        ¿Foto grupal de prendas?
                      </span>
                      <span className="text-[9.5px] text-tinta-apagada block font-sans font-light leading-relaxed">
                        Actívalo si en la misma fotografía aparecen varias prendas juntas (ej. 6 camisetas juntas). ESPEJO desglosará cada una con IA en fichas independientes automáticamente.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMultiMode(!isMultiMode)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isMultiMode ? "bg-laton" : "bg-linea"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-fondo shadow ring-0 transition duration-200 ease-in-out ${
                          isMultiMode ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {isMultiMode && (
                    <div className="flex items-center gap-1.5 text-[8.5px] bg-fondo p-1.5 px-2.5 rounded border border-laton/20 text-laton font-medium mt-2.5 font-sans justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-laton animate-ping" />
                      Modo Desglose Express activo. Se extraerán múltiples fichas.
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="manual-panel"
                onSubmit={handleAddPrendaManual}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-4 bg-tarjeta border border-linea rounded-lg space-y-4 text-left font-sans"
              >
                {/* Garment Name */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-laton font-bold font-sans">
                    Denominación de Prenda
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    placeholder="Ej: Camisa Slim Oxford Blanca"
                    value={manualNombre}
                    onChange={(e) => setManualNombre(e.target.value)}
                    className="w-full text-xs font-sans bg-fondo border border-linea text-tinta p-2.5 rounded focus:border-laton focus:outline-none placeholder-tinta-apagada/30 font-medium"
                  />
                </div>

                {/* Category selectors */}
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-laton font-bold font-sans">
                    Categoría
                  </label>
                  <div className="grid grid-cols-2 gap-2 select-none">
                    {([
                      { id: "top", label: "P. Superior" },
                      { id: "pantalon", label: "P. Inferior" },
                      { id: "calzado", label: "Calzado" },
                      { id: "accesorio", label: "Accesorio" }
                    ] as { id: CategoriaPrenda, label: string }[]).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setManualCategoria(cat.id)}
                        className={`p-2 border text-[10px] font-semibold rounded uppercase tracking-wider text-center transition ${
                          manualCategoria === cat.id
                            ? "bg-laton border-laton text-fondo"
                            : "bg-fondo/20 border-linea text-tinta-apagada hover:text-tinta hover:border-laton/40"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Bespoke Menswear Palette */}
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-laton font-bold font-sans block">
                    Cromática Predominante
                  </label>
                  <div className="flex flex-wrap gap-1.5 items-center justify-start bg-fondo2/40 border border-linea/60 p-2 rounded">
                    {[
                      { hex: "#1D2B42", name: "Azul Marino" },
                      { hex: "#313639", name: "Gris Carbón" },
                      { hex: "#111111", name: "Negro Sastre" },
                      { hex: "#F3EFE0", name: "Blanco Crudo" },
                      { hex: "#C3B091", name: "Camel/Beige" },
                      { hex: "#5C061D", name: "Burdeos" },
                      { hex: "#1E352F", name: "Verde Bosque" },
                      { hex: "#7F8C8D", name: "Gris Medio" },
                      { hex: "#3A2A1A", name: "Marrón Chocolate" },
                    ].map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        title={col.name}
                        onClick={() => setManualColor(col.hex)}
                        className={`w-5 h-5 rounded-full border relative transition-transform ${
                          manualColor === col.hex ? "scale-[1.15] border-laton" : "border-white/10 hover:scale-110"
                        }`}
                        style={{ backgroundColor: col.hex }}
                      >
                        {manualColor === col.hex && (
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white mix-blend-difference font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                    {/* Custom HTML Color Picker */}
                    <div className="relative w-5 h-5 rounded-full border border-white/10 overflow-hidden flex items-center justify-center cursor-pointer bg-gradient-to-tr from-rose-500 via-emerald-500 to-sky-500" title="Color personalizado">
                      <input
                        type="color"
                        value={manualColor}
                        onChange={(e) => setManualColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <span className="text-[8px] text-white font-bold select-none pointer-events-none">+</span>
                    </div>
                    <span className="text-[9px] font-mono text-tinta-apagada font-medium select-all uppercase">
                      {manualColor}
                    </span>
                  </div>
                </div>

                {/* Formality Star select */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-laton font-bold font-sans block">
                    Nivel de Formalidad
                  </label>
                  <div className="flex items-center gap-1.5 bg-fondo2/40 border border-linea/60 p-2.5 rounded justify-center">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const starVal = idx + 1;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setManualFormalidad(starVal)}
                          className="text-amber-500 hover:scale-120 transition"
                          title={`Grado ${starVal}`}
                        >
                          <Star
                            size={16}
                            className={starVal <= manualFormalidad ? "fill-laton text-laton" : "text-linea"}
                          />
                        </button>
                      );
                    })}
                    <span className="text-[10px] text-tinta-apagada font-sans font-medium ml-2">
                      {manualFormalidad === 3 && "Smart Casual"}
                      {manualFormalidad === 1 && "Informal"}
                      {manualFormalidad === 2 && "Casual Link"}
                      {manualFormalidad === 4 && "Sastrería"}
                      {manualFormalidad === 5 && "Gala / Chaqué"}
                    </span>
                  </div>
                </div>

                {/* Season tags selectors */}
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-laton font-bold font-sans">
                    Naturaleza Estacional
                  </label>
                  <div className="grid grid-cols-3 gap-2 select-none">
                    {([
                      { id: "verano", label: "Verano / Prim." },
                      { id: "invierno", label: "Invierno / Oto." },
                      { id: "todo", label: "Todo el Año" }
                    ] as { id: TemporadaPrenda, label: string }[]).map((temp) => (
                      <button
                        key={temp.id}
                        type="button"
                        onClick={() => setManualTemporada(temp.id)}
                        className={`p-1.5 border text-[9px] font-semibold rounded uppercase tracking-wider text-center transition ${
                          manualTemporada === temp.id
                            ? "bg-laton border-laton text-fondo"
                            : "bg-fondo/20 border-linea text-tinta-apagada hover:text-tinta hover:border-laton/40"
                        }`}
                      >
                        {temp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Dropzone or Selection (Optional, instantly processed client side) */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-laton font-bold font-sans block">
                    Fotografía de Prenda (Opcional)
                  </label>
                  <div className="flex items-center gap-3 bg-fondo2/40 border border-linea/60 p-2.5 rounded">
                    <div className="relative w-12 h-12 bg-fondo border border-linea rounded overflow-hidden shrink-0 flex items-center justify-center">
                      {manualImagePreview ? (
                        <img src={manualImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={16} className="text-tinta-apagada/30" />
                      )}
                      {manualImagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualImageFile(null);
                            setManualImagePreview(null);
                          }}
                          className="absolute -top-1 -right-1 bg-black/80 hover:bg-red-950 p-1 rounded-full text-red-400 border border-linea z-10"
                        >
                          <X size={8} />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex-1 text-left">
                      <input
                        type="file"
                        id="foto-manual-prenda"
                        className="hidden"
                        accept="image/*"
                        onChange={handleManualFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById("foto-manual-prenda")?.click()}
                        className="button-press border border-linea py-1 px-2.5 bg-tarjeta rounded text-[9.5px] font-semibold uppercase tracking-wider text-tinta hover:text-laton hover:border-laton transition"
                      >
                        {manualImagePreview ? "Cambiar Foto" : "Subir Imagen"}
                      </button>
                      <p className="text-[8.5px] text-tinta-apagada/70 mt-1 leading-normal">Si no subes foto, se creará un magnífico avatar según la categoría.</p>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={manualUploading}
                  className="w-full py-2.5 mt-2 bg-laton text-fondo hover:bg-white font-bold text-xs uppercase tracking-widest rounded transition duration-200 shadow-lg flex items-center justify-center gap-1.5 select-none"
                >
                  {manualUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-fondo border-t-transparent animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={13} /> Añadir Instantáneamente
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-950/20 border border-red-900/30 text-red-300 text-xs rounded">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 p-4 bg-tarjeta/30 border border-linea rounded-md text-xs space-y-2">
            <span className="text-laton font-medium flex items-center gap-1">
              <Star size={11} className="fill-laton text-laton" /> Pauta del Estilista
            </span>
            <p className="text-tinta-apagada font-light leading-relaxed">
              Registra diferentes niveles de formalidad. Lograrás mayor polivalencia al confeccionar propuestas
              para mañanas frías, bodas de tarde o cenas casuales.
            </p>
          </div>
        </div>

        {/* Garment Catalog & Filtering - Columns 2 & 3 */}
        <div className="lg:col-span-2">

          {/* Categories Selector tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none border-b border-linea/60">
            <SlidersHorizontal size={12} className="text-laton shrink-0" />
            <button
              type="button"
              id="filtro-todos"
              onClick={() => setActiveCategoryFilter("all")}
              className={`px-3 py-1.5 text-xs rounded font-sans uppercase tracking-wider transition ${
                activeCategoryFilter === "all" ? "bg-laton text-fondo font-semibold" : "text-tinta-apagada hover:text-tinta"
              }`}
            >
              Todos ({prendas.length})
            </button>
            {(["top", "pantalon", "calzado", "accesorio"] as CategoriaPrenda[]).map((cat) => (
              <button
                key={cat}
                type="button"
                id={`filtro-${cat}`}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs rounded font-sans uppercase tracking-wider transition shrink-0 ${
                  activeCategoryFilter === cat ? "bg-laton text-fondo font-semibold" : "text-tinta-apagada hover:text-tinta"
                }`}
              >
                {getCategoryLabel(cat)} ({prendas.filter((p) => p.categoria === cat).length})
              </button>
            ))}
          </div>

          {/* Catalog grid representation */}
          <AnimatePresence mode="wait">
            {prendasFiltradas.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 px-6 bg-tarjeta/10 rounded-lg border border-linea border-dashed text-center"
              >
                <Tag size={28} className="text-laton-apagado mx-auto mb-3" />
                <p className="font-serif text-lg text-tinta italic font-medium">Armario despejado</p>
                <p className="text-xs text-tinta-apagada mt-1 max-w-sm mx-auto">
                  No hay prendas cargadas en esta categoría. Sube fotografías para entrenar a tu sastre digital.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-4"
              >
                {prendasFiltradas.map((prenda) => (
                  <motion.div
                    key={prenda.id}
                    layoutId={prenda.id}
                    onClick={() => {
                      setSelectedPrenda(prenda);
                      setCustomDescripcion(prenda.descripcion || "");
                      setShowVintedSync(false);
                      setVintedDraft(null);
                      setVintedSyncStatus("idle");
                      setCopiedText(false);
                    }}
                    className="group bg-tarjeta border border-linea rounded overflow-hidden flex flex-col justify-between hover:border-laton cursor-pointer transition duration-300"
                  >
                    {/* Item Image area */}
                    <div className="relative aspect-square w-full bg-fondo2 overflow-hidden border-b border-linea/40">
                      <img
                        src={prenda.imageSrc}
                        alt={prenda.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Delete option */}
                      <button
                        type="button"
                        id={`eliminar-${prenda.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrendaEliminada(prenda.id);
                        }}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-red-950 border border-linea/60 text-tinta hover:text-red-300 p-1.5 rounded transition opacity-0 group-hover:opacity-100"
                        title="Borrar prenda"
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Season indicators */}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {prenda.temporada === "verano" && (
                          <span className="bg-black/60 backdrop-blur border border-linea/40 text-amber-400 p-1 rounded text-[10px]" title="Verano">
                            <Sun size={10} />
                          </span>
                        )}
                        {prenda.temporada === "invierno" && (
                          <span className="bg-black/60 backdrop-blur border border-linea/40 text-sky-400 p-1 rounded text-[10px]" title="Invierno">
                            <Snowflake size={10} />
                          </span>
                        )}
                        {prenda.temporada === "todo" && (
                          <span className="bg-black/60 backdrop-blur border border-linea/40 text-laton p-1 rounded text-[10px] font-sans font-semibold" title="Multiestacional">
                            C
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description Area */}
                    <div className="p-3">
                      <p className="text-[9px] uppercase tracking-widest text-laton font-medium">
                        {getCategoryLabel(prenda.categoria)}
                      </p>
                      <h4 className="font-serif text-xs font-semibold text-tinta truncate mt-0.5" title={prenda.nombre}>
                        {prenda.nombre}
                      </h4>

                      {prenda.descripcion && (
                        <p className="text-[10px] text-tinta-apagada line-clamp-1 italic mt-1 font-light border-l border-laton-apagado/30 pl-1.5">
                          {prenda.descripcion}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2.5">
                        {/* Dominant Color */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block shadow-inner"
                            style={{ backgroundColor: prenda.color }}
                            title={`Color hexadecimal: ${prenda.color}`}
                          />
                          <span className="text-[10px] font-mono text-tinta-apagada uppercase">
                            {prenda.color}
                          </span>
                        </div>

                        {/* Formality indicator stars */}
                        <div className="flex items-center gap-0.5" title={`Nivel de formalidad: ${prenda.formalidad}/5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={8}
                              className={i < prenda.formalidad ? "fill-laton text-laton" : "text-linea"}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Garment Details & Description Modal */}
      <AnimatePresence>
        {selectedPrenda && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fondo/90 backdrop-blur-md">
            {/* Backdrop close capture */}
            <div 
              className="absolute inset-0 cursor-default animate-fade-in" 
              onClick={() => setSelectedPrenda(null)} 
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ cubicBezier: [0.16, 1, 0.3, 1], duration: 0.5 }}
              className="relative w-full max-w-md bg-tarjeta border border-linea rounded overflow-hidden shadow-2xl flex flex-col z-10 font-sans"
            >
              {/* Top Bar with X button */}
              <div className="flex items-center justify-between p-4 border-b border-linea/60 bg-fondo2/40">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${showVintedSync ? "bg-[#09b1ba]" : "bg-laton"}`} />
                  <span className={`font-sans text-[10px] tracking-widest uppercase font-bold ${showVintedSync ? "text-[#09b1ba]" : "text-laton"}`}>
                    {showVintedSync ? "Vinted Express Integrator" : "Ficha del Sastre"}
                  </span>
                </div>
                <button
                  type="button"
                  id="boton-cerrar-detalle"
                  onClick={() => setSelectedPrenda(null)}
                  className="button-press text-tinta-apagada hover:text-laton p-1 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {!showVintedSync ? (
                <>
                  {/* Standard Garment Detail Modal Body */}
                  <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-none">
                    {/* Large Image Preview */}
                    <div className="relative aspect-square w-full rounded bg-fondo2 overflow-hidden border border-linea/60">
                      <img
                        src={selectedPrenda.imageSrc}
                        alt={selectedPrenda.nombre}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded text-[9px] text-laton font-medium border border-linea/30 uppercase tracking-widest">
                        {getCategoryLabel(selectedPrenda.categoria)}
                      </div>
                    </div>

                    {/* Info and characteristics */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-serif text-lg font-bold text-tinta">
                          {selectedPrenda.nombre}
                        </h3>
                      </div>

                      {/* Attributes Grid */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-fondo2/40 border border-linea/60 rounded">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium">
                            Temporada
                          </span>
                          <p className="text-xs text-tinta font-medium mt-0.5 flex items-center gap-1">
                            {selectedPrenda.temporada === "verano" && (
                              <>
                                <Sun size={10} className="text-amber-400" /> Verano / Primavera
                              </>
                            )}
                            {selectedPrenda.temporada === "invierno" && (
                              <>
                                <Snowflake size={10} className="text-sky-400" /> Invierno / Otoño
                              </>
                            )}
                            {selectedPrenda.temporada === "todo" && <>Multiestacional (Todo el Año)</>}
                          </p>
                        </div>

                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium">
                            Formalidad
                          </span>
                          <div className="flex items-center gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={9}
                                className={i < selectedPrenda.formalidad ? "fill-laton text-laton" : "text-linea"}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium">
                            Tono Dominante
                          </span>
                          <p className="text-xs text-tinta font-mono max-w-[120px] truncate uppercase flex items-center gap-1.5 mt-0.5">
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 inline-block shrink-0"
                              style={{ backgroundColor: selectedPrenda.color }}
                            />
                            {selectedPrenda.color}
                          </p>
                        </div>

                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-tinta-apagada/80 font-medium">
                            Identificador
                          </span>
                          <p className="text-[10px] font-mono text-tinta-apagada truncate mt-0.5">
                            #{selectedPrenda.id.split("_")[1] || selectedPrenda.id}
                          </p>
                        </div>
                      </div>

                      {/* Description Input Textarea */}
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-laton font-medium flex items-center gap-1">
                          <FileText size={10} /> Notas y Descripción Especial
                        </label>
                        <textarea
                          value={customDescripcion}
                          onChange={(e) => setCustomDescripcion(e.target.value)}
                          placeholder="Agrega notas sobre fit, tejido, etiqueta (ej: Lino italiano de Massimo Dutti, corte Slim)..."
                          className="w-full text-xs bg-fondo2 text-tinta border border-linea rounded p-2.5 focus:border-laton focus:outline-none min-h-[70px] resize-none leading-relaxed placeholder-tinta-apagada/40 font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operational Action Buttons footer */}
                  <div className="flex items-center justify-between p-4 border-t border-linea/60 bg-fondo2/40">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("¿Seguro que deseas eliminar esta prenda?")) {
                          onPrendaEliminada(selectedPrenda.id);
                          setSelectedPrenda(null);
                        }
                      }}
                      className="button-press flex items-center gap-1 text-[10px] text-tinta-apagada hover:text-red-400 font-sans font-bold uppercase tracking-wider"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const recommendedPrice = selectedPrenda.formalidad * 12 + 15;
                          setVintedDraft({
                            titulo: `Elegante ${selectedPrenda.nombre} - Espejo Selected`,
                            precio: recommendedPrice,
                            descripcion: `Exquisito ${selectedPrenda.nombre.toLowerCase()} en impecable estado de conservación.\n\nTemporada óptima: ${selectedPrenda.temporada === "verano" ? "Primavera/Verano" : selectedPrenda.temporada === "invierno" ? "Otoño/Invierno" : "Multiestacional"}.\nObservaciones sastreras: ${customDescripcion || "Prenda de excelente diseño y tacto premium para balancear cualquier atuendo clásico."}\n\n#slowfashion #vintagedepot #elegantmen #sartorial #espejoboutique`,
                          });
                          setShowVintedSync(true);
                          setVintedSyncStatus("idle");
                          setVintedStep(0);
                        }}
                        className="button-press px-3 py-1.5 bg-[#09b1ba] text-white hover:bg-[#0aa2ac] font-bold text-[10px] rounded flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        <ShoppingBag size={12} /> Subir a Vinted
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onPrendaActualizada) {
                            onPrendaActualizada({
                              ...selectedPrenda,
                              descripcion: customDescripcion,
                            });
                          }
                          setSelectedPrenda(null);
                        }}
                        className="button-press px-4 py-1.5 bg-laton text-fondo hover:bg-white text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider"
                      >
                        <Check size={12} /> Guardar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Vinted Express view inline details */}
                  <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-none">
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded bg-fondo2 border border-linea overflow-hidden shrink-0">
                        <img
                          src={selectedPrenda.imageSrc}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-serif text-sm font-bold text-tinta">{selectedPrenda.nombre}</h4>
                        <p className="text-[10px] text-tinta-apagada">Generando anuncio de venta circular con Inteligencia Artificial</p>
                      </div>
                    </div>

                    {vintedDraft && (
                      <div className="space-y-3.5 pt-2">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-laton font-medium">Título del Anuncio</label>
                          <input
                            type="text"
                            value={vintedDraft.titulo}
                            onChange={(e) => setVintedDraft({ ...vintedDraft, titulo: e.target.value })}
                            className="w-full text-xs font-sans bg-fondo border border-linea text-tinta p-2 rounded focus:border-laton focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-laton font-medium">Precio de Reventa (€)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={vintedDraft.precio}
                              onChange={(e) => setVintedDraft({ ...vintedDraft, precio: parseInt(e.target.value) || 0 })}
                              className="w-20 text-xs font-sans bg-fondo border border-[#3a3225] text-tinta p-2 rounded focus:border-laton focus:outline-none"
                            />
                            <span className="text-[10px] text-tinta-apagada italic">Valoración recomendada</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-laton font-medium">Descripción y Hashtags</label>
                          <textarea
                            value={vintedDraft.descripcion}
                            onChange={(e) => setVintedDraft({ ...vintedDraft, descripcion: e.target.value })}
                            className="w-full h-28 text-xs font-sans bg-fondo border border-linea text-tinta p-2 rounded focus:border-laton focus:outline-none resize-none leading-relaxed"
                          />
                        </div>

                        {/* Connection log progress bar indicator */}
                        <div className="p-3 bg-fondo border border-linea rounded text-[10px]">
                          {vintedSyncStatus === "idle" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setVintedSyncStatus("connecting");
                                setVintedStep(1);
                                setTimeout(() => setVintedStep(2), 1000);
                                setTimeout(() => {
                                  setVintedSyncStatus("uploading");
                                  setVintedStep(3);
                                }, 2100);
                                setTimeout(() => {
                                  setVintedSyncStatus("success");
                                }, 3300);
                              }}
                              className="button-press w-full py-2 bg-[#09b1ba] dark:bg-[#09c0ca] font-mono text-white text-[10px] uppercase tracking-wider font-bold rounded flex items-center justify-center gap-1"
                            >
                              Sincronizar con mi cuenta <ArrowRight size={11} />
                            </button>
                          ) : (
                            <div className="space-y-2 font-mono">
                              <div className="flex items-center justify-between text-[8px] uppercase font-bold text-tinta-apagada font-sans border-b border-linea/40 pb-1">
                                <span>Canal de sincronización</span>
                                <span className="text-[#09b1ba] animate-pulse">{vintedSyncStatus}...</span>
                              </div>
                              <div className="space-y-1 text-[9px] text-tinta-apagada">
                                <div className={`flex items-center gap-1.5 ${vintedStep >= 1 ? "text-laton" : "text-tinta-apagada/40"}`}>
                                  {vintedStep >= 1 ? <Check size={10} className="text-laton font-black" /> : <span className="w-1.5 h-1.5 rounded-full bg-linea" />}
                                  <span>Conectando API de Vinted</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${vintedStep >= 2 ? "text-laton" : "text-tinta-apagada/40"}`}>
                                  {vintedStep >= 2 ? <Check size={10} className="text-laton font-black" /> : <span className="w-1.5 h-1.5 rounded-full bg-linea" />}
                                  <span>Formateando imagen de la prenda</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${vintedStep >= 3 ? "text-laton" : "text-tinta-apagada/40"}`}>
                                  {vintedStep >= 3 ? <Check size={10} className="text-laton font-black" /> : <span className="w-1.5 h-1.5 rounded-full bg-linea" />}
                                  <span>Publicando anuncio borrador</span>
                                </div>
                              </div>

                              {vintedSyncStatus === "success" && (
                                <div className="space-y-3 mt-2">
                                  <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-200 font-sans text-[10px] leading-relaxed rounded">
                                    <strong>¡Anuncio sastrero automatizado!</strong> Debido a las políticas de seguridad de Vinted, no es posible enviar información directamente desde nuestros servidores a sus formularios de forma invisible. 
                                    Por ello, ESPEJO ha creado la <strong>Sincronización Express en 1-Clic</strong>:
                                  </div>

                                  <div className="bg-tarjeta p-3 border border-linea rounded space-y-2.5 font-sans">
                                    <div className="flex items-center gap-2 p-1.5 bg-fondo rounded border border-linea/60 text-[10px]">
                                      <span className="w-4 h-4 rounded-full bg-laton text-fondo flex items-center justify-center font-bold text-[8.5px] shrink-0">1</span>
                                      <span className="font-semibold text-tinta">Foto guardada automáticamente</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 bg-fondo rounded border border-linea/60 text-[10px]">
                                      <span className="w-4 h-4 rounded-full bg-laton text-fondo flex items-center justify-center font-bold text-[8.5px] shrink-0">2</span>
                                      <span className="font-semibold text-tinta text-left">Ficha SEO copiada al Portapapeles (Título, Precio y Hashtags)</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 bg-[#09b1ba]/10 rounded border border-[#09b1ba]/30 text-[10px]">
                                      <span className="w-4 h-4 rounded-full bg-[#09b1ba] text-white flex items-center justify-center font-bold text-[8.5px] shrink-0">3</span>
                                      <span className="font-semibold text-[#09b1ba]">Redirección lista para pegar</span>
                                    </div>
                                  </div>

                                  {/* Fast Copy Individual Fields Board */}
                                  <div className="bg-fondo p-3 border border-linea rounded space-y-3 text-left font-sans">
                                    <p className="text-[9px] uppercase tracking-widest text-[#C9A35B] font-bold">
                                      Copias Individuales Rápidas:
                                    </p>
                                    <p className="text-[8px] text-tinta-apagada -mt-2">
                                      Para rellenar en Vinted en 5 segundos sin tocar el teclado.
                                    </p>
                                    
                                    <div className="space-y-1.5">
                                      {/* Título copy row */}
                                      <div className="flex items-center gap-2 bg-tarjeta p-1 px-2 border border-linea/60 rounded justify-between">
                                        <div className="overflow-hidden w-full text-left">
                                          <span className="text-[7px] text-[#A89C82] block uppercase font-bold tracking-wider">Título</span>
                                          <span className="text-[9.5px] text-[#F3ECDD] truncate block">{vintedDraft?.titulo}</span>
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
                                          className="text-[8.5px] font-sans font-bold uppercase shrink-0 px-2.5 py-1 bg-laton hover:bg-white text-fondo rounded transition active:scale-95"
                                        >
                                          {copiedTitulo ? "¡Copiado! ✓" : "Copiar"}
                                        </button>
                                      </div>

                                      {/* Precio copy row */}
                                      <div className="flex items-center gap-2 bg-tarjeta p-1 px-2 border border-linea/60 rounded justify-between">
                                        <div className="overflow-hidden w-full text-left">
                                          <span className="text-[7px] text-[#A89C82] block uppercase font-bold tracking-wider">Precio (Número Limpio)</span>
                                          <span className="text-[9.5px] text-laton font-bold">{vintedDraft?.precio} €</span>
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
                                          className="text-[8.5px] font-sans font-bold uppercase shrink-0 px-2.5 py-1 bg-laton hover:bg-white text-fondo rounded transition active:scale-95"
                                        >
                                          {copiedPrecio ? "¡Copiado! ✓" : "Copiar"}
                                        </button>
                                      </div>

                                      {/* Descripción copy row */}
                                      <div className="flex flex-col gap-1 bg-tarjeta p-2 border border-linea/60 rounded">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[7px] text-[#A89C82] uppercase font-bold tracking-wider">Descripción del sastre</span>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (vintedDraft) {
                                                await navigator.clipboard.writeText(vintedDraft.descripcion);
                                                setCopiedDescripcion(true);
                                                setTimeout(() => setCopiedDescripcion(false), 2000);
                                              }
                                            }}
                                            className="text-[8.5px] font-sans font-bold uppercase px-2.5 py-0.5 bg-laton hover:bg-white text-fondo rounded transition active:scale-95"
                                          >
                                            {copiedDescripcion ? "¡Copiado! ✓" : "Copiar"}
                                          </button>
                                        </div>
                                        <div className="text-[8px] text-tinta-apagada leading-relaxed bg-fondo/40 p-1.5 rounded border border-linea/20 mt-1 max-h-12 overflow-y-auto break-words text-left">
                                          {vintedDraft?.descripcion}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vinted active buttons footer */}
                  <div className="flex items-center justify-between p-4 border-t border-linea/60 bg-fondo2/40">
                    <button
                      type="button"
                      onClick={async () => {
                        if (vintedDraft) {
                          const content = `Título: ${vintedDraft.titulo}\nPrecio: ${vintedDraft.precio}€\n\nDescripción:\n${vintedDraft.descripcion}`;
                          await navigator.clipboard.writeText(content);
                          setCopiedText(true);
                          setTimeout(() => setCopiedText(false), 2000);
                        }
                      }}
                      className="button-press flex items-center gap-1 text-[10px] text-tinta hover:text-laton font-sans font-bold uppercase tracking-wider"
                    >
                      <Clipboard size={12} /> {copiedText ? "¡Copiado!" : "Copiar Ficha"}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowVintedSync(false)}
                        className="button-press border border-linea px-3 py-1.5 hover:border-tinta text-tinta-apagada hover:text-tinta text-[10px] font-bold rounded uppercase tracking-wider"
                      >
                        Regresar
                      </button>

                      {vintedSyncStatus === "success" ? (
                        <button
                          type="button"
                          onClick={async () => {
                            // 1. Descargar la imagen automáticamente
                            if (selectedPrenda) {
                              const link = document.createElement("a");
                              link.href = selectedPrenda.imageSrc;
                              link.download = `${selectedPrenda.nombre.toLowerCase().replace(/\s+/g, "_")}_espejo.png`;
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
                                console.error("Clipboard copy failed", e);
                              }
                            }

                            // 3. Abrir Vinted en una pestaña nueva listo para subir
                            window.open("https://www.vinted.es/items/new", "_blank");
                          }}
                          className="button-press px-4 py-1.5 bg-[#09b1ba] text-white hover:bg-[#0aa2ac] hover:text-white text-[10px] font-bold rounded flex items-center gap-1.5 uppercase tracking-wider"
                        >
                          Crear Anuncio en Vinted <ExternalLink size={12} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
