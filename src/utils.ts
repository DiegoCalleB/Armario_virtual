import { Prenda } from "./types";

/**
 * Resizes an image base64 data string to a maximum dimension of maxDimension (768px)
 * using HTML Canvas in client side.
 */
export function resizeImage(base64Str: string, maxDimension = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = (err) => {
      reject(new Error("No se pudo cargar la imagen para su procesamiento."));
    };
  });
}

/**
 * Utility to convert loaded File object into browser Base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Returns typical styling colors based on categories to back up color presentation
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case "top":
      return "Parte Superior";
    case "pantalon":
      return "Parte Inferior";
    case "calzado":
      return "Calzado";
    case "accesorio":
      return "Accesorio";
    default:
      return category;
  }
}

/**
 * Programmatic client-side background removal and advanced sharpening upscaler.
 * Serves as a high-performance local processor or fallback.
 */
export function removeBackgroundAndSharpenCanvas(base64Str: string, tolerance = 48): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      try {
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
          resolve(base64Str);
          return;
        }

        const w = img.width;
        const h = img.height;
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCtx.drawImage(img, 0, 0);

        const imgData = tempCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Sample the four corners to get representative background colors
        const corners = [
          { r: data[0], g: data[1], b: data[2] }, // Top-Left
          { r: data[(w - 1) * 4], g: data[(w - 1) * 4 + 1], b: data[(w - 1) * 4 + 2] }, // Top-Right
          { r: data[(h - 1) * w * 4], g: data[(h - 1) * w * 4 + 1], b: data[(h - 1) * w * 4 + 2] }, // Bottom-Left
          { r: data[((h - 1) * w + (w - 1)) * 4], g: data[((h - 1) * w + (w - 1)) * 4 + 1], b: data[((h - 1) * w + (w - 1)) * 4 + 2] } // Bottom-Right
        ];

        // Let's use the average corner color as our target background key
        const bgR = Math.round(corners.reduce((sum, c) => sum + c.r, 0) / 4);
        const bgG = Math.round(corners.reduce((sum, c) => sum + c.g, 0) / 4);
        const bgB = Math.round(corners.reduce((sum, c) => sum + c.b, 0) / 4);

        // Remove background pixels by measuring color distance
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Euclidean color distance
          const dist = Math.sqrt(
            Math.pow(r - bgR, 2) +
            Math.pow(g - bgG, 2) +
            Math.pow(b - bgB, 2)
          );

          if (dist < tolerance) {
            // Background color - make it transparent
            data[i + 3] = 0;
          } else if (dist < tolerance + 15) {
            // Feather edge slightly for soft, premium cutout edges
            const ratio = (dist - tolerance) / 15;
            data[i + 3] = Math.round(ratio * 255);
          }
        }
        tempCtx.putImageData(imgData, 0, 0);

        // Advanced resolution improvement: Create a larger high-res canvas (1.5x scale)
        const scale = 1.5;
        const resCanvas = document.createElement("canvas");
        const resCtx = resCanvas.getContext("2d");
        if (!resCtx) {
          resolve(tempCanvas.toDataURL("image/png"));
          return;
        }

        const targetW = Math.round(w * scale);
        const targetH = Math.round(h * scale);
        resCanvas.width = targetW;
        resCanvas.height = targetH;

        // Apply superior scaling settings
        resCtx.imageSmoothingEnabled = true;
        resCtx.imageSmoothingQuality = "high";
        resCtx.drawImage(tempCanvas, 0, 0, targetW, targetH);

        // Apply standard laplacian/sharpening filter to reveal texture and weave
        const sData = resCtx.getImageData(0, 0, targetW, targetH);
        const pixels = sData.data;
        const width = sData.width;
        const height = sData.height;

        // Create a copy for reading while writing
        const copy = new Uint8ClampedArray(pixels);

        // Convolution matrix: [0, -0.4, 0, -0.4, 2.6, -0.4, 0, -0.4, 0] (moderate sharpening)
        const weights = [
           0, -0.4,  0,
          -0.4, 2.6, -0.4,
           0, -0.4,  0
        ];
        const side = 3;
        const halfSide = 1;

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const dstOff = (y * width + x) * 4;
            let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

            for (let cy = 0; cy < side; cy++) {
              for (let cx = 0; cx < side; cx++) {
                const scy = y + cy - halfSide;
                const scx = x + cx - halfSide;
                const srcOff = (scy * width + scx) * 4;
                const wt = weights[cy * side + cx];

                rSum += copy[srcOff] * wt;
                gSum += copy[srcOff + 1] * wt;
                bSum += copy[srcOff + 2] * wt;
                aSum += copy[srcOff + 3] * wt;
              }
            }

            // Write back clamped values
            pixels[dstOff] = Math.max(0, Math.min(255, rSum));
            pixels[dstOff + 1] = Math.max(0, Math.min(255, gSum));
            pixels[dstOff + 2] = Math.max(0, Math.min(255, bSum));
            // Keep alpha transparent/feathered as calculated before
            pixels[dstOff + 3] = copy[dstOff + 3];
          }
        }

        resCtx.putImageData(sData, 0, 0);
        resolve(resCanvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Error in fallback background removal canvas:", err);
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
}

export interface InfoCapa {
  nivel: number;
  etiqueta: string;
  color: string; // text/border color
  bg: string;    // bg color
  desc: string;
}

export function obtenerCapaDePrenda(prenda: Prenda): InfoCapa {
  if (prenda.categoria !== "top") {
    if (prenda.categoria === "pantalon") {
      return {
        nivel: 10,
        etiqueta: "Parte Inferior",
        color: "text-zinc-600 border border-zinc-200/50",
        bg: "bg-zinc-100/70",
        desc: "Pantalón o parte inferior"
      };
    }
    if (prenda.categoria === "calzado") {
      return {
        nivel: 20,
        etiqueta: "Calzado",
        color: "text-amber-700 border border-amber-200/50",
        bg: "bg-amber-50/70",
        desc: "Zapatos / Zapatillas"
      };
    }
    return {
      nivel: 30,
      etiqueta: "Accesorio",
      color: "text-teal-700 border border-teal-200/50",
      bg: "bg-teal-50/70",
      desc: "Accesorio / Complemento"
    };
  }

  const nombreLower = (prenda.nombre || "").toLowerCase();
  const descLower = (prenda.descripcion || "").toLowerCase();
  const tejidoLower = (prenda.tejido || "").toLowerCase();
  const tagsStr = (prenda.tags || []).join(" ").toLowerCase();

  const fullText = `${nombreLower} ${descLower} ${tejidoLower} ${tagsStr}`;

  // 1. Check for Outer Layer (Abrigo, chaqueta, blazer, etc.)
  if (
    fullText.includes("abrigo") ||
    fullText.includes("chaqueta") ||
    fullText.includes("cazadora") ||
    fullText.includes("gabardina") ||
    fullText.includes("parca") ||
    fullText.includes("parka") ||
    fullText.includes("plumifero") ||
    fullText.includes("plumífero") ||
    fullText.includes("chubasquero") ||
    fullText.includes("americana") ||
    fullText.includes("blazer") ||
    fullText.includes("sobretodo") ||
    fullText.includes("trench") ||
    fullText.includes("bomber") ||
    fullText.includes("chupa") ||
    fullText.includes("cortavientos") ||
    fullText.includes("chaleco") ||
    fullText.includes("jacket") ||
    fullText.includes("coat") ||
    fullText.includes("cardigan grueso")
  ) {
    return {
      nivel: 4,
      etiqueta: "Capa Exterior (Capa 4)",
      color: "text-rose-700 border border-rose-200/50",
      bg: "bg-rose-50/70",
      desc: "Abrigo / Chaqueta / Americana"
    };
  }

  // 2. Check for Warm Layer (Jersey, sudadera, etc.)
  if (
    fullText.includes("jersey") ||
    fullText.includes("suéter") ||
    fullText.includes("sueter") ||
    fullText.includes("sudadera") ||
    fullText.includes("cardigan") ||
    fullText.includes("cárdigan") ||
    fullText.includes("sweater") ||
    fullText.includes("hoodie") ||
    fullText.includes("pull") ||
    fullText.includes("lana") ||
    fullText.includes("pashmina") ||
    fullText.includes("rebeca")
  ) {
    return {
      nivel: 3,
      etiqueta: "Capa de Abrigo (Capa 3)",
      color: "text-amber-700 border border-amber-200/50",
      bg: "bg-amber-50/70",
      desc: "Jersey / Sudadera / Punto"
    };
  }

  // 3. Check for Mid Layer (Camisa, blusa, polo, etc.)
  if (
    fullText.includes("camisa") ||
    fullText.includes("blusa") ||
    fullText.includes("polo") ||
    fullText.includes("camisola") ||
    fullText.includes("guayabera") ||
    fullText.includes("shirt")
  ) {
    return {
      nivel: 2,
      etiqueta: "Capa Intermedia (Capa 2)",
      color: "text-sky-700 border border-sky-200/50",
      bg: "bg-sky-50/70",
      desc: "Camisa / Blusa / Polo"
    };
  }

  // 4. Base Layer (Camiseta, top, t-shirt, tirantes, etc.)
  return {
    nivel: 1,
    etiqueta: "Capa Interior (Capa 1)",
    color: "text-emerald-700 border border-emerald-200/50",
    bg: "bg-emerald-50/70",
    desc: "Camiseta / Top básico"
  };
}

