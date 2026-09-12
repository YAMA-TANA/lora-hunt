import { json, type Env } from "../_auth";

export const onRequestGet: PagesFunction<Env> = async () => json({ resources: [], total: 0 });
