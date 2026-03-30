import { openai } from "../lib/openai";
import { withRetry } from "../lib/retry";
import { Publication, VectorEntry, SearchResult, BrowseSort, STATUS_VALUES } from "../types";
import { cosineSimilarity } from "../lib/cosine";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 20;
const MIN_SIMILARITY_SCORE = 0.35;

class VectorStore {
    private entries: VectorEntry[] = [];
    private built = false;
    private metadata: { projects: string[]; categories: string[] } | null =
        null;

    async build(publications: Publication[]): Promise<void> {
        console.log(
            `[VectorStore] Embedding ${publications.length} publications in batches of ${BATCH_SIZE}...`,
        );
        // Mark not ready during rebuild so concurrent requests don't operate on
        // an empty or partially-built store.
        this.built = false;
        this.entries = [];
        const start = Date.now();

        for (let i = 0; i < publications.length; i += BATCH_SIZE) {
            const batch = publications.slice(i, i + BATCH_SIZE);

            // Embed title + category + project together for richer semantic signal.
            // A search for "success story" should match docs categorised as "Success Stories"
            // even when their title alone is a generic "Case Study: ACME".
            // Including project name ensures project-name queries (e.g. "America") match
            // publications that belong to that project even when the title doesn't mention it.
            const inputs = batch.map((p) => `${p.title} ${p.category} ${p.project}`);

            const response = await withRetry(
                () =>
                    openai.embeddings.create({
                        model: EMBEDDING_MODEL,
                        input: inputs,
                    }),
                { label: `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}` },
            );

            response.data.forEach((embeddingObj, index) => {
                this.entries.push({
                    publication: batch[index],
                    vector: embeddingObj.embedding,
                });
            });

            console.log(
                `  [VectorStore] ${Math.min(i + BATCH_SIZE, publications.length)}/${publications.length} embedded`,
            );
        }

        this.metadata = {
            projects: Array.from(
                new Set(publications.map((p) => p.project)),
            ).sort(),
            categories: Array.from(
                new Set(publications.map((p) => p.category)),
            ).sort(),
        };
        this.built = true;
        console.log(
            `[VectorStore] Build complete in ${Date.now() - start}ms.\n`,
        );
    }

    async embedText(text: string): Promise<number[]> {
        const response = await withRetry(
            () =>
                openai.embeddings.create({
                    model: EMBEDDING_MODEL,
                    input: text,
                }),
            { label: "embedText" },
        );
        return response.data[0].embedding;
    }

    /**
     * Search using a pre-computed vector. Always call embedText() first,
     * then pass the result here — avoids double-embedding per request.
     *
     * @param includeDeleted - When true, deleted publications are included in results.
     *   Default false (deleted docs are excluded from normal search, see "recycle bin" feature).
     */
    searchByVector(
        queryVector: number[],
        includeDeleted = false,
    ): SearchResult[] {
        if (!this.built) throw new Error("[VectorStore] Store not built yet");

        const filtered = includeDeleted
            ? this.entries
            : this.entries.filter((e) => e.publication.status !== "deleted");

        return filtered
            .map((entry) => ({
                publication: entry.publication,
                score: cosineSimilarity(queryVector, entry.vector),
            }))
            .filter((r) => r.score >= MIN_SIMILARITY_SCORE)
            .sort((a, b) => b.score - a.score);
    }

    getAll(): Publication[] {
        return this.entries.map((e) => e.publication);
    }

    listPublications(opts: {
        project?: string;
        category?: string;
        sort?: BrowseSort;
        page: number;
        limit: number;
    }): { items: Publication[]; total: number; totalPages: number } {
        if (!this.built) throw new Error("[VectorStore] Store not built yet");

        let publications = this.getAll();

        if (opts.project) {
            publications = publications.filter(
                (p) => p.project.toLowerCase() === opts.project!.toLowerCase(),
            );
        }
        if (opts.category) {
            publications = publications.filter(
                (p) =>
                    p.category.toLowerCase() === opts.category!.toLowerCase(),
            );
        }

        // Derived from STATUS_VALUES — adding a new status requires updating only the const.
        const STATUS_ORDER = Object.fromEntries(
            STATUS_VALUES.map((s, i) => [s, i])
        ) as Record<Publication['status'], number>;
        const sorters: Record<BrowseSort, (a: Publication, b: Publication) => number> = {
            'date-desc':   (a, b) => b.created_at.localeCompare(a.created_at),
            'date-asc':    (a, b) => a.created_at.localeCompare(b.created_at),
            'title-asc':   (a, b) => a.title.localeCompare(b.title),
            'title-desc':  (a, b) => b.title.localeCompare(a.title),
            'project-asc': (a, b) => a.project.localeCompare(b.project),
            'status':      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
        };
        publications.sort(sorters[opts.sort ?? 'date-desc']);

        const total = publications.length;
        const totalPages = Math.ceil(total / opts.limit);
        const start = (opts.page - 1) * opts.limit;
        const items = publications.slice(start, start + opts.limit);

        return { items, total, totalPages };
    }

    getMetadata(): { projects: string[]; categories: string[] } {
        if (!this.built || !this.metadata)
            throw new Error("[VectorStore] Store not built yet");
        return this.metadata;
    }

    isReady(): boolean {
        return this.built;
    }
}

export const vectorStore = new VectorStore();
