import createClient from 'openapi-fetch';

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  requestId: string;
};

export type DependencyCheck = {
  status: 'up' | 'down';
  latencyMs: number;
};

export type ReadinessReport = {
  status: 'ok' | 'unavailable';
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
  checkedAt: string;
  requestId?: string | null;
};

export type LivenessReport = {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  requestId?: string | null;
};

export type Paths = {
  '/auth/login': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            email: string;
            password: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              accessToken: string | null;
              mfaRequired: boolean;
              partialSessionId: string | null;
            };
          };
        };
        401: {
          content: {
            'application/json': ProblemDetails;
          };
        };
      };
    };
  };
  '/auth/mfa/verify': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            partialSessionId: string;
            code: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              accessToken: string;
            };
          };
        };
        401: {
          content: {
            'application/json': ProblemDetails;
          };
        };
      };
    };
  };
  '/me': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': {
              id: string;
              email: string;
              fullName: string;
              role: string;
              profiles: string[];
              permissions: string[];
            };
          };
        };
        401: {
          content: {
            'application/json': ProblemDetails;
          };
        };
      };
    };
  };
  '/health/live': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': LivenessReport;
          };
        };
      };
    };
  };
  '/health/ready': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': ReadinessReport;
          };
        };
        503: {
          content: {
            'application/problem+json': ProblemDetails;
          };
        };
      };
    };
  };
};

const configuredBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  typeof configuredBaseUrl === 'string' && configuredBaseUrl.length > 0
    ? configuredBaseUrl
    : '/api/v1';

export const apiClient = createClient<Paths>({
  baseUrl: API_BASE_URL,
});
