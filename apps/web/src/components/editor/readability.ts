import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node as ProsemirrorNode } from '@tiptap/pm/model'

const COMMON_EASY_WORDS = new Set([
  "about", "after", "another", "article", "because", "before", "better",
  "business", "category", "content", "customer", "different", "during",
  "every", "example", "family", "favorite", "general", "important",
  "internet", "marketing", "natural", "personal", "possible", "question",
  "really", "simple", "similar", "specific", "together", "usually",
  "website", "without", "wordpress",
])

function countSyllables(word: string): number {
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
  return countSyllables(clean) >= 3
}

function findReadabilityIssues(doc: ProsemirrorNode) {
  const decorations: Decoration[] = []
  
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      let sentenceMatch;
      // Match sentences by breaking at punctuation.
      const sRegex = /([^.!?]+[.!?]+)|([^.!?]+$)/g;
      
      while ((sentenceMatch = sRegex.exec(node.text)) !== null) {
        const sentence = sentenceMatch[0];
        const sentenceStart = pos + sentenceMatch.index;
        const words = sentence.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []
        
        if (words.length > 20) {
          // Highlight entire sentence
          decorations.push(
            Decoration.inline(sentenceStart, sentenceStart + sentence.length, {
              class: 'readability-long-sentence',
              title: 'Long sentence (> 20 words) — consider splitting it up'
            })
          )
        } else {
          // Highlight complex words only if sentence is not already highlighted as long
          let wordMatch;
          const wordRegex = /\b[a-zA-Z]+\b/g;
          while ((wordMatch = wordRegex.exec(sentence)) !== null) {
            const word = wordMatch[0];
            if (isComplexWord(word)) {
              const wordStart = sentenceStart + wordMatch.index;
              decorations.push(
                Decoration.inline(wordStart, wordStart + word.length, {
                  class: 'readability-complex-word',
                  title: 'Complex word (3+ syllables) — consider simpler alternatives'
                })
              )
            }
          }
        }
      }
    }
  })
  
  return DecorationSet.create(doc, decorations)
}

export const ReadabilityHighlight = Extension.create({
  name: 'readabilityHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('readabilityHighlight'),
        state: {
          init(_, { doc }) {
            return findReadabilityIssues(doc)
          },
          apply(tr, old) {
            if (!tr.docChanged) return old.map(tr.mapping, tr.doc)
            return findReadabilityIssues(tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
