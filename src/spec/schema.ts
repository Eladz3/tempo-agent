import { z } from 'zod';

export const StepSchema = z.object({
  id: z.number(),
  description: z.string(),
  files_allowed: z.array(z.string()),
});

export const SpecSchema = z.object({
  goal: z.string(),
  constraints: z.array(z.string()),
  steps: z.array(StepSchema),
  tests: z.array(z.string()),
  definition_of_done: z.array(z.string()),
});

export type Step = z.infer<typeof StepSchema>;
export type Spec = z.infer<typeof SpecSchema>;
