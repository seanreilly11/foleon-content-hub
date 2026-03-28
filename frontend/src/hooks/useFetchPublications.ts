import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { publicationsDataSchema } from '../schemas';
import { PAGE_SIZE } from '../constants';

interface PublicationsParams {
  page: number;
  project: string;
  category: string;
}

export function useFetchPublications({ page, project, category }: PublicationsParams) {
  // apiGet returns ApiResult<PublicationsData> — { data: { items }, pagination }
  return useQuery({
    queryKey: ['publications', { page, project, category }],
    queryFn: ({ signal }) =>
      apiGet(
        '/api/publications',
        {
          page: String(page),
          limit: String(PAGE_SIZE),
          ...(project && { project }),
          ...(category && { category }),
        },
        publicationsDataSchema,
        { signal }
      ),
    placeholderData: (prev) => prev,
  });
}
