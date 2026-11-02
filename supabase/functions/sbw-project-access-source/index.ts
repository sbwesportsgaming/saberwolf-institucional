import { createSourceHandler } from "./group-handler.mjs";
import { sourceConfig } from "./site-config.mjs";
Deno.serve(createSourceHandler({...sourceConfig,serverKey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}));
