import { buildArgv, COMMANDS, displayCommand, type CommandDef, planEstimate, stepEstimate, type PlanStep } from "@/lib/gtm/commands";
import { GTM_JOBS, type GtmJob } from "@/lib/gtm/jobs";
import type { ApprovalRequest } from "@/lib/spec";
import type { Ledger } from "./evidence";

function jobLabel(job: GtmJob): string {
  return GTM_JOBS[job].split(":")[0]!.trim();
}

export function approvalSteps(ledger: Ledger, free: PlanStep[], paid: PlanStep[]): ApprovalRequest["steps"] {
  return [...free, ...paid].map((step) => {
    const def: CommandDef = COMMANDS[step.command];
    const built = buildArgv(step, ledger.ctx, null);
    const display =
      "argv" in built
        ? displayCommand(built.argv)
        : `gtm ${def.path.join(" ")} ${step.flags.map((f) => `--${f.name} ${f.values.join(" ")}`).join(" ")}`.trim();
    return {
      command: step.command,
      flags: step.flags,
      rawArgs: step.rawArgs,
      reason: step.reason,
      display,
      cost: def.cost,
      estimate: stepEstimate(step),
      executed: def.cost === "free",
    };
  });
}

export function approvalLead(request: ApprovalRequest, resolved: boolean): string {
  const name = request.entity.company ?? request.entity.contact ?? request.entity.domain ?? "this account";
  const paid = request.steps.filter((s) => !s.executed);
  const opener = resolved ? `I found **${name}** with a free search.` : `I can research **${name}**.`;
  const what = paid.map((s) => s.reason.charAt(0).toLowerCase() + s.reason.slice(1)).join(", and ");
  const estimate = request.estimate.replace(/^Estimate:\s*/, "").replace(/\.\s*Actual charges.*$/, "");
  const cost = estimate && estimate !== "Free" ? `That uses ${estimate} from your balance.` : "These spend your ZoomInfo credits.";
  return `${opener} To finish the ${jobLabel(request.job).toLowerCase()}, I'd run ${paid.length} more GTM call${paid.length === 1 ? "" : "s"}: ${what}. ${cost} Want me to go ahead?`;
}

export { planEstimate };
