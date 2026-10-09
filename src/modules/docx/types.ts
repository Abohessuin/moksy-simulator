export type RawTableRow = string[];

export interface RawTable {
  headers: string[];
  rows: RawTableRow[];
}

export interface RawEndpointMetadata {
  apiName?: string;
  method?: string;
  path?: string;
  authentication?: string;
  requestBody?: string;
  successStatus?: string;
  successBody?: string;
}

export interface RawEndpointBlock {
  metadata: RawEndpointMetadata;
  requestFieldsTable?: RawTable;
  successResponseTable?: RawTable;
  errorResponsesTable?: RawTable;
}

export interface DocxElement {
  type: 'paragraph' | 'table';
  text?: string;
  table?: RawTable;
}
