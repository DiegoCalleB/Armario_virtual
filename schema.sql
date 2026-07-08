-- =========================================================================
-- ESPEJO - BARBERÍA & SASTRERÍA DIGITAL INTELIGENTE
-- DOCUMENTO DE CONFIGURACIÓN DE BASE DE DATOS SUPABASE (POSTGRESQL)
-- =========================================================================
--
-- Copia y pega esta consulta SQL completa en la sección "SQL Editor"
-- de tu panel de Supabase para estructurar las tablas, habilitar
-- Row Level Security (RLS) y garantizar el aislamiento confidencial de datos.
-- 

-- -------------------------------------------------------------------------
-- 1. CONFIGURACIÓN DE LA TABLA 'rostro' (Fisionomía del Cabello y Rostro)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rostro (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    forma_cara TEXT NOT NULL,
    pelo_actual TEXT NOT NULL,
    barba_actual TEXT NOT NULL,
    clave TEXT NOT NULL,
    image_src TEXT, -- Representación gráfica de calibración (Base64)
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.rostro ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura individual de rostro" ON public.rostro;
DROP POLICY IF EXISTS "Permitir inserción individual de rostro" ON public.rostro;
DROP POLICY IF EXISTS "Permitir actualización individual de rostro" ON public.rostro;
DROP POLICY IF EXISTS "Permitir borrado individual de rostro" ON public.rostro;

-- Políticas de RLS para 'rostro'
CREATE POLICY "Permitir lectura individual de rostro" 
    ON public.rostro FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserción individual de rostro" 
    ON public.rostro FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir actualización individual de rostro" 
    ON public.rostro FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir borrado individual de rostro" 
    ON public.rostro FOR DELETE 
    USING (auth.uid() = user_id);


-- -------------------------------------------------------------------------
-- 2. CONFIGURACIÓN DE LA TABLA 'prendas' (Guarda Ropa Digital Inteligente)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prendas (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL, -- 'top', 'pantalon', 'calzado', 'accesorio'
    color TEXT NOT NULL, -- Código Hexadecimal o nombre
    formalidad INTEGER NOT NULL DEFAULT 5, -- 1 al 5
    temporada TEXT NOT NULL DEFAULT 'todo', -- 'verano', 'invierno', 'todo'
    image_src TEXT NOT NULL, -- Imagen minificada de la prenda (Base64)
    descripcion TEXT, -- Observaciones o ficha sastrera
    tejido TEXT, -- Clasificación de tejido inteligente (ej: Lino, Lana Peinada)
    tags TEXT[], -- Etiquetas de corte y silueta estructuradas
    precio_compra NUMERIC, -- Coste en euros para calcular Cost-per-Wear
    veces_puesto INTEGER NOT NULL DEFAULT 0, -- Contador de usos
    composicion_tejido TEXT, -- Algodón, lana, sintético, cuero, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que las columnas nuevas existan si la tabla ya estaba creada previamente
ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS tejido TEXT;
ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS precio_compra NUMERIC;
ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS veces_puesto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.prendas ADD COLUMN IF NOT EXISTS composicion_tejido TEXT;

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.prendas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura individual de prendas" ON public.prendas;
DROP POLICY IF EXISTS "Permitir inserción individual de prendas" ON public.prendas;
DROP POLICY IF EXISTS "Permitir actualización individual de prendas" ON public.prendas;
DROP POLICY IF EXISTS "Permitir borrado individual de prendas" ON public.prendas;

-- Políticas de RLS para 'prendas'
CREATE POLICY "Permitir lectura individual de prendas" 
    ON public.prendas FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserción individual de prendas" 
    ON public.prendas FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir actualización individual de prendas" 
    ON public.prendas FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir borrado individual de prendas" 
    ON public.prendas FOR DELETE 
    USING (auth.uid() = user_id);


-- -------------------------------------------------------------------------
-- 3. CONFIGURACIÓN DE LA TABLA 'historial' (Catálogo de Atuendos e Histórico)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fecha TEXT NOT NULL,
    ocasion TEXT NOT NULL,
    clima TEXT NOT NULL,
    look_titulo TEXT NOT NULL,
    look_porque TEXT NOT NULL,
    look_pelo_sugerido TEXT NOT NULL,
    look_barba_sugerida TEXT NOT NULL,
    look_consejo_barberia TEXT NOT NULL,
    look_id_prendas TEXT[], -- Lista de los IDs de prendas que componen el look
    look_simulated_image_url TEXT, -- Render de retrato
    look_simulated_full_body_image_url TEXT, -- Render de cuerpo entero
    favorito BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura individual de historial" ON public.historial;
DROP POLICY IF EXISTS "Permitir inserción individual de historial" ON public.historial;
DROP POLICY IF EXISTS "Permitir actualización individual de historial" ON public.historial;
DROP POLICY IF EXISTS "Permitir borrado individual de historial" ON public.historial;

-- Políticas de RLS para 'historial'
CREATE POLICY "Permitir lectura individual de historial" 
    ON public.historial FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserción individual de historial" 
    ON public.historial FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir actualización individual de historial" 
    ON public.historial FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir borrado individual de historial" 
    ON public.historial FOR DELETE 
    USING (auth.uid() = user_id);


-- -------------------------------------------------------------------------
-- 4. CONFIGURACIÓN DE LA TABLA 'perfil_estilo' (ADN de Estilo / Perfil de Estilo)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfil_estilo (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    estilo_vibe TEXT,
    forma_ser TEXT,
    estilo_objetivo TEXT,
    estilo_presupuesto TEXT,
    detalles_libres TEXT,
    respuestas_quiz JSONB, -- Almacena silueta, colores, rutina, edad, etc.
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.perfil_estilo ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura individual de perfil_estilo" ON public.perfil_estilo;
DROP POLICY IF EXISTS "Permitir inserción individual de perfil_estilo" ON public.perfil_estilo;
DROP POLICY IF EXISTS "Permitir actualización individual de perfil_estilo" ON public.perfil_estilo;
DROP POLICY IF EXISTS "Permitir borrado individual de perfil_estilo" ON public.perfil_estilo;

-- Políticas de RLS para 'perfil_estilo'
CREATE POLICY "Permitir lectura individual de perfil_estilo" 
    ON public.perfil_estilo FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserción individual de perfil_estilo" 
    ON public.perfil_estilo FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir actualización individual de perfil_estilo" 
    ON public.perfil_estilo FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir borrado individual de perfil_estilo" 
    ON public.perfil_estilo FOR DELETE 
    USING (auth.uid() = user_id);


-- -------------------------------------------------------------------------
-- 5. CONFIGURACIÓN DE LA TABLA 'planificaciones' (Agenda de Looks & Clima)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planificaciones (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fecha TEXT NOT NULL,
    nombre_look TEXT NOT NULL,
    prendas_ids TEXT[] NOT NULL DEFAULT '{}',
    clima_simulado JSONB NOT NULL, -- Almacena temp, condicion, ciudad, etc.
    comentarios_sastre TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.planificaciones ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura individual de planificaciones" ON public.planificaciones;
DROP POLICY IF EXISTS "Permitir inserción individual de planificaciones" ON public.planificaciones;
DROP POLICY IF EXISTS "Permitir actualización individual de planificaciones" ON public.planificaciones;
DROP POLICY IF EXISTS "Permitir borrado individual de planificaciones" ON public.planificaciones;

-- Políticas de RLS para 'planificaciones'
CREATE POLICY "Permitir lectura individual de planificaciones" 
    ON public.planificaciones FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserción individual de planificaciones" 
    ON public.planificaciones FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir actualización individual de planificaciones" 
    ON public.planificaciones FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir borrado individual de planificaciones" 
    ON public.planificaciones FOR DELETE 
    USING (auth.uid() = user_id);


-- -------------------------------------------------------------------------
-- 6. CONFIGURACIÓN DE LA TABLA 'armarios_personalizados' (Lista de Cápsulas)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.armarios_personalizados (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, nombre)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.armarios_personalizados ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir lectura de armarios_personalizados de usuario" ON public.armarios_personalizados;
DROP POLICY IF EXISTS "Permitir inserción de armarios_personalizados de usuario" ON public.armarios_personalizados;
DROP POLICY IF EXISTS "Permitir borrado de armarios_personalizados de usuario" ON public.armarios_personalizados;

-- Políticas de RLS para 'armarios_personalizados'
CREATE POLICY "Permitir lectura de armarios_personalizados de usuario" 
    ON public.armarios_personalizados FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserción de armarios_personalizados de usuario" 
    ON public.armarios_personalizados FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir borrado de armarios_personalizados de usuario" 
    ON public.armarios_personalizados FOR DELETE 
    USING (auth.uid() = user_id);


