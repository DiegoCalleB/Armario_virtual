# 🪞 ESPEJO — Barbería & Sastrería Digital Inteligente
> Proyecto de Fin de Máster — Máster de Desarrollo con IA de MoureDev

**ESPEJO** es una plataforma premium full-stack de consultoría de imagen, barbería clásica y gestión circular de armario dirigida al público masculino. El proyecto fusiona la elegancia editorial de las sastrerías clásicas con el poder computacional de agentes inteligentes basados en modelos generativos de visión de última generación (**Gemini 3.5**).

---

## 💎 Características Principales (Agentes IA Reales)

El ecosistema de ESPEJO ha sido enriquecido con cinco agentes y utilidades basadas en Inteligencia Artificial real de clase de producción:

### 1. 👁️ Segmentación, Etiquetado y Análisis de Tejidos Invisible
*   **Detalle**: Al subir cualquier prenda (vía archivo o captura de cámara), el modelo de visión multimodal realiza un diagnóstico instantáneo sin que el usuario tenga que escribir nada.
*   **Resultados**: Detecta con precisión el tipo de prenda, color dominante hexadecimal, formalidad (1/5), temporada, **tipo de tejido** (ej: *Lino italiano*, *Lana peinada*, *Algodón Oxford*) y asigne **etiquetas de estilo silueta** (ej: *#sartorial*, *#smartcasual*, *#slowwear*).

### 2. 💈 Agente Estilista Personal (Generador de Looks Dinámico)
*   **Detalle**: Integra el estado del cabello, fisionomía del rostro y corte actual del usuario junto con variables climáticas externas preestablecidas y ocasión de uso.
*   **Resultados**: Genera una terna de atuendos (*looks*) equilibrados recomendando exclusivamente combinaciones reales de su armario virtual, acompañándolo con sugerencias de peinado, perfilado de barba clásica y consejos técnicos de cera o pomadas de barbero.

### 3. 🧳 Asistente de Maletas Inteligente (Cápsula de Viaje)
*   **Detalle**: El usuario indica un destino, días de estadía, clima previsto y tipo de actividades principales de su viaje.
*   **Resultados**: El agente selecciona de manera matemática de **5 a 8 prendas reales** de su ropero que constituyan una cápsula de equipaje ideal. Estructura una planificación día por día con los outfits exactos hilvanando los IDs de las prendas combinadas e indica extras recomendables de compra.

### 4. 📈 Personal Shopper & Analista de Vacíos de Armario
*   **Detalle**: Escanea el balance cromático y de formalidad general del guardarropa del caballero.
*   **Resultados**: Detecta los vacíos de cobertura ("Multiplicadores de Armario" o básicos faltantes), redacta un análisis conceptual del estilo ideal del cliente (e.g. *Quiet Luxury*, *Neo-Sartorial*) y propone una **Adquisición Estrella Inmediata** describiendo materiales recomendados, costes y qué prendas actuales potenciaría su compra.

### 5. 🔄 Auditoría de Armario Circular e Integración con Vinted
*   **Detalle**: Agente de descarte inteligente. Escanea redundancias estilísticas o prendas muertas en base al perfil del cliente.
*   **Resultados**: Identifica prendas prescindibles, fija una tasación de reventa justa en euros, diseña un título de alta conversión y una **persuasiva descripción para Vinted** optimizada para SEO. Permite iniciar el flujo de reventa descargando la imagen procesada y abriendo el draft de Vinted con un clic.

---

## 🛠️ Arquitectura Tecnológica y Patrones AI

El proyecto está diseñado bajo estrictos estándares de robustez, escalabilidad y eficiencia de costes:

### Front-End (SPA)
*   **React 18** + **Vite**: Aplicación de página única veloz con soporte modular extendido.
*   **Tailwind CSS**: Estética editorial clásica basada en contrastes profundos, tonos tiza, tinta de carbón y acentos dorados de latón (`#C9A35B`).
*   **Motion**: Transiciones refinadas, desenfoques y micro-animaciones fluidas para emular un probador sastrero premium.
*   **Lucide React**: Biblioteca unificada para iconografía vectorial sutil.

### Back-End (API Proxy Segura)
*   **Node.js / Express**: Servidor intermedio que encapsula las llamadas a los servicios cognitivos de Google Cloud, manteniendo las claves de API (**GEMINI_API_KEY**) ocultas de forma segura al navegador.
*   **@google/genai SDK**: Implementación nativa oficial de la suite de Google para conexiones de alta velocidad con modelos Flash y de Imagen.
*   **Esquemas Estructurados (Structured Output)**: Configuración estricta de variables en el backend para forzar respuestas estrictamente conformes en formato JSON tipeado sin contaminación verbal o alucinaciones sintácticas.

### Base de Datos & Capa de Persistencia
*   **Supabase / PostgreSQL**: Autenticación nativa (Modo Invitado / Modo Registrado), almacenamiento relacional seguro para las prendas guardadas por el usuario, el historial de looks favoritos y los metadatos de su rostro simulado.

---

## 💳 Gestión de Costes y Optimización de LLMs
Para garantizar que el proyecto mantenga unos costes de API de céntimos en producción real, se aplican los siguientes patrones de ingeniería:
1.  **Compresión de Imágenes en Cliente**: Antes de transmitir las fotos al backend `/api/analizar-prenda`, el navegador reescala y comprime la imagen a un canvas compacto de baja resolución procesable por el modelo de visión, minimizando el consumo de ancho de banda y el recuento de tokens de entrada.
2.  **Mecanismo de Retries Resiliente (`callGeminiWithRetry`)**: Sistema de reintentos integrado con backoff exponencial sutil para mitigar errores de rate-limiting (HTTP 429) o fallos transitorios de red.
3.  **Modelos Especializados**: Uso del modelo equilibrado `gemini-3.5-flash` para tareas de generación de texto y análisis estructurado complejo.

---

## 🚀 Guía de Instalación y Ejecución Local

### Prerrequisitos
*   Node.js v18 o superior.
*   Una API Key de Gemini obtenida en Google AI Studio.
*   Una instancia de base de datos Supabase configurada en tu panel con las tablas `perfiles`, `rostros`, `prendas` e `historial_looks`.

### Instalación
1.  Clona este repositorio impecable:
    ```bash
    git clone https://github.com/tu-usuario/espejo-sastreria.git
    cd espejo-sastreria
    ```
2.  Instala las dependencias necesarias de npm:
    ```bash
    npm install
    ```
3.  Configura las variables de entorno creando un archivo `.env` en la raíz (basado en `.env.example`):
    ```env
    GEMINI_API_KEY=tu_api_key_aqui
    VITE_SUPABASE_URL=tu_supabase_url
    VITE_SUPABASE_ANON_KEY=tu_anon_key
    ```
4.  Levanta el servidor de desarrollo local de alta velocidad:
    ```bash
    npm run dev
    ```
    El servidor levantará en puerto `3000` con recarga viva automática.

### Compilación para Producción (Railway / Cloud Run)
Para compilar y empaquetar el servidor de manera autocontenida:
```bash
npm run build
```
Esto creará el bundle estático Vite en `dist/` y compilará `server.ts` a un bundle Node CommonJS ultraoptimizado en `dist/server.cjs` empleando esbuild. Para arrancar en producción:
```bash
npm start
```

---

## 🎨 Filosofía de Diseño: "Sartorial Minimal"
El diseño se desliga conscientemente de la saturación visual de la IA actual. No tiene terminales, telemetría sintética o ruidos "cyberpunk". Se inspira en catálogos impresos históricos ingleses:
*   Negros ahumados y sombras profundas para un probador privado.
*   Líneas muy finas imitando tizas de corte sastre.
*   Márgenes holgados que dotan de respiración y porte "Slow-Fashion" a cada elemento.

---
*Diseñado e implementado con pasión sastrera por un entusiasta de la tecnología y la IA.*
