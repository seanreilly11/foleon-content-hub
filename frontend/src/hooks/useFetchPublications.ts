import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { publicationsDataSchema } from '../schemas';
import { PAGE_SIZE } from '../constants';
import type { BrowseSort } from '../types';

interface PublicationsParams {
  page: number;
  project: string;
  category: string;
  sort: BrowseSort;
}

export function useFetchPublications({ page, project, category, sort }: PublicationsParams) {
  // apiGet returns ApiResult<PublicationsData> — { data: { items }, pagination }
  return useQuery({
    queryKey: ['publications', { page, project, category, sort }],
    queryFn: ({ signal }) =>
      apiGet(
        '/api/publications',
        {
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
          ...(project && { project }),
          ...(category && { category }),
        },
        publicationsDataSchema,
        { signal }
      ),
    placeholderData: (prev) => prev,
  });
}
