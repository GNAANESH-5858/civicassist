// Phrases that try to give the model instructions from inside citizen-supplied text.
export const INJECTION_RE =
  /ignore (all |any )?(previous|prior|above|earlier) (instructions|prompts?|rules)|disregard (the |all )?(previous|above|system)|you are now|act as (an? )?(admin|developer|system)|system prompt|reveal (your )?(prompt|instructions)|jailbreak|do anything now/i

export function detectInjection(text: string): boolean {
  return INJECTION_RE.test(text)
}
