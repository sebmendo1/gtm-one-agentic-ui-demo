"use client";

import type { ComponentType } from "react";
import type { UiComponentId } from "@/lib/message";
import { CompanyWidget, IntentWidget, NextActionsWidget, ScoresWidget, SignalsWidget, WhyNowWidget } from "./AccountWidgets";
import { CommitteeWidget, ComparisonWidget, ContactWidget, GtmContextWidget, TechStackWidget } from "./PeopleWidgets";

export { CrmDraftCard } from "./PeopleWidgets";

/** The renderer only draws known components (docs/specs/03-genui-components.md). */
export const WIDGETS: Record<UiComponentId, ComponentType> = {
  company: CompanyWidget,
  intent: IntentWidget,
  signals: SignalsWidget,
  next_actions: NextActionsWidget,
  committee: CommitteeWidget,
  scores: ScoresWidget,
  tech_stack: TechStackWidget,
  comparison: ComparisonWidget,
  contact: ContactWidget,
  why_now: WhyNowWidget,
  gtm_context: GtmContextWidget,
};
