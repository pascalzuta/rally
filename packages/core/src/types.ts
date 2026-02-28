export type PriorityStatus = "pending" | "done" | "partial" | "missed";

export interface Priority {
  id: string;
  title: string;
  why: string;
  blockers: string;
  status: PriorityStatus;
}

export interface DailyCheckin {
  date: string;
  confidence: number;
  priorities: Priority[];
}
