export type Permission = "board:read" | "board:write" | "knowledge:read" | "knowledge:write" | "runtime:read" | "ai:run" | "integration:import";
export interface Principal { kind: "user" | "service"; id: string; permissions: readonly Permission[]; expiresAt?: number }
export const humanPermissions: readonly Permission[];
export const amonPermissions: readonly Permission[];
export function permissionFor(pathname: string, method: string): Permission | null;
export function matchesServiceToken(header: string | null, expected: string | undefined): boolean;
export function accessStatus(principal: Principal | null, permission: Permission | null): 200 | 401 | 403;
export function authorizeRequest(input: { pathname: string; method: string; headers: Headers; serviceToken?: string; legacyServiceToken?: string; resolveUserSession: () => Promise<Principal | null> }): Promise<200 | 401 | 403>;
export function isAuthorizedOwner(userId: string | null, sessionId: string | null, configuredOwnerId: string | undefined): boolean;
export function parseAuthorizedParties(value: string | undefined, production: boolean): string[] | null;
export function principalForClerkSession(userId: string | null, sessionId: string | null, configuredOwnerId: string | undefined, claims: unknown, parties: string[] | null, now?: number): Principal | null;
export function isAllowedMutationOrigin(headers: Headers, requestOrigin: string, parties: string[] | null): boolean;
