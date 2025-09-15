import { Base64Image } from '../types';

const TARGET_DIMENSION = 965;

/**
 * Converts any browser-supported image file to a 965x965 pixel PNG base64 string.
 * This is done by drawing the image onto a canvas. If the image is not square,
 * it will be center-cropped to fit the 1:1 aspect ratio.
 * This standardizes the format and dimensions before sending to the Gemini API.
 * @param file The image file to convert.
 * @returns A promise that resolves to a Base64Image object with a PNG mime type.
 */
export const convertImageToBase64 = (file: File): Promise<Base64Image> => {
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
        canvas.width = TARGET_DIMENSION;
        canvas.height = TARGET_DIMENSION;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('Could not get canvas 2D context.'));
        }

        // Calculate dimensions for center-cropping
        const { width: originalWidth, height: originalHeight } = img;
        let sx = 0;
        let sy = 0;
        let sWidth = originalWidth;
        let sHeight = originalHeight;

        if (originalWidth > originalHeight) {
          // Landscape: crop the sides
          sWidth = originalHeight;
          sx = (originalWidth - originalHeight) / 2;
        } else if (originalHeight > originalWidth) {
          // Portrait: crop the top and bottom
          sHeight = originalWidth;
          sy = (originalHeight - originalWidth) / 2;
        }
        
        // Draw the cropped and resized image onto the canvas
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_DIMENSION, TARGET_DIMENSION);

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
