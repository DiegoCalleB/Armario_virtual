import React, { useState, useRef } from "react";
import { Rostro } from "../types";
import { fileToBase64, resizeImage } from "../utils";
import { Camera, Upload, Sparkles, Check, RotateCcw, User, Eye, AlertCircle, Image } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import GooglePhotosPicker from "./GooglePhotosPicker";

interface TuEspejoProps {
  rostro: Rostro | null;
  onAnalizado: (rostro: Rostro) => void;
  onBorrar: () => void;
}

export default function TuEspejo({ rostro, onAnalizado, onBorrar }: TuEspejoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Handle Drag Events
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await procesarImagen(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await procesarImagen(file);
    }
  };

  // Process and scale face image from base64 directly
  const procesarBase64 = async (rawBase64: string) => {
    setError(null);
    setLoading(true);

    try {
      // Resize to 768px in browser as requested!
      const resizedBase64 = await resizeImage(rawBase64, 768);
      
      // Send for analysis
      const res = await fetch("/api/analizar-rostro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: resizedBase64 }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al analizar la fisionomía.");
      }

      const decoded: Rostro = await res.json();
      onAnalizado({
        ...decoded,
        imageSrc: resizedBase64, // Keep image as base64 for client persistence
      });
    } catch (err: any) {
      console.error(err);
      let errorFriendly = err.message || "Fallo al comunicar con el estilista virtual.";
      if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
        errorFriendly = "No se ha podido conectar con el atelier virtual de Espejo. Por favor, asegúrate de que el servidor esté activo o reinténtalo en unos instantes.";
      }
      setError(errorFriendly);
    } finally {
      setLoading(false);
    }
  };

  // Process and scale face image
  const procesarImagen = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, sube un formato de imagen válido (PNG, JPEG, WebP).");
      return;
    }
    
    try {
      const rawBase64 = await fileToBase64(file);
      await procesarBase64(rawBase64);
    } catch (err: any) {
      setError("Error al leer el archivo de imagen.");
    }
  };

  // Webcam controls
  const startCamera = async () => {
    setError(null);
    setShowCamera(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Webcam error:", err);
      setError("No se pudo acceder a la webcam. Por favor, sube una foto clásica.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const captureSnapshot = async () => {
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
        try {
          const resizedBase64 = await resizeImage(rawBase64, 768);
          
          const res = await fetch("/api/analizar-rostro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: resizedBase64 }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Fallo al procesar el snapshot.");
          }

          const decoded: Rostro = await res.json();
          onAnalizado({
            ...decoded,
            imageSrc: resizedBase64,
          });
        } catch (err: any) {
          console.error(err);
          let errorFriendly = err.message || "Fallo del estilista al analizar la webcam.";
          if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("failed"))) {
            errorFriendly = "No se ha podido conectar con el atelier virtual de Espejo para analizar tu captura. Por favor, comprueba tu conexión o reinténtalo en un momento.";
          }
          setError(errorFriendly);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  return (
    <section id="tu-espejo-sección" className="border-t border-linea pt-8 pb-10">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-laton font-medium text-lg">01</span>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-tinta">Tu Espejo</h2>
        </div>
        <p className="text-xs font-sans text-tinta-apagada select-none">DIGITAL REFLECTION</p>
      </div>

      <AnimatePresence mode="wait">
        {!rostro && !loading && !showCamera && (
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
          >
            <p className="text-tinta-apagada text-sm mb-6 max-w-xl">
              Sube una foto o retrato para analizar tus rasgos.
            </p>

            <div
              className={`border border-dashed p-8 rounded-lg text-center flex flex-col items-center justify-center cursor-pointer min-h-[220px] espejo-transition ${
                dragActive ? "border-laton bg-tarjeta/40" : "border-linea bg-tarjeta/10 hover:border-laton-apagado hover:bg-tarjeta/20"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              <div className="p-4 bg-tarjeta rounded-full border border-linea mb-4 text-laton">
                <Upload size={24} className="animate-pulse" />
              </div>
              <p className="font-serif text-lg text-tinta font-semibold">Arrastra tu fotografía aquí</p>
              <p className="text-xs text-tinta-apagada mt-1">o haz clic para explorar tus archivos</p>
              <div className="flex flex-wrap gap-4 mt-6 justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  id="boton-camara"
                  onClick={startCamera}
                  className="button-press flex items-center gap-2 px-4 py-2 border border-linea bg-tarjeta text-tinta hover:border-laton hover:text-laton rounded text-xs"
                >
                  <Camera size={14} /> Usar Webcam
                </button>
                <GooglePhotosPicker 
                  onPhotoSelected={procesarBase64}
                  triggerButtonText="Importar de Google Fotos"
                  triggerClassName="button-press flex items-center gap-2 px-4 py-2 border border-linea bg-tarjeta text-tinta hover:border-laton hover:text-laton rounded text-xs font-sans text-left"
                />
              </div>
            </div>
            
            {error && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-red-950/20 border border-red-900/30 text-red-300 text-xs rounded">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </motion.div>
        )}

        {showCamera && (
          <motion.div
            key="webcam"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center p-4 bg-tarjeta rounded-lg border border-linea"
          >
            <div className="relative overflow-hidden rounded-md bg-black w-full max-w-sm aspect-square mb-4 border border-linea">
              <video
                ref={videoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                playsInline
                muted
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-laton font-medium border border-linea">
                VISTA EN VIVO
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                id="boton-capturar"
                onClick={captureSnapshot}
                className="button-press px-5 py-2.5 bg-laton text-fondo font-medium text-xs rounded hover:bg-white select-none shadow-lg shadow-black/40 flex items-center gap-1.5"
              >
                <Sparkles size={14} /> Capturar Imagen
              </button>
              <button
                type="button"
                id="boton-cancelar-camara"
                onClick={stopCamera}
                className="button-press px-4 py-2.5 border border-linea bg-fondo text-tinta-apagada hover:text-tinta text-xs rounded"
              >
                Volver
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}

        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8 bg-tarjeta/40 border border-linea rounded-lg flex flex-col items-center justify-center min-h-[220px]"
          >
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-linea"></div>
              <div className="absolute inset-0 rounded-full border-2 border-laton border-t-transparent animate-spin"></div>
            </div>
            <p className="font-serif text-lg text-tinta italic">Analizando facciones...</p>
            <p className="text-xs text-tinta-apagada mt-1 animate-pulse max-w-xs text-center">
              El estilista virtual de Espejo está calibrando simetría facial, líneas craneales y densidades...
            </p>
          </motion.div>
        )}

        {rostro && !loading && (
          <motion.div
            key="resultados"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 bg-tarjeta rounded-lg border border-linea overflow-hidden"
          >
            {/* User Retrato */}
            <div className="md:col-span-2 flex flex-col items-center">
              <div className="relative w-40 h-40 md:w-full md:max-w-[200px] aspect-square rounded-full md:rounded-lg overflow-hidden border border-linea shadow-inner mb-3">
                {rostro.imageSrc ? (
                  <img
                    src={rostro.imageSrc}
                    alt="Tu retrato"
                    className="w-full h-full object-cover scale-x-[-1]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-fondo2 flex items-center justify-center text-laton-apagado">
                    <User size={48} />
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-laton/90 backdrop-blur text-fondo p-1 rounded-full border border-linea">
                  <Check size={14} strokeWidth={3} />
                </div>
              </div>
              <button
                type="button"
                id="boton-reanalizar"
                onClick={onBorrar}
                className="button-press flex items-center gap-1.5 text-xs text-tinta-apagada hover:text-laton mt-2 bg-transparent border-0"
              >
                <RotateCcw size={12} /> Cambiar Foto
              </button>
            </div>

            {/* Analysis details */}
            <div className="md:col-span-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] tracking-widest text-laton uppercase font-medium">Concepto Espejo</span>
                <h3 className="font-serif text-xl font-bold text-tinta italic mt-0.5 leading-tight">
                  {rostro.clave}
                </h3>
                
                <div className="h-px bg-linea my-4" />

                <div className="space-y-3.5 text-sm">
                  <div className="grid grid-cols-3">
                    <span className="text-tinta-apagada text-xs font-medium uppercase font-sans">Forma de Rostro</span>
                    <span className="col-span-2 text-laton font-serif text-base capitalize font-medium">{rostro.forma_cara}</span>
                  </div>
                  <div className="grid grid-cols-3">
                    <span className="text-tinta-apagada text-xs font-medium uppercase font-sans">Cabello Actual</span>
                    <span className="col-span-2 text-tinta font-light">{rostro.pelo_actual}</span>
                  </div>
                  <div className="grid grid-cols-3">
                    <span className="text-tinta-apagada text-xs font-medium uppercase font-sans">Barba Actual</span>
                    <span className="col-span-2 text-tinta font-light">{rostro.barba_actual}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 p-3 bg-fondo/60 border border-linea rounded">
                <Eye size={14} className="text-laton shrink-0" />
                <span className="text-[11px] text-tinta-apagada font-light">
                  Análisis facial listo. Ahora puedes registrar prendas en tu armario y planificar tus looks.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
