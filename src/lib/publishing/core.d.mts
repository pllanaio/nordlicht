import type { PublicationProvider, TikTokCreator } from './types';
export type StoredConnection = { provider: string; accountId: string; displayName: string; accessToken: string; refreshToken?: string; tokenExpiresAt?: string; scopes: string[]; connectedAt: string; profileImageUrl?: string };
export const publishingProviders: PublicationProvider[];
export const requiredScopes: Record<PublicationProvider, string[]>;
export class PublishingError extends Error { uncertain: boolean; constructor(message: string, uncertain?: boolean); }
export function encryptState(value: unknown): Buffer;
export function decryptState(value: Buffer): StoredConnection;
export function assertConnection(connection: StoredConnection, provider: PublicationProvider): void;
export function refreshConnection(connection: StoredConnection): Promise<StoredConnection>;
export function getTikTokCreator(connection: StoredConnection): Promise<TikTokCreator>;
export function signedMediaUrl(id: string): string;
export function verifyMediaSignature(id: string, expires: string, signature: string): boolean;
