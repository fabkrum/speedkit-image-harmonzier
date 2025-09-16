import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Base64Image } from "../types";


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const MAX_RETRIES = 2; // The initial attempt + 2 retries = 3 total attempts

// Fix: Correctly typed the retryableRequest function to accept a function returning a GenerateContentResponse
// and to return a promise that resolves to a string (the image data URL). This resolves the type mismatch.
const retryableRequest = async (
  requestFn: () => Promise<GenerateContentResponse>,
  requestName: string
): Promise<string> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await requestFn();
      
      const candidate = result.candidates?.[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        let errorMessage = `${requestName} failed. The model did not return a valid response.`;
        if (result.promptFeedback?.blockReason) {
          errorMessage = `Request blocked: ${result.promptFeedback.blockReason}`;
        }
        throw new Error(errorMessage);
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          const base64ImageBytes: string = part.inlineData.data;
          return `data:image/png;base64,${base64ImageBytes}`;
        }
      }

      throw new Error("No image data found in the response for this attempt.");

    } catch (error) {
      console.error(`Error on ${requestName} attempt ${attempt + 1}/${MAX_RETRIES + 1}:`, error);
      lastError = error instanceof Error ? error : new Error('An unknown error occurred');
      
      if (attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); 
      }
    }
  }

  console.error(`All retries failed for ${requestName}.`);
  const finalErrorMessage = `${requestName} failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError?.message || 'Unknown'}`;
  throw new Error(finalErrorMessage);
}


/**
 * Prompt A: Generates a single, reusable master studio background image.
 */
export async function generateMasterBackground(): Promise<string> {
  const requestFn = () => ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: {
      parts: [
        {
          text: `Prompt A: Generate Master Studio Background
GOAL: Generate a single, perfectly uniform, and seamless professional studio background image (965x965 pixels) that will be used as the exact backdrop for all subsequent corporate headshots.

NON-NEGOTIABLE RULES:
- EXACT DIMENSIONS: The output image MUST be exactly 965x965 pixels.
- UNIFORMITY: The background must be a single, solid, consistent image, free from any noise, variations, or imperfections.

INSTRUCTIONS:
- Background: The image must be a professional, photorealistic studio backdrop. It must be a seamless, solid, neutral-white wall with an EXACT, subtle, and smooth vertical gradient. This gradient must be perfectly uniform: slightly darker gray (specifically, #DCDCDC - very light gray) at the very bottom (exactly at the 965px mark), transitioning smoothly and linearly to pure white (#FFFFFF) at the top (exactly at the 0px mark).
- Finish: The background must have a completely textureless, smooth, and uniform finish, like a freshly painted seamless studio cyclorama.
- Output: High-resolution, noise-free PNG image.`,
        },
      ],
    },
    config: {
      // Fix: The 'gemini-2.5-flash-image-preview' model requires both IMAGE and TEXT modalities in the response.
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  return retryableRequest(requestFn, "Master Background Generation");
}

/**
 * Prompt B: Generates an individual headshot using the employee photo, master background, and company logo.
 */
export async function processHeadshot(
  employeeImage: Base64Image,
  masterBackground: Base64Image,
  companyLogo: Base64Image
): Promise<string> {
  const requestFn = () => {
    const employeePart = { inlineData: { data: employeeImage.base64, mimeType: employeeImage.mimeType } };
    const backgroundPart = { inlineData: { data: masterBackground.base64, mimeType: masterBackground.mimeType } };
    const logoPart = { inlineData: { data: companyLogo.base64, mimeType: companyLogo.mimeType } };

    const textPart = {
      text: `Prompt B: Individual Headshot with Master Background & Transformed Logo

CONTEXT: You are provided with three images in this order:
1. The employee photo.
2. The master background image.
3. The company logo image.
Your task is to follow the detailed instructions below to create a corporate headshot.

GOAL: Transform the provided employee photo into a professional corporate headshot, meticulously integrating it onto the pre-generated master background image and applying the transformed company logo with absolute consistency. The final image must be perfectly uniform with others generated using this same process.

NON-NEGOTIABLE CORE CONSISTENCY RULES:
- EXACT FRAMING & ZOOM MANDATE: Aggressively CROP and ZOOM IN on the subject to achieve a PERFECTLY IDENTICAL head-and-shoulders composition. Eye-line at 1/3 down from top (pixel 321), and exactly 80 pixels headspace. Calculate necessary zoom/crop precisely.
- ABSOLUTE IDENTITY PRESERVATION: Retain the exact facial features, specific hair details, and original facial expression of the person in the provided photo.
- MANDATORY BACKGROUND USAGE: The entire background of the final image MUST be the provided master studio background image. No part of the original photo's background or any newly generated background elements are permitted.
- LOGO MANDATE: The transformed company logo (rocket and text in white) MUST be present on the subject's shirt in every image.

DETAILED INSTRUCTIONS FOR ABSOLUTE VISUAL UNIFORMITY & SCENE INTEGRATION:
- Subject Integration & Attire:
  - Background: Integrate the subject seamlessly onto the provided master studio background image. Ensure perfect blending at the edges, avoiding any halos or unnatural transitions.
  - Attire: Dress the subject in a clean, high-quality, plain black crew-neck t-shirt. The fabric texture should appear consistently smooth, soft cotton, and free from wrinkles.
  - Logo Application: Place the provided company logo image onto the left chest of the black t-shirt. The logo MUST be transformed so that the rocket icon and the "Speed Kit" text are entirely white. The logo's size and its exact placement (horizontally centered on the left chest fabric, vertically consistent relative to the collarbone) must be identical across all images.
- Lighting – Studio Precision & Integration:
  - Global Lighting Schema: Implement a single, unchanging professional studio lighting setup consistent with a master reference. This involves a large softbox key light at 45 degrees left, a softer fill light on the opposite side, and a subtle rim light from behind.
  - Catchlights: Ensure two distinct, identically sized, and identically positioned oval catchlights are visible in each eye.
  - Shadows & Depth: All shadows on the face, neck, and shoulders must exhibit identical softness, depth, and fall-off.
  - Color Temperature & Skin Tone Uniformity: The overall color temperature must be IDENTICAL and neutral (5500K). The skin tone of every subject must be rendered with an EXACT, natural, and consistent luminosity and hue.
- Camera & Lens Simulation (Technical Consistency):
  - Standardized Pose & Gaze: The subject should be posed looking directly into the camera, with their head and shoulders squared forward.
  - Emulate a Single Digital Camera Profile: Emulate a high-end full-frame DSLR with a premium 85mm f/2.8 prime lens. The subject must be tack-sharp.
  - Micro-Detail Uniformity: For subjects wearing glasses, any reflections or glare must be minimal and consistent.
- Final Output Specifications: High-resolution, noise-free PNG image, exactly 965x965 pixels, with IDENTICAL global contrast, sharpness, and saturation levels.
`
    };

    return ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          employeePart,
          backgroundPart,
          logoPart,
          textPart,
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
  };

  return retryableRequest(requestFn, "Headshot Processing");
}