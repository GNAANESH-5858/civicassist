// Phase 1 stub. In Phase 5 this becomes the only place API keys are read
// (process.env.GEMINI_API_KEY / process.env.GROQ_API_KEY).

export const SAMPLE_LLM = {
  text: 'This is a stub response from the LLM gateway.',
  provider: 'stub',
  model: 'none',
}

export default async (_req: Request): Promise<Response> => {
  return Response.json(SAMPLE_LLM)
}
