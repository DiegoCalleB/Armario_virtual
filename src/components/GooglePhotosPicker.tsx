import React, { useState, useEffect } from "react";
import { 
  getGooglePhotosToken, 
  signOutGooglePhotos, 
  fetchGooglePhotos, 
  GooglePhotoItem 
} from "../lib/googlePhotos";
import { Image, LogOut, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, X, Sparkles, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GooglePhotosPickerProps {
  onPhotoSelected: (base64Data: string) => void;
  triggerButtonText?: string;
  triggerClassName?: string;
}

const GoogleLogomark = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

const CATEGORY_PRESETS = [
  { id: "PEOPLE_SELFIES", label: "Yo (Retratos / Selfies)", categories: ["PORTRAITS", "SELFIES", "PEOPLE"] },
  { id: "FASHION", label: "Moda y Ropa", categories: ["FASHION"] },
  { id: "ALL", label: "Todas las fotos", categories: [] },
  { id: "TRAVEL", label: "Viajes y Paisajes", categories: ["TRAVEL", "LANDSCAPES"] },
  { id: "WEDDINGS", label: "Eventos y Fiestas", categories: ["WEDDINGS", "BIRTHDAYS"] }
];

const getActiveCategoriesForPreset = (presetId: string): string[] => {
  const preset = CATEGORY_PRESETS.find(p => p.id === presetId);
  return preset ? preset.categories : [];
};

export default function GooglePhotosPicker({ 
  onPhotoSelected, 
  triggerButtonText = "Importar de Google Fotos",
  triggerClassName = "button-press flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-tarjeta border border-linea text-tinta-apagada hover:text-laton hover:border-laton transition text-xs rounded select-none font-medium"
}: GooglePhotosPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [photos, setPhotos] = useState<GooglePhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null); // tracks id of the image currently being converted to base64
  const [error, setError] = useState<string | null>(null);
  
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [prevPageTokens, setPrevPageTokens] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedCategoryPreset, setSelectedCategoryPreset] = useState<string>("PEOPLE_SELFIES");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsConnected(!!getGooglePhotosToken());
  }, []);

  const loadPhotos = async (pageToken?: string, isNext = true, categoriesOverride?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const activeCats = categoriesOverride !== undefined ? categoriesOverride : getActiveCategoriesForPreset(selectedCategoryPreset);
      const data = await fetchGooglePhotos(pageToken, activeCats);
      setPhotos(data.items);
      
      if (pageToken) {
        if (isNext) {
          setPrevPageTokens(prev => [...prev, pageToken]);
          setCurrentPage(prev => prev + 1);
        } else {
          setPrevPageTokens(prev => prev.slice(0, -1));
          setCurrentPage(prev => Math.max(1, prev - 1));
        }
      } else {
        setPrevPageTokens([]);
        setCurrentPage(1);
      }
      
      setNextPageToken(data.nextPageToken);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No se pudieron recuperar las fotos de Google Fotos.");
      if (err.message && err.message.includes("expirado")) {
        setIsConnected(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (presetId: string) => {
    setSelectedCategoryPreset(presetId);
    setSearchQuery("");
    const activeCats = getActiveCategoriesForPreset(presetId);
    loadPhotos(undefined, true, activeCats);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }
      if (event.data?.type === "GOOGLE_PHOTOS_TOKEN" && event.data?.token) {
        sessionStorage.setItem("google_photos_token", event.data.token);
        setIsConnected(true);
        const activeCats = getActiveCategoriesForPreset(selectedCategoryPreset);
        loadPhotos(undefined, true, activeCats);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedCategoryPreset]);

  const handleOpen = () => {
    setIsOpen(true);
    setError(null);
    const token = getGooglePhotosToken();
    if (token) {
      setIsConnected(true);
      const activeCats = getActiveCategoriesForPreset(selectedCategoryPreset);
      loadPhotos(undefined, true, activeCats);
    } else {
      setIsConnected(false);
    }
  };

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setLoading(true);
    try {
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        "/auth/google-photos",
        "google_photos_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
      if (!popup) {
        setError("El navegador bloqueó la ventana emergente de autenticación. Por favor, permite ventanas emergentes.");
        setLoading(false);
        return;
      }
      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          setLoading(false);
        }
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError("No se pudo iniciar sesión con Google o autorizar el acceso a Google Fotos.");
      setLoading(false);
    }
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    signOutGooglePhotos();
    setIsConnected(false);
    setPhotos([]);
    setNextPageToken(undefined);
    setPrevPageTokens([]);
    setCurrentPage(1);
  };

  const handleSelectPhoto = async (photo: GooglePhotoItem) => {
    setImporting(photo.id);
    setError(null);
    try {
      // Use our backend proxy route to download the image and convert to base64
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(photo.baseUrl)}`);
      if (!res.ok) {
        throw new Error("No se pudo proxy-transferir la imagen desde Google Fotos.");
      }
      const data = await res.json();
      if (!data.base64) {
        throw new Error("Respuesta inválida del servidor proxy.");
      }
      onPhotoSelected(data.base64);
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      setError("Error al importar la foto. Intenta con otra imagen.");
    } finally {
      setImporting(null);
    }
  };

  const handleNextPage = () => {
    if (nextPageToken) {
      const activeCats = getActiveCategoriesForPreset(selectedCategoryPreset);
      loadPhotos(nextPageToken, true, activeCats);
    }
  };

  const handlePrevPage = () => {
    const prevToken = prevPageTokens[prevPageTokens.length - 2]; // the token before current
    const activeCats = getActiveCategoriesForPreset(selectedCategoryPreset);
    loadPhotos(prevToken, false, activeCats);
  };

  const filteredPhotos = photos.filter(photo => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const filenameMatch = photo.filename.toLowerCase().includes(query);
    const descMatch = photo.description?.toLowerCase().includes(query) || false;
    return filenameMatch || descMatch;
  });

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={triggerClassName}
      >
        <Image size={13} className="text-laton" />
        <span>{triggerButtonText}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
              className="w-full max-w-2xl bg-tarjeta border border-linea rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-linea flex items-center justify-between bg-fondo/40">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#4285F4]/10 rounded border border-[#4285F4]/30 text-[#4285F4]">
                    <Image size={16} />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-white uppercase tracking-wide">Google Fotos</h3>
                    <p className="text-[10px] text-tinta-apagada font-mono">IMPORTACIÓN INTELIGENTE Y SEGURA</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-tinta-apagada hover:text-white hover:bg-white/5 rounded-md transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Area */}
              <div className="flex-grow p-6 overflow-y-auto min-h-[300px] flex flex-col justify-between">
                <div>
                  {error && (
                    <div className="mb-4 flex items-start gap-2 p-3 bg-red-950/20 border border-red-900/30 text-red-300 text-xs rounded-lg">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {!isConnected ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-tarjeta border border-linea flex items-center justify-center text-tinta-apagada/40">
                        <Image size={28} />
                      </div>
                      <div className="space-y-1 max-w-md">
                        <h4 className="font-serif text-lg font-bold text-white uppercase">Sincroniza con Google Fotos</h4>
                        <p className="text-xs text-tinta-apagada leading-relaxed">
                          Conéctate de manera segura a tu biblioteca para importar tus retratos para el Espejo virtual o las prendas de tu armario en un clic.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={loading}
                        className="button-press py-2 px-4 bg-white hover:bg-neutral-100 text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center transition disabled:opacity-50 cursor-pointer shadow-md"
                      >
                        {loading ? (
                          <RefreshCw size={14} className="animate-spin mr-2" />
                        ) : (
                          <GoogleLogomark />
                        )}
                        Vincular Cuenta de Google
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-tinta-apagada">
                        <span className="font-medium">Filtrar Galería con IA de Google</span>
                        <button
                          type="button"
                          onClick={handleDisconnect}
                          className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition text-[11px] font-medium"
                        >
                          <LogOut size={12} /> Desvincular Google
                        </button>
                      </div>

                      {/* IA Categories Filters */}
                      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin border-b border-linea/40">
                        {CATEGORY_PRESETS.map((preset) => {
                          const isSelected = selectedCategoryPreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleCategoryChange(preset.id)}
                              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-all flex-shrink-0 border cursor-pointer ${
                                isSelected 
                                  ? "bg-laton/20 border-laton text-laton font-bold" 
                                  : "bg-tarjeta border-linea hover:border-tinta-apagada text-tinta-apagada hover:text-white"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Text Search input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar por nombre de archivo o descripción..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-12 py-2 bg-fondo/60 border border-linea focus:border-laton rounded-lg text-xs text-white placeholder-tinta-apagada/70 transition font-sans focus:outline-none focus:ring-1 focus:ring-laton/40"
                        />
                        <Search size={14} className="absolute left-3 top-2.5 text-tinta-apagada" />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-2 text-[10px] text-laton hover:text-white font-mono bg-laton/10 px-1.5 py-0.5 rounded border border-laton/20 transition"
                          >
                            LIMPIAR
                          </button>
                        )}
                      </div>

                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <RefreshCw size={24} className="text-laton animate-spin mb-2" />
                          <p className="text-xs text-tinta-apagada font-mono uppercase tracking-wider animate-pulse">
                            Filtrando galería...
                          </p>
                        </div>
                      ) : filteredPhotos.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-linea/50 rounded-lg flex flex-col items-center justify-center space-y-2">
                          <p className="text-xs text-tinta-apagada">No se encontraron imágenes en esta categoría.</p>
                          <p className="text-[10px] text-tinta-apagada/65 max-w-sm leading-relaxed">
                            Prueba seleccionando la categoría <span className="text-laton">"Todas las fotos"</span> o borrando tu filtro de búsqueda actual.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {filteredPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              onClick={() => !importing && handleSelectPhoto(photo)}
                              className={`relative aspect-square bg-black/40 border rounded-lg overflow-hidden group cursor-pointer transition ${
                                importing === photo.id 
                                  ? "border-laton opacity-60 pointer-events-none" 
                                  : "border-linea hover:border-laton"
                              }`}
                            >
                              <img
                                src={`${photo.baseUrl}=w200-h200-c`}
                                alt={photo.filename}
                                className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                              
                              {importing === photo.id ? (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2 text-center">
                                  <RefreshCw size={16} className="text-laton animate-spin mb-1.5" />
                                  <span className="text-[9px] text-white font-mono uppercase tracking-wider leading-none">Importando...</span>
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-200 flex items-end p-2">
                                  <span className="text-[9px] text-white font-mono truncate w-full">{photo.filename}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pagination (Only visible when connected and not loading) */}
                {isConnected && !loading && filteredPhotos.length > 0 && (
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-linea/60 bg-fondo/20 px-1">
                    <button
                      type="button"
                      onClick={handlePrevPage}
                      disabled={prevPageTokens.length === 0}
                      className="px-3 py-1.5 border border-linea text-tinta-apagada hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Anterior
                    </button>
                    <span className="text-xs text-tinta-apagada font-mono">Pág. {currentPage}</span>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={!nextPageToken}
                      className="px-3 py-1.5 border border-linea text-tinta-apagada hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded transition text-xs flex items-center gap-1 cursor-pointer"
                    >
                      Siguiente <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
