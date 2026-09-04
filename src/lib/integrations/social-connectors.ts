import "server-only";

import type { SocialConnectorCard } from "./contracts";
import type { SubscriptionEntitlement } from "@/lib/subscription-access";
import { isOAuthStateConfigured } from "./oauth-state";
import { getSocialConnectionSummaries, isSocialConnectionStoreConfigured } from "./social-connection-store";
import { getSocialOAuthProvider, getSocialPublishingScopes, socialProviderIds } from "./social-oauth";

export async function getSocialConnectorCards(storage: { mode: "demo" } | { mode: "workspace"; entitlement: SubscriptionEntitlement }): Promise<SocialConnectorCard[]> {
  const connections = await getSocialConnectionSummaries(socialProviderIds, storage);
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
