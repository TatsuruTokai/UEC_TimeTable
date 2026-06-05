export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type Semester = "first" | "second" | "intensive" | "full-year";

export type CourseStatus = "planned" | "taking" | "earned" | "failed" | "retake";

export type CourseCategory =
  | "必修"
  | "選択必修"
  | "選択"
  | "自由科目"
  | "教養科目"
  | "専門科目"
  | "実験・演習"
  | "英語・第二外国語";

export type CampusArea = "east" | "west" | "other";

export type AssignmentType = "report" | "exam" | "quiz" | "other";

export type ThemeMode = "light" | "dark" | "system";

export type ScreenId = "dashboard" | "timetable" | "credits" | "settings";

export type Course = {
  id: string;
  name: string;
  instructor?: string;
  dayOfWeek: DayOfWeek;
  period: number;
  semester: Semester;
  credits: number;
  category: CourseCategory | string;
  classroomId?: string;
  buildingName?: string;
  syllabusUrl?: string;
  relatedUrl?: string;
  memo?: string;
  color?: string;
  status: CourseStatus;
};

export type Classroom = {
  id: string;
  name: string;
  buildingName: string;
  buildingNumber?: string;
  area: CampusArea;
  floor?: string;
  latitude?: number;
  longitude?: number;
  memo?: string;
  favorite?: boolean;
};

export type CreditRequirement = {
  id: string;
  admissionYear: number;
  faculty: string;
  cluster?: string;
  program?: string;
  totalRequiredCredits: number;
  categoryRequirements: {
    category: string;
    requiredCredits: number;
  }[];
  requiredCourseNames: string[];
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  dueDate?: string;
  type: AssignmentType;
  url?: string;
  memo?: string;
  completed: boolean;
};

export type UserSettings = {
  admissionYear: number;
  faculty: string;
  cluster: string;
  program: string;
  gradeYear: string;
  theme: ThemeMode;
  initialSetupCompleted?: boolean;
};

export type GradeRecord = {
  id: string;
  no?: string;
  categoryMajor: string;
  categoryMiddle: string;
  categoryMinor: string;
  categoryPath: string;
  timetableCode: string;
  subject: string;
  instructor: string;
  credits: number;
  earnedYear: string;
  earnedTerm: string;
  grade: string;
  passFail: string;
  passed: boolean;
};

export type GradeCsvImport = {
  student: {
    name?: string;
    studentId?: string;
    affiliation?: string;
    gradeYear?: string;
    admissionYear?: number;
    cluster?: string;
    program?: string;
  };
  records: GradeRecord[];
  importedAt: string;
};

export type AppState = {
  version: number;
  settings: UserSettings;
  courses: Course[];
  classrooms: Classroom[];
  assignments: Assignment[];
  customSubjects?: CatalogSubject[];
  gradeImport?: GradeCsvImport;
  manualRequirement?: CreditRequirement;
};

export type CatalogSubject = {
  admission_year: number;
  cluster: string;
  course: string;
  subject: string;
  subject_code?: string;
  credits: string;
  requirement_type: string;
  category_path: string;
  eligible_years?: number[];
  semester_hours?: { semester: number; year: number; hours: string }[];
  remarks?: string;
  source_url?: string;
  source_page?: number;
};

export type RequirementSourceRow = {
  cluster: string;
  course: string;
  category: string;
  credits: string;
  admission_year: number;
  source_url?: string;
  source_page?: number;
  source_pdf?: string;
};

export type PromotionRequirementType = "third-year-promotion" | "fourth-year-promotion";

export type PromotionRequirementCondition = {
  id: string;
  label: string;
  categoryIds: string[];
  requiredCredits: number;
  requiredSubjects?: string[];
  requiredCourseType?: string;
  maxEligibleYear?: number;
  confidence: "high" | "medium" | "manual-review" | "unknown";
  note?: string;
};

export type PromotionRequirement = {
  id: string;
  type: PromotionRequirementType;
  label: string;
  admissionYear: number;
  cluster: string;
  program: string;
  totalRequiredCredits: number;
  categoryRequirements: PromotionRequirementCondition[];
  requiredSubjects?: string[];
  electiveGroups?: unknown[];
  blockedSubjectsIfUnsatisfied?: string[];
  source: {
    pdf: string;
    url: string;
    pages: number[];
  };
  confidence: "high" | "medium" | "manual-review" | "unknown";
  notes: string[];
};

export type PromotionRequirementDataset = {
  version: number;
  generatedFrom: string[];
  requirements: PromotionRequirement[];
};

export type CategoryAliases = {
  aliases: Record<string, string>;
  category_labels: Record<string, string>;
};

export type SubjectAliases = {
  aliases: Record<string, string>;
};
