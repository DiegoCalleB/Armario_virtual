import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up bodies with elevated limits for base64 image transfers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Parse a data URI into MimeType and raw base64 data
function parseDataUri(dataUri: string): { mimeType: string; data: string } {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    return { mimeType: matches[1], data: matches[2] };
  }
  // Try fallback
  return { mimeType: "image/jpeg", data: dataUri.replace(/^data:image\/[a-z]+;base64,/, "") };
}

// Lazy initialization of the Gemini client so it fails fast during a call if key is missing,
// instead of crashing the process on server startup.
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to retry Gemini API calls in case of rate limits, 503 unavailable, or spikes in demand
async function callGeminiWithRetry<T>(
  apiCallFn: () => Promise<T>,
  retries = 4,
  delayMs = 1500
): Promise<T> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiCallFn();
    } catch (error: any) {
      lastError = error;
      const errorStr = String(error?.message || error || "");
      const errorJson = error && typeof error === "object" ? JSON.stringify(error) : "";
      
      const isTransient =
        error?.status === 503 ||
        error?.status === 429 ||
        error?.statusCode === 503 ||
        error?.statusCode === 429 ||
        errorStr.includes("503") ||
        errorStr.includes("429") ||
        errorStr.includes("UNAVAILABLE") ||
        errorStr.includes("high demand") ||
        errorJson.includes("503") ||
        errorJson.includes("429") ||
        errorJson.includes("UNAVAILABLE") ||
        errorJson.includes("high demand");

      if (isTransient && attempt < retries) {
        const nextDelay = delayMs * Math.pow(2, attempt) + Math.random() * 400;
        console.warn(
          `[ESPEJO IA] Error temporal detectado (503/429/UNAVAILABLE). Intento ${attempt + 1}/${retries + 1}. Reintentando en ${Math.round(nextDelay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
      } else {
        throw error;
      }
    }
  }
  throw lastError || new Error("Servicio de IA temporalmente no disponible tras reintentos.");
}

// 1. ANALIZAR ROSTRO
app.post("/api/analizar-rostro", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
       res.status(400).json({ error: "No se proporcionó ninguna imagen de rostro." });
       return;
     }

    const { mimeType, data } = parseDataUri(image);
    const ai = getGenAI();

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: "Analiza esta foto de rostro masculino para un aseso de imagen exclusivo. Determina su forma de cara (ej: ovalada, cuadrada, redonda, alargada, triangular, diamante). Identifica su estilo de pelo actual y estilo de barba actual (o indica 'ninguno' si no tiene barba). Define un concepto de clave estilística única y sofisticada que capture su potencial de imagen. Todo el análisis debe ser en español castellano elegante. Responde estrictamente con el formato JSON definido en el esquema.",
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              forma_cara: {
                type: Type.STRING,
                description: "Forma predominante de la cara: ovalada, cuadrada, redonda, alargada, triangular, diamante, etc.",
              },
              pelo_actual: {
                type: Type.STRING,
                description: "Descripción corta y elegante del estilo de cabello actual.",
              },
              barba_actual: {
                type: Type.STRING,
                description: "Descripción corta y elegante del estilo de barba actual.",
              },
              clave: {
                type: Type.STRING,
                description: "Concepto de clave estilística única de 3-5 palabras (ej: 'Estructurado y de Carácter', 'Equilibrio Atemporal', 'Moderno Minimalista').",
              },
            },
            required: ["forma_cara", "pelo_actual", "barba_actual", "clave"],
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("No se obtuvo respuesta de texto del modelo.");
    }

    const analysis = JSON.parse(response.text.trim());
    res.json(analysis);
  } catch (error: any) {
    console.error("Error en analizar-rostro; aplicando fallback elegante de gracia:", error);
    const fallbackResponse = {
      forma_cara: "ovalada",
      pelo_actual: "Corte estructurado clásico",
      barba_actual: "Barba corta y pulida",
      clave: "Equilibrio Atemporal",
      _is_fallback: true
    };
    res.json(fallbackResponse);
  }
});

// 2. ANALIZAR PRENDA
app.post("/api/analizar-prenda", async (req, res) => {
  try {
    const { image, isMulti } = req.body;
    if (!image) {
       res.status(400).json({ error: "No se proporcionó ninguna imagen de la prenda." });
       return;
    }

    const { mimeType, data } = parseDataUri(image);
    const ai = getGenAI();
    const isMultiModeEnabled = isMulti === true || isMulti === "true";

    // We distinguish between single garment and multi-garment analysis
    const promptText = isMultiModeEnabled
      ? `Analiza detalladamente esta imagen de armario masculino o prenda de vestir. 
Identifica CADA una de las prendas, calzado o accesorios de hombre visibles de forma independiente.

- DETECCIÓN INDEPENDIENTE OBLIGATORIA: Si la imagen muestra a una persona vestida, un maniquí o un grupo de prendas juntas (ej: armario o ropa colgada), DEBES desglosar e identificar CADA una de las prendas por separado (ej: la chaqueta por un lado como 'top', la camisa por otro como 'top', los pantalones o vaqueros por otro como 'pantalon', los zapatos por otro como 'calzado', y el reloj, cinturón o gafas como 'accesorio'). Es de suma importancia que NO los agrupes en una sola prenda de armario.
- Si la imagen contiene un único artículo de vestir aislado, lístalo como un único elemento en el array.

Para cada prenda identificada de forma independiente, determina:
1. Nombre de lujo sastrero y refinado en español (ej: "Americana estructurada marrón chocolate", "Pantalón chino beige de corte recto", "Zapatos Loafer de piel marrón oscura").
2. Categoría: "top" (camisas, camisetas, abrigos, chaquetas), "pantalon" (pantalones, vaqueros, bermudas), "calzado" (zapatos, zapatillas, botas) o "accesorio" (relojes, gafas, cinturones, bufandas).
3. Color predominante en hexadecimal (ej: "#2C3E50").
4. Formalidad del 1 al 5 (1: muy casual/deportivo, 2: casual diario, 3: smart casual/semi-formal, 4: traje/cóctel, 5: de etiqueta/gala).
5. Temporada: "verano", "invierno" o "todo".
6. Su caja delimitadora (bounding box) en coordenadas normalizadas de 0 a 1000 (donde box_ymin es el borde superior, box_xmin el borde izquierdo, box_ymax el borde inferior y box_xmax el borde derecho de la prenda, ej: una camisa puede ser box_ymin: 150, box_xmin: 250, box_ymax: 550, box_xmax: 750).

Responde estrictamente con el formato JSON definido en el esquema de respuesta.`
      : `Analiza este artículo de ropa o calzado de hombre de la imagen de forma individual. 
Identifica SOLO la prenda de vestir o el artículo de armario principal visible en la imagen como un elemento único del armario.

Determina con precisión:
1. Nombre elegante y refinado en español (ej: 'Americana estructurada marrón chocolate', 'Pantalón chino beige de corte recto', 'Zapatos Loafer de piel marrón oscura').
2. Categoría de armario: "top" (camisas, camisetas, abrigos, chaquetas), "pantalon" (pantalones, vaqueros, bermudas), "calzado" (zapatos, zapatillas, botas) o "accesorio" (reloj, pañuelo, gafas de sol, cinturón).
3. Color predominante en formato hexadecimal (#HEX) (ej: '#1E3A8A').
4. Formalidad del 1 al 5 (1: deportivo/muy casual, 2: casual diario, 3: smart casual/semi-formal, 4: traje/cóctel, 5: de etiqueta/gala).
5. Temporada idónea: "verano", "invierno" o "todo".

Responde estrictamente con el formato JSON definido en el esquema de respuesta.`;

    const responseSchema = isMultiModeEnabled
      ? {
          type: Type.OBJECT,
          properties: {
            prendas: {
              type: Type.ARRAY,
              description: "Lista de prendas de armario identificadas. Si la imagen contiene un outfit completo o varias prendas, desglósalo en múltiples elementos individuales. Si solo contiene una única prenda, devuelve un único elemento en este array.",
              items: {
                type: Type.OBJECT,
                properties: {
                  nombre: {
                    type: Type.STRING,
                    description: "Nombre de la prenda de forma descriptiva, sofisticada y elegante.",
                  },
                  categoria: {
                    type: Type.STRING,
                    description: "Debe ser estrictamente uno de estos valores: top, pantalon, calzado, accesorio.",
                  },
                  color: {
                    type: Type.STRING,
                    description: "Código de color hexadecimal representativo de la prenda (ej: '#1E3A8A').",
                  },
                  formalidad: {
                    type: Type.INTEGER,
                    description: "Nivel de formalidad del 1 al 5.",
                  },
                  temporada: {
                    type: Type.STRING,
                    description: "Debe ser estrictamente uno de estos valores: verano, invierno, todo.",
                  },
                  box_ymin: {
                    type: Type.INTEGER,
                    description: "Coordenada Y superior (0 a 1000) donde empieza la prenda verticalmente.",
                  },
                  box_xmin: {
                    type: Type.INTEGER,
                    description: "Coordenada X izquierda (0 a 1000) donde empieza la prenda horizontalmente.",
                  },
                  box_ymax: {
                    type: Type.INTEGER,
                    description: "Coordenada Y inferior (0 a 1000) donde termina la prenda verticalmente.",
                  },
                  box_xmax: {
                    type: Type.INTEGER,
                    description: "Coordenada X derecha (0 a 1000) donde termina la prenda horizontalmente.",
                  }
                },
                required: ["nombre", "categoria", "color", "formalidad", "temporada", "box_ymin", "box_xmin", "box_ymax", "box_xmax"],
              },
            },
          },
          required: ["prendas"],
        }
      : {
          type: Type.OBJECT,
          properties: {
            nombre: {
              type: Type.STRING,
              description: "Nombre de la prenda de forma descriptiva, sofisticada y elegante.",
            },
            categoria: {
              type: Type.STRING,
              description: "Debe ser estrictamente uno de estos valores: top, pantalon, calzado, accesorio.",
            },
            color: {
              type: Type.STRING,
              description: "Código de color hexadecimal representativo de la prenda (ej: '#1E3A8A').",
            },
            formalidad: {
              type: Type.INTEGER,
              description: "Nivel de formalidad del 1 al 5.",
            },
            temporada: {
              type: Type.STRING,
              description: "Debe ser estrictamente uno de estos valores: verano, invierno, todo.",
            },
          },
          required: ["nombre", "categoria", "color", "formalidad", "temporada"],
        };

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      })
    );

    if (!response.text) {
      throw new Error("No se obtuvo respuesta de la prenda del modelo.");
    }

    let cleanText = response.text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    const parsedResponse = JSON.parse(cleanText);
    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Error en analizar-prenda, aplicando fallback de atelier:", error);
    const { isMulti } = req.body;
    if (isMulti) {
      res.json({
        prendas: [
          {
            nombre: "Americana vintage de botonadura simple",
            categoria: "top",
            color: "#1d2b42",
            formalidad: 4,
            temporada: "todo",
            box_ymin: 150,
            box_xmin: 150,
            box_ymax: 850,
            box_xmax: 850
          }
        ],
        _is_fallback: true
      });
    } else {
      res.json({
        nombre: "Chaqueta estructurada de sastre clásica",
        categoria: "top",
        color: "#1d2b42",
        formalidad: 4,
        temporada: "todo",
        _is_fallback: true
      });
    }
  }
});

// 3. GENERAR LOOKS DE EVENTO
app.post("/api/generar-looks", async (req, res) => {
  try {
    const { ocasion, clima, formaCara, peloActual, barbaActual, armario } = req.body;

    if (!ocasion || !clima) {
       res.status(400).json({ error: "Se requiere especificar la ocasión y el clima." });
       return;
    }

    if (!armario || !Array.isArray(armario) || armario.length === 0) {
       res.status(400).json({ error: "Tu armario está vacío. Sube al menos un par de prendas para que el estilista organice tus looks." });
       return;
    }

    const ai = getGenAI();

    // Prepare a highly descriptive prompt containing user characteristics and inventory items with exact IDs
    const inventoryText = armario
      .map(
        (item, index) =>
          `${index + 1}. [ID: "${item.id}"] Nombre: "${item.nombre}", Categoría: "${item.categoria}", Color: "${item.color}", Nivel de Formalidad: ${item.formalidad}/5, Temporada: "${item.temporada}"`
      )
      .join("\n");

    const prompt = `Actúa como el estilista jefe de un salón de imagen masculina de lujo llamado ESPEJO.
Analiza la fisionomía del usuario:
- Forma de cara: ${formaCara || "No especificada"}
- Pelo actual: ${peloActual || "No especificado"}
- Barba actual: ${barbaActual || "No especificada"}

Recomendación requerida para el siguiente contexto:
- Ocasión/Evento: ${ocasion}
- Clima y temperatura: ${clima}

Inventario disponible de su propio Armario (USAR EXCLUSIVAMENTE ESTOS Ids para componer los looks):
${inventoryText}

Tu tarea:
1. Diseña de 2 a 3 looks sofisticados perfectos para la ocasión y el clima.
2. Cada look DEBE componerse de prendas presentes en el inventario. Proporciona sus IDs exactos en el campo 'id_prendas'. ¡Está TOTALMENTE PROHIBIDO inventar IDs o incluir prendas que no estén en la lista de arriba!
3. Explica detalladamente y en lenguaje editorial de alta costura el porqué de esta combinación ('porque').
4. Aconseja sobre el corte de cabello óptimo adaptado a su forma de cara ('pelo_sugerido') para estilizar su silueta. Si consideras que su peinado o corte actual ("${peloActual || "No especificado"}") ya es ideal y encaja de maravilla, indícalo expresamente afirmando que su estilo actual de pelo es perfecto y describe por qué.
5. Aconseja sobre el estilo de barba óptimo adaptado a su rostro ('barba_sugerida') para balancear sus facciones. Si consideras que su barba actual o afeitado ("${barbaActual || "No especificado"}") ya es óptimo y armoniza a la perfección, indícalo expresamente diciendo que su estilo de barba actual es perfecto y describe por qué.
6. Ofrece un truco o truco práctico del barbero ('consejo_barberia') para mantener o lucir este estilo.

Responde estrictamente utilizando el esquema de formato JSON siguiente.`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              looks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    titulo: {
                      type: Type.STRING,
                      description: "Nombre del look aristocrático o sofisticado (ej: 'El Conquistador de Otoño', 'Elegancia Desenfadada en Lino').",
                    },
                    id_prendas: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Colección de IDs exactos seleccionados del inventario de ropa que forman el look coordinado.",
                    },
                    porque: {
                      type: Type.STRING,
                      description: "Explicación impecable del estilista sobre la armonía del look, colores y tejidos elegidos.",
                    },
                    pelo_sugerido: {
                      type: Type.STRING,
                      description: "Peinado o corte de cabello recomendado para compensar y realzar su forma de rostro.",
                    },
                    barba_sugerida: {
                      type: Type.STRING,
                      description: "Diseño de barba sugerido para su fisionomía.",
                    },
                    consejo_barberia: {
                      type: Type.STRING,
                      description: "Truco práctico de barbería clásica (aplicación de ceras, aceites, perfilados, etc.) para este peinado/barba.",
                    },
                  },
                  required: ["titulo", "id_prendas", "porque", "pelo_sugerido", "barba_sugerida", "consejo_barberia"],
                },
              },
            },
            required: ["looks"],
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("No se obtuvo respuesta refinada de looks del modelo.");
    }

    const looksData = JSON.parse(response.text.trim());
    res.json(looksData);
  } catch (error: any) {
    console.error("Error en generar-looks, aplicando destilación sastrera local de gracia:", error);
    try {
      const { ocasion = "Evento distinguido", clima = "Templado", peloActual, barbaActual, armario = [] } = req.body;
      
      const tops = armario.filter((p: any) => p.categoria === "top");
      const pantalones = armario.filter((p: any) => p.categoria === "pantalon");
      const calzados = armario.filter((p: any) => p.categoria === "calzado");
      const accesorios = armario.filter((p: any) => p.categoria === "accesorio");

      const look1Ids: string[] = [];
      const look2Ids: string[] = [];

      if (tops.length > 0) {
        look1Ids.push(tops[0].id);
        look2Ids.push(tops[tops.length - 1].id);
      }
      if (pantalones.length > 0) {
        look1Ids.push(pantalones[0].id);
        look2Ids.push(pantalones[pantalones.length - 1].id);
      }
      if (calzados.length > 0) {
        look1Ids.push(calzados[0].id);
        look2Ids.push(calzados[calzados.length - 1].id);
      }
      if (accesorios.length > 0) {
        look1Ids.push(accesorios[0].id);
      }

      if (look1Ids.length === 0 && armario.length > 0) {
        look1Ids.push(armario[0].id);
      }
      if (look2Ids.length === 0 && armario.length > 1) {
        look2Ids.push(armario[1].id);
      }

      const fallbackLooks = {
        looks: [
          {
            titulo: "Atuendo Espejo Classic (Local)",
            id_prendas: look1Ids,
            porque: `Combinación idónea extraída del armario para tu cita de ${ocasion} (${clima}). Balance de tonos con un acabado sobrio y simetrías elegantes.`,
            pelo_sugerido: peloActual || "Corte clásico texturizado",
            barba_sugerida: barbaActual || "Perfilado limpio de barbería",
            consejo_barberia: "Aplica cera mate premium para estructurar el cabello sin brillo excesivo."
          }
        ],
        _is_fallback: true
      };

      if (look2Ids.length > 0) {
        fallbackLooks.looks.push({
          titulo: "Casual Inteligente Espejo",
          id_prendas: look2Ids,
          porque: `Segunda propuesta sastrera coordinando prendas formales e informales de tu armario. Ideal para destacar en el evento de ${ocasion}.`,
          pelo_sugerido: peloActual || "Corte clásico texturizado",
          barba_sugerida: barbaActual || "Perfilado limpio de barbería",
          consejo_barberia: "Utiliza un sérum hidratante de argán para nutrir y aportar suavidad al vello facial."
        });
      }

      res.json(fallbackLooks);
    } catch (innerError) {
      res.status(500).json({ error: "Fallo al coordinar looks locales." });
    }
  }
});

// 4. VER EN EL ESPEJO (GENERACIÓN DE IMAGEN - NANO BANANA / GEMINI-2.5-FLASH-IMAGE)
app.post("/api/generar-imagen", async (req, res) => {
  try {
    const { faceImage, estiloCabello, estiloBarba, fullBody, prendasTexto, customFullBodyImage, prendasDetalle } = req.body;

    if (!faceImage && !customFullBodyImage) {
      res.status(400).json({ error: "Por favor, sube tu foto de rostro en 'Tu espejo' o tu foto de cuerpo completo primero." });
      return;
    }

    if (!estiloCabello || !estiloBarba) {
      res.status(400).json({ error: "Faltan las recomendaciones de estilo para simular la imagen." });
      return;
    }

    const isUsingCustomBody = !!(fullBody && customFullBodyImage);
    const activeImageSource = isUsingCustomBody ? customFullBodyImage : faceImage;
    const { mimeType, data } = parseDataUri(activeImageSource);
    const ai = getGenAI();

    console.log(`Generando imagen simulada con gemini-2.5-flash-image (fullBody: ${!!fullBody}, customBody: ${isUsingCustomBody})...`);

    let promptText = "";
    let aspectRatio: "1:1" | "3:4" = "1:1";

    if (fullBody) {
      aspectRatio = "3:4";
      if (isUsingCustomBody) {
        promptText = `CRITICAL INSTRUCTION: You must completely change the clothes of the person in the provided input full-body photograph. 
Do NOT keep or output their original shirt, suit, top, trousers, jeans, or shoes.
Fully replace their entire outfit with the specified new ensemble.
New outfit garments to wear:
- ${prendasTexto || "a tailored blazer and formal chino trousers with elegant shoes"}

Keep their exact face, gaze, hair color, physique, stance, hands, and the general pose from the original picture. Preserve the high-fashion background scene nicely. Fit and drape the new tailoring items (tops, pants, shoes) beautifully onto their body proportions as a highly realistic menswear editorial digital outfit replacement. Extremely photorealistic, high-fashion catalog magazine page quality.`;
      } else {
        promptText = `Generate a photorealistic, full-body high-fashion editorial sartorial photograph of the same man shown in the portrait face photo.
His facial identity, eyes, lips, ethnicity, beard, hair style, age, and skeletal structure must be matched perfectly with the provided visage photograph.
He must be standing elegantly in a stylish, full-body menswear posture, looking directly at the camera. He must be shown from head to toe.
He is wearing this complete tailored outfit combination:
- ${prendasTexto || "a tailored blazer and formal chino trousers with loafer shoes"}

The background is a tasteful, luxurious modern gentlemen's barber and sartorial atelier interior, with brass accents, warm wood paneling, and dramatic premium studio lighting. Focus on high-quality fabrics, professional tailoring drape, extremely sharp garment textures, and flawless visual style. High-fashion magazine editorial.`;
      }
    } else {
      promptText = `Generate a photorealistic, professional, high-fashion editorial portrait of this same man. Use the original photograph provided as the base.
Modify only his hair and beard to match these styling guides perfectly:
- Haircut suggested: "${estiloCabello}"
- Facial hair / Beard suggested: "${estiloBarba}"

Maintain his exact identity, eyes, lips, ethnicity, age, bone structure, and facial likeness from the original image. He should look neatly groomed, handsome, stylish, in a warm, dark, premium luxury barber shop interior backdrop with subtle brass and mahogany warm wood lighting. Output should be high quality, sharp, balanced contrast, as a clean editorial magazine portrait picture.`;
    }

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      })
    );

    let base64Output: string | null = null;

    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Output = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Output) {
      console.log("Response structure:", JSON.stringify(response?.candidates?.[0]?.content));
      throw new Error("No se pudo extraer la imagen simulada de la respuesta de Nano Banana. Verifica que tu API key admite generación/edición de imágenes.");
    }

    res.json({
      imageUrl: `data:image/png;base64,${base64Output}`,
    });
  } catch (error: any) {
    const { faceImage, estiloCabello, estiloBarba, fullBody, prendasTexto, customFullBodyImage, prendasDetalle } = req.body;
    console.error("Error en generar-imagen, ejecutando fallback elegante:", error);
    
    // Si la gema de imagen falla por cuota o crédito, creamos un boceto sastrero de primera calidad que dibuja vectorialmente su atuendo coordinado
    try {
      const activeFallbackPhoto = (fullBody && customFullBodyImage) ? customFullBodyImage : faceImage;
      
      const findColorByCategory = (category: string, defaultColor: string) => {
        if (!prendasDetalle || !Array.isArray(prendasDetalle)) return defaultColor;
        const g = prendasDetalle.find((p: any) => p.categoria === category);
        return g && g.color ? g.color : defaultColor;
      };

      const topColor = findColorByCategory("top", "#C9A35B");
      const pantColor = findColorByCategory("pantalon", "#3A3225");
      const shoeColor = findColorByCategory("calzado", "#8C7440");

      let fallbackSvg = "";
      if (fullBody) {
        fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 600" width="100%" height="100%">
  <defs>
    <filter id="brass-duotone">
      <feColorMatrix type="matrix" values="
        0.393 0.769 0.189 0 0
        0.349 0.686 0.168 0 0
        0.272 0.534 0.131 0 0
        0.000 0.000 0.000 1 0" />
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.1" />
        <feFuncG type="linear" slope="0.9" />
        <feFuncB type="linear" slope="0.6" />
      </feComponentTransfer>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="#16130E" />
  <rect x="15" y="15" width="420" height="570" fill="none" stroke="#C9A35B" stroke-width="1.5" />
  <rect x="22" y="22" width="406" height="556" fill="none" stroke="#3A3225" stroke-width="0.5" />

  <line x1="225" y1="22" x2="225" y2="440" stroke="#3A3225" stroke-width="1" stroke-dasharray="3,3" />
  <line x1="22" y1="440" x2="428" y2="440" stroke="#C9A35B" stroke-width="1" />

  <g transform="translate(45, 80)">
    <text x="65" y="-15" font-family="'Outfit', sans-serif" font-size="10" fill="#C9A35B" font-weight="900" letter-spacing="2" text-anchor="middle">FOTOGRAFÍA BASE</text>
    <rect width="130" height="150" fill="#1E1A13" stroke="#3A3225" stroke-width="1.5" />
    <image href="${activeFallbackPhoto}" width="130" height="150" preserveAspectRatio="xMidYMid slice" filter="url(#brass-duotone)" />
    <path d="M 0 10 L 0 0 L 10 0" fill="none" stroke="#C9A35B" stroke-width="1.5" />
    <path d="M 120 0 L 130 0 L 130 10" fill="none" stroke="#C9A35B" stroke-width="1.5" />
    <path d="M 0 140 L 0 150 L 10 150" fill="none" stroke="#C9A35B" stroke-width="1.5" />
    <path d="M 120 150 L 130 150 L 130 140" fill="none" stroke="#C9A35B" stroke-width="1.5" />
  </g>

  <!-- MANIQUÍ SARTORIAL CON ROPA DEL LOOK DETALLADA -->
  <g transform="translate(255, 60)">
    <text x="70" y="5" font-family="'Outfit', sans-serif" font-size="10" fill="#C9A35B" font-weight="900" letter-spacing="2" text-anchor="middle" stroke="none">FITTING SARTORIAL</text>
    
    <!-- Soporte y Percha del Maniquí -->
    <path d="M 70 30 Q 70 18 64 12 Q 70 6 76 12 Q 70 18 70 30" fill="none" stroke="#C9A35B" stroke-width="1.5" />
    <line x1="70" y1="30" x2="70" y2="330" stroke="#8C7440" stroke-width="1.5" stroke-opacity="0.6" />
    <path d="M 45 330 L 70 315 L 95 330" fill="none" stroke="#C9A35B" stroke-width="2" />
    
    <!-- Parte Superior (Blazer / Jacket / Top) con color real -->
    <path d="M 58 40 L 82 40 L 115 65 L 105 150 L 85 155 L 70 160 L 55 155 L 35 150 L 25 65 Z" fill="${topColor}" fill-opacity="0.9" stroke="#F3ECDD" stroke-width="1" stroke-opacity="0.7" />
    <path d="M 58 40 L 70 95 L 82 40" fill="none" stroke="#C9A35B" stroke-width="1.5" />
    <path d="M 70 95 L 70 155" fill="none" stroke="#C9A35B" stroke-width="1" stroke-dasharray="2,2" />
    <circle cx="70" cy="115" r="2" fill="#F3ECDD" />
    <circle cx="70" cy="130" r="2" fill="#F3ECDD" />

    <!-- Parte Inferior (Pantalón / Pantalon) con color real -->
    <path d="M 50 155 L 90 155 L 95 275 L 77 275 L 70 195 L 63 275 L 45 275 Z" fill="${pantColor}" fill-opacity="0.9" stroke="#F3ECDD" stroke-width="1" stroke-opacity="0.7" />
    <line x1="70" y1="155" x2="70" y2="195" stroke="#C9A35B" stroke-width="1" stroke-opacity="0.5" />
    
    <!-- Calzado (Zapatos / Calzado) con color real -->
    <path d="M 45 275 L 35 290 L 52 292 L 55 275 Z" fill="${shoeColor}" fill-opacity="0.95" stroke="#C9A35B" stroke-width="0.8" />
    <path d="M 95 275 L 105 290 L 88 292 L 85 275 Z" fill="${shoeColor}" fill-opacity="0.95" stroke="#C9A35B" stroke-width="0.8" />
  </g>

  <g transform="translate(45, 465)">
    <text x="0" y="5" font-family="'Outfit', sans-serif" font-size="9" fill="#8C7440" font-weight="bold" letter-spacing="3" text-anchor="start">ATUENDO COORDINADO</text>
    <text x="0" y="28" font-family="'Fraunces', serif" font-size="11" fill="#F3ECDD" font-weight="bold" font-style="italic" text-anchor="start">
      ${(prendasTexto || "ESTILO SASTRERO DETALLADO").substring(0, 48)}
    </text>
    <text x="0" y="50" font-family="'Outfit', sans-serif" font-size="10" fill="#A89C82" text-anchor="start">
      Peinado: <tspan fill="#C9A35B" font-weight="bold">${estiloCabello}</tspan> | Barba: <tspan fill="#C9A35B" font-weight="bold">${estiloBarba}</tspan>
    </text>
    
    <rect x="290" y="-10" width="70" height="70" fill="none" stroke="#C9A35B" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2,2" transform="rotate(5, 305, 10)" />
    <text x="325" y="20" font-family="'Fraunces', serif" font-size="8" fill="#C9A35B" font-weight="900" letter-spacing="1" text-anchor="middle" stroke="none" transform="rotate(5, 305, 10)" opacity="0.7">ESPEJO</text>
    <text x="325" y="35" font-family="'Outfit', sans-serif" font-size="6" fill="#F3ECDD" letter-spacing="0.5" text-anchor="middle" stroke="none" transform="rotate(5, 305, 10)" opacity="0.6">COMPROBADO</text>
  </g>

  <text x="225" y="50" font-family="'Fraunces', serif" font-size="20" fill="#F3ECDD" font-weight="bold" letter-spacing="4" text-anchor="middle">ESPEJO EDITORIAL</text>
  <text x="225" y="560" font-family="'Outfit', sans-serif" font-size="8" fill="#8C7440" letter-spacing="2" text-anchor="middle">PREVISUALIZACIÓN DE ALTA COSTURA • DISEÑO DIGITAL</text>
</svg>`;
      } else {
        fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <filter id="brass-duotone">
      <feColorMatrix type="matrix" values="
        0.393 0.769 0.189 0 0
        0.349 0.686 0.168 0 0
        0.272 0.534 0.131 0 0
        0.000 0.000 0.000 1 0" />
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.1" />
        <feFuncG type="linear" slope="0.9" />
        <feFuncB type="linear" slope="0.6" />
      </feComponentTransfer>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="#16130E" />
  
  <g stroke="#3A3225" stroke-opacity="0.4" stroke-width="0.5">
    <line x1="25" y1="0" x2="25" y2="500" />
    <line x1="475" y1="0" x2="475" y2="500" />
    <line x1="0" y1="25" x2="500" y2="25" />
    <line x1="0" y1="475" x2="500" y2="475" />
    <circle cx="250" cy="250" r="210" fill="none" stroke="#C9A35B" stroke-opacity="0.15" stroke-dasharray="4,4" />
  </g>

  <rect x="15" y="15" width="470" height="470" fill="none" stroke="#C9A35B" stroke-width="1.5" />
  <rect x="22" y="22" width="456" height="456" fill="none" stroke="#3A3225" stroke-width="0.5" />

  <g transform="translate(130, 80)">
    <rect width="240" height="240" fill="#1E1A13" stroke="#3A3225" stroke-width="1" />
    <image href="${faceImage}" width="240" height="240" preserveAspectRatio="xMidYMid slice" filter="url(#brass-duotone)" />
    <path d="M 0 15 L 0 0 L 15 0" fill="none" stroke="#C9A35B" stroke-width="2" />
    <path d="M 225 0 L 240 0 L 240 15" fill="none" stroke="#C9A35B" stroke-width="2" />
    <path d="M 0 225 L 0 240 L 15 240" fill="none" stroke="#C9A35B" stroke-width="2" />
    <path d="M 225 240 L 240 240 L 240 225" fill="none" stroke="#C9A35B" stroke-width="2" />
  </g>

  <text x="250" y="55" font-family="'Fraunces', serif" font-size="18" fill="#F3ECDD" font-weight="bold" letter-spacing="4" text-anchor="middle">ESPEJO BOUTIQUE</text>
  <text x="250" y="350" font-family="'Outfit', sans-serif" font-size="10" fill="#C9A35B" font-weight="900" letter-spacing="3" text-anchor="middle">RECOMENDACIÓN DE GROOMING</text>
  
  <rect x="50" y="365" width="400" height="1" fill="#3A3225" />

  <text x="250" y="390" font-family="'Fraunces', serif" font-size="14" fill="#F3ECDD" font-style="italic" text-anchor="middle">"${estiloCabello}"</text>
  <text x="250" y="415" font-family="'Outfit', sans-serif" font-size="10" fill="#A89C82" letter-spacing="1" text-anchor="middle">Con barba sugerida: <tspan fill="#C9A35B" font-weight="bold">${estiloBarba}</tspan></text>
  
  <text x="250" y="450" font-family="'Outfit', sans-serif" font-size="8" fill="#8C7440" letter-spacing="2" text-anchor="middle">PREVISUALIZACIÓN DIGITAL • CORTE DE CABELLO</text>
</svg>`;
      }

      const base64Svg = Buffer.from(fallbackSvg).toString("base64");
      const imageUrl = `data:image/svg+xml;base64,${base64Svg}`;
      res.json({ imageUrl, fallback: true });
    } catch (fallbackError) {
      console.error("Fallo crítico en generación de fallback:", fallbackError);
      res.status(500).json({
        error: error.message || "Error al simular tu retrato con la IA de imagen.",
      });
    }
  }
});

// 5. AUDITORÍA INTELIGENTE DE ARMARIO Y VINTED
app.post("/api/auditar-armario", async (req, res) => {
  try {
    const { armario, rostro } = req.body;

    if (!armario || !Array.isArray(armario) || armario.length === 0) {
      res.status(400).json({ error: "Sube y registra al menos un par de prendas en tu armario para poder realizar la auditoría." });
      return;
    }

    const ai = getGenAI();

    const inventoryText = armario
      .map(
        (item: any, index: number) =>
          `${index + 1}. [ID: "${item.id}"] Nombre: "${item.nombre}", Categoría: "${item.categoria}", Color: "${item.color}", Formalidad: ${item.formalidad}/5, Temporada: "${item.temporada}", Descripción/Notas: "${item.descripcion || "Ninguna"}"`
      )
      .join("\n");

    const prompt = `Actúas como el maestro sastre y estilista jefe de la boutique premium de caballeros ESPEJO.
Analiza con exquisitez literaria e impecable gusto de alta costura el actual inventario de ropa de este caballero.

Perfil del Cliente:
- Fisionomía de Rostro: ${rostro?.forma_cara || "No especificada"}
- Corte de Cabello Actual: ${rostro?.pelo_actual || "No especificado"}
- Estilo de Barba Actual: ${rostro?.barba_actual || "No especificada"}
- Clave de Estilo: ${rostro?.clave || "Consistencia Clásica"}

Inventario de Ropa Registrado (Realiza la auditoría sobre este conjunto):
${inventoryText}

Tu misión:
1. Redacta un análisis sastrero crítico ('analisis_editorial') impecable de 2 párrafos cortos en español. Debe destacar con elegancia las virtudes, la coordinación de colores, los balances térmicos/temporales y los huecos en la formalidad de su armario.
2. Calcula una nota numérica ('grado_cohesion_porcentaje') de 0 a 100 de cohesión, basándote en la sinergia y versatilidad de sus prendas.
3. Determina de 1 a 2 vacíos o necesidades ('necesita'): prendas específicas que NO tiene pero que le complementarían de una forma milagrosa para armar conjuntos para toda ocasión.
4. Identifica hasta 2 prendas redundantes, repetitivas o de menor calidad estilística ('sobran') de las que el cliente debería desprenderse para renovar o purificar su armario. Para cada prenda seleccionada en exceso:
   - Indica su ID exacto ('id_prenda') para cruzarlo en el cliente.
   - Da el veredicto del estilista ('motivo_descarte') explicando con elegancia por qué es prescindible o de baja sinergia.
   - Recomienda un precio digno de reventa en euros ('precio_sugerido_vinted') para la plataforma Vinted.
   - Escribe un título llamativo y optimizado para SEO en Vinted ('titulo_vinted') para una máxima atracción.
   - Escribe una detallada y persuasiva descripción narrativa para el anuncio de Vinted ('descripcion_vinted') en español elegante, describiendo sus virtudes, su encaje en un atuendo de calidad y hashtags premium como #sartorial, #smartcasual o #slowfashion.

Responde obligatoriamente en estricto formato JSON, siguiendo el esquema estructurado detallado a continuación.`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analisis_editorial: {
                type: Type.STRING,
                description: "Elegante análisis boutique de la estructura cromática y formal de su armario actual.",
              },
              grado_cohesion_porcentaje: {
                type: Type.INTEGER,
                description: "Grado de cohesión estilística de 0 a 100.",
              },
              necesita: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    prenda_sugerida: {
                      type: Type.STRING,
                      description: "Nombre elegante de la prenda faltante (ej: 'Mocasines Tassel de color tabaco').",
                    },
                    categoria: {
                      type: Type.STRING,
                      description: "Debe ser estrictamente uno de los siguientes: top, pantalon, calzado, accesorio.",
                    },
                    por_que_falta: {
                      type: Type.STRING,
                      description: "Por qué es esencial esta prenda para desbloquear el máximo potencial de combinaciones en su armario actual.",
                    },
                    consejo_estilovital: {
                      type: Type.STRING,
                      description: "Consejo de estilo rápido de barbero/sastre clásico.",
                    },
                  },
                  required: ["prenda_sugerida", "categoria", "por_que_falta", "consejo_estilovital"],
                },
              },
              sobran: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id_prenda: {
                      type: Type.STRING,
                      description: "ID de la prenda analizada que se sugiere de baja sinergia o redundante.",
                    },
                    motivo_descarte: {
                      type: Type.STRING,
                      description: "Motivo por el cual no encaja de forma premium en el armario.",
                    },
                    precio_sugerido_vinted: {
                      type: Type.INTEGER,
                      description: "Tasación de reventa recomendada en euros (€).",
                    },
                    titulo_vinted: {
                      type: Type.STRING,
                      description: "Título irresistible de alta conversión optimizado para Vinted.",
                    },
                    descripcion_vinted: {
                      type: Type.STRING,
                      description: "Descripción de venta estructurada con tono slow fashion, tejidos y hashtags relevantes.",
                    },
                  },
                  required: ["id_prenda", "motivo_descarte", "precio_sugerido_vinted", "titulo_vinted", "descripcion_vinted"],
                },
              },
            },
            required: ["analisis_editorial", "grado_cohesion_porcentaje", "necesita", "sobran"],
          },
        },
      })
    );

    if (!response.text) {
      throw new Error("No se obtuvo respuesta del sastre virtual.");
    }

    const auditData = JSON.parse(response.text.trim());
    res.json(auditData);
  } catch (error: any) {
    console.error("Error en auditar-armario, aplicando sastería local de gracia:", error);
    try {
      const { armario = [] } = req.body;
      
      const numPrendas = armario.length;
      let cohesion = 50;
      if (numPrendas > 3) cohesion = 75;
      if (numPrendas > 6) cohesion = 90;

      const fallbackAudit = {
        analisis_editorial: "Tu guardarropa muestra un criterio enfocado en la funcionalidad práctica. Cuenta con excelentes prendas de base sastrera. Te recomendamos incorporar algún calzado de piel noble o una sobrecamisa estructurada de lino para expandir la versatilidad de tus combinaciones formales.",
        grado_cohesion_porcentaje: cohesion,
        necesita: [
          {
            prenda_sugerida: "Sobrecamisa de lino italiano beige",
            categoria: "top",
            por_que_falta: "Para complementar tus prendas más ligeras y añadir una capa de textura sofisticada idónea para transiciones de temporada.",
            consejo_estilovital: "Combínala con zapatos tipo mocasín y mangas sutilmente remangadas."
          }
        ],
        sobran: armario.length > 3 ? [
          {
            id_prenda: armario[armario.length - 1].id,
            motivo_descarte: "Esta prenda presenta redundancia cromática y textil respecto a tus opciones de sastrería principales.",
            precio_sugerido_vinted: 29,
            titulo_vinted: "Prenda de Sastrería de Alta Calidad",
            descripcion_vinted: "Prenda de excelente caída y patronaje clásico impecable. Muy cuidada, ideal para combinar con chinos o vaqueros oscuros en un conjunto smart casual de categoría. #slowfashion #sartorial #slowwear"
          }
        ] : [],
        _is_fallback: true
      };

      res.json(fallbackAudit);
    } catch (innerError) {
      res.status(500).json({ error: "Fallo al componer auditoría local." });
    }
  }
});

// Vite server connection mapping depending on environment
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ESPEJO] Servidor full-stack corriendo en puerto ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Fallo al iniciar el servidor full-stack:", err);
});
