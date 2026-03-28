import type { Publication, SearchResult } from '../src/types';

export const mockPublications: Publication[] = [
  {
    id: 'fol_001',
    title: 'Client Testimonial Alpha',
    project: 'Marketing',
    category: 'Success Stories',
    created_at: '2024-01-15T09:30:00Z',
    status: 'published',
  },
  {
    id: 'fol_002',
    title: 'API Documentation Core',
    project: 'Developer Portal',
    category: 'Technical Guides',
    created_at: '2024-02-01T10:00:00Z',
    status: 'published',
  },
  {
    id: 'fol_003',
    title: 'Q3 Revenue Summary',
    project: 'Sales Operations',
    category: 'Sales Reports',
    created_at: '2024-03-01T10:00:00Z',
    status: 'published',
  },
  {
    id: 'fol_004',
    title: 'Deleted Case Study',
    project: 'Marketing',
    category: 'Success Stories',
    created_at: '2024-04-01T10:00:00Z',
    status: 'deleted',
  },
  {
    id: 'fol_005',
    title: 'Draft Migration Guide',
    project: 'Developer Portal',
    category: 'Technical Guides',
    created_at: '2024-05-01T10:00:00Z',
    status: 'draft',
  },
];

export const mockSearchResults: SearchResult[] = [
  { publication: mockPublications[0], score: 0.97 },
  { publication: mockPublications[1], score: 0.85 },
];

/** A unit vector of given dimension — useful for cosine similarity tests */
export function unitVector(dim: number, index: number): number[] {
  const v = new Array(dim).fill(0);
  v[index] = 1;
  return v;
}
