// Messages between the browser and a room's Durable Object. Shared by both sides.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const MAX_ANSWER = 45;
export const MAX_NAME = 12;
/** Votes each player hands out in the final round. */
export const FINAL_VOTES = 3;

export type Phase =
  | 'lobby'
  | 'answer' // rounds 1–2: everyone answers their two prompts
  | 'vote' // one head-to-head matchup at a time
  | 'reveal' // votes + points for that matchup
  | 'scores' // leaderboard between rounds
  | 'finalAnswer' // round 3: everyone answers the same prompt
  | 'finalVote'
  | 'finalReveal'
  | 'end';

export interface Settings {
  familyFriendly: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  vip: boolean;
  /** Finished the current answer/vote step. */
  done: boolean;
}

export interface MyPrompt {
  id: string;
  text: string;
  answered: boolean;
}

export interface Answer {
  /** Opaque id to vote for. Hidden author until reveal. */
  id: string;
  text: string;
  safety?: boolean;
  /** You wrote it (you can't vote for it). */
  mine?: boolean;
  /** Filled in on reveal. */
  author?: string;
  votes?: number;
  voters?: string[];
  points?: number;
  winner?: boolean;
}

export interface Matchup {
  index: number;
  total: number;
  prompt: string;
  answers: Answer[];
  /** You wrote one of these, so you watch instead of voting. */
  yours: boolean;
  /** Your current vote(s). */
  myVotes: string[];
  /** Everyone voted the same way. */
  sweep?: boolean;
  /** Both players typed the same thing; nobody scores. */
  jinx?: boolean;
  /** Only one player answered, so they win without a vote. */
  forfeit?: boolean;
}

export interface RoomState {
  code: string;
  phase: Phase;
  round: number;
  settings: Settings;
  players: PlayerInfo[];
  /** Epoch ms the current phase times out, or null. */
  deadline: number | null;
  /** Server clock, for computing the countdown. */
  now: number;
  me: string;
  myPrompts: MyPrompt[];
  matchup: Matchup | null;
}

export type ClientMsg =
  | { t: 'join'; name: string; playerId?: string }
  | { t: 'settings'; settings: Settings }
  | { t: 'start' }
  | { t: 'answer'; promptId: string; text: string }
  | { t: 'safety'; promptId: string }
  | { t: 'vote'; answerIds: string[] }
  | { t: 'skip' }
  | { t: 'again' };

export type ServerMsg =
  | { t: 'welcome'; playerId: string }
  | { t: 'state'; state: RoomState }
  | { t: 'error'; message: string; fatal?: boolean };
