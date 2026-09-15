// Readability score — Flesch Reading Ease (no AI needed)
const COMMON_EASY_WORDS = new Set([
  "about", "after", "another", "article", "because", "before", "better",
  "business", "category", "content", "customer", "different", "during",
  "every", "example", "family", "favorite", "general", "important",
  "internet", "marketing", "natural", "personal", "possible", "question",
  "really", "simple", "similar", "specific", "together", "usually",
  "website", "without", "wordpress",
])

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g",
  "i.e", "u.s", "u.k", "seo", "ai", "api", "cms", "html", "url",
])

function normalizeText(htmlContent: string): string {
  return htmlContent
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ". ")
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function getWords(text: string): string[] {
  return text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []
}

function splitSentences(text: string): string[] {
  const protectedText = text
    .replace(/\b([A-Za-z])\./g, "$1<dot>")
    .replace(/\b([A-Za-z]{1,4})\./g, (match, word) => (
      ABBREVIATIONS.has(word.toLowerCase()) ? `${word}<dot>` : match
    ))

  return protectedText
    .split(/(?<=[.!?])\s+|(?<=\.)\s*(?=[A-Z])/)
    .map(s => s.replace(/<dot>/g, ".").trim())
    .filter(s => getWords(s).length > 0)
}

export function countSyllablesClient(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "")
  if (!clean) return 0
  if (clean.length <= 3) return 1

  let count = 0
  let previousWasVowel = false
  for (const char of clean) {
    const isVowel = /[aeiouy]/.test(char)
    if (isVowel && !previousWasVowel) count++
    previousWasVowel = isVowel
  }

  if (clean.endsWith("e") && !clean.endsWith("le") && count > 1) count--
  if (clean.endsWith("es") && count > 1) count--
  if (clean.endsWith("ed") && !/(ted|ded)$/.test(clean) && count > 1) count--
  if (clean.endsWith("le") && clean.length > 3 && !/[aeiouy]le$/.test(clean)) count++

  return Math.max(count, 1)
}

function isComplexWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "")
  if (clean.length < 8) return false
  if (COMMON_EASY_WORDS.has(clean)) return false
  if (/(ing|ed|es|s)$/.test(clean)) {
    const root = clean.replace(/(ing|ed|es|s)$/, "")
    if (COMMON_EASY_WORDS.has(root)) return false
  }
  return countSyllablesClient(clean) >= 3
}

export function calculateReadabilityClient(htmlContent: string): {
  score: number
  label: string
  color: "green" | "blue" | "amber" | "red"
  wordCount: number
  sentenceCount: number
  avgWordsPerSentence: number
  longSentences: number      // sentences over 20 words
  complexWords: number       // words over 3 syllables
  suggestions: string[]
  grade: string              // "Grade 6", "Grade 8" etc
} {
  const text = normalizeText(htmlContent)
  const sentences = splitSentences(text)
  const words = getWords(text)

  const sentenceCount = Math.max(sentences.length, 1)
  const wordCount = Math.max(words.length, 1)

  const syllableCounts = words.map(w => countSyllablesClient(w))
  const totalSyllables = syllableCounts.reduce((a, b) => a + b, 0)

  // Count sentences over 20 words
  const sentenceWordCounts = sentences.map(s => getWords(s).length)
  const longSentences = sentenceWordCounts.filter(count => count > 20).length

  // Count complex words, excluding common easy words.
  const complexWords = words.filter(isComplexWord).length

  const avgWordsPerSentence = wordCount / sentenceCount
  const avgSyllablesPerWord = totalSyllables / wordCount

  // Flesch Reading Ease
  const score = Math.round(
    206.835
    - (1.015 * avgWordsPerSentence)
    - (84.6 * avgSyllablesPerWord)
  )
  const clampedScore = Math.min(100, Math.max(0, score))

  // Flesch-Kincaid Grade Level
  const gradeLevel = Math.round(
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
  )
  const grade = `Grade ${Math.max(1, Math.min(gradeLevel, 16))}`

  // Build specific suggestions
  const suggestions: string[] = []
  const longestSentenceWords = Math.max(...sentenceWordCounts, 0)
  const complexWordRate = complexWords / wordCount

  if (longSentences > 0) {
    suggestions.push(
      `${longSentences} sentence${longSentences > 1 ? "s are" : " is"} over 20 words — split them up`
    )
  }
  if (avgWordsPerSentence > 15) {
    suggestions.push(
      `Average sentence is ${Math.round(avgWordsPerSentence)} words — aim for under 15`
    )
  }
  if (longestSentenceWords > 24) {
    suggestions.push(
      `Longest sentence has ${longestSentenceWords} words - keep it under 20`
    )
  }
  if (complexWordRate > 0.08) {
    suggestions.push(
      `${complexWords} complex words found — replace with simpler alternatives`
    )
  }
  if (wordCount < 300) {
    suggestions.push("Content is short — expand to 600+ words for better SEO")
  }
  if (clampedScore >= 80 && avgWordsPerSentence <= 15 && longSentences === 0 && complexWordRate <= 0.08 && suggestions.length === 0) {
    suggestions.push("Excellent readability — easy for most readers")
  }

  let label: string
  let color: "green" | "blue" | "amber" | "red"
  if (clampedScore >= 80 && avgWordsPerSentence <= 15 && longSentences === 0 && complexWordRate <= 0.08) { label = "Excellent"; color = "green" }
  else if (clampedScore >= 70) { label = "Very easy"; color = "green" }
  else if (clampedScore >= 60) { label = "Easy"; color = "green" }
  else if (clampedScore >= 50) { label = "Good"; color = "blue" }
  else if (clampedScore >= 40) { label = "Fairly difficult"; color = "amber" }
  else if (clampedScore >= 30) { label = "Difficult"; color = "amber" }
  else { label = "Very difficult"; color = "red" }

  return {
    score: clampedScore,
    label,
    color,
    wordCount,
    sentenceCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    longSentences,
    complexWords,
    suggestions,
    grade,
  }
}

// Keyword density calculator
export function calculateKeywordDensityClient(
  htmlContent: string,
  focusKeyword: string
): { count: number; density: number; status: "low" | "good" | "high" } {
  if (!focusKeyword.trim()) return { count: 0, density: 0, status: "low" }

  const text = htmlContent.replace(/<[^>]*>/g, " ").toLowerCase()
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const keyword = focusKeyword.toLowerCase()

  const count = (text.match(new RegExp(escapeRegExp(keyword), "gi")) || []).length
  const density = words.length > 0
    ? Math.round((count / words.length) * 1000) / 10
    : 0

  const status = density < 0.5 ? "low" : density > 2.5 ? "high" : "good"
  return { count, density, status }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function slugifyClient(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-")
}
