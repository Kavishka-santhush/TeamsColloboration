const axios = require('axios');
const prisma = require('../config/prisma');
const env = require('../config/env');
const logger = require('../utils/logger.util');
const { ApiError } = require('../utils/response.util');

/**
 * ai.service — the single OpenRouter gateway. Every AI feature (summarize,
 * smart replies, translate, sentiment, chatbot, writing assistant, action
 * items) funnels through `complete()` so token/cost accounting is consistent.
 */

const client = axios.create({
  baseURL: env.openrouter.baseUrl,
  headers: {
    Authorization: `Bearer ${env.openrouter.apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.clientUrl,
    'X-Title': 'Team Communication Platform',
  },
});

/** Core chat completion with usage logging into AiUsageLog. */
async function complete({ messages, model, workspaceId, userId, feature, temperature = 0.4, maxTokens = 1000 }) {
  if (!env.openrouter.apiKey) throw new ApiError(503, 'AI is not configured (missing OPENROUTER_API_KEY)', null, 'AI_UNAVAILABLE');
  try {
    const { data } = await client.post('/chat/completions', {
      model: model || env.openrouter.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};
    if (workspaceId) {
      await prisma.aiUsageLog.create({
        data: {
          workspaceId,
          userId: userId || null,
          feature,
          model: data.model || env.openrouter.model,
          tokensIn: usage.prompt_tokens || 0,
          tokensOut: usage.completion_tokens || 0,
          // rough cost estimate; real pricing varies by model
          costUsd: ((usage.total_tokens || 0) * 0.000002).toFixed(6),
        },
      });
    }
    return content;
  } catch (err) {
    logger.error(`ai.complete failed: ${err.response?.data?.error?.message || err.message}`);
    throw new ApiError(502, 'AI provider error', err.response?.data, 'AI_PROVIDER_ERROR');
  }
}

// ---- Features --------------------------------------------------------------

async function summarizeText(text, { workspaceId, userId, focus } = {}) {
  const content = await complete({
    feature: 'summarize',
    workspaceId,
    userId,
    messages: [
      { role: 'system', content: 'You summarize workplace chat conversations concisely into bullet points.' },
      { role: 'user', content: `${focus ? `Focus on: ${focus}.\n\n` : ''}Summarize:\n${text}` },
    ],
  });
  return { summary: content };
}

async function smartReplies(incomingMessage, context, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'smart_replies',
    workspaceId,
    userId,
    maxTokens: 200,
    messages: [
      { role: 'system', content: 'Suggest exactly 3 short, professional Slack-style quick replies. Return a JSON array of strings.' },
      { role: 'user', content: `Context:\n${context}\n\nLatest message: ${incomingMessage}` },
    ],
  });
  try {
    return { replies: JSON.parse(content.match(/\[[\s\S]*\]/)[0]) };
  } catch {
    return { replies: content.split('\n').filter(Boolean).slice(0, 3) };
  }
}

async function translate(text, language, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'translate',
    workspaceId,
    userId,
    maxTokens: 800,
    messages: [
      { role: 'system', content: `Translate the user's text to ${language}. Output only the translation.` },
      { role: 'user', content: text },
    ],
  });
  return { translation: content, language };
}

async function sentiment(messages, { workspaceId, userId } = {}) {
  const sample = messages.map((m) => m.body).join('\n');
  const content = await complete({
    feature: 'sentiment',
    workspaceId,
    userId,
    maxTokens: 300,
    messages: [
      { role: 'system', content: 'Analyze team morale from chat messages. Return JSON {score: -1..1, label: "positive|neutral|negative", insight: string}.' },
      { role: 'user', content: sample },
    ],
  });
  try {
    return JSON.parse(content.match(/\{[\s\S]*\}/)[0]);
  } catch {
    return { score: 0, label: 'neutral', insight: content };
  }
}

async function meetingNotes(transcript, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'meeting_notes',
    workspaceId,
    userId,
    maxTokens: 1200,
    messages: [
      { role: 'system', content: 'From a call transcript, produce structured meeting notes with a Summary, Decisions, and Action items (with owners) as markdown.' },
      { role: 'user', content: transcript },
    ],
  });
  return { notes: content };
}

async function extractActionItems(text, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'action_items',
    workspaceId,
    userId,
    messages: [
      { role: 'system', content: 'Extract action items from the conversation. Return a JSON array of {task, owner}.' },
      { role: 'user', content: text },
    ],
  });
  try {
    return { items: JSON.parse(content.match(/\[[\s\S]*\]/)[0]) };
  } catch {
    return { items: [] };
  }
}

async function writingAssistant(text, tone, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'writing_assistant',
    workspaceId,
    userId,
    messages: [
      { role: 'system', content: `Rewrite the message to be ${tone} while preserving meaning. Output only the rewritten message.` },
      { role: 'user', content: text },
    ],
  });
  return { rewritten: content };
}

async function chatbot(question, history, workspaceContext, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'chatbot',
    workspaceId,
    userId,
    messages: [
      { role: 'system', content: `You are a helpful workspace assistant. Workspace context: ${workspaceContext}` },
      ...history,
      { role: 'user', content: question },
    ],
  });
  return { answer: content };
}

async function suggestTopic(messages, { workspaceId, userId } = {}) {
  const sample = messages.map((m) => m.body).join('\n');
  const content = await complete({
    feature: 'topic_suggester',
    workspaceId,
    userId,
    maxTokens: 120,
    messages: [
      { role: 'system', content: 'Suggest a short channel topic (max 80 chars) based on recent conversation. Output only the topic.' },
      { role: 'user', content: sample },
    ],
  });
  return { topic: content.trim() };
}

async function detectToxicity(text, { workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'toxicity',
    workspaceId,
    userId,
    maxTokens: 120,
    messages: [
      { role: 'system', content: 'Return JSON {flagged: boolean, reason: string} if the message is inappropriate or toxic for a workplace.' },
      { role: 'user', content: text },
    ],
  });
  try {
    return JSON.parse(content.match(/\{[\s\S]*\}/)[0]);
  } catch {
    return { flagged: false, reason: '' };
  }
}

async function icebreaker({ workspaceId, userId } = {}) {
  const content = await complete({
    feature: 'icebreaker',
    workspaceId,
    userId,
    maxTokens: 120,
    messages: [{ role: 'user', content: 'Generate one fun, inclusive team icebreaker question.' }],
  });
  return { question: content.trim() };
}

module.exports = {
  complete,
  summarizeText,
  smartReplies,
  translate,
  sentiment,
  meetingNotes,
  extractActionItems,
  writingAssistant,
  chatbot,
  suggestTopic,
  detectToxicity,
  icebreaker,
};
