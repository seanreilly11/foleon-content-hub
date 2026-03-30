import { openai } from "../lib/openai";
import { withRetry } from "../lib/retry";
import {
    cleanedPublicationsResponseSchema,
    mappingsSchema,
    rawPublicationArraySchema,
} from "../schemas";
import type { Mappings, RawPublication, Publication } from "../types";

// ─── Pass 1: Discover canonical names from raw unique values ─────────────────

const CLUSTERING_SYSTEM_PROMPT = `
You are a data analyst. You will receive two lists of raw strings from a legacy
content management system:
1. "project_names" — raw project identifiers (may be ALL_CAPS, kebab-case, snake_case,
   have version numbers, department suffixes, year suffixes, etc.)
2. "categories" — raw category labels (may be ALL CAPS, lowercase, mixed case; null
   is represented as the string "null")

Your tasks:
A. CLUSTER the project_names into logical groups. Each group represents the same
   real-world project expressed in different formats. For each group, invent ONE clean,
   human-readable canonical name in Title Case (e.g. "Marketing", "Developer Portal").
   Use semantic meaning to guide grouping — version numbers, year suffixes, department
   codes, and case differences should NOT create separate groups.

B. NORMALISE the categories. Group equivalent labels (same meaning, different casing
   or formatting) into one clean Title Case canonical label. If a value is "null" or
   clearly uncategorised, map it to "Uncategorised". Infer from context where possible.

Return ONLY valid JSON — no markdown, no explanation:
{
  "project_mapping": { "<raw_value>": "<canonical_name>", ... },
  "category_mapping": { "<raw_value>": "<canonical_name>", ... }
}
Every raw value provided MUST appear as a key in the appropriate mapping.
`.trim();

// ─── Pass 2: Clean all documents using discovered mappings ───────────────────

const CLEANING_SYSTEM_PROMPT = `
You are a data cleaning assistant for a content management system.
You will receive:
- "project_mapping": maps raw project_name values → canonical project names
- "category_mapping": maps raw category values → canonical category names
- "publications": array of documents to clean

For each publication:
1. CLEAN the title:
   - Strip dev-noise prefixes: DRAFT_, draft_, v1_, v2_, v3_, vN_, FINAL_, OLD_,
     COPY, COPY_, TEMP_, WIP_, [WIP]
   - Strip dev-noise suffixes: _FINAL, _final, _v1, _v2, _v3, _DRAFT, _draft,
     _copy, -copy, _backup, _TEST, _test, _WIP
   - Remove standalone inline version tokens like "v3", "v4.1", "V2" between spaces
   - Replace underscores used as word separators with spaces
   - Clean up double spaces, trailing hyphens, leading/trailing punctuation
   - Apply correct Title Case

2. MAP project_name → "project" using project_mapping
3. MAP category → "category" using category_mapping
   - If null/empty, infer from cleaned title before falling back to "Uncategorised"

Return ONLY valid JSON: { "publications": [...] }
Each item: { "id": string, "title": string, "project": string, "category": string }
`.trim();

async function discoverMappings(rawDocs: RawPublication[]): Promise<Mappings> {
    const uniqueProjects = Array.from(
        new Set(rawDocs.map((d) => d.project_name)),
    );
    const uniqueCategories = Array.from(
        new Set(rawDocs.map((d) => d.category ?? "null")),
    );

    console.log(
        `  [Pass 1] Clustering ${uniqueProjects.length} project variants, ` +
            `${uniqueCategories.length} category variants...`,
    );

    const response = await withRetry(
        () =>
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: CLUSTERING_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: JSON.stringify({
                            project_names: uniqueProjects,
                            categories: uniqueCategories,
                        }),
                    },
                ],
            }),
        { label: "Sanitizer Pass 1" },
    );

    const raw = response.choices[0].message.content;
    if (!raw) throw new Error("[Sanitizer] Pass 1: empty response from OpenAI");

    const parsed = mappingsSchema.parse(JSON.parse(raw));

    // Log the discovered mappings — impressive demo moment
    const canonicalProjects = Array.from(
        new Set(Object.values(parsed.project_mapping)),
    );
    const canonicalCategories = Array.from(
        new Set(Object.values(parsed.category_mapping)),
    );

    console.log(
        `  [Pass 1] Discovered ${canonicalProjects.length} canonical projects:`,
    );
    canonicalProjects.forEach((canon) => {
        const variants = Object.entries(parsed.project_mapping)
            .filter(([, v]) => v === canon)
            .map(([k]) => k);
        console.log(`    "${variants.join('", "')}" → "${canon}"`);
    });

    console.log(
        `  [Pass 1] Discovered ${canonicalCategories.length} canonical categories:`,
    );
    canonicalCategories.forEach((canon) => {
        const variants = Object.entries(parsed.category_mapping)
            .filter(([, v]) => v === canon)
            .map(([k]) => k);
        console.log(`    "${variants.join('", "')}" → "${canon}"`);
    });

    return parsed;
}

async function cleanDocuments(
    prepped: Array<{
        id: string;
        title: string;
        project_name: string;
        category: string;
    }>,
    mappings: Mappings,
): Promise<
    Array<{ id: string; title: string; project: string; category: string }>
> {
    console.log(`  [Pass 2] Cleaning ${prepped.length} publication titles...`);

    // withRetry wraps both the API call and the Zod parse — if the model returns
    // a malformed response, ZodError has no .status so withRetry will retry the
    // whole block (re-call the model) rather than surfacing a cryptic parse failure.
    const { publications } = await withRetry(
        async () => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: CLEANING_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: JSON.stringify({
                            ...mappings,
                            publications: prepped,
                        }),
                    },
                ],
            });

            const raw = response.choices[0].message.content;
            if (!raw)
                throw new Error(
                    "[Sanitizer] Pass 2: empty response from OpenAI",
                );

            return cleanedPublicationsResponseSchema.parse(JSON.parse(raw));
        },
        { label: "Sanitizer Pass 2" },
    );

    return publications;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse and validate raw JSON input against the schema before processing.
 * Catches malformed seed data at the boundary rather than failing deep in a service.
 */
export function parseRawPublications(data: unknown): RawPublication[] {
    return rawPublicationArraySchema.parse(data);
}

export async function sanitizePublications(
    rawDocs: RawPublication[],
): Promise<Publication[]> {
    console.log(
        `\n[Sanitizer] Starting sanitisation of ${rawDocs.length} publications...`,
    );

    // Count and log data quality issues found — useful for observability
    const nullTitles = rawDocs.filter((d) => !d.title?.trim()).length;
    const nullCategories = rawDocs.filter((d) => !d.category).length;
    if (nullTitles > 0)
        console.log(
            `  [Pre-process] ${nullTitles} null/empty titles → "Untitled Document"`,
        );
    if (nullCategories > 0)
        console.log(
            `  [Pre-process] ${nullCategories} null categories → will be inferred`,
        );

    // Pre-process in TypeScript: handle nulls before any LLM call
    const prepped = rawDocs.map((doc) => ({
        id: doc.id,
        title: doc.title?.trim() || "Untitled Document",
        project_name: doc.project_name,
        category: doc.category ?? "null",
    }));

    const mappings = await discoverMappings(rawDocs);
    const cleaned = await cleanDocuments(prepped, mappings);

    if (cleaned.length !== rawDocs.length) {
        throw new Error(
            `[Sanitizer] Count mismatch: expected ${rawDocs.length}, got ${cleaned.length}`,
        );
    }

    const cleanedMap = new Map(cleaned.map((c) => [c.id, c]));

    const result = rawDocs.map((doc): Publication => {
        const clean = cleanedMap.get(doc.id);
        return {
            id: doc.id,
            title: clean?.title ?? doc.title ?? "Untitled Document",
            project: clean?.project ?? doc.project_name,
            category: clean?.category ?? "Uncategorised",
            created_at: doc.created_at,
            status: doc.status,
        };
    });

    console.log(`[Sanitizer] Complete.\n`);
    return result;
}
