import type { Activity } from "../../shared/parsers/types.ts";

export interface DailySession {
  id: string;
  name: string;
  activities: Activity[];
  rawLines?: string[];
}
export interface DailyDocument {
  frontmatterRaw: string;
  preambleRaw: string;
  date: string;
  sessions: DailySession[];
  totalMinutes: number;
  unknownDurationCount: number;
  notesRaw: string;
}
export type DailyDocumentInput = Pick<DailyDocument, "date" | "sessions"> & Partial<DailyDocument>;
export interface DailyContext { date: string }
