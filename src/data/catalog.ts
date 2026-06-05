import type { CatalogSubject, CategoryAliases, PromotionRequirement, PromotionRequirementDataset, RequirementSourceRow, SubjectAliases } from "../types";

export type CatalogData = {
  subjects: CatalogSubject[];
  requirements: RequirementSourceRow[];
  promotionRequirements: PromotionRequirement[];
  categoryAliases: CategoryAliases;
  subjectAliases: SubjectAliases;
};

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}を読み込めませんでした`);
  return response.json() as Promise<T>;
};

const publicPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export const emptyCatalog: CatalogData = {
  subjects: [],
  requirements: [],
  promotionRequirements: [],
  categoryAliases: { aliases: {}, category_labels: {} },
  subjectAliases: { aliases: {} },
};

export const loadCatalogData = async (): Promise<CatalogData> => {
  const [subjects, requirements, promotionDataset, categoryAliases, subjectAliases] = await Promise.all([
    json<CatalogSubject[]>(publicPath("data/all_subjects.json")),
    json<RequirementSourceRow[]>(publicPath("data/graduation_requirements.json")),
    json<PromotionRequirementDataset>(publicPath("data/promotion_requirements.json")),
    json<CategoryAliases>(publicPath("data/category_aliases.json")),
    json<SubjectAliases>(publicPath("data/subject_aliases.json")),
  ]);
  return { subjects, requirements, promotionRequirements: promotionDataset.requirements, categoryAliases, subjectAliases };
};
