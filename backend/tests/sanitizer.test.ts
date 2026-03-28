import { sanitizePublications } from '../src/services/sanitizer';
import type { RawPublication } from '../src/types';

jest.mock('../src/lib/openai', () => ({
  openai: {
    chat: { completions: { create: jest.fn() } },
  },
}));

jest.mock('../src/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));

import { openai } from '../src/lib/openai';

const mockRaw: RawPublication[] = [
  {
    id: 'fol_001',
    project_name: 'MARKETING_2024',
    title: 'DRAFT_Client Testimonial Alpha',
    category: 'Success Stories',
    created_at: '2024-01-15T09:30:00Z',
    status: 'draft',
  },
  {
    id: 'fol_009',
    project_name: 'Dev_Portal_v2',
    title: '',
    category: 'Technical Guides',
    created_at: '2024-02-10T09:00:00Z',
    status: 'draft',
  },
  {
    id: 'fol_043',
    project_name: 'Dev_Portal_v2',
    title: null,
    category: 'Technical Guides',
    created_at: '2024-02-25T10:00:00Z',
    status: 'draft',
  },
];

const mockPass1 = {
  project_mapping: {
    MARKETING_2024: 'Marketing',
    Dev_Portal_v2: 'Developer Portal',
  },
  category_mapping: {
    'Success Stories': 'Success Stories',
    'Technical Guides': 'Technical Guides',
    null: 'Uncategorised',
  },
};

const mockPass2 = {
  publications: [
    { id: 'fol_001', title: 'Client Testimonial Alpha', project: 'Marketing', category: 'Success Stories' },
    { id: 'fol_009', title: 'Untitled Document', project: 'Developer Portal', category: 'Technical Guides' },
    { id: 'fol_043', title: 'Untitled Document', project: 'Developer Portal', category: 'Technical Guides' },
  ],
};

function setupMocks() {
  (openai.chat.completions.create as jest.Mock)
    .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(mockPass1) } }] })
    .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(mockPass2) } }] });
}

describe('sanitizePublications', () => {
  beforeEach(setupMocks);
  afterEach(() => jest.clearAllMocks());

  describe('title cleaning', () => {
    it('removes DRAFT_ prefix', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].title).toBe('Client Testimonial Alpha');
      expect(result[0].title).not.toMatch(/DRAFT/i);
    });

    it('replaces empty string title with "Untitled Document"', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[1].title).toBe('Untitled Document');
    });

    it('replaces null title with "Untitled Document"', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[2].title).toBe('Untitled Document');
    });
  });

  describe('project normalisation', () => {
    it('maps messy project_name to canonical project via discovered mapping', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].project).toBe('Marketing');
    });

    it('renames project_name field to project', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0]).not.toHaveProperty('project_name');
      expect(result[0]).toHaveProperty('project');
    });
  });

  describe('field preservation', () => {
    it('preserves status unchanged', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].status).toBe('draft');
    });

    it('preserves created_at unchanged', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].created_at).toBe('2024-01-15T09:30:00Z');
    });

    it('returns same count as input', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result).toHaveLength(mockRaw.length);
    });
  });

  describe('API call strategy', () => {
    it('calls OpenAI exactly twice — one pass per concern', async () => {
      await sanitizePublications(mockRaw);
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('Pass 1 sends only unique project_name values (no duplicates)', async () => {
      await sanitizePublications(mockRaw);
      const pass1Body = JSON.parse(
        (openai.chat.completions.create as jest.Mock).mock.calls[0][0].messages[1].content
      );
      const names = pass1Body.project_names as string[];
      expect(names.length).toBe(new Set(names).size);
    });

    it('Pass 1 sends only unique category values (no duplicates)', async () => {
      await sanitizePublications(mockRaw);
      const pass1Body = JSON.parse(
        (openai.chat.completions.create as jest.Mock).mock.calls[0][0].messages[1].content
      );
      const cats = pass1Body.categories as string[];
      expect(cats.length).toBe(new Set(cats).size);
    });
  });
});
