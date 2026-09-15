import Groq from 'groq-sdk';
import { buildPrompt, type PromptOptions } from './promptBuilder.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';

export const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

export interface GenerateBlogPostParams {
  userId?: string;
  topic: string;
  keywords: string[];
  tone: string;
  wordCount: number;
  language?: string;
}

const EXCELLENT_READABILITY_RULES = `Excellent readability rules:
- Target a Flesch Reading Ease score of 80 or higher.
- Keep every sentence under 20 words. Never exceed 20 words.
- Aim for 10-14 words per sentence on average.
- Use mostly one-clause sentences.
- Split sentences that contain multiple commas, semicolons, or long clauses.
- Keep paragraphs to 2-3 short sentences.
- Use simple everyday words a broad audience can understand.
- Replace complex words with simpler alternatives.
- Avoid jargon, acronyms, and technical terms unless required by the topic.
- Prefer active voice.
- Do not pad sentences with filler phrases.
- Before returning the final HTML, silently review the draft and rewrite any sentence over 20 words.`;

const SIMPLE_WORD_REPLACEMENTS = `Simple word replacements:
- utilize -> use
- demonstrate -> show
- facilitate -> help
- implement -> add
- methodology -> method
- subsequently -> then
- commence -> start
- terminate -> end
- approximately -> about
- sufficient -> enough
- comprehensive -> complete
- additionally -> also
- numerous -> many
- indicate -> show
- obtain -> get
- require -> need
- purchase -> buy
- assist -> help
- leverage -> use`;

export async function getGroqClient(userId?: string): Promise<Groq> {
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { groqApiKey: true },
      });

      if (user?.groqApiKey) {
        return new Groq({ apiKey: decrypt(user.groqApiKey) });
      }
    } catch (error) {
      console.warn('Failed to load user Groq key, using system key:', error);
    }
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error('No Groq API key configured. Please add your key in Settings.');
  }

  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.message?.includes('resource_exhausted') ||
        error.message?.includes('overloaded') ||
        error.message?.includes('temporarily unavailable') ||
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503;
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export async function generateBlogPost({ 
  userId,
  topic, 
  keywords, 
  tone, 
  wordCount, 
  language = 'English' 
}: GenerateBlogPostParams) {
  const groq = await getGroqClient(userId);
  const stream = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert blog writer who writes for maximum readability.
          
STRICT WRITING RULES — follow every rule without exception:

Sentence rules:
- Every sentence must be under 20 words
- Aim for 12-15 words per sentence
- Use short sentences. They are easier to read.
- Break long ideas into multiple short sentences
- Never write a sentence over 25 words under any circumstances

Word choice rules:
- Use simple everyday words
- If a complex word exists, replace it with a simpler one
- Examples: "utilize" → "use", "demonstrate" → "show", 
  "facilitate" → "help", "implement" → "add",
  "methodology" → "method", "subsequently" → "then",
  "commence" → "start", "terminate" → "end",
  "approximately" → "about", "sufficient" → "enough"
- Write as if explaining to a 12-year-old
- Avoid jargon, acronyms, and technical terms unless essential

Paragraph rules:
- Maximum 3 sentences per paragraph
- Add a blank line between every paragraph
- Use H2 and H3 headings to break up content every 150-200 words

Structure rules:
- Start with a 1-2 sentence introduction
- Use bullet points or numbered lists for steps or multiple items
- End with a short conclusion under 3 sentences

Generate ONLY the blog post body content in clean HTML.
Do NOT include a title, H1, or any header at the top.
Start directly with an introduction paragraph.
Return only valid HTML body content.
No markdown, no code fences, no html or body tags.

Updated article format requirements:
- Generate a professional SEO-friendly blog article in long-form article format.
- Write in a natural, human-like tone.
- Start with an engaging introduction paragraph.
- Use <h2> and <h3> headings.
- Write detailed paragraphs under each heading, with 2-4 paragraphs per major section.
- Do NOT use excessive bullet points or list-only sections.
- Avoid markdown symbols like **, ##, or *.
- Return clean HTML suitable for a WordPress Rich Text Editor.
- Use tags such as <h2>, <h3>, <p>, <ul>, and <ol>.
- Make the article read like a professionally written blog post similar to articles on Medium or HubSpot.
- Include a conclusion section at the end.

Readability requirements:
- Keep every sentence under 20 words.
- Aim for an average sentence length under 15 words.
- Split long sentences into two or more shorter sentences.
- Use simple, everyday words.
- Replace complex words with simpler alternatives.
- Avoid jargon unless the topic truly requires it.

${EXCELLENT_READABILITY_RULES}

${SIMPLE_WORD_REPLACEMENTS}`
        },
        {
          role: "user",
          content: `Write a ${wordCount}-word blog post about: "${topic}"
Keywords to include naturally: ${keywords.join(", ")}
Tone: ${tone}
Language: ${language}

Write the full professional SEO-friendly blog article now. Run the silent readability review before responding. Return clean HTML only.`
        }
      ],
      max_tokens: Math.min(6500, Math.max(3000, Math.ceil(wordCount * 3.5))),
      temperature: 0.35,
      stream: true,
    });
  }, 3, 2000);
  
  return stream;
}

export async function continueBlogPost({
  userId,
  topic,
  keywords,
  tone,
  wordCount,
  language = 'English',
  existingContent,
  remainingWords,
}: GenerateBlogPostParams & { existingContent: string; remainingWords: number }) {
  const groq = await getGroqClient(userId);
  const stream = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You continue existing blog body HTML. Generate ONLY additional valid HTML body content. Do not repeat existing content, do not add a title or H1, no markdown, no code fences, no <html> or <body> tags.

${EXCELLENT_READABILITY_RULES}

${SIMPLE_WORD_REPLACEMENTS}`
        },
        {
          role: "user",
          content: `Title/topic: "${topic}"
Keywords to naturally include if useful: ${keywords.join(", ")}
Tone: ${tone}
Language: ${language}
Overall target: ${wordCount} words.
Existing content:
${existingContent}

Continue the same article with about ${remainingWords} additional words. Add new sections or paragraphs that flow naturally from the existing content. Keep the continuation easy to read, with every sentence under 20 words. Run the silent readability review before responding.`
        }
      ],
      max_tokens: Math.min(3500, Math.max(900, Math.ceil(remainingWords * 3.5))),
      temperature: 0.3,
      stream: true,
    });
  }, 2, 1000);

  return stream;
}

export async function generateBlogPostNonStream({ 
  userId,
  topic, 
  keywords, 
  tone, 
  wordCount, 
  language = 'English' 
}: GenerateBlogPostParams): Promise<string> {
  const groq = await getGroqClient(userId);
  const completion = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert blog writer who writes for maximum readability.
          
STRICT WRITING RULES — follow every rule without exception:

Sentence rules:
- Every sentence must be under 20 words
- Aim for 12-15 words per sentence
- Use short sentences. They are easier to read.
- Break long ideas into multiple short sentences
- Never write a sentence over 25 words under any circumstances

Word choice rules:
- Use simple everyday words
- If a complex word exists, replace it with a simpler one
- Examples: "utilize" → "use", "demonstrate" → "show", 
  "facilitate" → "help", "implement" → "add",
  "methodology" → "method", "subsequently" → "then",
  "commence" → "start", "terminate" → "end",
  "approximately" → "about", "sufficient" → "enough"
- Write as if explaining to a 12-year-old
- Avoid jargon, acronyms, and technical terms unless essential

Paragraph rules:
- Maximum 3 sentences per paragraph
- Add a blank line between every paragraph
- Use H2 and H3 headings to break up content every 150-200 words

Structure rules:
- Start with a 1-2 sentence introduction
- Use bullet points or numbered lists for steps or multiple items
- End with a short conclusion under 3 sentences

Generate ONLY the blog post body content in clean HTML.
Do NOT include a title, H1, or any header at the top.
Start directly with an introduction paragraph.
Return only valid HTML body content.
No markdown, no code fences, no html or body tags.

Updated article format requirements:
- Generate a professional SEO-friendly blog article in long-form article format.
- Write in a natural, human-like tone.
- Start with an engaging introduction paragraph.
- Use <h2> and <h3> headings.
- Write detailed paragraphs under each heading, with 2-4 paragraphs per major section.
- Do NOT use excessive bullet points or list-only sections.
- Avoid markdown symbols like **, ##, or *.
- Return clean HTML suitable for a WordPress Rich Text Editor.
- Use tags such as <h2>, <h3>, <p>, <ul>, and <ol>.
- Make the article read like a professionally written blog post similar to articles on Medium or HubSpot.
- Include a conclusion section at the end.

Readability requirements:
- Keep every sentence under 20 words.
- Aim for an average sentence length under 15 words.
- Split long sentences into two or more shorter sentences.
- Use simple, everyday words.
- Replace complex words with simpler alternatives.
- Avoid jargon unless the topic truly requires it.

${EXCELLENT_READABILITY_RULES}

${SIMPLE_WORD_REPLACEMENTS}`
        },
        {
          role: "user",
          content: `Write a ${wordCount}-word blog post about: "${topic}"
Keywords to include naturally: ${keywords.join(", ")}
Tone: ${tone}
Language: ${language}

Write the full professional SEO-friendly blog article now. Run the silent readability review before responding. Return clean HTML only.`
        }
      ],
      max_tokens: 4096,
      temperature: 0.35,
      stream: false,
    });
  }, 3, 2000);
  
  return completion.choices[0]?.message?.content || '';
}

export async function improvePostReadability({
  userId,
  title,
  content,
  keywords = [],
  tone = 'Professional',
  language = 'English',
  targetWordCount,
}: {
  userId?: string;
  title: string;
  content: string;
  keywords?: string[];
  tone?: string;
  language?: string;
  targetWordCount?: number;
}): Promise<string> {
  const groq = await getGroqClient(userId);
  const plainWordCount = countWords(content);
  const safeWordCount = Math.min(
    Math.max(Math.round(targetWordCount || plainWordCount || 800), 300),
    3000
  );

  const completion = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert readability editor and SEO blog editor.

Rewrite the provided blog post to achieve excellent readability while preserving meaning, structure, and SEO intent.

Strict readability goals:
- Every sentence must be under 20 words.
- Aim for an average sentence length under 15 words.
- Split long sentences into two or more shorter sentences.
- Replace complex words with simpler alternatives.
- Use simple everyday words a broad audience can understand.
- Avoid jargon unless the topic truly requires it.
- Keep paragraphs short, clear, and useful.

${EXCELLENT_READABILITY_RULES}

${SIMPLE_WORD_REPLACEMENTS}

Content and format goals:
- Preserve the article's main points, helpful details, and search intent.
- Keep a natural, professional, human-like tone.
- Keep or improve the existing <h2>, <h3>, <p>, <ul>, and <ol> structure.
- Keep the article close to ${safeWordCount} words.
- Include the provided keywords naturally where they already fit.
- Return clean HTML body content only.
- Do NOT include markdown, code fences, <html>, <head>, <body>, H1, or explanations.
- Before returning, silently check sentence length, average sentence length, and complex word use.`
        },
        {
          role: 'user',
          content: `Title: "${title}"
Tone: ${tone}
Language: ${language}
Keywords: ${keywords.join(', ')}

Rewrite this HTML blog post for excellent readability. Run the silent readability review before responding:

${content}`
        }
      ],
      max_tokens: Math.min(6500, Math.max(2500, Math.ceil(safeWordCount * 3.4))),
      temperature: 0.25,
      stream: false,
    });
  }, 2, 1000);

  return completion.choices[0]?.message?.content?.trim() || content;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function countWords(text: string) {
  return stripHtml(text).split(' ').filter(Boolean).length;
}

export async function generateDescription({
  userId,
  title,
  keywords = [],
  categories = '',
  tags = '',
  wordCount = 1000,
  tone = 'Professional',
  language = 'English',
  descriptionFormat = 'articleBody',
}: {
  userId?: string;
  title: string;
  keywords?: string[] | string;
  categories?: string;
  tags?: string;
  wordCount?: number;
  tone?: string;
  language?: string;
  descriptionFormat?: 'articleBody' | 'postDescription';
}): Promise<string> {
  const groq = await getGroqClient(userId);
  const safeWordCount = Math.min(Math.max(Math.round(wordCount), 500), 3000);
  const keywordsList = Array.isArray(keywords) ? keywords.join(', ') : String(keywords || '');
  const metadataContext = `\nKeywords: ${keywordsList}\nCategories: ${categories}\nTags: ${tags}\nTone: ${tone}\nLanguage: ${language}`;
  const model = GROQ_MODEL;

  if (descriptionFormat === 'postDescription') {
    const completion = await retryWithBackoff(async () => {
      return await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an expert SEO and social media copywriter.

Generate a post description bundle in the requested language and tone.

STRICT OUTPUT RULES:
- Output valid HTML body content only. Use <h2>, <p>, <strong>, <ul>, and <li>.
- Do not include markdown, code fences, <html>, <head>, or <body>.
- Include exactly these three sections in this order:
  1. <h2>Meta Description</h2>
  2. <h2>Blog Intro / Hook + Thesis Statement</h2>
  3. <h2>Social Media Caption / Teaser Post</h2>
- Meta Description must be 140-150 characters, include the main keyword, a clear benefit, and a CTA for Google search.
- Blog Intro must be 50-100 words. Include a hook, the reader's problem, and a thesis/solution outline.
- Social Media Caption must be 100-150 words. Include a hook, the problem, a teaser list with exactly 3 bullet points, the benefit, a CTA, and exactly 5 hashtags.
- Keep the copy specific to the title and keywords.
- Keep every sentence under 20 words.
- Aim for 10-14 words per sentence.
- Use simple everyday words.
- Replace complex words with simpler alternatives.
- Avoid jargon unless the topic requires it.

${SIMPLE_WORD_REPLACEMENTS}`
          },
          {
            role: 'user',
            content: `Title: "${title}"${metadataContext}

Generate the Meta Description, Blog Intro / Hook + Thesis Statement, and Social Media Caption / Teaser Post now.`
          }
        ],
        max_tokens: 1200,
        temperature: 0.25,
        stream: false,
      });
    }, 2, 1000);

    return completion.choices[0]?.message?.content?.trim() || '';
  }

  const promptMessages = [
    {
      role: 'system',
      content: `You are a professional SEO blog writer. Generate a professional SEO-friendly blog article in long-form article format for the given title (about ${safeWordCount} words).

Requirements:
- Write in a natural, human-like tone.
- Start directly with an engaging introduction paragraph. Do not add an H1 or repeat the title at the top.
- Use <h2> and <h3> headings.
- Write detailed paragraphs under each heading, with 2-4 paragraphs per major section.
- Do NOT use excessive bullet points or list-only sections.
- Avoid markdown symbols like **, ##, or *.
- Return the content as clean HTML suitable for a WordPress Rich Text Editor.
- Use tags such as <h2>, <h3>, <p>, <ul>, <ol>, and <li>.
- The article should read like a professionally written blog post similar to articles on Medium or HubSpot.
- Include a conclusion section at the end using <h2>Conclusion</h2>.
- Respect the requested tone and language. Incorporate the provided keywords, categories, and tags naturally for SEO.

Format rules:
- Return clean HTML body content only.
- Do NOT include markdown code fences, <html>, <head>, or <body> tags.
- Do NOT output a single paragraph. The article must read like a complete long-form blog post.
- Use <ul> or <ol> only when a short supporting list genuinely improves the article.

Readability requirements:
- Keep every sentence under 20 words.
- Aim for an average sentence length under 15 words.
- Split long sentences into two or more shorter sentences.
- Use simple, everyday words.
- Replace complex words with simpler alternatives.
- Avoid jargon unless the topic truly requires it.

${EXCELLENT_READABILITY_RULES}

${SIMPLE_WORD_REPLACEMENTS}`
    },
    {
      role: 'user',
      content: `Title: "${title}"${metadataContext}\n\nWrite the full professional SEO-friendly blog article now. Target length: ${safeWordCount} words. Run the silent readability review before responding. Return clean HTML only.`
    }
  ];

  const maxTokens = Math.min(6000, Math.max(2500, Math.ceil(safeWordCount * 3.2)));

  const completion = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model,
      messages: promptMessages,
      max_tokens: maxTokens,
      temperature: 0.3,
      stream: false,
    });
  }, 2, 1000);

  try {
    let raw = completion.choices[0]?.message?.content?.trim() || '';
    const minWords = Math.floor(safeWordCount * 0.9);
    const maxWords = Math.ceil(safeWordCount * 1.1);

    for (let attempt = 0; attempt < 2; attempt++) {
      const actualWords = countWords(raw);
      if (actualWords >= minWords && actualWords <= maxWords) {
        break;
      }

      if (actualWords < minWords) {
        const remainingWords = Math.max(safeWordCount - actualWords, 200);
        const continuation = await retryWithBackoff(async () => {
          return await groq.chat.completions.create({
            model,
            messages: [
              ...promptMessages,
              {
                role: 'user',
                content: `The existing HTML article content is ${actualWords} words and needs about ${remainingWords} more words. Continue the same long-form professional blog article with additional valid HTML sections only. Use <h2>, <h3>, and detailed <p> paragraphs. Avoid excessive bullet points, do not repeat earlier content, do not add a title or H1, and return only the continuation HTML. Make sure the final article includes a conclusion section. Keep every sentence under 20 words, aim for 10-14 words per sentence, use simple words, and run the silent readability review before responding.`
              }
            ],
            max_tokens: Math.min(3000, Math.max(800, Math.ceil(remainingWords * 3.2))),
            temperature: 0.25,
            stream: false,
          });
        }, 1, 750);

        const extra = continuation.choices[0]?.message?.content?.trim();
        if (!extra) break;
        raw = `${raw}\n${extra}`;
        continue;
      }

      const adjustment = await retryWithBackoff(async () => {
        return await groq.chat.completions.create({
          model,
          messages: [
            ...promptMessages,
            {
              role: 'user',
              content: `The previous HTML article content had ${actualWords} words, which is too long for the requested ${safeWordCount}-word target.\n\n${raw}\n\nShorten it to within ${minWords}-${maxWords} words. Keep the same topic, tone, SEO focus, long-form article structure, H2/H3 headings, detailed paragraphs, and conclusion section. Avoid markdown and excessive bullet points. Improve readability while shortening: every sentence under 20 words, average under 15 words, simple wording, low jargon. Return only the final clean HTML body content.`
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
          stream: false,
        });
      }, 1, 750);

      raw = adjustment.choices[0]?.message?.content?.trim() || raw;
    }

    return raw;
  } catch (err) {
    console.error('Failed to generate description:', err);
    return '';
  }
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateExcerpt(content: string, maxLength: number = 150): string {
  // Remove HTML tags
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}
export async function generateWorkflowPlan({ 
  userId,
  workflowName, 
  count,
  tone = 'Professional',
  language = 'English',
  wordCount = 1000,
}: { 
  userId?: string;
  workflowName: string; 
  count: number; 
  tone?: string;
  language?: string;
  wordCount?: number;
}): Promise<{ title: string; keywords: string[]; categories?: string[]; tags?: string[] }[]> {
  const groq = await getGroqClient(userId);
  const completion = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a content strategist. Based on a workflow theme/name, generate ${count} unique and engaging blog post titles, 3-5 relevant keywords, 1-2 categories, and 3-5 tags for each. Produce titles, keywords, categories and tags in the requested tone (${tone}) and language (${language}). Keep titles suitable for ~${wordCount} word posts.\nReturn the data ONLY as a valid JSON array of objects with \"title\" (string), \"keywords\" (array of strings), \"categories\" (array of strings), and \"tags\" (array of strings) properties. No other text, no markdown code blocks.`
        },
        {
          role: "user",
          content: `Workflow Theme: "${workflowName}"`
        }
      ],
    });
  }, 3, 2000);
  
  try {
    let rawContent = completion.choices[0]?.message?.content || '[]';
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawContent);
    return Array.isArray(parsed) ? parsed : (parsed.plan || []);
  } catch (err) {
    console.error("Failed to parse AI plan:", err);
    return [];
  }
}

export async function generateMetadata(title: string, options?: { userId?: string; language?: string; tone?: string }): Promise<{ keywords: string[], categories: string[], tags: string[] }> {
  const groq = await getGroqClient(options?.userId);
  const language = options?.language || 'English';
  const tone = options?.tone || 'Professional';
  const completion = await retryWithBackoff(async () => {
    return await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an SEO expert. Given a blog post title, generate 5-8 SEO keywords, 1-2 categories, and 3-5 tags in the requested language (${language}) and tone (${tone}).\nReturn the data ONLY as a valid JSON object with "keywords", "categories", and "tags" properties, all containing arrays of strings. Do NOT include markdown formatting or extra text.`
        },
        {
          role: "user",
          content: `Title: "${title}"`
        }
      ],
    });
  }, 3, 2000);
  
  try {
    let rawContent = completion.choices[0]?.message?.content || '{}';
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(rawContent);
  } catch (err) {
    console.error("Failed to parse AI metadata:", err);
    return { keywords: [], categories: [], tags: [] };
  }
}
