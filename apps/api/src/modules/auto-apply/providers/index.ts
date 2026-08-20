import type { ApplicationProvider } from "@intern-platform/shared";
import { MockApplicationProvider } from "./mockApplicationProvider.js";

/** Every registered application-submission channel. Add real providers alongside — see mockApplicationProvider.ts. */
export const applicationProviders: ApplicationProvider[] = [new MockApplicationProvider()];

/** Returns the first provider that can submit to this URL, or null (→ Manual Application Required). */
export function resolveApplicationProvider(applicationUrl: string): ApplicationProvider | null {
  return applicationProviders.find((p) => p.supports(applicationUrl)) ?? null;
}
