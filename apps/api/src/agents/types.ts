export type SpecialistAgent = 'billing' | 'technical' | 'sales' | 'account';
export type AgentName = 'router' | SpecialistAgent | 'unknown';

export interface RouterResult {
  agent: AgentName;
  confidence: number;
  reasoning?: string;
}

export interface AgentConfig {
  name: SpecialistAgent;
  displayName: string;
  systemPrompt: string;
  actionKeywords: RegExp;
}

export interface OrchestratorTraceStep {
  type: 'route' | 'handoff' | 'tool_call' | 'tool_result' | 'approval' | 'undo';
  agent?: string;
  detail?: string;
  timestamp: string;
}

export interface SseEvent {
  type:
    | 'token'
    | 'status'
    | 'handoff'
    | 'approval_card'
    | 'undo_available'
    | 'trace'
    | 'done'
    | 'error'
    | 'conversation'
    | 'guardrail';
  [key: string]: unknown;
}
