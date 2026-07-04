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
