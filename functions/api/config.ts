import { json, type Env } from "../_auth";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json({ clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY || "" });
};
