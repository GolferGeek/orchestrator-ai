import { DeliverableType, DeliverableFormat } from '@/services/deliverablesService';

// Helper to ensure string is a valid DeliverableType
export function toDeliverableType(type: string | DeliverableType): DeliverableType {
  if (Object.values(DeliverableType).includes(type as DeliverableType)) {
    return type as DeliverableType;
  }
  // Default fallback
  return DeliverableType.DOCUMENT;
}

// Helper to ensure string is a valid DeliverableFormat  
export function toDeliverableFormat(format: string | DeliverableFormat): DeliverableFormat {
  if (Object.values(DeliverableFormat).includes(format as DeliverableFormat)) {
    return format as DeliverableFormat;
  }
  // Default fallback
  return DeliverableFormat.MARKDOWN;
}

// Convert service deliverable (with string dates) to store deliverable (with Date objects)
export function convertServiceToStoreDeliverable(serviceDeliverable: any): any {
  return {
    ...serviceDeliverable,
    deliverable_type: toDeliverableType(serviceDeliverable.deliverable_type),
    format: toDeliverableFormat(serviceDeliverable.format),
    created_at: new Date(serviceDeliverable.created_at),
    updated_at: new Date(serviceDeliverable.updated_at),
    content_preview: serviceDeliverable.content_preview || serviceDeliverable.content?.substring(0, 200) || ''
  };
}

// Convert store deliverable to service format
export function convertStoreToServiceDeliverable(storeDeliverable: any): any {
  return {
    ...storeDeliverable,
    created_at: storeDeliverable.created_at instanceof Date 
      ? storeDeliverable.created_at.toISOString() 
      : storeDeliverable.created_at,
    updated_at: storeDeliverable.updated_at instanceof Date
      ? storeDeliverable.updated_at.toISOString()
      : storeDeliverable.updated_at
  };
}