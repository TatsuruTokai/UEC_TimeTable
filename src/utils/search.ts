import type { CatalogSubject, GradeRecord } from "../types";

const kanaMap: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  を: "wo",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ゃ: "ya",
  ゅ: "yu",
  ょ: "yo",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
};

const subjectAliases: Record<string, string[]> = {
  微分積分学第一: ["びぶんせきぶん", "bibunsekibun", "calculus", "bisekibun"],
  微分積分学第二: ["びぶんせきぶん", "bibunsekibun", "calculus", "bisekibun"],
  線形代数学第一: ["せんけい", "senkei", "linearalgebra"],
  線形代数学第二: ["せんけい", "senkei", "linearalgebra"],
  解析学: ["かいせき", "kaiseki", "analysis"],
  力学: ["りきがく", "rikigaku", "mechanics"],
  基礎プログラミングおよび演習: ["ぷろぐらみんぐ", "programming", "program"],
  コンピュータリテラシー: ["こんぴゅーたりてらしー", "computerliteracy", "literacy"],
  化学概論第一: ["かがく", "kagaku", "chemistry"],
  化学概論第二: ["かがく", "kagaku", "chemistry"],
  Academic: ["english", "eigo", "えいご"],
  独語: ["どいつご", "doitsugo", "german"],
  中国語: ["ちゅうごくご", "chuugokugo", "chinese"],
  仏語: ["ふつご", "futsugo", "french"],
  韓国朝鮮語: ["かんこく", "kankoku", "korean"],
};

export const compact = (text: string) =>
  (text || "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−－]/g, "-")
    .replace(/[ \u3000・/()（）［］[\]_-]/g, "")
    .replace(/[Ⅰ]/g, "I")
    .replace(/[Ⅱ]/g, "II")
    .replace(/[Ⅲ]/g, "III")
    .toLowerCase();

export const kanaToRomaji = (text: string) => {
  const normalized = text.normalize("NFKC").replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  let out = "";
  for (const char of normalized) out += kanaMap[char] ?? char;
  return compact(out);
};

const searchableText = (subject: CatalogSubject) => {
  const pieces = [subject.subject, subject.subject_code ?? "", subject.requirement_type, subject.category_path, kanaToRomaji(subject.subject)];
  for (const [key, aliases] of Object.entries(subjectAliases)) {
    if (subject.subject.includes(key)) pieces.push(...aliases);
  }
  return pieces.map(compact).join(" ");
};

export const findSubjects = (
  query: string,
  subjects: CatalogSubject[],
  earnedRecords: GradeRecord[],
  filters: {
    admissionYear: number;
    cluster: string;
    program: string;
    credits?: number | "";
    category?: string;
  },
) => {
  const q = compact(query);
  const earnedNames = new Set(earnedRecords.filter((record) => record.passed).map((record) => compact(record.subject)));
  const scoped = subjects.filter(
    (subject) =>
      subject.admission_year === filters.admissionYear &&
      subject.cluster === filters.cluster &&
      subject.course === filters.program &&
      !earnedNames.has(compact(subject.subject)) &&
      (filters.credits === "" || filters.credits === undefined || Number(subject.credits) === Number(filters.credits)) &&
      (!filters.category || subject.requirement_type === filters.category || subject.category_path.includes(filters.category)),
  );
  if (!q) return scoped.slice(0, 24);
  return scoped
    .map((subject) => ({ subject, score: searchableText(subject).includes(q) ? 2 : compact(subject.subject).includes(q) ? 1 : 0 }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.subject.subject.localeCompare(b.subject.subject, "ja"))
    .map((item) => item.subject)
    .slice(0, 24);
};
