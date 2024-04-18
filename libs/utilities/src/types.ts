declare global {
  namespace NodeJS {
    interface ProcessEnv {
      POSTGRES_HOST: string;
      POSTGRES_PORT: string;
      POSTGRES_USER: string;
      POSTGRES_PASSWORD: string;
      POSTGRES_DATABASE: string;

      JWT_SECRET_KEY: string;
      JWT_EXPIRES_IN: string;
      HTTP_TIMEOUT: string;
      HTTP_MAX_REDIRECTS: string;

      AUDIT_LOG_API_HOST: string;
      AUDIT_LOG_API_TOKEN: string;
      AUDIT_LOG_CONFIG_ID: string;
      AUDIT_LOG_TENANT_ID: string;
    }
  }

  interface Request {
    user?: {
      id?: string;
      organizationId?: string;
    };
    connection?: {
      remoteAddress?: string;
    };
  }
}
// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
