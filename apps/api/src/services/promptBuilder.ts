export interface PromptOptions {
  topic: string
  keywords: string[]
  tone: 'Professional' | 'Casual' | 'Technical' | 'Friendly'
  wordCount: number
  language: string
}

export function buildPrompt(options: PromptOptions): string {
  const { topic, keywords, tone, wordCount, language } = options
  
  // Tone-specific instructions
  const toneInstructions = {
    Professional: `
- Use industry-appropriate terminology
- Maintain formal, authoritative voice
- Support claims with data and evidence
- Avoid colloquialisms and contractions
- Structure arguments logically`,

    Casual: `
- Use conversational language (e.g., "you know", "here's the thing")
- Include contractions (don't, can't, it's)
- Add relatable examples and stories
- Use shorter sentences and paragraphs
- Write like you're explaining to a friend`,

    Technical: `
- Include technical specifications and metrics
- Use precise, domain-specific terminology
- Add code examples or technical diagrams where relevant
- Focus on implementation details
- Assume reader has baseline technical knowledge`,

    Friendly: `
- Use warm, encouraging language
- Include phrases like "you've got this" and "here's a tip"
- Add emojis where appropriate (🎯, 💡, ✅)
- Break down complex ideas simply
- End sections with encouragement`
  }

  // Keyword integration instruction
  const keywordInstruction = keywords.length > 0 
    ? `\n🔑 KEYWORD REQUIREMENTS:
- Naturally incorporate these keywords: ${keywords.join(', ')}
- Each keyword must appear at least once
- Do not force keywords - maintain natural flow
- Keywords should be distributed across headings and body` 
    : ''

  // Language-specific instruction
  const languageInstruction = language !== 'English' 
    ? `\n🌐 LANGUAGE GUIDELINES (${language}):
- Write 100% in ${language} (no English except proper nouns)
- Use ${language}-specific idioms and phrasing
- Follow ${language} grammar and punctuation rules
- Ensure cultural appropriateness for ${language} readers` 
    : ''

  return `You are an expert content writer specializing in SEO-optimized blog posts. Generate a high-quality article based on the specifications below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONTENT SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAIN TOPIC: "${topic}"
TARGET LENGTH: Approximately ${wordCount} words
TONE: ${tone}${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions['Professional']}
OUTPUT LANGUAGE: ${language}${languageInstruction}${keywordInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 ARTICLE STRUCTURE (Required)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **ENGAGING TITLE** (H1)
   - Create click-worthy, benefit-driven headline
   - Include primary keyword naturally
   - Keep under 60 characters if possible

2. **INTRODUCTION** (1-2 paragraphs)
   - Hook reader with a problem or statistic
   - Clearly state what the article will cover
   - Preview main points
   - End with transition to first section

3. **MAIN BODY** (3-4 H2 sections)
   Each H2 section must include:
   - Clear subheading (H2)
   - 2-3 paragraphs of valuable content
   - At least one bullet list or numbered list
   - Practical examples or actionable tips
   - Internal transitions to next section

4. **CONCLUSION** (1-2 paragraphs)
   - Summarize key takeaways
   - Include call-to-action (CTA)
   - End with forward-looking statement

5. **BONUS ELEMENTS** (Include at least 2):
   - 💡 Pro Tip box (use <div class="pro-tip">)
   - ✅ Key Takeaways summary
   - ❓ FAQ section with 2-3 questions
   - 📊 Comparison table (if applicable)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 FORMATTING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use clean HTML markup:
• <h1>Title</h1>
• <p>Paragraph text</p>
• <h2>Section heading</h2>
• <ul><li>Bullet point</li></ul>
• <ol><li>Numbered item</li></ol>
• <strong>Bold for emphasis</strong>
• <em>Italics for terms</em>

Formatting rules:
- Paragraphs: 3-4 sentences maximum
- Line breaks between all elements
- No markdown (use HTML only)
- No images or external links
- Use — (em dash) for emphasis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ QUALITY CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before generating, ensure the post:
✓ Solves a specific reader problem
✓ Provides unique insights (not generic advice)
✓ Includes data, examples, or case studies
✓ Has scannable subheadings
✓ Flows logically from intro to conclusion
✓ Avoids fluff and repetition
✓ Matches exactly ${wordCount} words (±10%)
✓ Uses ${tone} tone consistently
✓ All keywords integrated naturally

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now write the complete blog post in ${language} with ${tone} tone. Start with the H1 title and follow the structure exactly. Make every word valuable.`
}
