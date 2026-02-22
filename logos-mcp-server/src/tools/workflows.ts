import { z } from "zod";
import { getWorkflowTemplates, getWorkflowInstances } from "../services/sqlite-reader.js";
import type { ToolResult } from "../types.js";

export const getStudyWorkflowsTool = {
  name: "get_study_workflows",
  description: "List available study workflow templates and active workflow instances from Logos Bible Software. Workflows provide structured, step-by-step study approaches like 'Inductive Bible Study', 'Lectio Divina', etc.",
  inputSchema: {
    type: "object" as const,
    properties: {
      include_instances: { type: "boolean", description: "Also show active workflow instances (default: true)" },
      instance_limit: { type: "number", description: "Max active instances to return (default: 10)" },
    },
    required: [],
  },
  async handler(args: Record<string, unknown>): Promise<ToolResult> {
    const { include_instances, instance_limit } = z.object({
      include_instances: z.boolean().optional(),
      instance_limit: z.number().optional(),
    }).parse(args);

    try {
      const templates = getWorkflowTemplates();
      const sections: string[] = [];

      // Templates
      if (templates.length > 0) {
        const templateLines = templates.map((t) => {
          const desc = t.templateJson
            ? (t.templateJson as Record<string, string>).title ?? t.externalId
            : t.externalId;
          return `- **${desc}** (${t.externalId})`;
        });
        sections.push(`## Available Workflow Templates\n\n${templateLines.join("\n")}`);
      } else {
        sections.push("No workflow templates found.");
      }

      // Instances
      if (include_instances !== false) {
        const instances = getWorkflowInstances(instance_limit ?? 10);
        if (instances.length > 0) {
          const instanceLines = instances.map((i) => {
            const status = i.completedDate ? "Completed" : `Step: ${i.currentStep ?? "unknown"}`;
            const completed = i.completedSteps.length;
            return `- **${i.title}** (${i.key}) — ${status}, ${completed} steps done`;
          });
          sections.push(`## Active Study Instances\n\n${instanceLines.join("\n")}`);
        } else {
          sections.push("No active workflow instances.");
        }
      }

      return { content: [{ type: "text", text: sections.join("\n\n") }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error reading workflows: ${msg}` }], isError: true };
    }
  },
};
