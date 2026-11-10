import { useEffect, useMemo, useState } from 'react';
import { ApiCatalogView } from '../components/ApiCatalogView';
import { filterEndpoints, groupEndpoints, selectEndpoint } from '../endpoint-catalog';
import type { Endpoint, EndpointFilter } from '../types';
import { EndpointDetailsContainer } from './EndpointDetailsContainer';

interface ApiCatalogContainerProps {
  endpoints: Endpoint[];
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}

/**
 * Owns catalog filters and keeps endpoint details aligned with the visible list.
 *
 * @param props - Endpoints plus callbacks for refreshing state and showing notices.
 * @returns The connected endpoint catalog.
 */
export function ApiCatalogContainer({ endpoints, onReload, onNotify }: ApiCatalogContainerProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const [filter, setFilter] = useState<EndpointFilter>('all');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterEndpoints(endpoints, filter, search), [endpoints, filter, search]);
  const groups = useMemo(() => groupEndpoints(visible), [visible]);
  const selected = selectEndpoint(visible, selectedKey);
  const visibleKey = selected?.key ?? '';

  useEffect(() => setSelectedKey(visibleKey), [visibleKey]);

  return (
    <ApiCatalogView
      groups={groups}
      selectedKey={visibleKey}
      filter={filter}
      search={search}
      onSelect={setSelectedKey}
      onFilterChange={setFilter}
      onSearchChange={setSearch}
    >
      {selected ? (
        <EndpointDetailsContainer
          key={selected.key}
          endpoint={selected}
          onReload={onReload}
          onNotify={onNotify}
        />
      ) : null}
    </ApiCatalogView>
  );
}
