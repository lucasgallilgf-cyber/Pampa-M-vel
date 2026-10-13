// Compressão de foto no próprio aparelho (só roda no navegador).
//
// Em vez de usar uma qualidade fixa (que dá resultados muito diferentes
// dependendo da foto — uma imagem cheia de textura/sujeira pode ficar com
// 800KB mesmo a 1280px), aqui a compressão persegue um TAMANHO ALVO: tenta
// combinações de dimensão e qualidade, da melhor pra pior, e fica com a
// primeira que couber no alvo. Se nenhuma couber, usa a menor que gerou.
//
// O resultado é sempre JPEG sem metadados (a conversão via canvas descarta
// EXIF/GPS), já com a orientação corrigida.

const ATTEMPTS: { maxDim: number; quality: number }[] = [
  { maxDim: 1280, quality: 0.72 },
  { maxDim: 1280, quality: 0.6 },
  { maxDim: 1280, quality: 0.5 },
  { maxDim: 1024, quality: 0.55 },
  { maxDim: 1024, quality: 0.45 },
  { maxDim: 800, quality: 0.5 },
];

function toJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
}

export async function compressImage(
  file: File,
  targetBytes: number
): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);

    const longest = Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    let best: Blob | null = null;
    let lastDim = 0;
    for (const attempt of ATTEMPTS) {
      const scale = Math.min(1, attempt.maxDim / longest);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      // Só redesenha quando a dimensão muda; entre tentativas da mesma
      // dimensão, só a qualidade do JPEG varia.
      if (Math.max(w, h) !== lastDim) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(bitmap, 0, 0, w, h);
        lastDim = Math.max(w, h);
      }
      const blob = await toJpegBlob(canvas, attempt.quality);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= targetBytes) {
        best = blob;
        break;
      }
    }
    bitmap.close();

    if (!best) return file;
    // Se a original já era menor que o resultado (foto pequena/já leve),
    // mantém a original só quando ela também já é JPEG.
    if (best.size >= file.size && file.type === "image/jpeg") return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([best], newName, { type: "image/jpeg" });
  } catch {
    // Formato não suportado etc. — devolve a original em vez de travar o
    // checklist (o envio direto aceita arquivos maiores).
    return file;
  }
}
