import { getGroqClient, GROQ_MODEL } from "./groq.service.js"

export interface KeywordSet {
  seedWord: string        // single word — highest volume, hardest to rank
  shortTail: string       // 2-3 words — medium volume, medium difficulty
  longTail: string        // 4-6 words — lower volume, easiest to rank
}

export interface SEOData {
  keywords: KeywordSet
  selectedKeyword: string         // which one is active (default: longTail)
  selectedKeywordType: "seed" | "short" | "long"
  metaDescription: string         // STRICT: 130-142 CHARACTERS
  seoTitle: string                // 50-60 chars
  slug: string                    // url-friendly, from long tail keyword
  schemaMarkup: string            // JSON-LD Article
}

export async function generateSEOData(
  userId: string,
  params: {
    postTitle: string
    content: string
    keywords: string[]
    tone: string
  }
): Promise<SEOData> {
  const groq = await getGroqClient(userId)

  // Strip HTML for content analysis
  const plainText = params.content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 800)

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: `You are an expert SEO copywriter.
Respond ONLY with valid JSON. No markdown, no backticks, no explanation.
Follow every rule EXACTLY — character counts are strict requirements.`
      },
      {
        role: "user",
        content: `Generate SEO data for this blog post.

POST TITLE: ${params.postTitle}
KEYWORDS: ${params.keywords.join(", ")}
CONTENT PREVIEW: ${plainText}

Return this exact JSON structure:

{
  "seedWord": "single most important keyword (1 word only)",
  "shortTail": "2 to 3 word keyword phrase",
  "longTail": "4 to 6 word keyword phrase that someone would search",
  "metaDescription": "MUST be between 130 and 142 characters. Write in short sentences under 15 words each. Use simple everyday words. No jargon. Include the long tail keyword naturally. Count every character including spaces.",
  "seoTitle": "50 to 60 character title. Put the main keyword near the start.",
  "slug": "long-tail-keyword-as-url-slug"
}

STRICT RULES — do not break any of these:

metaDescription rules:
- Minimum 130 characters, maximum 142 characters
- COUNT every single character including spaces and punctuation
- Write 2 to 3 short sentences
- Each sentence must be under 15 words
- Use simple words a 12 year old would understand
- No complex vocabulary or jargon
- Include the long tail keyword naturally in the text
- End with a clear benefit or call to action
- Do NOT start with the post title

metaDescription example of correct length and style:
"Learn how to start a blog in simple steps. We cover tools, tips, and tricks for beginners. Build your blog today and share your ideas with the world."
(That example is 152 chars — your output must be shorter, 130-142 chars)

seoTitle rules:
- Between 50 and 60 characters exactly
- Include the main keyword near the beginning
- No clickbait

slug rules:
- Use the long tail keyword converted to a URL
- Lowercase only
- Hyphens between words
- No special characters
- Maximum 6 words`
      }
    ],
    max_tokens: 600,
    temperature: 0.2,
  })

  const raw = response.choices[0]?.message?.content?.trim() || "{}"

  // Clean response in case model adds backticks
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned)

    // Validate and enforce meta description length
    let metaDesc = parsed.metaDescription || ""
    
    // If too long — trim at last complete sentence under 142
    if (metaDesc.length > 142) {
      metaDesc = trimToSentence(metaDesc, 142)
    }
    
    // If too short — this is rare but handle it
    if (metaDesc.length < 130) {
      metaDesc = padMetaDescription(metaDesc, parsed.longTail || "")
    }

    const longTailKeyword = parsed.longTail || params.keywords[0] || ""

    return {
      keywords: {
        seedWord: parsed.seedWord || extractSeedWord(params.postTitle),
        shortTail: parsed.shortTail || params.keywords[0] || "",
        longTail: longTailKeyword,
      },
      selectedKeyword: longTailKeyword,
      selectedKeywordType: "long",
      metaDescription: metaDesc,
      seoTitle: (parsed.seoTitle || params.postTitle).substring(0, 60),
      slug: parsed.slug || slugify(longTailKeyword || params.postTitle),
      schemaMarkup: generateArticleSchema({
        title: params.postTitle,
        description: metaDesc,
        keywords: [
          parsed.seedWord || "",
          parsed.shortTail || "",
          longTailKeyword,
          ...params.keywords,
        ].filter(Boolean),
      }),
    }

  } catch (e) {
    console.error("SEO JSON parse failed:", e)
    const fallbackLongTail = params.keywords.slice(0, 3).join(" ")
    return {
      keywords: {
        seedWord: extractSeedWord(params.postTitle),
        shortTail: params.keywords.slice(0, 2).join(" "),
        longTail: fallbackLongTail,
      },
      selectedKeyword: fallbackLongTail,
      selectedKeywordType: "long",
      metaDescription: generateFallbackMeta(params.postTitle, fallbackLongTail),
      seoTitle: params.postTitle.substring(0, 60),
      slug: slugify(fallbackLongTail || params.postTitle),
      schemaMarkup: generateArticleSchema({
        title: params.postTitle,
        description: "",
        keywords: params.keywords,
      }),
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────

function trimToSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastPeriod = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?")
  )
  if (lastPeriod > 100) {
    return truncated.substring(0, lastPeriod + 1)
  }
  // No sentence boundary found — cut at last space
  const lastSpace = truncated.lastIndexOf(" ")
  return truncated.substring(0, lastSpace) + "."
}

function padMetaDescription(text: string, keyword: string): string {
  const additions = [
    ` Try it today.`,
    ` Start now.`,
    ` Learn more here.`,
    ` See how it works.`,
    ` Get started today.`,
  ]
  for (const add of additions) {
    if ((text + add).length >= 130 && (text + add).length <= 142) {
      return text + add
    }
  }
  return text
}

function extractSeedWord(title: string): string {
  const stopWords = new Set([
    "the","a","an","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","could",
    "should","may","might","shall","can","need","dare","ought",
    "to","of","in","for","on","with","at","by","from","as",
    "into","through","during","about","against","between","into",
    "how","what","why","when","where","which","who","that","this",
  ])
  const words = title.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/)
  const meaningful = words.filter(w => w.length > 3 && !stopWords.has(w))
  return meaningful[0] || words[0] || title.split(" ")[0].toLowerCase()
}

function slugify(text: string): string {
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

function generateFallbackMeta(title: string, keyword: string): string {
  const base = `Discover ${title.toLowerCase()}. `
  const mid = keyword ? `Learn about ${keyword} with simple tips. ` : ""
  const end = "Get started today and see results fast."
  const full = base + mid + end
  return trimToSentence(full, 142)
}

function generateArticleSchema(params: {
  title: string
  description: string
  keywords: string[]
}): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": params.title,
    "description": params.description,
    "keywords": params.keywords.join(", "),
    "author": {
      "@type": "Organization",
      "name": "AutoBlog"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AutoBlog"
    }
  }, null, 2)
}

const COMMON_EASY_READABILITY_WORDS = new Set([
  "about", "after", "another", "article", "because", "before", "better",
  "business", "category", "content", "customer", "different", "during",
  "every", "example", "family", "favorite", "general", "important",
  "internet", "marketing", "natural", "personal", "possible", "question",
  "really", "simple", "similar", "specific", "together", "usually",
  "website", "without", "wordpress",
])

const READABILITY_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g",
  "i.e", "u.s", "u.k", "seo", "ai", "api", "cms", "html", "url",
])

function normalizeReadableText(htmlContent: string): string {
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

function getReadableWords(text: string): string[] {
  return text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []
}

function splitReadableSentences(text: string): string[] {
  const protectedText = text
    .replace(/\b([A-Za-z])\./g, "$1<dot>")
    .replace(/\b([A-Za-z]{1,4})\./g, (match, word) => (
      READABILITY_ABBREVIATIONS.has(word.toLowerCase()) ? `${word}<dot>` : match
    ))

  return protectedText
    .split(/(?<=[.!?])\s+|(?<=\.)\s*(?=[A-Z])/)
    .map(s => s.replace(/<dot>/g, ".").trim())
    .filter(s => getReadableWords(s).length > 0)
}

function countReadableSyllables(word: string): number {
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

function isReadableComplexWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "")
  if (clean.length < 8) return false
  if (COMMON_EASY_READABILITY_WORDS.has(clean)) return false
  if (/(ing|ed|es|s)$/.test(clean)) {
    const root = clean.replace(/(ing|ed|es|s)$/, "")
    if (COMMON_EASY_READABILITY_WORDS.has(root)) return false
  }
  return countReadableSyllables(clean) >= 3
}

export function calculateReadability(htmlContent: string): {
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
  const text = normalizeReadableText(htmlContent)
  const sentences = splitReadableSentences(text)
  const words = getReadableWords(text)

  const sentenceCount = Math.max(sentences.length, 1)
  const wordCount = Math.max(words.length, 1)

  const syllableCounts = words.map(w => countReadableSyllables(w))
  const totalSyllables = syllableCounts.reduce((a, b) => a + b, 0)

  // Count sentences over 20 words
  const sentenceWordCounts = sentences.map(s => getReadableWords(s).length)
  const longSentences = sentenceWordCounts.filter(count => count > 20).length

  // Count complex words, excluding common easy words.
  const complexWords = words.filter(isReadableComplexWord).length

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
export function calculateKeywordDensity(
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
