export class MoksyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoksyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MoksyConfigError extends MoksyError {
  public filePath?: string;

  constructor(message: string, filePath?: string) {
    super(filePath ? `[Moksy Config Error in ${filePath}]: ${message}` : `[Moksy Config Error]: ${message}`);
    this.name = 'MoksyConfigError';
    this.filePath = filePath;
  }
}

export interface AgreementErrorContext {
  filePath?: string;
  endpoint?: string;
  section?: string;
  row?: number | string;
  field?: string;
}

export class MoksyAgreementError extends MoksyError {
  public context: AgreementErrorContext;

  constructor(message: string, context: AgreementErrorContext = {}) {
    const details: string[] = [];
    if (context.filePath) details.push(`File: ${context.filePath}`);
    if (context.endpoint) details.push(`Endpoint: ${context.endpoint}`);
    if (context.section) details.push(`Section: ${context.section}`);
    if (context.row !== undefined) details.push(`Row: ${context.row}`);
    if (context.field) details.push(`Field: ${context.field}`);

    const header = details.length > 0 ? `[Moksy Agreement Error (${details.join(' | ')})]` : '[Moksy Agreement Error]';
    super(`${header}: ${message}`);
    this.name = 'MoksyAgreementError';
    this.context = context;
  }
}
