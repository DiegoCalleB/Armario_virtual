import React, { useState, useRef, useEffect } from "react";
import { Prenda, CategoriaPrenda, TemporadaPrenda } from "../types";
import { fileToBase64, resizeImage, getCategoryLabel, removeBackgroundAndSharpenCanvas } from "../utils";
import { getShareCodeFromEmail, getWardrobeFromRegistry } from "../utils/share";
import { supabase, fetchUserArmariosLista, saveUserArmariosLista } from "../supabase";
import { Upload, Plus, Trash2, SlidersHorizontal, Sun, Snowflake, Star, Tag, AlertCircle, Sparkles, Camera, X, FileText, Check, ShoppingBag, ExternalLink, Clipboard, ArrowRight, Users, Image, RefreshCw, Briefcase, Folder, Search, ChevronDown, ChevronUp, Edit } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import GooglePhotosPicker from "./GooglePhotosPicker";

interface TuArmarioProps {
  prendas: Prenda[];
  onPrendaAgregada: (prenda: Prenda | Prenda[]) => void;
  onPrendaEliminada: (id: string) => void;
  onPrendaActualizada?: (prenda: Prenda | Prenda[]) => void;
  userEmail?: string;
}

const cropGarmentImage = (
  base64Src: string,
  ymin: number,
  xmin: number,
  ymax: number,
  xmax: number,
  categoria?: string
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

        // Validate the crop coordinates or apply smart fallback coordinates if suspicious/hallucinated
        const widthPercent = Math.abs(xmaxScale - xminScale);
        const heightPercent = Math.abs(ymaxScale - yminScale);

        let isSuspicious = false;

        // 1. If coordinates are NaN or extremely small
        if (isNaN(yminScale) || isNaN(xminScale) || isNaN(ymaxScale) || isNaN(xmaxScale) || widthPercent < 5 || heightPercent < 5) {
          isSuspicious = true;
        }

        // 2. Physical anomaly heuristics (e.g. pants in upper body, shoes in upper body)
        // Only run physical anomaly checks when confident, without aggressive full-image area limitations
        if (categoria) {
          const cat = String(categoria).toLowerCase();
          if (cat === "pantalon") {
            // If the entire pants are located strictly in the upper 35% of the image
            if (Math.max(yminScale, ymaxScale) < 350) {
              isSuspicious = true;
              console.warn(`[CROP] Sospechoso: pantalones ubicados completamente en el tercio superior.`);
            }
          } else if (cat === "calzado") {
            // If the shoes are located strictly in the upper 50% of the image
            if (Math.max(yminScale, ymaxScale) < 500) {
              isSuspicious = true;
              console.warn(`[CROP] Sospechoso: calzado ubicado completamente en la mitad superior.`);
            }
          }
        }

        // Apply smart crop fallback according to garment category if suspicious coordinates are detected
        if (isSuspicious && categoria) {
          const cat = String(categoria).toLowerCase();
          console.log(`[CROP] Aplicando recorte heuristico inteligente para la categoria: ${cat}`);
          if (cat === "top") {
            yminScale = 50;   // 5% top
            xminScale = 200;  // 20% left
            ymaxScale = 650;  // 65% top
            xmaxScale = 800;  // 80% left
          } else if (cat === "pantalon") {
            yminScale = 450;  // 45% top
            xminScale = 200;  // 20% left
            ymaxScale = 880;  // 88% top
            xmaxScale = 800;  // 80% left
          } else if (cat === "calzado") {
            yminScale = 750;  // 75% top
            xminScale = 200;  // 20% left
            ymaxScale = 1000; // 100% top
            xmaxScale = 800;  // 80% left
          }
        }

        // Normalize coordinates to ensure start is always <= end
        const normYMin = Math.min(yminScale, ymaxScale);
        const normYMax = Math.max(yminScale, ymaxScale);
        const normXMin = Math.min(xminScale, xmaxScale);
        const normXMax = Math.max(xminScale, xmaxScale);

        // Convert normalized (0-1000) coordinates to actual pixels
        const yStart = (Math.max(0, Math.min(1000, normYMin)) / 1000) * totalH;
        const xStart = (Math.max(0, Math.min(1000, normXMin)) / 1000) * totalW;
        const yEnd = (Math.max(0, Math.min(1000, normYMax)) / 1000) * totalH;
        const xEnd = (Math.max(0, Math.min(1000, normXMax)) / 1000) * totalW;

        let cropW = xEnd - xStart;
        let cropH = yEnd - yStart;

        if (isNaN(cropW) || isNaN(cropH) || cropW <= 10 || cropH <= 10) {
          console.warn("Rango de recorte invalido, devolviendo original:", { ymin, xmin, ymax, xmax });
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

        if (isNaN(finalCropW) || isNaN(finalCropH) || finalCropW <= 5 || finalCropH <= 5) {
          console.warn("Ancho/alto de recorte final invalido, devolviendo original.");
          resolve(base64Src);
          return;
        }

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

/**
 * Removes background and upscales the garment image using high-precision, ultra-fast local Canvas processing.
 */
const processImageToTransparentAndHD = async (
  base64Src: string,
  onProgress?: (text: string) => void
): Promise<string> => {
  if (!base64Src || base64Src.startsWith("data:image/svg+xml")) {
    return base64Src;
  }
  if (onProgress) {
    onProgress("Ajustando fondo transparente y perfilando silueta...");
  }
  return await removeBackgroundAndSharpenCanvas(base64Src);
};

const generateGarmentSVG = (categoria: CategoriaPrenda, color: string): string => {
  let paths = "";
  if (categoria === "top") {
    // Elegant blazer/shirt silhouette
    paths = `<path d="M50 15 L20 40 L20 85 L80 85 L80 40 Z" fill="${color}" opacity="0.9" />
             <path d="M50 15 L35 48 L50 85 L65 48 Z" fill="#FFFFFF" stroke="${color}" stroke-width="1" />
             <path d="M45 15 L50 25 L55 15" fill="none" stroke="#09090B" stroke-width="1.5" />
             <line x1="50" y1="25" x2="50" y2="85" stroke="#09090B" stroke-width="1.5" stroke-dasharray="3,3" />`;
  } else if (categoria === "pantalon") {
    // Tailored trousers silhouette
    paths = `<path d="M30 15 L70 15 L78 85 L54 85 L50 48 L46 85 L22 85 Z" fill="${color}" opacity="0.9" />
             <line x1="50" y1="15" x2="50" y2="48" stroke="#09090B" stroke-width="1.5" stroke-dasharray="3,3" />
             <line x1="38" y1="15" x2="38" y2="85" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
             <line x1="62" y1="15" x2="62" y2="85" stroke="rgba(255,255,255,0.15)" stroke-width="1" />`;
  } else if (categoria === "calzado") {
    // Classic Oxford shoe silhouette
    paths = `<path d="M15 65 C15 65 30 45 65 52 C75 54 85 62 85 75 L80 75 C80 75 75 70 65 70 L30 70 L25 75 L15 75 Z" fill="${color}" opacity="0.9" />
             <rect x="70" y="75" width="12" height="4" fill="#FAFAFA" />
             <path d="M45 55 L58 58" fill="none" stroke="#09090B" stroke-width="1.5" />
             <path d="M46 60 L56 62" fill="none" stroke="#09090B" stroke-width="1.5" />`;
  } else {
    // Elegant accessory Watch silhouette
    paths = `<circle cx="50" cy="50" r="30" fill="none" stroke="${color}" stroke-width="10" />
             <circle cx="50" cy="50" r="23" fill="#FFFFFF" />
             <line x1="50" y1="50" x2="50" y2="35" stroke="#09090B" stroke-width="2.5" />
             <line x1="50" y1="50" x2="62" y2="50" stroke="rgba(243, 236, 221, 0.7)" stroke-width="2" />
             <circle cx="50" cy="50" r="3" fill="#18181B" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <rect width="100" height="100" fill="#FFFFFF" />
    <g transform="translate(0, 0)">
      ${paths}
    </g>
    <rect x="2" y="2" width="96" height="96" fill="none" stroke="#E4E4E7" stroke-width="1" opacity="0.5" />
  </svg>`;
  
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
};

export default function TuArmario({ prendas, onPrendaAgregada, onPrendaEliminada, onPrendaActualizada, userEmail }: TuArmarioProps) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | CategoriaPrenda>("all");
  
  // Search and Closet filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeColorFilter, setActiveColorFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPrendasForLook, setSelectedPrendasForLook] = useState<string[]>([]);
  
  // Registration control tabs
  const [registrationTab, setRegistrationTab] = useState<"ia" | "manual" | "amiga" | "googlefotos">("ia");

  // Friend Wardrobe states
  const [friendCode, setFriendCode] = useState("");
  const [friendConnected, setFriendConnected] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendPrendas, setFriendPrendas] = useState<Prenda[]>([]);
  const [borrowedIds, setBorrowedIds] = useState<string[]>([]);
  const [copiedOwnCode, setCopiedOwnCode] = useState(false);

  // Google Fotos states
  const [gphotosConnected, setGphotosConnected] = useState(false);
  const [gphotosConnecting, setGphotosConnecting] = useState(false);
  const [gphotosExtractingId, setGphotosExtractingId] = useState<string | null>(null);
  const [gphotosExtractedCount, setGphotosExtractedCount] = useState(0);

  // Link Importer Form States
  const [linkInputUrl, setLinkInputUrl] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [extractedPrenda, setExtractedPrenda] = useState<Partial<Prenda> | null>(null);

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

  React.useEffect(() => {
    if (friendConnected && friendName.includes("(Tú)")) {
      setFriendPrendas(prendas);
    }
  }, [prendas, friendConnected, friendName]);
  const [customDescripcion, setCustomDescripcion] = useState("");
  const [selectedPrendaTags, setSelectedPrendaTags] = useState<string[]>([]);
  const [capsuleSavedFlash, setCapsuleSavedFlash] = useState(false);
  const [isEditingPrenda, setIsEditingPrenda] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editCategoria, setEditCategoria] = useState<CategoriaPrenda>("top");
  const [editTemporada, setEditTemporada] = useState<TemporadaPrenda>("todo");
  const [editFormalidad, setEditFormalidad] = useState(3);
  const [editColor, setEditColor] = useState("");
  const [editTejido, setEditTejido] = useState("");
  const [editMarca, setEditMarca] = useState("");
  const [editComposicionTejido, setEditComposicionTejido] = useState("");
  const [editPrecioCompra, setEditPrecioCompra] = useState<number | "">("");
  const [editVecesPuesto, setEditVecesPuesto] = useState<number>(0);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagsText, setEditTagsText] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
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

  // Interactive image cropping states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropBox, setCropBox] = useState({ x: 15, y: 15, w: 70, h: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, boxX: 15, boxY: 15, boxW: 70, boxH: 70 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  // Encapsulated wardrobes states
  const [armariosDisponibles, setArmariosDisponibles] = useState<string[]>(() => {
    const cached = localStorage.getItem(`espejo_armarios_lista_${userEmail || "guest"}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Ignore cache parse error
      }
    }
    return ["normal", "oficina", "fiesta"];
  });

  const [activeArmarioFilter, setActiveArmarioFilter] = useState<string>("all");
  const [isArmariosExpanded, setIsArmariosExpanded] = useState<boolean>(false);

  // Sync custom wardrobes list from Supabase
  useEffect(() => {
    async function loadCustomArmarios() {
      if (!userEmail || userEmail === "guest") return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const dbLista = await fetchUserArmariosLista(user.id);
          if (dbLista && dbLista.length > 0) {
            setArmariosDisponibles(dbLista);
            localStorage.setItem(`espejo_armarios_lista_${userEmail}`, JSON.stringify(dbLista));
          }
        }
      } catch (err) {
        console.warn("Could not load custom capsule wardrobes list from Supabase:", err);
      }
    }
    loadCustomArmarios();
  }, [userEmail]);

  const saveArmariosLista = async (lista: string[]) => {
    setArmariosDisponibles(lista);
    localStorage.setItem(`espejo_armarios_lista_${userEmail || "guest"}`, JSON.stringify(lista));

    // Save to Supabase
    if (userEmail && userEmail !== "guest") {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await saveUserArmariosLista(user.id, lista);
        }
      } catch (err) {
        console.warn("Could not save custom capsule wardrobes list to Supabase:", err);
      }
    }
  };

  const getArmariosDePrenda = (prenda: Prenda): string[] => {
    if (!prenda.tags || !Array.isArray(prenda.tags)) return ["normal"];
    const armariosTags = prenda.tags
      .filter(t => typeof t === "string" && t.startsWith("armario:"))
      .map(t => t.substring("armario:".length));
    if (armariosTags.length === 0) return ["normal"];
    return armariosTags;
  };

  const setArmariosDePrenda = (prenda: Prenda, nuevosArmarios: string[]) => {
    const cleanTags = (Array.isArray(prenda.tags) ? prenda.tags : []).filter(t => typeof t === "string" && !t.startsWith("armario:"));
    const newTags = [...cleanTags, ...nuevosArmarios.map(a => `armario:${a}`)];
    if (onPrendaActualizada) {
      onPrendaActualizada({
        ...prenda,
        tags: newTags
      });
    }
  };

  // Dragging event listeners for cropping
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = ((clientX - dragStart.x) / rect.width) * 100;
      const deltaY = ((clientY - dragStart.y) / rect.height) * 100;

      setCropBox(() => {
        let x = dragStart.boxX;
        let y = dragStart.boxY;
        let w = dragStart.boxW;
        let h = dragStart.boxH;

        if (activeHandle === "move") {
          x = Math.max(0, Math.min(100 - w, dragStart.boxX + deltaX));
          y = Math.max(0, Math.min(100 - h, dragStart.boxY + deltaY));
        } else if (activeHandle === "br") {
          w = Math.max(10, Math.min(100 - dragStart.boxX, dragStart.boxW + deltaX));
          h = Math.max(10, Math.min(100 - dragStart.boxY, dragStart.boxH + deltaY));
        } else if (activeHandle === "tl") {
          const newX = Math.max(0, Math.min(dragStart.boxX + dragStart.boxW - 10, dragStart.boxX + deltaX));
          w = dragStart.boxX + dragStart.boxW - newX;
          x = newX;
          const newY = Math.max(0, Math.min(dragStart.boxY + dragStart.boxH - 10, dragStart.boxY + deltaY));
          h = dragStart.boxY + dragStart.boxH - newY;
          y = newY;
        } else if (activeHandle === "tr") {
          w = Math.max(10, Math.min(100 - dragStart.boxX, dragStart.boxW + deltaX));
          const newY = Math.max(0, Math.min(dragStart.boxY + dragStart.boxH - 10, dragStart.boxY + deltaY));
          h = dragStart.boxY + dragStart.boxH - newY;
          y = newY;
        } else if (activeHandle === "bl") {
          const newX = Math.max(0, Math.min(dragStart.boxX + dragStart.boxW - 10, dragStart.boxX + deltaX));
          w = dragStart.boxX + dragStart.boxW - newX;
          x = newX;
          h = Math.max(10, Math.min(100 - dragStart.boxY, dragStart.boxH + deltaY));
        }

        return { x, y, w, h };
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
      setActiveHandle(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, dragStart, activeHandle]);

  const handleCropStart = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDragging(true);
    setActiveHandle(handle);
    setDragStart({
      x: clientX,
      y: clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.w,
      boxH: cropBox.h
    });
  };

  const performCrop = async () => {
    if (!imageToCrop) return;
    setLoading(true);
    setLoadingText("Recortando prenda...");
    
    try {
      const croppedBase64 = await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("No se pudo crear el lienzo de recorte"));
            return;
          }
          
          const startX = (cropBox.x / 100) * img.width;
          const startY = (cropBox.y / 100) * img.height;
          const cropW = (cropBox.w / 100) * img.width;
          const cropH = (cropBox.h / 100) * img.height;
          
          canvas.width = cropW;
          canvas.height = cropH;
          
          ctx.drawImage(
            img,
            startX,
            startY,
            cropW,
            cropH,
            0,
            0,
            cropW,
            cropH
          );
          
          resolve(canvas.toDataURL("image/jpeg", 0.95));
        };
        img.onerror = () => reject(new Error("No se pudo cargar la imagen para recortar"));
        img.src = imageToCrop;
      });

      setImageToCrop(null);
      await procesarBase64Prenda(croppedBase64);
    } catch (err: any) {
      console.error(err);
      setError("No se pudo recortar la imagen seleccionada: " + err.message);
      setLoading(false);
    }
  };

  const handlePrendaAgregadaConArmario = (nuevaPrendaOrArray: Prenda | Prenda[]) => {
    const arr = Array.isArray(nuevaPrendaOrArray) ? nuevaPrendaOrArray : [nuevaPrendaOrArray];
    const activeArm = activeArmarioFilter !== "all" ? activeArmarioFilter : "normal";
    
    // Duplicate Checking Helper
    const esPrendaDuplicada = (nueva: Prenda, existentes: Prenda[]): boolean => {
      return existentes.some(existente => {
        if (existente.categoria !== nueva.categoria) return false;
        
        const nombreNueva = (nueva.nombre || "").toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, " ").trim();
        const nombreExistente = (existente.nombre || "").toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, " ").trim();
        
        const exactNameMatch = nombreNueva === nombreExistente;
        
        const marcaNueva = (nueva.marca || "No identificada").toLowerCase().trim();
        const marcaExistente = (existente.marca || "No identificada").toLowerCase().trim();
        const brandMatch = marcaNueva === marcaExistente || 
                           ((marcaNueva === "" || marcaNueva === "no identificada") && 
                            (marcaExistente === "" || marcaExistente === "no identificada"));

        const colorNueva = (nueva.color || "").toLowerCase().trim();
        const colorExistente = (existente.color || "").toLowerCase().trim();
        const colorMatch = colorNueva === colorExistente;

        const tejidoNueva = (nueva.tejido || "").toLowerCase().trim();
        const tejidoExistente = (existente.tejido || "").toLowerCase().trim();
        const fabricMatch = tejidoNueva === tejidoExistente;

        // Case 1: Name matches exactly, brand matches, and either color or fabric matches
        if (exactNameMatch && brandMatch && (colorMatch || fabricMatch)) {
          return true;
        }
        // Case 2: Name, color, and brand are all identical
        if (exactNameMatch && colorMatch && brandMatch) {
          return true;
        }
        return false;
      });
    };

    const duplicatesSkipped: string[] = [];
    const addedUniqueKeys = new Set<string>();
    
    const uniquePrendasToAdd = arr.filter(p => {
      const isDupInWardrobe = esPrendaDuplicada(p, prendas);
      const batchKey = `${(p.nombre || "").toLowerCase().trim()}_${p.categoria}`;
      const isDupInBatch = addedUniqueKeys.has(batchKey);
      
      if (isDupInWardrobe || isDupInBatch) {
        if (!duplicatesSkipped.includes(p.nombre)) {
          duplicatesSkipped.push(p.nombre);
        }
        return false;
      }
      
      addedUniqueKeys.add(batchKey);
      return true;
    });

    if (duplicatesSkipped.length > 0) {
      alert(`Se han omitido ${duplicatesSkipped.length} prenda(s) duplicada(s) que ya se encuentran registradas en el armario:\n- ${duplicatesSkipped.join("\n- ")}`);
    }

    if (uniquePrendasToAdd.length === 0) {
      setIsAddModalOpen(false);
      return;
    }

    const updated = uniquePrendasToAdd.map(p => {
      const current = getArmariosDePrenda(p);
      let next = current;
      if (activeArm !== "normal" && current.length === 1 && current[0] === "normal") {
        next = [activeArm];
      } else if (!current.includes(activeArm)) {
        next = [...current, activeArm];
      }
      
      const cleanTags = (p.tags || []).filter(t => !t.startsWith("armario:"));
      const newTags = [...cleanTags, ...next.map(a => `armario:${a}`)];
      return {
        ...p,
        tags: newTags
      };
    });
    
    onPrendaAgregada(updated);
    setIsAddModalOpen(false); // Close the beautiful uploader modal on success
  };

  const handleCrearArmario = () => {
    const nombre = window.prompt("Introduce el nombre del nuevo armario (ej: deporte, viaje, playa):");
    if (!nombre) return;
    const cleanNombre = nombre.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!cleanNombre) return;
    if (armariosDisponibles.includes(cleanNombre)) {
      alert("Ya existe un armario con ese nombre.");
      return;
    }
    saveArmariosLista([...armariosDisponibles, cleanNombre]);
    setActiveArmarioFilter(cleanNombre);
  };

  const handleEliminarArmario = (arm: string) => {
    if (window.confirm(`¿Seguro que quieres eliminar el armario "${arm}"? Tus prendas se conservarán en el ropero general.`)) {
      const updated = armariosDisponibles.filter(a => a !== arm);
      saveArmariosLista(updated);
      
      // Update each garment belonging to this wardrobe using batching
      const updatedPrendasToSave: Prenda[] = [];
      prendas.forEach(p => {
        const currentArmarios = getArmariosDePrenda(p);
        if (currentArmarios.includes(arm)) {
          const nextArmarios = currentArmarios.filter(a => a !== arm);
          const finalArmarios = nextArmarios.length === 0 ? ["normal"] : nextArmarios;
          
          const cleanTags = (Array.isArray(p.tags) ? p.tags : []).filter(t => typeof t === "string" && !t.startsWith("armario:"));
          const newTags = [...cleanTags, ...finalArmarios.map(a => `armario:${a}`)];
          
          updatedPrendasToSave.push({
            ...p,
            tags: newTags
          });
        }
      });
      
      if (updatedPrendasToSave.length > 0 && onPrendaActualizada) {
        onPrendaActualizada(updatedPrendasToSave);
      }
      
      if (activeArmarioFilter === arm) {
        setActiveArmarioFilter("all");
      }
    }
  };

  // Sincronización con la base de datos Supabase: descubre armarios personalizados a partir de las etiquetas de las prendas
  const armariosTagsString = (prendas || [])
    .map(p => (p.tags || []).filter(t => t.startsWith("armario:")).sort().join(","))
    .sort()
    .join("|");

  useEffect(() => {
    if (!prendas || prendas.length === 0) return;
    const foundArmarios = new Set<string>();
    prendas.forEach(p => {
      if (p.tags) {
        p.tags.forEach(t => {
          if (t.startsWith("armario:")) {
            const val = t.substring("armario:".length).trim().toLowerCase();
            if (val) {
              foundArmarios.add(val);
            }
          }
        });
      }
    });

    let modified = false;
    const currentList = [...armariosDisponibles];
    foundArmarios.forEach(arm => {
      if (!currentList.includes(arm)) {
        currentList.push(arm);
        modified = true;
      }
    });

    if (modified) {
      saveArmariosLista(currentList);
    }
  }, [armariosTagsString]);

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
        const resized = await resizeImage(manualImagePreview, 512);
        finalImage = await processImageToTransparentAndHD(resized);
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
      
      handlePrendaAgregadaConArmario(nuevaPrenda);
      
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

  const procesarBase64Prenda = async (base64Image: string) => {
    setError(null);
    setLoading(true);

    try {
      setLoadingText("Analizando prenda con IA...");
      // Resize to 768px on browser client for ultra-fast light payload
      const resizedBase64 = await resizeImage(base64Image, 768);

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
      if (infoParsed && infoParsed.prendas && Array.isArray(infoParsed.prendas)) {
        prendasArray = infoParsed.prendas;
      } else if (infoParsed && infoParsed.nombre) {
        prendasArray = [infoParsed];
      }

      if (prendasArray.length > 0) {
        const listToAdd: Prenda[] = [];
        for (let idx = 0; idx < prendasArray.length; idx++) {
          const item = prendasArray[idx];
          if (!item) continue;
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
                xmaxVal,
                item.categoria
              );
            } catch (cropErr) {
              console.error("No se pudo recortar la prenda, usando imagen base:", cropErr);
            }
          }

          // Apply background removal and upscale
          try {
            croppedImg = await processImageToTransparentAndHD(croppedImg, (text) => {
              setLoadingText(`[Prenda ${idx + 1}/${prendasArray.length}] ${text}`);
            });
          } catch (bgErr) {
            console.error("Error al quitar fondo:", bgErr);
          }

          const formalidadVal = item.formalidad !== undefined && item.formalidad !== null ? Number(item.formalidad) : 3;
          const nuevaPrenda: Prenda = {
            id: "prenda_" + Date.now() + "_" + idx + "_" + Math.floor(Math.random() * 1000),
            nombre: item.nombre || "Prenda identificada con IA",
            categoria: (item.categoria as CategoriaPrenda) || "top",
            color: item.color || "#18181B",
            formalidad: isNaN(formalidadVal) ? 3 : Math.max(1, Math.min(5, formalidadVal)),
            temporada: (item.temporada as TemporadaPrenda) || "todo",
            imageSrc: croppedImg,
            marca: item.marca || "No identificada",
            tejido: item.tejido || "Algodón mixto",
            tags: Array.isArray(item.tags) ? item.tags : ["Modern", "Básico"],
          };
          listToAdd.push(nuevaPrenda);
        }
        if (listToAdd.length > 0) {
          handlePrendaAgregadaConArmario(listToAdd);
        }
      } else {
        throw new Error("No se pudo extraer ninguna prenda válida de la imagen analizada.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No se pudo procesar la imagen de la prenda.");
    } finally {
      setLoading(false);
    }
  };

  const procesarArchivos = async (files: File[]) => {
    const validImageFiles = files.filter(f => f.type.startsWith("image/"));
    if (validImageFiles.length === 0) {
      setError("Por favor, selecciona al menos una imagen de prenda válida.");
      return;
    }

    if (validImageFiles.length === 1 && !isMultiMode) {
      setError(null);
      setLoading(true);
      setLoadingText("Cargando imagen...");
      try {
        const rawBase64 = await fileToBase64(validImageFiles[0]);
        const resizedBase64 = await resizeImage(rawBase64, 1024); // Keep better quality for editing/cropping
        setImageToCrop(resizedBase64);
        setCropBox({ x: 15, y: 15, w: 70, h: 70 });
      } catch (err) {
        console.error("Error reading file:", err);
        setError("Fallo al cargar la imagen seleccionada.");
      } finally {
        setLoading(false);
        setLoadingText("");
      }
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
          if (infoParsed && infoParsed.prendas && Array.isArray(infoParsed.prendas)) {
            prendasArray = infoParsed.prendas;
          } else if (infoParsed && infoParsed.nombre) {
            prendasArray = [infoParsed];
          }

          if (prendasArray.length > 0) {
            const listToAdd: Prenda[] = [];
            for (let idx = 0; idx < prendasArray.length; idx++) {
              const item = prendasArray[idx];
              if (!item) continue;
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
                    xmaxVal,
                    item.categoria
                  );
                } catch (cropErr) {
                  console.error("No se pudo recortar la prenda, usando imagen base:", cropErr);
                }
              }

              // Apply background removal and upscale
              try {
                croppedImg = await processImageToTransparentAndHD(croppedImg, (text) => {
                  setLoadingText(`[Prenda ${idx + 1}/${prendasArray.length}] ${text}`);
                });
              } catch (bgErr) {
                console.error("Error al quitar fondo:", bgErr);
              }

              const formalidadVal = item.formalidad !== undefined && item.formalidad !== null ? Number(item.formalidad) : 3;
              const nuevaPrenda: Prenda = {
                id: "prenda_" + Date.now() + "_" + i + "_" + idx + "_" + Math.floor(Math.random() * 1000),
                nombre: item.nombre || "Prenda identificada con IA",
                categoria: (item.categoria as CategoriaPrenda) || "top",
                color: item.color || "#18181B",
                formalidad: isNaN(formalidadVal) ? 3 : Math.max(1, Math.min(5, formalidadVal)),
                temporada: (item.temporada as TemporadaPrenda) || "todo",
                imageSrc: croppedImg,
                marca: item.marca || "No identificada",
                tejido: item.tejido || "Algodón mixto",
                tags: Array.isArray(item.tags) ? item.tags : ["Modern", "Básico"],
              };
              listToAdd.push(nuevaPrenda);
            }
            if (listToAdd.length > 0) {
              handlePrendaAgregadaConArmario(listToAdd);
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
          
          let processedFallbackImg = resizedBase64;
          try {
            processedFallbackImg = await processImageToTransparentAndHD(resizedBase64);
          } catch (bgErr) {
            console.error("Error en quitar fondo fallback:", bgErr);
          }
          
          const mockPrenda: Prenda = {
            id: "prenda_f_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 1000),
            nombre: "Prenda registrada (Ajustar manual)",
            categoria: "top",
            color: "#E4E4E7",
            formalidad: 3,
            temporada: "todo",
            imageSrc: processedFallbackImg,
            descripcion: "Fallo o lentitud al contactar la Inteligencia Artificial. Presiona esta tarjeta para configurar sus detalles y notas."
          };
          handlePrendaAgregadaConArmario(mockPrenda);
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
        
        // Load the captured camera shot into the interactive crop editor!
        setImageToCrop(rawBase64);
        setCropBox({ x: 15, y: 15, w: 70, h: 70 });
      }
    }
  };

  // Helper to match colors
  const matchesColorFilter = (p: Prenda, filter: string): boolean => {
    if (filter === "all") return true;
    const name = p.nombre.toLowerCase();
    const hex = p.color ? p.color.toLowerCase() : "";
    
    if (filter === "blanco") {
      return name.includes("blanc") || name.includes("crudo") || hex === "#ffffff" || hex === "#fafafa" || hex === "#f3efe0" || hex === "#f4f4f5" || hex === "#e4e4e7";
    }
    if (filter === "negro") {
      return name.includes("negr") || name.includes("carb") || name.includes("oscur") || hex === "#111111" || hex === "#000000" || hex === "#0f0f10" || hex === "#18181b" || hex === "#09090b";
    }
    if (filter === "beige") {
      return name.includes("beige") || name.includes("camel") || name.includes("arena") || hex === "#c3b091" || hex === "#f3efe0";
    }
    if (filter === "marron") {
      return name.includes("marr") || name.includes("choc") || hex === "#3a2a1a" || hex === "#c3b091";
    }
    if (filter === "azul") {
      return name.includes("azul") || name.includes("marino") || name.includes("navy") || hex === "#1d2b42" || hex === "#121a30";
    }
    if (filter === "gris") {
      return name.includes("gris") || name.includes("plata") || hex === "#7f8c8d" || hex === "#313639" || hex === "#71717a" || hex === "#52525b";
    }
    return false;
  };

  // Filter garments list
  const prendasFiltradas = prendas.filter((p) => {
    // 1. Filter by Armario (wardrobe capsule)
    if (activeArmarioFilter !== "all") {
      const armarios = getArmariosDePrenda(p);
      if (!armarios.includes(activeArmarioFilter)) {
        return false;
      }
    }
    
    // 2. Filter by Category
    if (activeCategoryFilter !== "all" && p.categoria !== activeCategoryFilter) {
      return false;
    }

    // 3. Filter by Color
    if (!matchesColorFilter(p, activeColorFilter)) {
      return false;
    }

    // 4. Filter by Search Term
    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      const matchName = p.nombre.toLowerCase().includes(s);
      const matchCat = getCategoryLabel(p.categoria).toLowerCase().includes(s);
      const matchTejido = p.tejido?.toLowerCase().includes(s) || false;
      const matchTags = p.tags?.some(t => t.toLowerCase().includes(s)) || false;
      if (!matchName && !matchCat && !matchTejido && !matchTags) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <section id="tu-armario-sección" className="border-t border-linea pt-2 pb-6">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-linea/20">
        <div className="flex items-center gap-2">
          <span className="font-serif italic text-laton font-semibold text-base">01</span>
          <h2 className="font-serif text-lg font-bold tracking-tight text-tinta">Tu Armario</h2>
          <span className="text-[9px] text-tinta-apagada font-mono uppercase tracking-widest ml-1 hidden sm:inline">DIGITAL WARDROBE</span>
        </div>
      </div>

      {/* SEARCH AND FILTERS (AI CLOSET STYLE) */}
      <div className="space-y-2.5 mb-4">
        {/* Search Input */}
        <div className="relative w-full max-w-xl mx-auto">
          <input
            type="text"
            placeholder="Buscar en tu armario (nombre, tejido, etiquetas...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-fondo2 text-tinta pl-9 pr-9 py-2 rounded-full border border-linea focus:border-laton focus:outline-none focus:ring-1 focus:ring-laton transition font-sans text-xs shadow-inner"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-apagada">
            <Search size={14} />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tinta-apagada hover:text-tinta"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Pills (Row 1) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar justify-start sm:justify-center">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition shrink-0 border ${
              activeCategoryFilter === "all"
                ? "bg-tinta border-tinta text-white shadow-sm"
                : "bg-white border-linea text-tinta-apagada hover:text-tinta hover:border-laton/40"
            }`}
          >
            Todo ({prendas.length})
          </button>
          {(["top", "pantalon", "calzado", "accesorio"] as CategoriaPrenda[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition shrink-0 border ${
                activeCategoryFilter === cat
                  ? "bg-tinta border-tinta text-white shadow-sm"
                  : "bg-white border-linea text-tinta-apagada hover:text-tinta hover:border-laton/40"
              }`}
            >
              {getCategoryLabel(cat) === "Parte Superior" ? "P. Superior" : getCategoryLabel(cat) === "Parte Inferior" ? "P. Inferior" : getCategoryLabel(cat)} ({prendas.filter((p) => p.categoria === cat).length})
            </button>
          ))}
        </div>

        {/* Color Pills (Row 2) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none no-scrollbar justify-start sm:justify-center border-b border-linea">
          <button
            type="button"
            onClick={() => setActiveColorFilter("all")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition shrink-0 border ${
              activeColorFilter === "all"
                ? "bg-tinta border-tinta text-white shadow-sm"
                : "bg-white border-linea text-tinta-apagada hover:text-tinta hover:border-laton/40"
            }`}
          >
            Todos los Colores
          </button>
          {[
            { id: "blanco", label: "Blanco", dot: "bg-white border border-linea" },
            { id: "beige", label: "Beige", dot: "bg-[#E6D5BC] border border-linea" },
            { id: "marron", label: "Marrón", dot: "bg-[#7E5C45]" },
            { id: "negro", label: "Negro", dot: "bg-[#2C2520]" },
            { id: "azul", label: "Azul", dot: "bg-[#4B6584]" },
            { id: "gris", label: "Gris", dot: "bg-[#A5B1C2]" },
          ].map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => setActiveColorFilter(col.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition shrink-0 border flex items-center gap-1 ${
                activeColorFilter === col.id
                  ? "bg-tinta border-tinta text-white shadow-sm"
                  : "bg-white border-linea text-tinta-apagada hover:text-tinta hover:border-laton/40"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${col.dot} inline-block shrink-0`} />
              {col.label}
            </button>
          ))}
        </div>

        {/* Primary Action Buttons (Row 3) */}
        <div className="flex gap-3 max-w-xl mx-auto pt-1">
          <button
            type="button"
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedPrendasForLook([]);
            }}
            className={`flex-1 py-2 text-[11px] uppercase tracking-wider font-bold rounded-full border transition flex items-center justify-center gap-1.5 shadow-sm ${
              selectionMode
                ? "bg-tinta border-tinta text-white"
                : "bg-white border-linea text-tinta-apagada hover:border-laton hover:text-laton"
            }`}
          >
            {selectionMode ? "Cancelar" : "Elegir prendas"}
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 py-2 bg-laton hover:bg-laton-apagado text-white text-[11px] uppercase tracking-wider font-extrabold rounded-full transition flex items-center justify-center gap-1.5 shadow-md button-press"
          >
            <Plus size={12} /> Añadir Prenda
          </button>
        </div>
      </div>

      {/* Floating look creation indicator */}
      {selectionMode && selectedPrendasForLook.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-tinta text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 animate-bounce">
          <span className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
            {selectedPrendasForLook.length} {selectedPrendasForLook.length === 1 ? "prenda elegida" : "prendas elegidas"}
          </span>
          <button
            type="button"
            onClick={() => {
              const itemsNames = prendas
                .filter(p => selectedPrendasForLook.includes(p.id))
                .map(p => p.nombre)
                .join(", ");
              alert(`Has elegido crear un look con: ${itemsNames}. ¡Pídele al asesor inteligente que confeccione este outfit para ti!`);
              setSelectionMode(false);
              setSelectedPrendasForLook([]);
            }}
            className="px-4 py-1.5 bg-[#FA5C7C] hover:bg-[#E04B6A] text-white text-[10px] uppercase tracking-widest font-extrabold rounded-full transition"
          >
            Crear Look
          </button>
        </div>
      )}

      {/* POPUP MODAL FOR ADDING GARMENTS (AI CLOSET STYLE) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-[#18181B]/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-[#E4E4E7] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative p-6 md:p-8"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="absolute right-5 top-5 text-[#71717A] hover:text-[#18181B] bg-[#F4F4F5] p-2 rounded-full transition z-10 animate-pulse"
              >
                <X size={18} />
              </button>

              <div className="mb-6">
                <h3 className="font-serif text-2xl font-bold tracking-tight text-[#18181B]">Añadir Nueva Prenda</h3>
                <p className="text-xs text-[#71717A] font-sans">Elige la modalidad para registrar una prenda en tu armario digital</p>
              </div>

              {/* Garment Uploader - Column 1 */}
              <div className="w-full">
                {imageToCrop ? (
                  <div className="space-y-5 animate-fade-in text-left">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-laton uppercase tracking-widest block font-sans">
                        Ajustar foto de la prenda
                      </span>
                      <p className="text-[10.5px] text-tinta-apagada font-light leading-relaxed">
                        Arrastra las esquinas o desplaza el recuadro para seleccionar la prenda exacta que deseas registrar en tu armario digital.
                      </p>
                    </div>

                    {/* Cropping Canvas Container */}
                    <div 
                      ref={containerRef}
                      className="relative w-full aspect-square bg-[#18181B] rounded-2xl overflow-hidden border border-linea select-none touch-none max-h-[360px] mx-auto"
                    >
                      <img 
                        src={imageToCrop} 
                        alt="Prenda a encuadrar" 
                        className="w-full h-full object-contain pointer-events-none"
                      />
                      
                      {/* Dark overlay around the crop area using clip-path */}
                      <div className="absolute inset-0 pointer-events-none bg-black/60" style={{
                        clipPath: `polygon(
                          0% 0%, 
                          0% 100%, 
                          ${cropBox.x}% 100%, 
                          ${cropBox.x}% ${cropBox.y}%, 
                          ${cropBox.x + cropBox.w}% ${cropBox.y}%, 
                          ${cropBox.x + cropBox.w}% ${cropBox.y + cropBox.h}%, 
                          ${cropBox.x}% ${cropBox.y + cropBox.h}%, 
                          ${cropBox.x}% 100%, 
                          100% 100%, 
                          100% 0%
                        )`
                      }} />

                      {/* Draggable crop window */}
                      <div 
                        className="absolute border-2 border-laton bg-transparent cursor-move group"
                        style={{
                          left: `${cropBox.x}%`,
                          top: `${cropBox.y}%`,
                          width: `${cropBox.w}%`,
                          height: `${cropBox.h}%`
                        }}
                        onMouseDown={(e) => handleCropStart(e, "move")}
                        onTouchStart={(e) => handleCropStart(e, "move")}
                      >
                        {/* Subtle Grid Lines */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                          <div className="border-r border-b border-white border-dashed"></div>
                          <div className="border-r border-b border-white border-dashed"></div>
                          <div className="border-b border-white border-dashed"></div>
                          <div className="border-r border-b border-white border-dashed"></div>
                          <div className="border-r border-b border-white border-dashed"></div>
                          <div className="border-b border-white border-dashed"></div>
                          <div className="border-r border-white border-dashed"></div>
                          <div className="border-r border-white border-dashed"></div>
                          <div></div>
                        </div>

                        {/* Handles */}
                        {/* Top-Left */}
                        <div 
                          className="absolute w-5 h-5 -left-2.5 -top-2.5 border-t-4 border-l-4 border-laton cursor-nwse-resize z-20"
                          onMouseDown={(e) => handleCropStart(e, "tl")}
                          onTouchStart={(e) => handleCropStart(e, "tl")}
                        />
                        {/* Top-Right */}
                        <div 
                          className="absolute w-5 h-5 -right-2.5 -top-2.5 border-t-4 border-r-4 border-laton cursor-nesw-resize z-20"
                          onMouseDown={(e) => handleCropStart(e, "tr")}
                          onTouchStart={(e) => handleCropStart(e, "tr")}
                        />
                        {/* Bottom-Left */}
                        <div 
                          className="absolute w-5 h-5 -left-2.5 -bottom-2.5 border-b-4 border-l-4 border-laton cursor-nesw-resize z-20"
                          onMouseDown={(e) => handleCropStart(e, "bl")}
                          onTouchStart={(e) => handleCropStart(e, "bl")}
                        />
                        {/* Bottom-Right */}
                        <div 
                          className="absolute w-5 h-5 -right-2.5 -bottom-2.5 border-b-4 border-r-4 border-laton cursor-nwse-resize z-20"
                          onMouseDown={(e) => handleCropStart(e, "br")}
                          onTouchStart={(e) => handleCropStart(e, "br")}
                        />
                      </div>
                    </div>

                    {/* Actions buttons */}
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setImageToCrop(null)}
                        className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold border border-linea hover:bg-fondo text-tinta-apagada hover:text-tinta rounded-xl transition duration-150"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={performCrop}
                        className="px-5 py-2 text-[10px] uppercase tracking-wider font-extrabold bg-laton hover:bg-laton-apagado text-white rounded-xl shadow transition duration-150 flex items-center gap-1.5"
                      >
                        <Sparkles size={11} /> Confirmar Selección
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Tab Selector */}
                    <div className="flex border-b border-linea mb-5 select-none font-sans overflow-x-auto no-scrollbar gap-1">
            <button
              type="button"
              onClick={() => {
                setRegistrationTab("ia");
                setError(null);
              }}
              className={`flex-1 min-w-[90px] py-3 text-[9.5px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition ${
                registrationTab === "ia"
                  ? "border-laton text-laton bg-tarjeta/15"
                  : "border-transparent text-tinta-apagada hover:text-tinta hover:bg-tarjeta/5"
              }`}
            >
              <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                <Sparkles size={11} className={registrationTab === "ia" ? "text-laton animate-pulse" : "text-tinta-apagada"} /> Escáner IA
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRegistrationTab("manual");
                setError(null);
              }}
              className={`flex-1 min-w-[90px] py-3 text-[9.5px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition ${
                registrationTab === "manual"
                  ? "border-laton text-laton bg-tarjeta/15"
                  : "border-transparent text-tinta-apagada hover:text-tinta hover:bg-tarjeta/5"
              }`}
            >
              <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                <Plus size={11} className={registrationTab === "manual" ? "text-laton" : "text-tinta-apagada"} /> Rápido
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRegistrationTab("amiga");
                setError(null);
              }}
              className={`flex-1 min-w-[90px] py-3 text-[9.5px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition ${
                registrationTab === "amiga"
                  ? "border-laton text-laton bg-tarjeta/15"
                  : "border-transparent text-tinta-apagada hover:text-tinta hover:bg-tarjeta/5"
              }`}
            >
              <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                <Users size={11} className={registrationTab === "amiga" ? "text-laton" : "text-tinta-apagada"} /> De Amiga
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRegistrationTab("googlefotos");
                setError(null);
              }}
              className={`flex-1 min-w-[90px] py-3 text-[9.5px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest border-b-2 transition ${
                registrationTab === "googlefotos"
                  ? "border-laton text-laton bg-tarjeta/15"
                  : "border-transparent text-tinta-apagada hover:text-tinta hover:bg-tarjeta/5"
              }`}
            >
              <span className="flex items-center justify-center gap-1 whitespace-nowrap">
                <Image size={11} className={registrationTab === "googlefotos" ? "text-laton" : "text-tinta-apagada"} /> Google Fotos
              </span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {registrationTab === "ia" && (
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
                      multiple={isMultiMode}
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
                        <p className="text-[11px] text-tinta-apagada mt-0.5 mb-2 font-light">Arrastra fotos de prendas o haz clic para subir</p>
                        <p className="text-[9.5px] text-laton/90 bg-tarjeta/50 border border-linea/40 px-3 py-1.5 rounded-md mb-4 max-w-[280px] leading-relaxed mx-auto font-sans font-light">
                          💡 <b>Consejo móvil:</b> Si la galería de tu móvil se queda en <i>"preparando contenido..."</i>, prueba seleccionando una foto guardada localmente o activa el Modo Lote abajo.
                        </p>
                        
                        <div className="flex flex-wrap gap-3 justify-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            id="boton-camara-prenda"
                            onClick={startCamera}
                            className="button-press flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-tarjeta border border-linea text-tinta-apagada hover:text-laton hover:border-laton transition text-xs rounded select-none font-medium"
                          >
                            <Camera size={13} /> Usar Cámara
                          </button>
                          <GooglePhotosPicker 
                            onPhotoSelected={procesarBase64Prenda}
                            triggerButtonText="Importar Google Fotos"
                            triggerClassName="button-press flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-tarjeta border border-linea text-tinta-apagada hover:text-laton hover:border-laton transition text-xs rounded select-none font-medium text-left"
                          />
                        </div>
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-bold text-tinta uppercase tracking-widest block font-sans">
                        Modo Lote (Desglose IA)
                      </span>
                      <span className="text-[9.5px] text-tinta-apagada block font-sans font-light leading-snug">
                        Sube una foto con varias prendas juntas y la IA las separará por ti.
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
                    <div className="flex flex-col gap-1 items-center bg-fondo p-2 rounded border border-laton/20 text-laton text-[8px] mt-2 font-sans">
                      <div className="flex items-center gap-1.5 font-medium justify-center">
                        <span className="w-1 h-1 rounded-full bg-laton animate-ping" />
                        Desglose Express activo. Se extraerán múltiples fichas de ropa y calzado.
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {registrationTab === "manual" && (
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
                      { hex: "#111111", name: "Negro" },
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
                      {manualFormalidad === 3 && "Semi-formal"}
                      {manualFormalidad === 1 && "Informal"}
                      {manualFormalidad === 2 && "Casual"}
                      {manualFormalidad === 4 && "Formal / Elegante"}
                      {manualFormalidad === 5 && "Muy formal / Gala"}
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



            {registrationTab === "amiga" && (
              <motion.div
                key="amiga-panel"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-4 bg-tarjeta border border-linea rounded-lg space-y-4 text-left font-sans animate-fade-in"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-laton uppercase tracking-widest block font-sans">
                    Armario Compartido de Amigas
                  </span>
                  <p className="text-[10.5px] text-tinta-apagada font-light leading-relaxed">
                    ¿Quieres usar ropa prestada de una amiga para tu próximo evento? Conecta su vestidor con su código exclusivo.
                  </p>
                </div>

                {!friendConnected ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-tinta-apagada font-bold block">
                        Código del Armario de tu Amiga
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej: MARIA-7892 o SOFIA-1102"
                          value={friendCode}
                          onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                          className="flex-1 text-xs font-sans bg-fondo border border-linea text-tinta p-2.5 rounded focus:border-laton focus:outline-none placeholder-tinta-apagada/30 font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const code = friendCode.trim().toUpperCase();
                            const ownCode = getShareCodeFromEmail(userEmail);
                            const ownParts = ownCode.split("-");
                            
                            if (code.includes("MARIA") || code.includes("7892")) {
                              setFriendConnected(true);
                              setFriendName("María");
                              setFriendPrendas([
                                {
                                  id: "friend_m1",
                                  nombre: "Bolso de hombro de cuero vintage Sèzane",
                                  categoria: "accesorio" as CategoriaPrenda,
                                  color: "#5A1827",
                                  formalidad: 4,
                                  temporada: "todo" as TemporadaPrenda,
                                  tejido: "Cuero italiano de becerro",
                                  tags: ["Sèzane", "Eventos"]
                                },
                                {
                                  id: "friend_m2",
                                  nombre: "Vestido de satén drapeado de seda",
                                  categoria: "top" as CategoriaPrenda,
                                  color: "#E6D7C3",
                                  formalidad: 5,
                                  temporada: "todo" as TemporadaPrenda,
                                  tejido: "Seda natural de morera",
                                  tags: ["Boda", "Chic"]
                                },
                                {
                                  id: "friend_m3",
                                  nombre: "Chaqueta Tweed Bouclé clásica estilo Chanel",
                                  categoria: "top" as CategoriaPrenda,
                                  color: "#F5F2EB",
                                  formalidad: 4,
                                  temporada: "todo" as TemporadaPrenda,
                                  tejido: "Lana Bouclé con hilos dorados",
                                  tags: ["Clásico", "Atelier"]
                                }
                              ]);
                              setError(null);
                            } else if (code.includes("SOFIA") || code.includes("1102")) {
                              setFriendConnected(true);
                              setFriendName("Sofía");
                              setFriendPrendas([
                                {
                                  id: "friend_s1",
                                  nombre: "Chaqueta blazer de satén verde esmeralda",
                                  categoria: "top" as CategoriaPrenda,
                                  color: "#0F4C3A",
                                  formalidad: 4,
                                  temporada: "todo" as TemporadaPrenda,
                                  tejido: "Satén brillante de seda",
                                  tags: ["Fiesta", "Blazer"]
                                },
                                {
                                  id: "friend_s2",
                                  nombre: "Zapatos slingback de tacón de aguja Dior",
                                  categoria: "calzado" as CategoriaPrenda,
                                  color: "#0F0F10",
                                  formalidad: 5,
                                  temporada: "todo" as TemporadaPrenda,
                                  tejido: "Charol fino italiano",
                                  tags: ["Gala", "Dior"]
                                },
                                {
                                  id: "friend_s3",
                                  nombre: "Clutch de terciopelo con cadena de oro Yves Saint Laurent",
                                  categoria: "accesorio" as CategoriaPrenda,
                                  color: "#121A30",
                                  formalidad: 5,
                                  temporada: "todo" as TemporadaPrenda,
                                  tejido: "Terciopelo de algodón",
                                  tags: ["YSL", "Nocturno"]
                                }
                              ]);
                              setError(null);
                            } else if (code.includes(ownParts[0]) || (ownParts[1] && code.includes(ownParts[1]))) {
                              setFriendConnected(true);
                              const namePrefix = userEmail ? userEmail.split("@")[0] : "Tú";
                              const dispName = namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1).split(".")[0];
                              setFriendName(`${dispName} (Tú)`);
                              setFriendPrendas(prendas);
                              setError(null);
                            } else {
                              const sharedWardrobe = getWardrobeFromRegistry(code);
                              if (sharedWardrobe) {
                                setFriendConnected(true);
                                setFriendName(sharedWardrobe.userName);
                                setFriendPrendas(sharedWardrobe.prendas || []);
                                setError(null);
                              } else {
                                setError(`Código de armario no encontrado. Prueba con 'MARIA-7892', 'SOFIA-1102' o tu propio código '${ownCode}'.`);
                              }
                            }
                          }}
                          className="px-4 bg-laton hover:bg-white text-fondo font-bold text-xs uppercase tracking-widest rounded transition duration-150"
                        >
                          Conectar
                        </button>
                      </div>
                    </div>
                    <p className="text-[9.5px] text-tinta-apagada/70 italic">
                      Amigas recomendadas para probar: <strong className="text-laton/85 hover:underline cursor-pointer" onClick={() => setFriendCode("MARIA-7892")}>MARIA-7892</strong> o <strong className="text-laton/85 hover:underline cursor-pointer" onClick={() => setFriendCode("SOFIA-1102")}>SOFIA-1102</strong>
                    </p>

                    {/* Tu propio código de armario para compartir */}
                    <div className="mt-4 pt-3 border-t border-linea/50 bg-fondo/30 p-2.5 rounded space-y-2">
                      <span className="text-[9px] uppercase tracking-widest text-laton font-bold block">
                        Tu Código de Armario Compartido
                      </span>
                      <p className="text-[10px] text-tinta-apagada font-light leading-snug">
                        Comparte este código con tus amigas para que puedan ver e interactuar con las prendas de tu vestidor en tiempo real:
                      </p>
                      <div className="flex items-center justify-between bg-fondo p-2 rounded border border-linea">
                        <span className="font-mono text-xs font-bold text-tinta tracking-widest">
                          {getShareCodeFromEmail(userEmail)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(getShareCodeFromEmail(userEmail));
                            setCopiedOwnCode(true);
                            setTimeout(() => setCopiedOwnCode(false), 2000);
                          }}
                          className="px-2.5 py-1 text-[8.5px] uppercase font-bold tracking-wider rounded bg-laton/15 hover:bg-laton hover:text-fondo text-laton transition duration-150 select-none"
                        >
                          {copiedOwnCode ? "¡Copiado! ✓" : "Copiar Código"}
                        </button>
                      </div>
                      {copiedOwnCode && (
                        <p className="text-[8.5px] text-green-400 font-medium animate-pulse text-right">
                          Código copiado al portapapeles. ¡Pásaselo a tu amiga!
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-fondo p-2.5 rounded border border-laton/20">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                        <span className="text-xs font-medium text-tinta">
                          Conectado al armario de <strong className="text-laton">{friendName}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (friendName.includes("(Tú)")) {
                              setFriendPrendas(prendas);
                            } else {
                              const sharedWardrobe = getWardrobeFromRegistry(friendCode);
                              if (sharedWardrobe) {
                                setFriendPrendas(sharedWardrobe.prendas || []);
                              }
                            }
                          }}
                          className="text-[10px] text-laton hover:text-laton-apagado uppercase font-bold tracking-wider flex items-center gap-1"
                        >
                          <RefreshCw size={10} /> Sincronizar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFriendConnected(false);
                            setFriendCode("");
                            setFriendName("");
                            setFriendPrendas([]);
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold tracking-wider"
                        >
                          Desconectar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-widest text-tinta-apagada font-bold block">
                        Prendas compartidas por {friendName}
                      </span>
                      
                      <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 no-scrollbar animate-fade-in">
                        {(friendPrendas.length > 0 ? friendPrendas.map(p => ({
                          id: p.id,
                          nombre: p.nombre,
                          categoria: p.categoria,
                          color: p.color,
                          formalidad: p.formalidad,
                          temporada: p.temporada,
                          tejido: p.tejido || "Algodón sastre",
                          tags: p.tags || ["Propio", "Elegante"],
                          imageSrc: p.imageSrc
                        })) : [
                          {
                            id: "friend_empty",
                            nombre: "Aún no hay prendas en este vestidor para compartir",
                            categoria: "top" as CategoriaPrenda,
                            color: "#18181B",
                            formalidad: 3,
                            temporada: "todo" as TemporadaPrenda,
                            tejido: "Ninguno",
                            tags: ["vacío"]
                          }
                        ]).map((p) => {
                          const isBorrowed = borrowedIds.includes(p.id);
                          const garmentImage = (p as any).imageSrc || generateGarmentSVG(p.categoria, p.color);
                          return (
                            <div key={p.id} className="flex gap-3 bg-fondo/50 border border-linea p-2 rounded items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded border border-linea/60 overflow-hidden shrink-0 flex items-center justify-center bg-tarjeta/40">
                                  { (p as any).imageSrc ? (
                                    <img src={(p as any).imageSrc} alt={p.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.color }} />
                                  )}
                                </div>
                                <div className="text-left">
                                  <h5 className="text-[11px] font-bold text-tinta line-clamp-1">{p.nombre}</h5>
                                  <p className="text-[8.5px] text-tinta-apagada font-light">
                                    {p.tejido} • {p.tags.join(", ")}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isBorrowed || p.id === "friend_empty"}
                                onClick={() => {
                                  // Add to user's wardrobe
                                  const id = "friend_borrowed_" + p.id + "_" + Date.now();
                                  const finalPrenda: Prenda = {
                                    ...p,
                                    id,
                                    nombre: `[Préstamo de ${friendName}] ${p.nombre}`,
                                    tags: [...p.tags, `De ${friendName}`, "prestado"],
                                    imageSrc: garmentImage,
                                  };
                                  handlePrendaAgregadaConArmario(finalPrenda);
                                  setBorrowedIds([...borrowedIds, p.id]);
                                }}
                                className={`px-2.5 py-1 text-[9px] uppercase font-bold tracking-wider rounded select-none ${
                                  p.id === "friend_empty"
                                    ? "bg-transparent text-tinta-apagada border border-linea cursor-not-allowed"
                                    : isBorrowed
                                    ? "bg-green-950/40 border border-green-900/30 text-green-400 cursor-default"
                                    : "bg-laton hover:bg-laton-apagado hover:text-white text-fondo transition duration-150"
                                }`}
                              >
                                {p.id === "friend_empty" ? "Vacío" : isBorrowed ? "Prestado ✓" : "Pedir Prestado"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {registrationTab === "googlefotos" && (
              <motion.div
                key="googlefotos-panel"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-4 bg-tarjeta border border-linea rounded-lg space-y-4 text-left font-sans animate-fade-in"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-laton uppercase tracking-widest block font-sans">
                    Sincronización con Google Fotos
                  </span>
                  <p className="text-[10.5px] text-tinta-apagada font-light leading-relaxed">
                    Sincroniza tus álbumes personales. La inteligencia artificial de Espejo analizará tus fotografías para identificar, aislar e incorporar la ropa que llevas puesta a tu vestidor virtual de forma autónoma.
                  </p>
                </div>

                {!gphotosConnected ? (
                  <div className="py-6 flex flex-col items-center justify-center border border-dashed border-linea rounded bg-fondo/30 space-y-4">
                    <div className="w-10 h-10 rounded-full bg-laton/15 flex items-center justify-center text-laton">
                      <Image size={18} />
                    </div>
                    <div className="text-center space-y-1 px-4">
                      <h4 className="text-xs font-bold text-tinta">Extrae prendas de tus fotos personales</h4>
                      <p className="text-[10px] text-tinta-apagada font-light max-w-xs leading-relaxed">
                        Conéctate de forma segura con tu cuenta de Google Fotos para escanear de forma inteligente tus retratos y modelados diarios.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center">
                      <GooglePhotosPicker
                        onPhotoSelected={(base64) => {
                          setImageToCrop(base64);
                          setCropBox({ x: 15, y: 15, w: 70, h: 70 });
                        }}
                        triggerButtonText="Conectar Google Fotos (Real)"
                        triggerClassName="px-4 py-2 bg-white text-slate-800 hover:bg-slate-100 font-bold text-xs uppercase tracking-widest rounded transition duration-200 flex items-center gap-2 shadow-md border border-slate-200 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setGphotosConnected(true);
                          setError(null);
                        }}
                        className="px-4 py-2 bg-tarjeta text-tinta-apagada hover:text-tinta border border-linea hover:border-laton font-bold text-xs uppercase tracking-widest rounded transition duration-200 shadow-md"
                      >
                        Modo Demostración
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between bg-fondo p-2.5 rounded border border-laton/20">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping shrink-0" />
                        <span className="text-xs font-medium text-tinta">
                          Álbumes sincronizados ✓
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGphotosConnected(false);
                          setGphotosExtractedCount(0);
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold tracking-wider"
                      >
                        Cerrar Sesión
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <span className="text-[9.5px] uppercase tracking-widest text-tinta-apagada font-bold block">
                        Fotos personales detectadas (Últimas cargadas)
                      </span>

                      <div className="grid grid-cols-3 gap-2 animate-fade-in">
                        {[
                          {
                            id: "gphoto_1",
                            title: "Outfit de Boda",
                            categoria: "top" as CategoriaPrenda,
                            desc: "Americana entallada elegante azul cobalto",
                            color: "#1d2b42",
                            formalidad: 5,
                            tejido: "Lana virgen súper 120",
                            tags: ["Boda", "Elegante"]
                          },
                          {
                            id: "gphoto_2",
                            title: "Atuendo Casual",
                            categoria: "top" as CategoriaPrenda,
                            desc: "Jersey de punto beige de cuello alto cisne",
                            color: "#d7c5ae",
                            formalidad: 3,
                            tejido: "Algodón peinado y cachemira",
                            tags: ["Casual", "Invierno"]
                          },
                          {
                            id: "gphoto_3",
                            title: "Zapatos Cóctel",
                            categoria: "calzado" as CategoriaPrenda,
                            desc: "Mocasines de cuero negro con antifaz",
                            color: "#111111",
                            formalidad: 4,
                            tejido: "Cuero Napa cepillado",
                            tags: ["Clásico", "Elegante"]
                          }
                        ].map((item) => {
                          const isExtracting = gphotosExtractingId === item.id;
                          return (
                            <div key={item.id} className="relative rounded border border-linea/60 overflow-hidden bg-fondo/60 p-2 flex flex-col justify-between min-h-[145px] hover:border-laton/40 transition">
                              <div className="space-y-1 text-center">
                                <div className="w-8 h-8 rounded bg-laton/10 mx-auto flex items-center justify-center text-laton">
                                  <Camera size={13} />
                                </div>
                                <h6 className="text-[10px] font-bold text-tinta leading-tight">{item.title}</h6>
                                <p className="text-[8.5px] text-tinta-apagada line-clamp-2 leading-relaxed font-light">{item.desc}</p>
                              </div>

                              <button
                                type="button"
                                disabled={isExtracting}
                                onClick={() => {
                                  setGphotosExtractingId(item.id);
                                  setTimeout(() => {
                                    // Add extracted prenda to user's wardrobe!
                                    const finalPrenda: Prenda = {
                                      id: "gphoto_extracted_" + item.id + "_" + Date.now(),
                                      nombre: `[Google Fotos] ${item.desc}`,
                                      categoria: item.categoria,
                                      color: item.color,
                                      formalidad: item.formalidad,
                                      temporada: "todo",
                                      tejido: item.tejido,
                                      tags: [...item.tags, "Google Fotos", "IA"],
                                      imageSrc: generateGarmentSVG(item.categoria, item.color)
                                    };
                                    handlePrendaAgregadaConArmario(finalPrenda);
                                    setGphotosExtractingId(null);
                                    setGphotosExtractedCount(prev => prev + 1);
                                  }, 1800);
                                }}
                                className={`w-full py-1 text-[8.5px] uppercase font-bold tracking-wider rounded select-none text-center ${
                                  isExtracting
                                    ? "bg-laton/20 text-laton animate-pulse cursor-default"
                                    : "bg-laton hover:bg-laton-apagado hover:text-white text-fondo transition duration-150"
                                  }`}
                              >
                                {isExtracting ? "Analizando..." : "Extraer IA"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      {gphotosExtractedCount > 0 && (
                        <div className="text-[9px] text-green-400 bg-green-950/20 border border-green-900/30 p-2 rounded text-center font-medium animate-fade-in">
                          ¡Prenda extraída con éxito! Se ha añadido a tu armario con todos sus detalles clasificados automáticamente.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
                  </>
                )}

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-950/20 border border-red-900/30 text-red-300 text-xs rounded">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Garment Catalog & Filtering - Full Width */}
      <div className="w-full">

          {/* Section for Encapsulated Wardrobes */}
          <div className="mb-4 p-3 bg-[#F4F4F5]/60 border border-laton/15 rounded-xl shadow-sm transition-all duration-355">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsArmariosExpanded(!isArmariosExpanded)}
                className="flex items-center gap-2 text-left select-none cursor-pointer group"
              >
                <Briefcase size={13} className="text-laton animate-pulse" />
                <span className="text-[11px] font-bold text-tinta uppercase tracking-wider group-hover:text-laton transition">
                  Cápsulas de Armario ({armariosDisponibles.length})
                </span>
                {activeArmarioFilter !== "all" ? (
                  <span className="bg-laton/15 text-laton text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Activo: {activeArmarioFilter}
                  </span>
                ) : (
                  <span className="text-tinta-apagada text-[9px] font-mono lowercase">
                    (todo visible)
                  </span>
                )}
                {isArmariosExpanded ? <ChevronUp size={12} className="text-tinta-apagada ml-1" /> : <ChevronDown size={12} className="text-tinta-apagada ml-1" />}
              </button>
              
              <button
                type="button"
                onClick={handleCrearArmario}
                className="text-[9px] font-extrabold text-tinta hover:text-laton transition flex items-center gap-1 uppercase tracking-wider bg-white/80 hover:bg-white border border-linea px-2 py-1 rounded-full shadow-sm"
              >
                <Plus size={10} /> Crear
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isArmariosExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-[10px] text-tinta-apagada leading-relaxed mt-2.5 mb-2 pb-2 border-b border-linea/40">
                    Define colecciones independientes de tu ropero (ej: oficina, normal, fiesta). Las prendas agregadas con un filtro activo se clasificarán automáticamente en esa cápsula.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveArmarioFilter("all");
                        setIsArmariosExpanded(false);
                      }}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-lg font-sans transition flex items-center gap-1.5 border ${
                        activeArmarioFilter === "all"
                          ? "bg-laton border-laton text-fondo font-bold"
                          : "bg-white border-linea/60 text-tinta-apagada hover:text-tinta hover:border-laton/40"
                      }`}
                    >
                      <Folder size={11} /> Todo ({prendas.length})
                    </button>
                    
                    {armariosDisponibles.map((arm) => {
                      const count = prendas.filter(p => getArmariosDePrenda(p).includes(arm)).length;
                      const isCustom = arm !== "normal" && arm !== "oficina" && arm !== "fiesta";
                      return (
                        <div key={arm} className="relative group flex items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveArmarioFilter(arm);
                              setIsArmariosExpanded(false);
                            }}
                            className={`px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-lg font-sans transition flex items-center gap-1.5 border pr-5 ${
                              activeArmarioFilter === arm
                                ? "bg-laton border-laton text-fondo font-bold"
                                : "bg-white border-linea/60 text-tinta-apagada hover:text-tinta hover:border-laton/40"
                            }`}
                          >
                            <span>
                              {arm === "normal" && "🏠"}
                              {arm === "oficina" && "💼"}
                              {arm === "fiesta" && "✨"}
                              {isCustom && "🏷️"} {arm.charAt(0).toUpperCase() + arm.slice(1)}
                            </span>
                            <span className={`text-[9px] ${activeArmarioFilter === arm ? "text-fondo/80 font-black" : "text-tinta-apagada/70"}`}>
                              ({count})
                            </span>
                          </button>
                          
                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEliminarArmario(arm);
                              }}
                              className="absolute -top-1 -right-1 bg-red-950/90 border border-red-800/40 text-red-300 hover:bg-red-800 hover:text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] leading-none transition shadow"
                              title={`Eliminar armario ${arm}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                  No hay prendas en esta categoría. Sube fotos para que la Inteligencia Artificial las organice en tu armario.
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
                      setSelectedPrendaTags(prenda.tags || []);
                      setCustomDescripcion(prenda.descripcion || "");
                      setShowVintedSync(false);
                      setVintedDraft(null);
                      setVintedSyncStatus("idle");
                      setCopiedText(false);
                      setIsEditingPrenda(false);
                      setEditNombre(prenda.nombre || "");
                      setEditCategoria(prenda.categoria || "top");
                      setEditTemporada(prenda.temporada || "todo");
                      setEditFormalidad(prenda.formalidad || 3);
                      setEditColor(prenda.color || "#000000");
                      setEditTejido(prenda.tejido || "");
                      setEditMarca(prenda.marca || "No identificada");
                      setEditComposicionTejido(prenda.composicion_tejido || "");
                      setEditPrecioCompra(prenda.precio_compra !== undefined ? prenda.precio_compra : "");
                      setEditVecesPuesto(prenda.veces_puesto !== undefined ? prenda.veces_puesto : 0);
                      const nonArmarioTags = (prenda.tags || []).filter(t => typeof t === "string" && !t.startsWith("armario:"));
                      setEditTags(nonArmarioTags);
                      setEditTagsText(nonArmarioTags.join(", "));
                      setEditDescripcion(prenda.descripcion || "");
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

                      {prenda.marca && prenda.marca !== "No identificada" && prenda.marca !== "" && (
                        <p className="text-[10px] text-laton font-medium mt-1">
                          🏷️ Marca: <span className="text-tinta/80 font-normal">{prenda.marca}</span>
                        </p>
                      )}

                      {prenda.tejido && (
                        <p className="text-[10px] text-laton font-medium mt-1">
                          Tejido: <span className="text-tinta/80 font-normal">{prenda.tejido}</span>
                        </p>
                      )}

                      {prenda.tags && prenda.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {prenda.tags.map((tg, iIdx) => (
                            <span key={iIdx} className="text-[8.5px] font-sans px-1.5 py-0.5 rounded bg-linea/40 text-tinta-apagada border border-linea/20">
                              #{tg}
                            </span>
                          ))}
                        </div>
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
                  <span className={`w-1.5 h-1.5 rounded-full ${showVintedSync ? "bg-[#09b1ba]" : isEditingPrenda ? "bg-amber-500" : "bg-laton"}`} />
                  <span className={`font-sans text-[10px] tracking-widest uppercase font-bold ${showVintedSync ? "text-[#09b1ba]" : isEditingPrenda ? "text-amber-500" : "text-laton"}`}>
                    {showVintedSync ? "Venta en Vinted" : isEditingPrenda ? "Editar Prenda" : "Detalles de la Prenda"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!showVintedSync && (
                    <button
                      type="button"
                      id="boton-toggle-edicion"
                      onClick={() => setIsEditingPrenda(!isEditingPrenda)}
                      className={`button-press flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                        isEditingPrenda
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                          : "text-tinta-apagada hover:text-laton border border-linea/60 hover:border-laton/40"
                      }`}
                    >
                      <Edit size={11} />
                      {isEditingPrenda ? "Ver Detalles" : "Editar"}
                    </button>
                  )}
                  <button
                    type="button"
                    id="boton-cerrar-detalle"
                    onClick={() => {
                      setSelectedPrenda(null);
                      setIsEditingPrenda(false);
                    }}
                    className="button-press text-tinta-apagada hover:text-laton p-1 rounded transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {!showVintedSync ? (
                isEditingPrenda ? (
                  <>
                    {/* Edit Garment Detail Modal Body */}
                    <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-none text-left">
                      {/* Image Thumbnail Preview */}
                      <div className="flex items-center gap-3 bg-fondo2/40 p-2.5 border border-linea/60 rounded">
                        <div className="relative w-16 h-16 rounded bg-fondo2 overflow-hidden border border-linea/60 shrink-0">
                          <img
                            src={selectedPrenda.imageSrc}
                            alt={selectedPrenda.nombre}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="space-y-1 text-left">
                          <span className="text-[9px] uppercase tracking-wider text-tinta-apagada font-bold block">Imagen de la prenda</span>
                          <p className="text-xs text-tinta-apagada font-mono truncate max-w-[200px]">ID: #{selectedPrenda.id.split("_")[1] || selectedPrenda.id}</p>
                        </div>
                      </div>

                      {/* Fields Form */}
                      <div className="space-y-3.5 text-left">
                        {/* Name */}
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Nombre de la Prenda</label>
                          <input
                            type="text"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            placeholder="Ej: Camisa de Lino Azul"
                            className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                          />
                        </div>

                        {/* Marca */}
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Marca de la Prenda (Detectada o manual)</label>
                          <input
                            type="text"
                            value={editMarca}
                            onChange={(e) => setEditMarca(e.target.value)}
                            placeholder="Ej: Nike, Levi's, Zara, Tommy Hilfiger, No identificada"
                            className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                          />
                        </div>

                        {/* Category and Season row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Categoría</label>
                            <select
                              value={editCategoria}
                              onChange={(e) => setEditCategoria(e.target.value as CategoriaPrenda)}
                              className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium cursor-pointer"
                            >
                              <option value="top">Superior (Top)</option>
                              <option value="pantalon">Inferior (Pantalón)</option>
                              <option value="calzado">Calzado</option>
                              <option value="accesorio">Accesorio</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Temporada</label>
                            <select
                              value={editTemporada}
                              onChange={(e) => setEditTemporada(e.target.value as TemporadaPrenda)}
                              className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium cursor-pointer"
                            >
                              <option value="todo">Todo el año (Multiestacional)</option>
                              <option value="verano">Verano / Primavera</option>
                              <option value="invierno">Invierno / Otoño</option>
                            </select>
                          </div>
                        </div>

                        {/* Formality and Color row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Formalidad</label>
                            <div className="flex items-center gap-1.5 h-[38px]">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setEditFormalidad(i + 1)}
                                  className="button-press p-0.5 focus:outline-none"
                                >
                                  <Star
                                    size={16}
                                    className={i < editFormalidad ? "fill-laton text-laton" : "text-linea hover:text-laton/50"}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Color Dominante</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editColor.startsWith("#") ? editColor : "#ffffff"}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="w-8 h-8 rounded border border-linea cursor-pointer bg-transparent shrink-0"
                              />
                              <input
                                type="text"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                placeholder="#000000"
                                className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-2.5 py-1.5 focus:border-laton focus:outline-none font-mono uppercase"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Fabric and Composition row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Tejido</label>
                            <input
                              type="text"
                              value={editTejido}
                              onChange={(e) => setEditTejido(e.target.value)}
                              placeholder="Ej: Lino, Lana, Denim, Algodón"
                              className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Composición</label>
                            <input
                              type="text"
                              value={editComposicionTejido}
                              onChange={(e) => setEditComposicionTejido(e.target.value)}
                              placeholder="Ej: 100% lino, 80% algodón..."
                              className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                            />
                          </div>
                        </div>

                        {/* Price and Times Worn row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Precio de Compra (€)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editPrecioCompra}
                              onChange={(e) => setEditPrecioCompra(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="Ej: 49.99"
                              className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Veces Puesto (Uso)</label>
                            <input
                              type="number"
                              min="0"
                              value={editVecesPuesto}
                              onChange={(e) => setEditVecesPuesto(Number(e.target.value))}
                              className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                            />
                          </div>
                        </div>

                        {/* Style tags list */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold block">Etiquetas de Estilo (Tags)</label>
                          <input
                            type="text"
                            placeholder="Separadas por comas (ej: corte-slim, casual, lino-italiano)"
                            value={editTagsText}
                            onChange={(e) => {
                              setEditTagsText(e.target.value);
                              const tagList = e.target.value
                                .split(",")
                                .map(t => t.trim().toLowerCase())
                                .filter(t => t.length > 0);
                              setEditTags(tagList);
                            }}
                            className="w-full text-xs bg-fondo text-tinta border border-linea rounded px-3 py-2.5 focus:border-laton focus:outline-none font-medium"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {editTags.length === 0 ? (
                              <span className="text-[10px] text-tinta-apagada italic">Sin etiquetas de estilo</span>
                            ) : (
                              editTags.map((t, idx) => (
                                <span key={idx} className="text-[10px] font-sans px-2.5 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] border border-laton/20 font-medium">
                                  #{t}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest text-laton font-extrabold flex items-center gap-1">
                            <FileText size={10} /> Notas y Descripción Especial
                          </label>
                          <textarea
                            value={editDescripcion}
                            onChange={(e) => setEditDescripcion(e.target.value)}
                            placeholder="Agrega notas sobre fit, tejido, procedencia, etc."
                            className="w-full text-xs bg-fondo text-tinta border border-linea rounded p-2.5 focus:border-laton focus:outline-none min-h-[80px] resize-none leading-relaxed placeholder-tinta-apagada/40 font-sans font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Operational Action Buttons footer for Edit mode */}
                    <div className="flex items-center justify-between p-4 border-t border-linea/60 bg-fondo2/40">
                      <button
                        type="button"
                        onClick={() => setIsEditingPrenda(false)}
                        className="button-press px-4 py-2 text-[10px] text-tinta-apagada hover:text-tinta border border-linea rounded font-sans font-bold uppercase tracking-wider"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!editNombre.trim()) {
                            alert("Por favor ingresa un nombre para la prenda.");
                            return;
                          }
                          
                          // Combinamos armario tags actuales de selectedPrendaTags con las nuevas tags editadas
                          const armarioTags = (selectedPrendaTags || []).filter(t => typeof t === "string" && t.startsWith("armario:"));
                          const finalTags = [
                            ...armarioTags,
                            ...editTags.filter(t => !t.startsWith("armario:"))
                          ];

                          const updatedPrenda: Prenda = {
                            ...selectedPrenda,
                            nombre: editNombre,
                            categoria: editCategoria,
                            temporada: editTemporada,
                            formalidad: editFormalidad,
                            color: editColor,
                            marca: editMarca || undefined,
                            tejido: editTejido || undefined,
                            composicion_tejido: editComposicionTejido || undefined,
                            precio_compra: editPrecioCompra !== "" ? editPrecioCompra : undefined,
                            veces_puesto: editVecesPuesto,
                            tags: finalTags,
                            descripcion: editDescripcion,
                          } as Prenda;

                          if (onPrendaActualizada) {
                            onPrendaActualizada(updatedPrenda);
                          }
                          
                          // Actualizar vista local del modal
                          setSelectedPrenda(updatedPrenda);
                          setSelectedPrendaTags(finalTags);
                          setCustomDescripcion(editDescripcion);
                          setIsEditingPrenda(false);
                        }}
                        className="button-press px-5 py-2 bg-laton text-fondo hover:bg-laton-apagado hover:text-white text-[10px] font-bold rounded flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        <Check size={12} /> Guardar Cambios
                      </button>
                    </div>
                  </>
                ) : (
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
                      <div className="space-y-3 text-left">
                        <div>
                          <h3 className="font-serif text-lg font-bold text-tinta text-left">
                            {selectedPrenda.nombre}
                          </h3>
                        </div>

                        {/* Attributes Grid */}
                        <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-fondo2/40 border border-linea/60 rounded">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-tinta-apagada font-semibold">
                              Temporada
                            </span>
                            <p className="text-sm text-tinta font-medium mt-1 flex items-center gap-1.5">
                              {selectedPrenda.temporada === "verano" && (
                                <>
                                  <Sun size={12} className="text-amber-500" /> Verano / Primavera
                                </>
                              )}
                              {selectedPrenda.temporada === "invierno" && (
                                <>
                                  <Snowflake size={12} className="text-sky-500" /> Invierno / Otoño
                                </>
                              )}
                              {selectedPrenda.temporada === "todo" && <>Multiestacional (Todo el Año)</>}
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-tinta-apagada font-semibold">
                              Formalidad
                            </span>
                            <div className="flex items-center gap-1 mt-1.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={11}
                                  className={i < selectedPrenda.formalidad ? "fill-laton text-laton" : "text-linea"}
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-tinta-apagada font-semibold">
                              Tono Dominante
                            </span>
                            <p className="text-sm text-tinta font-mono max-w-[120px] truncate uppercase flex items-center gap-2 mt-1">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/30 inline-block shrink-0 shadow-xs"
                                style={{ backgroundColor: selectedPrenda.color }}
                              />
                              {selectedPrenda.color}
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-tinta-apagada font-semibold">
                              Identificador
                            </span>
                            <p className="text-xs font-mono text-tinta-apagada truncate mt-1">
                              #{selectedPrenda.id.split("_")[1] || selectedPrenda.id}
                            </p>
                          </div>

                          {/* Purchase Price & Cost-per-Wear if available */}
                          {selectedPrenda.precio_compra !== undefined && (
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-tinta-apagada font-semibold">
                                Precio Compra
                              </span>
                              <p className="text-sm text-tinta font-medium mt-1">
                                {Number(selectedPrenda.precio_compra).toFixed(2)}€
                              </p>
                            </div>
                          )}

                          {selectedPrenda.veces_puesto !== undefined && (
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-tinta-apagada font-semibold">
                                Veces Puesto / CPW
                              </span>
                              <p className="text-sm text-tinta font-medium mt-1 flex items-center gap-1">
                                {selectedPrenda.veces_puesto} {selectedPrenda.veces_puesto === 1 ? "vez" : "veces"}
                                {selectedPrenda.precio_compra !== undefined && selectedPrenda.veces_puesto > 0 && (
                                  <span className="text-[11px] text-laton font-mono">
                                    ({(selectedPrenda.precio_compra / selectedPrenda.veces_puesto).toFixed(2)}€/uso)
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* AI Detected Fabric, Composition and Tags */}
                        {(selectedPrenda.marca || selectedPrenda.tejido || selectedPrenda.composicion_tejido || (selectedPrenda.tags && selectedPrenda.tags.filter(t => !t.startsWith("armario:")).length > 0)) && (
                          <div className="p-3.5 bg-fondo border border-linea/60 rounded space-y-2.5">
                            {selectedPrenda.marca && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[10px] uppercase tracking-wider text-laton font-bold">Marca Detectada</span>
                                <span className="text-tinta font-semibold bg-laton/10 px-2.5 py-0.5 rounded border border-laton/25 text-xs">
                                  {selectedPrenda.marca}
                                </span>
                              </div>
                            )}
                            {selectedPrenda.tejido && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[10px] uppercase tracking-wider text-laton font-bold">Tejido Identificado</span>
                                <span className="text-tinta font-semibold bg-linea/40 px-2.5 py-0.5 rounded border border-linea/20 text-xs">{selectedPrenda.tejido}</span>
                              </div>
                            )}
                            {selectedPrenda.composicion_tejido && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[10px] uppercase tracking-wider text-laton font-bold">Composición</span>
                                <span className="text-tinta-apagada font-medium text-xs">{selectedPrenda.composicion_tejido}</span>
                              </div>
                            )}
                            {selectedPrenda.tags && selectedPrenda.tags.filter(t => !t.startsWith("armario:")).length > 0 && (
                              <div className="space-y-1.5 text-left">
                                <span className="text-[10px] uppercase tracking-wider text-laton font-bold block">Estilo & Silueta</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedPrenda.tags.filter(t => !t.startsWith("armario:")).map((tg, iIdx) => (
                                    <span key={iIdx} className="text-[10.5px] font-sans px-2.5 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] border border-laton/20 font-medium">
                                      #{tg}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Wardrobe Capsules Membership */}
                        <div className="space-y-2 p-3 bg-[#F4F4F5]/30 border border-laton/10 rounded relative text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase tracking-wider text-laton font-extrabold block">
                              Clasificación de Armario (Cápsulas)
                            </span>
                            {capsuleSavedFlash && (
                              <span className="text-[9px] text-green-600 dark:text-green-400 font-bold animate-pulse flex items-center gap-1">
                                ✓ Guardado
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {armariosDisponibles.map((arm) => {
                              const isMember = getArmariosDePrenda({ ...selectedPrenda, tags: selectedPrendaTags }).includes(arm);
                              return (
                                <button
                                  key={arm}
                                  type="button"
                                  onClick={() => {
                                    if (!selectedPrenda) return;
                                    const currentArmarios = getArmariosDePrenda({ ...selectedPrenda, tags: selectedPrendaTags });
                                    let nextArmarios = currentArmarios;
                                    if (!currentArmarios.includes(arm)) {
                                      nextArmarios = [...nextArmarios, arm];
                                    } else {
                                      nextArmarios = nextArmarios.filter(a => a !== arm);
                                      if (nextArmarios.length === 0) {
                                        nextArmarios = ["normal"];
                                      }
                                    }
                                    const nextTags = [
                                      ...(selectedPrendaTags || []).filter(t => typeof t === "string" && !t.startsWith("armario:")),
                                      ...nextArmarios.map(a => `armario:${a}`)
                                    ];
                                    setSelectedPrendaTags(nextTags);
                                    
                                    const updatedPrenda = {
                                      ...selectedPrenda,
                                      tags: nextTags
                                    };
                                    setSelectedPrenda(updatedPrenda);
                                    
                                    // Auto-save instantly to storage & Supabase
                                    if (onPrendaActualizada) {
                                      onPrendaActualizada(updatedPrenda);
                                    }
                                    
                                    setCapsuleSavedFlash(true);
                                    setTimeout(() => setCapsuleSavedFlash(false), 2000);
                                  }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border cursor-pointer select-none transition ${
                                    isMember
                                      ? "bg-laton/15 border-laton text-laton font-bold"
                                      : "bg-fondo2/30 border-linea/65 text-tinta-apagada hover:text-tinta hover:border-laton/30"
                                  }`}
                                >
                                  <span>
                                    {arm === "normal" && "🏠"}
                                    {arm === "oficina" && "💼"}
                                    {arm === "fiesta" && "✨"}
                                    {arm !== "normal" && arm !== "oficina" && arm !== "fiesta" && "🏷️"} {arm.charAt(0).toUpperCase() + arm.slice(1)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Description Input Textarea */}
                        <div className="space-y-1 text-left">
                          <label className="text-[9px] uppercase tracking-wider text-laton font-medium flex items-center gap-1">
                            <FileText size={10} /> Notas y Descripción Especial
                          </label>
                          <textarea
                            value={customDescripcion}
                            onChange={(e) => {
                              setCustomDescripcion(e.target.value);
                              setEditDescripcion(e.target.value);
                            }}
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
                              descripcion: `Bonito/a ${selectedPrenda.nombre.toLowerCase()} en muy buen estado.\n\nTemporada ideal: ${selectedPrenda.temporada === "verano" ? "Primavera/Verano" : selectedPrenda.temporada === "invierno" ? "Otoño/Invierno" : "Cualquier temporada"}.\nDetalles adicionales: ${customDescripcion || "Prenda muy bien cuidada y fácil de combinar."}\n\n#moda #vintagedepot #estilo #armariocircular #segundamano`,
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
                            if (onPrendaActualizada && selectedPrenda) {
                              onPrendaActualizada({
                                ...selectedPrenda,
                                tags: selectedPrendaTags,
                                descripcion: customDescripcion,
                              });
                            }
                            setSelectedPrenda(null);
                          }}
                          className="button-press px-4 py-1.5 bg-laton text-fondo hover:bg-laton-apagado hover:text-white text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider"
                        >
                          <Check size={12} /> Guardar
                        </button>
                      </div>
                    </div>
                  </>
                )
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
                              className="w-20 text-xs font-sans bg-fondo border border-[#E4E4E7] text-tinta p-2 rounded focus:border-laton focus:outline-none"
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
                                    <strong>¡Anuncio automático listo!</strong> Debido a las políticas de seguridad de Vinted, no es posible enviar información directamente desde nuestros servidores a sus formularios de forma invisible. 
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
                                    <p className="text-[9px] uppercase tracking-widest text-[#18181B] font-bold">
                                      Copias Individuales Rápidas:
                                    </p>
                                    <p className="text-[8px] text-tinta-apagada -mt-2">
                                      Para rellenar en Vinted en 5 segundos sin tocar el teclado.
                                    </p>
                                    
                                    <div className="space-y-1.5">
                                      {/* Título copy row */}
                                      <div className="flex items-center gap-2 bg-tarjeta p-1 px-2 border border-linea/60 rounded justify-between">
                                        <div className="overflow-hidden w-full text-left">
                                          <span className="text-[7px] text-[#52525B] block uppercase font-bold tracking-wider">Título</span>
                                          <span className="text-[9.5px] text-[#09090B] truncate block">{vintedDraft?.titulo}</span>
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
                                          <span className="text-[7px] text-[#52525B] block uppercase font-bold tracking-wider">Precio (Número Limpio)</span>
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
                                          <span className="text-[7px] text-[#52525B] uppercase font-bold tracking-wider">Descripción de la prenda</span>
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
