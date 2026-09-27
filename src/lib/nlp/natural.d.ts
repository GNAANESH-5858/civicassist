// Minimal types for the natural submodules we import directly (avoids loading
// natural's index, which pulls in database drivers).
declare module 'natural/lib/natural/stemmers/porter_stemmer.js' {
  const PorterStemmer: { stem(token: string): string }
  export default PorterStemmer
}

declare module 'natural/lib/natural/util/stopwords.js' {
  export const words: string[]
}

declare module 'natural/lib/natural/classifiers/bayes_classifier.js' {
  class BayesClassifier {
    addDocument(doc: string[] | string, label: string): void
    train(): void
    classify(doc: string[] | string): string
    getClassifications(doc: string[] | string): { label: string; value: number }[]
    static restore(data: unknown): BayesClassifier
  }
  export default BayesClassifier
}
