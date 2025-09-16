import { Base64Image } from '../types';

const TARGET_DIMENSION = 965;

interface ConversionOptions {
  cropToSquare: boolean;
}

/**
 * Converts an image file to a base64 string, with an option to crop it into a square.
 * All output images are converted to PNG format.
 * @param file The image file to convert.
 * @param options Options for conversion, e.g., whether to crop to a square.
 * @returns A promise that resolves to a Base64Image object.
 */
export const convertImageToBase64 = (file: File, options: ConversionOptions): Promise<Base64Image> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Read the file as a Data URL.
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      if (!event?.target?.result) {
        return reject(new Error("FileReader did not load the file."));
      }

      const img = new Image();
      img.src = event.target.result as string;

      // When the image is loaded, draw it to the canvas.
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('Could not get canvas 2D context.'));
        }

        if (options.cropToSquare) {
          // Standardize to 965x965 for headshots
          canvas.width = TARGET_DIMENSION;
          canvas.height = TARGET_DIMENSION;

          const { width: originalWidth, height: originalHeight } = img;
          let sx = 0, sy = 0, sWidth = originalWidth, sHeight = originalHeight;

          if (originalWidth > originalHeight) { // Landscape
            sWidth = originalHeight;
            sx = (originalWidth - originalHeight) / 2;
          } else if (originalHeight > originalWidth) { // Portrait
            sHeight = originalWidth;
            sy = (originalHeight - originalWidth) / 2;
          }
          
          // Draw the cropped and resized image onto the canvas
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_DIMENSION, TARGET_DIMENSION);
        } else {
          // Preserve original dimensions for assets like logos
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
        
        // Get the Data URL of the canvas content as a PNG.
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        
        // Resolve with the PNG base64 data.
        resolve({ base64, mimeType: 'image/png' });
      };
      
      // Handle image loading errors.
      img.onerror = (error) => reject(new Error(`Image could not be loaded: ${error}`));
    };

    // Handle file reading errors.
    reader.onerror = (error) => reject(error);
  });
};