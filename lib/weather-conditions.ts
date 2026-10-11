import { z } from "zod";

const DECISIONS_URL = "https://api.openai.com/v1/decisions";
const DECISIONS_MODEL = "gpt-6-luna";

// Tuned with npm run compare against scripts/labels.json. Borderline sun
// (low on the horizon, light through clouds) should come out as not hell.
export const FOG_THRESHOLD = 0.5;
export const SUN_THRESHOLD = 0.8;

const QUESTIONS = [
  {
    type: "predicate",
    name: "fog_clear",
    instructions:
      "The image is a webcam view towards the Uetliberg mountain range above Zurich. " +
      "True if the mountain top is clear of fog: the building on top of the mountain " +
      "range and the observation tower next to it are both visible. False if the image " +
      "is white/grey without these objects visible.",
  },
  {
    type: "predicate",
    name: "sunshine",
    instructions:
      "True if the sky suggests sunshine: clear or patchy clouds with sunlight on the " +
      "ground. False if heavily overcast, dusk or night.",
  },
];

const answerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("predicate"),
    name: z.string(),
    probability: z.number(),
  }),
  z.object({ type: z.literal("refusal"), name: z.string() }),
]);
const responseSchema = z.object({ answers: z.array(answerSchema) });

export interface ImageRecognitionResult {
  fogClear: boolean;
  sunshine: boolean;
  clear: boolean;
  // Raw probabilities, kept so thresholds can be re-tuned on cached results.
  // null when the model refused to answer.
  pFog: number | null;
  pSun: number | null;
  model: string;
}

// A refusal counts as "no": we only report hell when the model is confident
export function verdict(
  pFog: number | null,
  pSun: number | null,
  sunThreshold = SUN_THRESHOLD,
) {
  const fogClear = pFog !== null && pFog >= FOG_THRESHOLD;
  const sunshine = pSun !== null && pSun >= sunThreshold;
  return { fogClear, sunshine, clear: fogClear && sunshine };
}

export async function describeWeatherConditions(
  imageBuffer: Buffer,
): Promise<ImageRecognitionResult> {
  const res = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DECISIONS_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
            },
          ],
        },
      ],
      questions: QUESTIONS,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Decisions API ${res.status}: ${JSON.stringify(body)}`);
  }

  const validation = responseSchema.safeParse(body);
  if (!validation.success) {
    throw new Error(`Invalid Decisions response: ${validation.error.message}`);
  }
  const probability = (name: string) => {
    const answer = validation.data.answers.find((a) => a.name === name);
    if (!answer) throw new Error(`Missing answer for ${name}`);
    return answer.type === "predicate" ? answer.probability : null;
  };

  const pFog = probability("fog_clear");
  const pSun = probability("sunshine");
  return { ...verdict(pFog, pSun), pFog, pSun, model: DECISIONS_MODEL };
}
