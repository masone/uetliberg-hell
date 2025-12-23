"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recognizeImage = recognizeImage;
const path_1 = __importDefault(require("path"));
const promises_1 = require("fs/promises");
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
const zod_1 = require("zod");
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to call the OpenAI vision model.");
}
const visionModel = (0, openai_1.createOpenAI)({ apiKey })("gpt-4-turbo");
const responseSchema = zod_1.z.object({
    fogClear: zod_1.z.boolean(),
    sunshine: zod_1.z.boolean(),
    clear: zod_1.z.boolean(),
});
async function recognizeImage(imageFileName) {
    const imagePath = path_1.default.resolve("images", imageFileName);
    const systemPrompt = "You are reviewing the weather conditions on a webcam image. The scenery always shows a city in the valley on the left side with a mountain ridge covered in forest on the right side. There is a small road leading up to a large building in the foreground with an observation tower nearby.";
    const promptText = `Analyze the image and respond with a single JSON object only (no prose). Shape:\n` +
        `{"clear": boolean, "fogClear": boolean, "sunshine": boolean\n` +
        `Rules:\n` +
        `- fogClear: true only if the building, tower, the road and some forest are visible and not obscured by fog; false if the image is white/grey without the required objects visible.\n` +
        `- sunshine: true only if the sky suggests sun (clear/patchy clouds with light on ground); false if heavy overcast/night.\n` +
        `- clear: true only when fogClear AND sunshine are both true; otherwise false.\n` +
        `Keep JSON compact, no trailing text.`;
    const imageFile = {
        type: "file",
        name: imageFileName,
        data: await (0, promises_1.readFile)(imagePath),
        mimeType: "image/jpeg",
    };
    const imageDataUrl = `data:${imageFile.mimeType};base64,${imageFile.data.toString("base64")}`;
    const userContent = [
        { type: "text", text: promptText },
        { type: "image", image: imageDataUrl },
    ];
    const messages = [
        {
            role: "user",
            content: userContent,
        },
    ];
    const result = await (0, ai_1.generateText)({
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
