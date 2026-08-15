// Drop-in replacement for the `window.storage` API that Claude artifacts
// provide natively. App.jsx was written against that API (get/set/delete/list),
// so instead of touching App.jsx we back the same interface with a single
// Supabase table called "storage" (key text primary key, value text).
//
// This keeps ALL app logic (users, questions, content, attempts) unchanged —
// every arnabpro_* key just becomes a row in this one table.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in a .env file (local) or in your Vercel project's Environment Variables (production)."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The app only ever calls storage with shared=true, but we keep the
// parameter and namespace by it anyway in case that ever changes.
function rowKey(key, shared) {
  return `${shared ? "shared" : "local"}:${key}`;
}

window.storage = {
  async get(key, shared = false) {
    const { data, error } = await supabase
      .from("storage")
      .select("value")
      .eq("key", rowKey(key, shared))
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: data.value, shared };
  },

  async set(key, value, shared = false) {
    const { error } = await supabase
      .from("storage")
      .upsert({ key: rowKey(key, shared), value }, { onConflict: "key" });
    if (error) throw error;
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const { error } = await supabase
      .from("storage")
      .delete()
      .eq("key", rowKey(key, shared));
    if (error) throw error;
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    const nsPrefix = `${shared ? "shared" : "local"}:${prefix}`;
    const { data, error } = await supabase
      .from("storage")
      .select("key")
      .like("key", `${nsPrefix}%`);
    if (error) throw error;
    const stripLen = (shared ? "shared:" : "local:").length;
    return { keys: (data || []).map((r) => r.key.slice(stripLen)), prefix, shared };
  },
};
