import type { AskContext, AskResult } from "@/domain/ask/model";

export interface AskTurn extends AskResult {
  id: number;
  question: string;
}
export interface PendingQuestion {
  id: number;
  question: string;
  context: AskContext;
}
export interface AskSession {
  scopeKey: string;
  turns: AskTurn[];
  activeId: number | null;
  pending: PendingQuestion | null;
  error: PendingQuestion | null;
}
export type SessionAction =
  | { type: "reset"; scopeKey: string }
  | { type: "submit"; request: PendingQuestion }
  | { type: "resolve"; id: number; result: AskResult }
  | { type: "fail"; id: number }
  | { type: "cancel" }
  | { type: "select"; id: number };

export function emptySession(scopeKey: string): AskSession {
  return { scopeKey, turns: [], activeId: null, pending: null, error: null };
}
export function activeTurn(session: AskSession): AskTurn | undefined {
  return session.turns.find((turn) => turn.id === session.activeId);
}
export function activeContext(session: AskSession): AskContext {
  return activeTurn(session)?.context ?? { scopeKey: session.scopeKey };
}
export function sessionReducer(state: AskSession, action: SessionAction): AskSession {
  switch (action.type) {
    case "reset":
      return emptySession(action.scopeKey);
    case "submit":
      if (state.pending || action.request.context.scopeKey !== state.scopeKey) return state;
      return { ...state, pending: action.request, error: null };
    case "resolve": {
      if (
        state.pending?.id !== action.id ||
        action.result.answer.scope.key !== state.scopeKey ||
        action.result.context.scopeKey !== state.scopeKey
      )
        return state;
      const turn = { id: action.id, question: state.pending.question, ...action.result };
      return {
        ...state,
        turns: [...state.turns, turn],
        activeId: turn.id,
        pending: null,
        error: null,
      };
    }
    case "fail":
      return state.pending?.id === action.id
        ? { ...state, error: state.pending, pending: null }
        : state;
    case "cancel":
      return { ...state, pending: null, error: null };
    case "select":
      return !state.pending && state.turns.some((turn) => turn.id === action.id)
        ? { ...state, activeId: action.id, error: null }
        : state;
  }
}
