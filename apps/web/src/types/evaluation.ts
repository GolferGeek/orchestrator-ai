// Types for message evaluation system

export type UserRatingScale = 1 | 2 | 3 | 4 | 5;

export interface MessageEvaluation {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    userContext?: string;
    modelConfidence?: number;
  };
}

export interface EvaluationRequest {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    userContext?: string;
    modelConfidence?: number;
  };
}

export interface EvaluationResponse {
  id: string;
  messageId: string;
  userId: string;
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: any;
  createdAt: string;
  updatedAt: string;
}