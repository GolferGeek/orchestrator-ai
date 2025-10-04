/**
 * Simplified PII Metadata Types
 *
 * Clean, minimal structure for PII tracking without legacy complexity
 */

/**
 * Represents a flagged PII item detected by pattern matching
 */
export interface PIIFlag {
  value: string; // The actual PII value detected
  dataType: string; // Type of PII (email, phone, ssn, name, etc.)
  severity: 'info' | 'warning' | 'showstopper';
  confidence: number; // Detection confidence (0.0 to 1.0)
  pattern: string; // Pattern that matched
}

/**
 * Represents a pseudonymized item replaced by dictionary
 */
export interface PIIPseudonym {
  original: string; // Original value
  pseudonym: string; // Replacement pseudonym
  dataType: string; // Type of data
  conversationId?: string; // For tracking reversals
}

/**
 * Simplified PII metadata structure
 * This is all we need - flags and pseudonyms
 */
export interface SimplifiedPIIMetadata {
  // Pattern-detected PII items (flagged for awareness)
  flags: PIIFlag[];

  // Dictionary-replaced items (actually pseudonymized)
  pseudonyms: PIIPseudonym[];

  // Simple counts for quick access
  flagCount: number;
  pseudonymCount: number;

  // Optional: Track if there were showstoppers that blocked the request
  blocked?: boolean;
  blockingReason?: string;
}

/**
 * Helper function to create empty PII metadata
 */
export function createEmptyPIIMetadata(): SimplifiedPIIMetadata {
  return {
    flags: [],
    pseudonyms: [],
    flagCount: 0,
    pseudonymCount: 0,
  };
}

/**
 * Helper function to merge PII metadata from multiple sources
 */
export function mergePIIMetadata(
  ...sources: Partial<SimplifiedPIIMetadata>[]
): SimplifiedPIIMetadata {
  const merged: SimplifiedPIIMetadata = createEmptyPIIMetadata();

  for (const source of sources) {
    if (source.flags) {
      merged.flags.push(...source.flags);
    }
    if (source.pseudonyms) {
      merged.pseudonyms.push(...source.pseudonyms);
    }
    if (source.blocked) {
      merged.blocked = true;
      merged.blockingReason = source.blockingReason || merged.blockingReason;
    }
  }

  merged.flagCount = merged.flags.length;
  merged.pseudonymCount = merged.pseudonyms.length;

  return merged;
}
