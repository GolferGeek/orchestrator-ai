// Utility functions for case conversion - simplified after backend standardization
// The API now consistently returns camelCase, so most conversions are no longer needed

// Keep this function for any legacy compatibility needs
export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }

  const camelObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelObj[camelKey] = snakeToCamel(obj[key]);
    }
  }
  return camelObj;
}

// Legacy support for LLM Selection - API now expects camelCase directly
export function convertLLMSelectionToAPI(selection: any): any {
  // API now expects camelCase, so return as-is
  return selection;
}

// Legacy support for API responses - API now returns camelCase directly  
export function convertAPIResponseToFrontend(response: any): any {
  // API now returns camelCase, so return as-is
  return response;
}

// Format agent names from snake_case to Title Case for display
export function formatAgentName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}