import type { RawInternshipListing } from "../types/future.js";

/**
 * Source of internship listings (an official API, a permitted feed, or
 * manually curated data). Each provider is a separate implementation so
 * the platform is never coupled to one internship website. Implemented
 * starting Phase 3.
 */
export interface InternshipProvider {
  /** Stable key used as InternshipProvider.slug in the database. */
  readonly slug: string;
  readonly displayName: string;

  fetchListings(): Promise<RawInternshipListing[]>;
}
