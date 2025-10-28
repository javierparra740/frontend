export interface NPSSurvey {
    id: number;
    user_id: number;
    score: number;
    comment: string | null;
    created_at: string;
}

export interface NPSSurveyCreate {
    user_id: number;
    score: number;
    comment?: string;
}

export interface NPSStats {
    promoters: number;
    passives: number;
    detractors: number;
    total_responses: number;
    average_score: number;
    nps_score: number; // % promoters - % detractors
}