import createClient from 'openapi-fetch';

// Tipos derivados de packages/contracts/openapi.json (contrato aprobado en C0/C1/C2)
export type ProfileSummaryDto = {
  codigo: string;
  validUntil: string | null;
};

export type MfaEnrollResponseDto = {
  secret: string;
  otpauthUri: string;
};

export type MfaEnrollConfirmResponseDto = LoginResponseDto & {
  recoveryCodes: string[];
};

export type LoginResponseDto = {
  status:
    | 'authenticated'
    | 'password_change_required'
    | 'mfa_required'
    | 'mfa_enrollment_required';
  sessionToken?: string;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  csrfToken?: string;
  mustChangePassword: boolean;
  profiles: ProfileSummaryDto[];
};

export type MeResponseDto = {
  userId: string;
  email: string;
  nombre: string;
  estado: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  profiles: ProfileSummaryDto[];
  activeProfile: string | null;
  permissions: string[];
};

export type ProblemDetailsDto = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  errors: unknown[];
  requestId: string;
};

// Tipos para health (traídos del pull, endpoint /health/ready)
export type ReadinessReport = {
  status: 'ok' | 'unavailable';
  checks: Record<string, { status: 'up' | 'down'; latencyMs: number }>;
  checkedAt: string;
};

export type ProblemDetails = ProblemDetailsDto;

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
            'application/json': LoginResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        429: {
          content: {
            'application/json': ProblemDetailsDto;
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
            sessionToken: string;
            code: string;
            method?: 'totp' | 'recovery';
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        429: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/refresh': {
    post: {
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        403: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/logout': {
    post: {
      responses: {
        204: {
          description: 'Sesión cerrada';
        };
        403: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/password': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            currentPassword: string;
            newPassword: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        204: {
          description: 'Contraseña cambiada';
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/mfa/enroll': {
    post: {
      responses: {
        200: {
          content: {
            'application/json': MfaEnrollResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/mfa/enroll/confirm': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            sessionToken?: string;
            code: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': MfaEnrollConfirmResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
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
            'application/json': MeResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
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
      };
    };
  };
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = createClient<Paths>({
  baseUrl: API_BASE_URL,
});
