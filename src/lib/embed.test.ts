import { beforeEach, describe, expect, it, vi } from 'vitest'

const extractor = vi.fn()
const pipelineMock = vi.fn()

vi.mock('@huggingface/transformers', () => ({ pipeline: pipelineMock }))

describe('embed', () => {
  beforeEach(() => {
    vi.resetModules()
    extractor.mockReset()
    pipelineMock.mockReset()
    extractor.mockResolvedValue({ tolist: () => [[0.6, 0.8]] })
    pipelineMock.mockResolvedValue(extractor)
  })

  it('uses the configured model with mean pooling and normalisation', async () => {
    const { embed } = await import('./embed.ts')
    const vecs = await embed(['no water'])
    expect(pipelineMock).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    expect(extractor).toHaveBeenCalledWith(['no water'], { pooling: 'mean', normalize: true })
    expect(vecs).toEqual([[0.6, 0.8]])
  })

  it('loads the model once across calls', async () => {
    const { embed } = await import('./embed.ts')
    await embed(['a'])
    await embed(['b'])
    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('returns [] for no input without loading the model', async () => {
    const { embed } = await import('./embed.ts')
    expect(await embed([])).toEqual([])
    expect(pipelineMock).not.toHaveBeenCalled()
  })

  it('retries loading after a failed download', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('offline'))
    const { embed } = await import('./embed.ts')
    await expect(embed(['a'])).rejects.toThrow('offline')
    await expect(embed(['a'])).resolves.toEqual([[0.6, 0.8]])
    expect(pipelineMock).toHaveBeenCalledTimes(2)
  })
})
