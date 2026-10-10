export interface ActivityFields {
  subjects: string[];
  minutes: number | null;
  description: string;
}

export interface Activity extends ActivityFields { id: string }
export type ObjectiveStatus = "open" | "done" | "partial" | "cancelled";
export interface ObjectiveFields {
  subjects: string[];
  status: ObjectiveStatus;
  description: string;
  indent?: number;
}
export interface Objective extends ObjectiveFields { id: string; indent: number }
