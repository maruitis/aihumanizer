require('dotenv').config();
const express = require('express');
const OpenAI  = require('openai');
const path    = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public_html')));

// OpenRouter client (OpenAI-compatible API)
const ai = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'X-Title': 'TextHuman'
  }
});

// ── Style guides ──────────────────────────────────────────────────────────────
const styleGuides = {
  passage:     'a flowing narrative passage with smooth transitions, vivid description, and a storytelling quality that draws readers through naturally',
  article:     'a journalistic article with a strong lede, clear inverted-pyramid structure, factual grounding, and an objective yet compelling tone',
  research:    'academic research writing with precise terminology, evidence-based reasoning, appropriately hedged claims, formal register, and citation-ready phrasing',
  email:       'a professional email that is purposeful, warmly direct, concise, and action-oriented — with a natural opening and close',
  essay:       'a well-structured essay with a clear thesis, supporting evidence, acknowledgment of counterpoints, and a conclusion that earns its ending',
  instagram:   'an authentic Instagram caption written the way a real, thoughtful person would post — personal, resonant, and honest, without sounding curated or performative',
  informative: 'informative explanatory text that teaches with clarity and logic — using concrete examples, accessible language, and precise but never jargon-heavy vocabulary',
  emotional:   'emotionally resonant prose that connects through sensory detail, genuine empathy, quiet vulnerability, and truth — never manipulative, always earned'
};

// ── Audience guides ───────────────────────────────────────────────────────────
const audienceGuides = {
  general:       'the general public — use everyday language any adult can understand; avoid jargon; prioritize clarity above all',
  students:      'students — be encouraging, scaffold complex ideas with relatable analogies, and keep an approachable yet substantive tone',
  professionals: 'working professionals — be efficient, precise, and respect their expertise; use domain-appropriate vocabulary without over-explaining',
  academics:     'academic scholars — use formal register, assume deep domain knowledge, and engage with nuance and conceptual complexity',
  teenagers:     'teenagers — be authentic and direct, avoid condescension, use contemporary phrasing while keeping the substance intact',
  executives:    'business executives — lead with value and outcomes, be strategic and high-level, keep it tight with clear takeaways',
  children:      'children — use simple words, short sentences, concrete examples, and a warm, encouraging voice that respects their intelligence',
  creative:      'creative writers — use expressive, precise language; honor stylistic variation; bring literary craft to bear without being precious about it'
};

// ── Humanize endpoint ─────────────────────────────────────────────────────────
app.post('/humanize', async (req, res) => {
  const { text, style, audience } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide text to humanize.' });
  }

  const systemPrompt = `You are an expert text humanizer — a specialist in transforming AI-generated text into prose that is indistinguishable from writing produced by a thoughtful, skilled human author.

Your methodology draws directly from:
- Grammarly's writing quality standards: sentence variety, active voice preference, purposeful word choice, natural flow
- Cambridge Dictionary's lexical guidance: idiomatic expressions, precise collocations, authentic register
- Reading Rockets' literacy frameworks: readability, coherence, engagement, and purposeful structure
- ReadWriteThink's writing process principles: audience awareness, revision discipline, purpose-driven prose
- Khan Academy's communication clarity: logical progression, example-driven explanation, accessible depth without dumbing down

Transformation principles — apply all of these:
1. Sentence rhythm — alternate between short punchy sentences and longer flowing ones; no two consecutive sentences should be the same length pattern
2. Voice — default to active; use passive only when it genuinely reads more naturally
3. Discourse markers — weave in natural connectives: "That said," "In practice," "What's more," "Of course," "Curiously," "Then again," etc.
4. Human texture — include occasional parenthetical asides, em-dash digressions, or hedged phrasing that reflects genuine human thought in motion
5. Vocabulary — precise but never ostentatious; strip out AI-signature words like "delve," "crucial," "comprehensive," "it's worth noting," "I cannot stress enough," "transformative," "game-changing," "seamlessly," "straightforward"
6. Sentence openings — vary them; never start two consecutive sentences with the same word or construction
7. Paragraph bridges — connect sections with natural bridges, not formulaic transitions
8. Register — match the required style and audience precisely without overcorrecting or performing
9. Factual integrity — preserve every piece of information, argument, and nuance from the original
10. Naturalness — the output must read as if a thoughtful person sat down and wrote it from scratch

Target style: ${styleGuides[style] || styleGuides.passage}
Target audience: ${audienceGuides[audience] || audienceGuides.general}

Output ONLY the humanized text. No preamble, no meta-commentary, no quotation marks around the result.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await ai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 1500,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Transform this text:\n\n${text}` }
      ]
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message || 'Unknown error' })}\n\n`);
    res.end();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  TextHuman running at http://localhost:${PORT}\n`);
});
