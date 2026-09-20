import { CatalogProduct } from './catalog.model';

export interface RecommendationResponse {
  message: string;
  interpretation: {
    category?: string | null;
    color?: string | null;
    season?: string | null;
    gender?: string | null;
    size?: string | null;
    search?: string | null;
  };
  matched_filters: Record<string, string>;
  recommendations: CatalogProduct[];
}
