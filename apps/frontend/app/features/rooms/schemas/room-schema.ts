import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(100),
  description: z.string().trim().max(500).optional(),
});

export type CreateGroupValues = z.infer<typeof createGroupSchema>;
