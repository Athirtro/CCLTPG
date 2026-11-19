export abstract class FieldEncryption {
  abstract encrypt(plain: string, aad: string): string;
  abstract decrypt(payload: string, aad: string): string;
}
