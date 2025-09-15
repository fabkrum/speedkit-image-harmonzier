// Fix: Removed `Base64Image as GenaiBase64Image` from this import as it is not exported from the `@google/genai` package and was unused.
import { GoogleGenAI, Modality } from "@google/genai";
import { Base64Image } from "../types";


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const MAX_RETRIES = 2; // The initial attempt + 2 retries = 3 total attempts

export async function processImageStyle(
  employeeImage: Base64Image
): Promise<string> {

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const employeePart = {
        inlineData: {
          data: employeeImage.base64,
          mimeType: employeeImage.mimeType,
        },
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            employeePart,
            {
              text: `**GOAL:** Transform the provided employee photo into a professional corporate headshot.

**NON-NEGOTIABLE RULES:**
1.  **PRESERVE IDENTITY:** The final image MUST be of the person in the provided photo. Retain their exact facial features, hairstyle, and facial expression. The person must be 100% identifiable.
2.  **ABSOLUTE FRAMING CONSISTENCY:** The final image framing MUST be a tight "head and shoulders" corporate headshot. The vertical composition is critical: position the subject so that their eyes are EXACTLY on the horizontal line that is one-third of the way down from the top of the image. The top of their head should have only a minimal, consistent gap to the top edge of the frame. This is the most important instruction for visual consistency. Do not deviate.

**INSTRUCTIONS:**
1.  **Background:** Completely replace the original background and any borders or frames with a new background. The new background must be a professional, photorealistic studio backdrop that extends to all four edges of the 965x965 pixel canvas, leaving absolutely no border. The backdrop itself should be a seamless, solid, neutral-white wall with a subtle, smooth vertical gradient that is slightly darker gray at the very bottom and transitions to pure white at the top.
2.  **Attire:** Dress the subject in a clean, high-quality, plain black crew-neck t-shirt. On the left chest, add a small logo: a solid white square with a simple black rocket ship icon inside, pointing up and to the right.
3.  **Lighting:**
    -   Adjust the lighting on the subject to be consistent with a professional studio environment.
    -   Create soft, flattering studio lighting (loop lighting) with a key light, fill light, and a gentle rim light for separation.
    -   Ensure distinct, professional catchlights are visible in the subject's eyes.
4.  **Final Polish:**
    -   Emulate the quality of a professional DSLR with an 85mm f/2.8 lens, creating a tack-sharp subject and a softly blurred background.
    -   The final output must be a high-resolution, noise-free PNG image, exactly 965x965 pixels.`,
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const candidate = response.candidates?.[0];

      if (!candidate || !candidate.content || !candidate.content.parts) {
        let errorMessage = "Image generation failed. The model did not return a valid response.";
        if (response.promptFeedback?.blockReason) {
          errorMessage = `Request blocked: ${response.promptFeedback.blockReason}`;
        }
        throw new Error(errorMessage);
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          const base64ImageBytes: string = part.inlineData.data;
          // If we successfully find an image, return it and exit the function.
          return `data:image/png;base64,${base64ImageBytes}`;
        }
      }
      
      // If we loop through all parts and find no image, it's a failed attempt.
      throw new Error("No image data found in the response for this attempt.");

    } catch (error) {
      console.error(`Error on attempt ${attempt + 1}/${MAX_RETRIES + 1}:`, error);
      lastError = error instanceof Error ? error : new Error('An unknown error occurred');
      
      // If it's the last attempt, don't wait, let it fail and throw below.
      if (attempt < MAX_RETRIES) {
        // Wait a bit before retrying
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); 
      }
    }
  }

  // If all retries have been exhausted, throw the last captured error.
  console.error("All retries failed for image processing.");
  const finalErrorMessage = `Image processing failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError?.message || 'Unknown'}`;
  throw new Error(finalErrorMessage);
}