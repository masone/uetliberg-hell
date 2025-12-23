import path from "path";
import { readFile } from "fs/promises";
import { generateText, type ModelMessage, type UserContent } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const visionModel = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4-turbo");

const responseSchema = z.object({
  fogClear: z.boolean(),
  sunshine: z.boolean(),
  clear: z.boolean(),
});

export type ImageRecognitionResult = z.infer<typeof responseSchema>;

export async function recognizeImage(
  imageFileName: string,
): Promise<ImageRecognitionResult> {
  const imagePath = path.resolve("images", imageFileName);

  const systemPrompt =
    "You are reviewing the weather conditions on a webcam image. The scenery always shows a city in the valley on the left side with a mountain ridge covered in forest on the right side. There is a small road leading up to a large building in the foreground with an observation tower nearby.";

  const promptText =
    `Analyze the image and respond with a single JSON object only (no prose). Shape:\n` +
    `{"clear": boolean, "fogClear": boolean, "sunshine": boolean\n` +
    `Rules:\n` +
    `- fogClear: true only if the building, tower, the road and some forest are visible and not obscured by fog; false if the image is white/grey without the required objects visible.\n` +
    `- sunshine: true only if the sky suggests sun (clear/patchy clouds with light on ground); false if heavy overcast/night.\n` +
    `- clear: true only when fogClear AND sunshine are both true; otherwise false.\n` +
    `Keep JSON compact, no trailing text.`;

  const imageFile = {
    type: "file" as const,
    name: imageFileName,
    data: await readFile(imagePath),
    mimeType: "image/jpeg",
  };

  const imageDataUrl = `data:${imageFile.mimeType};base64,${imageFile.data.toString(
    "base64",
  )}`;

  const userContent: UserContent = [
    { type: "text", text: promptText },
    { type: "image", image: imageDataUrl },
  ];

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: userContent,
    },
  ];

  const result = await generateText({
    model: visionModel,
    system: systemPrompt,
    messages,
  });

  const parsed = JSON.parse(result.text ?? "{}");
  const validation = responseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(`Invalid model JSON: ${validation.error.message}`);
  }
  return validation.data;
}
