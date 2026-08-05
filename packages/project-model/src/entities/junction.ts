import { z } from "zod";

export const JunctionSchema = z
  .object({
    category: z.enum(["y", "t", "splitter", "merger", "manifold", "generic"]),
  })
  .strict();

export type Junction = z.infer<typeof JunctionSchema>;
