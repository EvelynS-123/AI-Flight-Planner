import { createTravelAIProvider } from "../../../ai-travel/providers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { params, weights, locale } = await request.json();

  const provider = createTravelAIProvider();
  if (!provider) {
    // If no AI, just return the original params as fallback
    return Response.json({ params });
  }

  const systemPrompt = `You are an expert flight booking algorithm.
The user has provided basic flight search parameters and their personal priority weights for Price, Interest (Transit Sightseeing), and Directness.
Your job is to analyze these inputs and output a refined JSON object of search parameters.

User Weights:
- Price: ${weights.price}%
- Interest: ${weights.interest}%
- Directness: ${weights.directness}%

Original Parameters:
${JSON.stringify(params, null, 2)}

Instructions:
1. If Price weight is very high (> 50%), you might set preferLCC to true or increase maxStops.
2. If Directness weight is very high (> 50%), you should set maxStops to 0.
3. If Interest weight is high (> 35%), the user wants an interesting journey, potentially with a long layover at a major hub. You might add major transit hubs to the origins or destinations if applicable, or change the tripType.
4. Output MUST BE a valid JSON block wrapped in \`\`\`json ... \`\`\` containing the refined parameters exactly matching the original schema. Do not change the date structure, just tweak routing, airlines, or stops.

Example Output format:
\`\`\`json
{
  "params": {
    "origins": ["IATA"],
    "destinations": ["IATA"],
    "dateRangeStart": "YYYY-MM-DD",
    "dateRangeEnd": "YYYY-MM-DD",
    "tripType": "one_way",
    "cabinClass": "economy",
    "maxStops": 0,
    "preferLCC": false,
    "adults": 1
  }
}
\`\`\`
DO NOT OUTPUT ANYTHING EXCEPT THE JSON BLOCK. ALWAYS USE VALID JSON.`;

  try {
    const aiResponse = await provider.generateJson({
      purpose: "planning",
      systemPrompt,
      userPrompt: "Please output the refined JSON params.",
      history: []
    }) as any;

    return Response.json(aiResponse);
  } catch (error: any) {
    console.error("Chat Analyze API Error:", error);
    // On error, fallback to original params
    return Response.json({ params });
  }
}
