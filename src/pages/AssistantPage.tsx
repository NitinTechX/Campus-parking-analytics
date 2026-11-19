import React, { useState } from 'react';
import { Bot, Send, Sparkles, Trash2, User } from 'lucide-react';
import type { ParkingRecord, ThresholdConfig } from '../types/parking';
import {
  answerParkingQuestionLocally,
  buildAssistantContext,
  type LiveAssistantOverride,
} from '../utils/analytics';

interface AssistantPageProps {
  records: ParkingRecord[];
  thresholds: ThresholdConfig;
  isSimulated: boolean;
  liveOverride?: LiveAssistantOverride;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sourceLabel?: string;
  apiNotice?: string;
}

const SUGGESTED_QUESTIONS = [
  'How many parking spaces are currently available?',
  'Which parking location is most crowded?',
  'What is the average occupancy rate?',
  'Which day has the highest parking demand?',
  'What is the busiest parking hour?',
  'Compare Main Gate and Hostel Parking.',
  'Give me recommendations to reduce congestion.',
];

export function AssistantPage({
  records,
  thresholds,
  isSimulated,
  liveOverride,
}: AssistantPageProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Ready to analyze ${
        liveOverride ? 'live campus database parking zones' : `${records.length.toLocaleString()} active parking records`
      }. Ask any question about occupancy, available bays, location comparisons, peak hours, forecasts, or congestion recommendations.`,
      sourceLabel: 'Dataset Analytics Context',
    },
  ]);

  const askQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const contextSummary = buildAssistantContext(records, thresholds, isSimulated, liveOverride);

    try {
      const resp = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, contextSummary }),
      });

      const data = (await resp.json()) as {
        configured?: boolean;
        mode?: string;
        model?: string;
        answer?: string;
        error?: string;
      };

      if (resp.ok && data.configured && data.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: data.answer!,
            sourceLabel: `Gemini (${data.model ?? 'gemini-4-hydrogen'}) · Grounded in active dataset`,
          },
        ]);
      } else {
        const localAnswer = answerParkingQuestionLocally(
          trimmed,
          records,
          thresholds,
          isSimulated,
          liveOverride
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: localAnswer,
            sourceLabel: 'Local Dataset Query Engine (100% calculated from active records)',
            apiNotice: data.error,
          },
        ]);
      }
    } catch {
      const localAnswer = answerParkingQuestionLocally(
        trimmed,
        records,
        thresholds,
        isSimulated,
        liveOverride
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: localAnswer,
          sourceLabel: 'Local Dataset Query Engine',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Suggested Questions Sidebar */}
      <div className="xl:col-span-4 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none h-fit">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
          <span>Suggested Questions</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Every answer is computed directly from the active dataset ({records.length.toLocaleString()}{' '}
          filtered records) using server-side Gemini AI when configured or the deterministic Dataset
          Query Engine.
        </p>

        <div className="space-y-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => askQuestion(q)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Viewport */}
      <div className="xl:col-span-8 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl flex flex-col h-[600px] shadow-sm dark:shadow-none">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI Parking Assistant
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'reset',
                  sender: 'assistant',
                  text: `Conversation cleared. Active context holds ${records.length.toLocaleString()} records.`,
                  sourceLabel: 'Dataset Analytics Context',
                },
              ])
            }
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-blue-600/15 text-blue-600 dark:text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {msg.apiNotice && (
                  <div className="text-xs bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 rounded-md px-2.5 py-1.5 mb-2">
                    {msg.apiNotice}
                  </div>
                )}
                <div className="whitespace-pre-line">{msg.text}</div>
                {msg.sourceLabel && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800">
                    {msg.sourceLabel}
                  </div>
                )}
              </div>
              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              Analyzing active dataset figures...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(input);
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about availability, crowded zones, comparisons, or predictions..."
            className="flex-1 bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            Ask Assistant
          </button>
        </form>
      </div>
    </div>
  );
}
