export abstract class TotpService {
  abstract generateSecret(): string;
  abstract otpauthUri(secret: string, email: string): string;
  abstract verify(secret: string, code: string, at?: Date): boolean;
}
