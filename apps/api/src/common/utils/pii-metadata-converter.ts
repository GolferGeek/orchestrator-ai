/**
 * Converter utility to transform legacy PII metadata to simplified structure
 */

import { PIIProcessingMetadata } from '../types/pii-metadata.types';
import { SimplifiedPIIMetadata, PIIFlag, PIIPseudonym } from '../types/simplified-pii-metadata.types';

/**
 * Converts legacy PIIProcessingMetadata to SimplifiedPIIMetadata
 */
export function convertToSimplifiedPIIMetadata(
  legacy: PIIProcessingMetadata | undefined | null
): SimplifiedPIIMetadata {
  if (!legacy) {
    return {
      flags: [],
      pseudonyms: [],
      flagCount: 0,
      pseudonymCount: 0
    };
  }

  // Extract flags from detection results
  const flags: PIIFlag[] = [];
  if (legacy.detectionResults?.flaggedMatches) {
    for (const match of legacy.detectionResults.flaggedMatches) {
      flags.push({
        value: match.value,
        dataType: match.dataType,
        severity: match.severity,
        confidence: match.confidence,
        pattern: match.pattern
      });
    }
  }

  // Extract pseudonyms from pseudonymResults or pseudonymInstructions
  const pseudonyms: PIIPseudonym[] = [];
  
  // Check pseudonymResults first (actual applied pseudonyms)
  if (legacy.pseudonymResults?.processedMatches) {
    for (const match of legacy.pseudonymResults.processedMatches) {
      if (match.pseudonym) {
        pseudonyms.push({
          original: match.value,
          pseudonym: match.pseudonym,
          dataType: match.dataType
        });
      }
    }
  }
  
  // If no results, check instructions (intended pseudonyms)
  else if (legacy.pseudonymInstructions?.targetMatches) {
    for (const match of legacy.pseudonymInstructions.targetMatches) {
      if (match.pseudonym) {
        pseudonyms.push({
          original: match.value,
          pseudonym: match.pseudonym,
          dataType: match.dataType
        });
      }
    }
  }

  // Check if request was blocked
  const blocked = legacy.showstopperDetected || legacy.policyDecision?.blocked || false;
  const blockingReason = legacy.policyDecision?.blockingReason || 
                         (legacy.showstopperDetected ? 'showstopper-pii' : undefined);

  return {
    flags,
    pseudonyms,
    flagCount: flags.length,
    pseudonymCount: pseudonyms.length,
    blocked,
    blockingReason
  };
}

/**
 * Converts dictionary pseudonymization results to simplified format
 */
export function convertDictionaryToSimplified(
  mappings: Array<{ originalValue: string; pseudonym: string; dataType: string }>
): SimplifiedPIIMetadata {
  const pseudonyms: PIIPseudonym[] = mappings.map(m => ({
    original: m.originalValue,
    pseudonym: m.pseudonym,
    dataType: m.dataType
  }));

  return {
    flags: [], // Dictionary doesn't create flags
    pseudonyms,
    flagCount: 0,
    pseudonymCount: pseudonyms.length
  };
}

/**
 * Merges PII metadata from pattern detection and dictionary pseudonymization
 */
export function mergePatternAndDictionary(
  patternMetadata: SimplifiedPIIMetadata,
  dictionaryMetadata: SimplifiedPIIMetadata
): SimplifiedPIIMetadata {
  return {
    flags: [...patternMetadata.flags],
    pseudonyms: [...patternMetadata.pseudonyms, ...dictionaryMetadata.pseudonyms],
    flagCount: patternMetadata.flagCount,
    pseudonymCount: patternMetadata.pseudonymCount + dictionaryMetadata.pseudonymCount,
    blocked: patternMetadata.blocked || dictionaryMetadata.blocked,
    blockingReason: patternMetadata.blockingReason || dictionaryMetadata.blockingReason
  };
}