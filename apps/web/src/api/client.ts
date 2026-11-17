import createClient from 'openapi-fetch';

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
            'application/json': {
              code: string;
              detail: string;
              status: number;
              title: string;
              type: string;
              requestId: string;
            };
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
            'application/json': {
              code: string;
              detail: string;
              status: number;
              title: string;
              type: string;
              requestId: string;
            };
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
            'application/json': {
              code: string;
              detail: string;
              status: number;
              title: string;
              type: string;
              requestId: string;
            };
          };
        };
      };
    };
  };
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = createClient<Paths>({
  baseUrl: API_BASE_URL,
});
