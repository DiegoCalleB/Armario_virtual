export interface Rostro {
  forma_cara: string;
  pelo_actual: string;
  barba_actual: string;
  clave: string;
  imageSrc?: string; // Original face photo base64
}

export type CategoriaPrenda = "top" | "pantalon" | "calzado" | "accesorio";
export type TemporadaPrenda = "verano" | "invierno" | "todo";

export interface Prenda {
  id: string;
  nombre: string;
  categoria: CategoriaPrenda;
  color: string;
  formalidad: number; // 1 to 5
  temporada: TemporadaPrenda;
  imageSrc: string; // Base64 representation of item
  descripcion?: string; // Observaciones opcionales o notas sobre la prenda
  tejido?: string; // Tipo de tejido identificado por la IA (ej: Algodón, Lana, Denim, etc.)
  tags?: string[]; // Etiquetas automatizadas de estilo y corte
  precio_compra?: number; // Coste en euros para calcular Cost-per-Wear
  veces_puesto?: number; // Contador de usos
  composicion_tejido?: string; // Algodón, lana, sintético, cuero, etc.
}

export interface LookPlanificado {
  id: string;
  fecha: string; // "YYYY-MM-DD"
  nombre_look: string;
  prendasIds: string[]; // prendas seleccionadas
  clima_simulado: {
    temp: number;
    condicion: "soleado" | "nublado" | "lluvioso" | "tormenta" | "frio";
    ciudad: string;
  };
  comentarios_sastre?: string;
}

export interface Look {
  titulo: string;
  id_prendas: string[]; // List of existing wardrobe item IDs inside this look
  porque: string; // Stylist's justification
  pelo_sugerido: string;
  barba_sugerida: string;
  consejo_barberia: string;
  simulatedImageUrl?: string; // Simulated retrato output from gemini-2.5-flash-image
  simulatedFullBodyImageUrl?: string; // Simulated body + outfit outfit from gemini-2.5-flash-image
}

export interface EventoConfig {
  ocasion: string;
  clima: string;
}

export interface HistorialLook {
  id: string;
  fecha: string;
  ocasion: string;
  clima: string;
  look: Look;
  favorito: boolean;
}

export interface AuditoriaPrendaExceso {
  id_prenda: string;
  motivo_descarte: string;
  precio_sugerido_vinted: number;
  titulo_vinted: string;
  descripcion_vinted: string;
}

export interface AuditoriaGap {
  prenda_sugerida: string;
  categoria: CategoriaPrenda;
  por_que_falta: string;
  consejo_estilovital: string;
}

export interface AuditoriaArmarioResult {
  analisis_editorial: string;
  grado_cohesion_porcentaje: number;
  necesita: AuditoriaGap[];
  sobran: AuditoriaPrendaExceso[];
}

export interface PerfilEstilo {
  estiloVibe?: string;
  formaSer?: string;
  estiloObjetivo?: string;
  estiloPresupuesto?: string;
  detallesLibres?: string;
  respuestasQuiz?: {
    silueta?: string;
    colores?: string[];
    rutina?: string;
    edad?: string;
  };
}

