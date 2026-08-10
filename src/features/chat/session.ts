import { Chat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";

import { authHeaders } from "@/api/auth";

// sessionStorage rather than localStorage, deliberately: a browser tab is one operator session, so
// two windows stay two independent conversations instead of one interleaved thread shared across
// screens. It also expires when the tab closes, which is the retention we want anyway.
const MESSAGES_KEY = "leitstand.chat.messages";

// The `ai` major must stay in step with the backend's chat `_SDK_VERSION`. Below 6 the
// tool-approval chunks are dropped with no error, so the approval gate is lost rather than broken.
const transport = new DefaultChatTransport({
  api: "/api/v1/chat",
  headers: authHeaders,
});

function readRaw(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private mode or quota. Continuity is a convenience; it must never break the panel.
  }
}

function readMessages(): UIMessage[] {
  const raw = readRaw(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
}

let session: Chat<UIMessage> | undefined;

// Resume the run as soon as the operator answers an approval, rather than waiting for their next
// message. Without this, addToolApprovalResponse only updates local state: the approved tool would
// never execute and the operator would see no result until they happened to send something else,
// leaving a stale approval that breaks the following turn.
const AUTO_RESUME_ON_APPROVAL =
  lastAssistantMessageIsCompleteWithApprovalResponses;

/**
 * Build a chat that saves itself once each turn completes.
 *
 * Persisting from the chat's own completion callback rather than from a render effect is what
 * keeps a half-finished turn out of storage. An effect watching status and messages also fires
 * while a turn is paused on an approval, so a reload at that moment would restore a tool call
 * with a decision but no result, which is the shape the server has to prune away. Aborted and
 * errored turns are skipped for the same reason: they have nothing worth restoring.
 */
function newSession(messages: UIMessage[] = []): Chat<UIMessage> {
  return new Chat({
    transport,
    messages,
    sendAutomaticallyWhen: AUTO_RESUME_ON_APPROVAL,
    onFinish: ({ messages, isAbort, isError }) => {
      if (isAbort || isError) return;
      writeRaw(MESSAGES_KEY, JSON.stringify(messages));
    },
  });
}

/**
 * The chat for this browser tab.
 *
 * Held outside React on purpose. The panel unmounts whenever the operator switches to another
 * tab, and a hook-local chat would go with it: the conversation would vanish and an answer still
 * streaming would be aborted mid-flight, leaving a question on the server with no answer.
 */
export function chatSession(): Chat<UIMessage> {
  session ??= newSession(readMessages());
  return session;
}

/** Abandon this conversation and start a fresh one. */
export function startNewChat(): Chat<UIMessage> {
  try {
    sessionStorage.removeItem(MESSAGES_KEY);
  } catch {
    // See writeRaw.
  }
  session = newSession();
  return session;
}
