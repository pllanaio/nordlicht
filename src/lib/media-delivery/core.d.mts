export const mediaUuidPattern: RegExp;
export function getMediaDeliveryOrigin(): string | null;
export function publicationSignature(id: string, expires: string | number): string;
export function verifyPublicationSignature(id: string, expires: string, signature: string): boolean;
export function signedAssetUrl(id: string, workspaceId: string, download?: boolean): string;
export function parseRange(value: string | null, size: number): {start: number; end: number} | null | false;
