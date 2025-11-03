import { z } from "zod";

export const bokunProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  productCategory: z.string().optional(),
  excerpt: z.string().optional(),
  description: z.string().optional(),
  flags: z.array(z.string()).optional(),
});

export const bokunProductSearchResponseSchema = z.object({
  totalHits: z.number(),
  tookInMillis: z.number().optional(),
  items: z.array(bokunProductSchema),
});

export const connectionStatusSchema = z.object({
  connected: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
  responseTime: z.number().optional(),
});

export type BokunProduct = z.infer<typeof bokunProductSchema>;
export type BokunProductSearchResponse = z.infer<typeof bokunProductSearchResponseSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
