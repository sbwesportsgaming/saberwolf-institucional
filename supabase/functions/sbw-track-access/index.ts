import { createHandler } from "./access-handler.mjs";
import { SITE } from "./site-config.ts";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
Deno.serve(createHandler({ ...SITE, projectUrl: Deno.env.get("SUPABASE_URL") || "", serverKey: key, rateSalt: key }));
