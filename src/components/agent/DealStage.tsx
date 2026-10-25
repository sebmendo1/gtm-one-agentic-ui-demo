import type { DealStage } from "@/lib/agents/fixtures";
import { StatusPill, type StatusTone } from "./AgentMessage";

const STAGE_TONE: Record<DealStage, StatusTone> = {
  Commit: "done",
  "Best case": "approval",
  Pipeline: "working",
};

export function DealStagePill({ stage }: { stage: DealStage }) {
  return <StatusPill tone={STAGE_TONE[stage]}>{stage}</StatusPill>;
}
