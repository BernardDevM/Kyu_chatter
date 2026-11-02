import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  image: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Use an https:// URL"),
});

export type ProfileValues = z.infer<typeof profileSchema>;
