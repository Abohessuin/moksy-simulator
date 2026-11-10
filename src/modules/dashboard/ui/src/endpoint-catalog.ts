import type { Endpoint, EndpointFilter, EndpointGroup } from './types';

/**
 * Filters the catalog by collection behavior and case-insensitive request text.
 *
 * @param endpoints - The complete endpoint catalog.
 * @param filter - The stateful/stateless filter to apply.
 * @param search - The method, path, or name text to match.
 * @returns Endpoints that satisfy both the type filter and search text.
 */
export function filterEndpoints(endpoints: Endpoint[], filter: EndpointFilter, search: string): Endpoint[] {
  const query = search.toLowerCase();
  return endpoints.filter((endpoint) => {
    const typeMatches = filter === 'all' || (filter === 'stateful' ? Boolean(endpoint.collection) : !endpoint.collection);
    return typeMatches && `${endpoint.method} ${endpoint.path} ${endpoint.name}`.toLowerCase().includes(query);
  });
}

/**
 * Keeps endpoint details aligned with the visible list after filtering or reloading.
 *
 * @param endpoints - The currently visible endpoints.
 * @param selectedKey - The previously selected endpoint identifier.
 * @returns The matching endpoint, the first visible endpoint, or `undefined`.
 */
export function selectEndpoint(endpoints: Endpoint[], selectedKey: string): Endpoint | undefined {
  return endpoints.find((endpoint) => endpoint.key === selectedKey) ?? endpoints[0];
}

/**
 * Groups visible endpoints in agreement order by their stateful collection.
 *
 * @param endpoints - The visible endpoints to group.
 * @returns Ordered endpoint groups for catalog rendering.
 */
export function groupEndpoints(endpoints: Endpoint[]): EndpointGroup[] {
  const groups = new Map<string, Endpoint[]>();
  for (const endpoint of endpoints) {
    const label = endpoint.collection ? `Stateful · ${endpoint.collection}` : 'Independent · Stateless';
    const items = groups.get(label) ?? [];
    items.push(endpoint);
    groups.set(label, items);
  }
  return Array.from(groups, ([label, items]) => ({ label, endpoints: items }));
}
