// Sentence embeddings with @huggingface/transformers. Runs in the browser (WASM/WebGPU)
// and in Node (onnxruntime-node) for the index build and evaluation scripts.
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { EMBED_MODEL } from './config.ts'

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', EMBED_MODEL) as Promise<FeatureExtractionPipeline>
    // Allow a retry if the model download fails.
    extractorPromise.catch(() => {
      extractorPromise = null
    })
  }
  return extractorPromise
}

/** Embeds texts with mean pooling; vectors are L2-normalised, so cosine similarity = dot product. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const extractor = await getExtractor()
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  return output.tolist() as number[][]
}
