import type { ReactNode } from 'react';
import type { EndpointFilter, EndpointGroup } from '../types';
import { Method } from './Method';

interface ApiCatalogViewProps {
  groups: EndpointGroup[];
  selectedKey: string;
  filter: EndpointFilter;
  search: string;
  children: ReactNode;
  onSelect: (key: string) => void;
  onFilterChange: (filter: EndpointFilter) => void;
  onSearchChange: (value: string) => void;
}

/**
 * Presents the endpoint catalog and details slot.
 *
 * @param props - Filter state, grouped endpoints, selected endpoint, and callbacks.
 * @returns The endpoint catalog element.
 */
export function ApiCatalogView(props: ApiCatalogViewProps) {
  const { groups, selectedKey, filter, search, children, onSelect, onFilterChange, onSearchChange } = props;
  return (
    <div className="split">
      <aside className="sidebar">
        <div className="sideHead">
          <h2>API catalog</h2>
          <p>Browse the imported agreement</p>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search method or path…"
            aria-label="Search endpoints"
          />
          <div className="filters">
            {(['all', 'stateful', 'stateless'] as const).map((value) => (
              <button
                className={filter === value ? 'active' : ''}
                onClick={() => onFilterChange(value)}
                key={value}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="endpointList">
          {groups.map((group) => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              {group.endpoints.map((endpoint) => (
                <button
                  className={`endpointItem ${endpoint.key === selectedKey ? 'active' : ''}`}
                  onClick={() => onSelect(endpoint.key)}
                  key={endpoint.key}
                >
                  <Method value={endpoint.method} />
                  <span>
                    <strong className="mono">{endpoint.path}</strong>
                    <small>{endpoint.name}</small>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="details">
        {children ?? <div className="empty">No endpoints match this filter.</div>}
      </section>
    </div>
  );
}
