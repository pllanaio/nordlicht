import "server-only";

import type { SocialConnectorCard } from "./contracts";
import { isOAuthStateConfigured } from "./oauth-state";
import { getSocialConnectionSummaries, isSocialConnectionStoreConfigured } from "./social-connection-store";
import { getSocialOAuthProvider, getSocialPublishingScopes, socialProviderIds } from "./social-oauth";

export async function getSocialConnectorCards(): Promise<SocialConnectorCard[]> {
  const connections = await getSocialConnectionSummaries(socialProviderIds);
  const secureFlowConfigured = isOAuthStateConfigured() && isSocialConnectionStoreConfigured();

  return socialProviderIds.map((providerId) => {
    const provider = getSocialOAuthProvider(providerId);
    const connection = connections.get(providerId);
    const publishingScopes = getSocialPublishingScopes(providerId);
    return {
      provider: provider.id,
      label: provider.label,
      description: provider.description,
      docsUrl: provider.docsUrl,
      configured: provider.isConfigured() && secureFlowConfigured,
      publishingReady: Boolean(connection && publishingScopes.every((scope) => connection.scopes.includes(scope))),
      connection,
    };
  });
}
