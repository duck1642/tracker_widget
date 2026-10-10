import type { Activity, ActivityFields, Objective } from "../../shared/parsers/types.ts";
import type { LogDayEntry } from "../../shared/services/types.ts";

export interface ISOWeek {

    year: number;

    week: number;

    rangeLabel?: string;

}
export interface WeekDescriptor extends ISOWeek {
  start: Date; end: Date; folderName: string; rangeLabel: string; dates: Date[];
}
export interface PlanEntry {
  id: string; day: string; session: string; subjects: string[];
  targetMinutes?: number; unknownDurationCount?: number; activities: Activity[];
}
export interface ActualEntry {
  day: string; session: string; subjects: string[]; actualMinutes: number;
  unknownDurationCount?: number; activities?: ActualActivity[];
}
export interface WeeklyDocument {
  frontmatterRaw: string; preambleRaw: string; unknownSectionsRaw: string[];
  isoWeek: ISOWeek; objectives: Objective[]; objectiveRawLines: string[];
  plan: PlanEntry[]; actual: ActualEntry[]; notesRaw: string;
}
export interface WeekContext { descriptor: ISOWeek; days: LogDayEntry[] }
export type ActualActivity = Pick<ActivityFields, "subjects" | "minutes"> & Partial<Pick<ActivityFields, "description">>;
export interface ActualDay { day: string; sessions: { name: string; activities: ActualActivity[] }[] }
