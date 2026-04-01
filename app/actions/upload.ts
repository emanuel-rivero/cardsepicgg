'use server';

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Server Action para persistir imagem enviada como Data URL em /public/uploads.
 *
 * Pipeline tecnico:
 * 1) valida formato base64;
 * 2) converte para Buffer;
 * 3) infere extensao de arquivo;
 * 4) cria diretorio destino se necessario;
 * 5) grava arquivo em disco;
 * 6) retorna URL publica relativa para renderizacao no frontend.
 */
export async function uploadImageServerAction(dataUrl: string, type: 'cards' | 'packs' | 'battles') {
  try {
    // 1. Validate Base64 string format
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string provided to server.');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 2. Determine extension
    let ext = '.jpg';
    if (mimeType.includes('webp')) ext = '.webp';
    if (mimeType.includes('png')) ext = '.png';

    // 3. Generate a unique, safe filename
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    
    // 4. Define local paths inside the Next.js standard `public` directory
    const publicDir = join(process.cwd(), 'public');
    const uploadDir = join(publicDir, 'uploads', type);
    const filepath = join(uploadDir, filename);

    // 5. Ensure the directory physically exists, creating it if needed
    await mkdir(uploadDir, { recursive: true });

    // 6. Write the binary Data Buffer directly to the computer's Disk!
    await writeFile(filepath, buffer);

    // 7. Return the relative URL path that Web browsers can use to load it
    return `/uploads/${type}/${filename}`;
  } catch (error: any) {
    console.error('SERVER ACTION ERROR (uploadImageServerAction):', error);
    throw new Error('Failed to save image file to server disk.');
  }
}
