import type { GradeCsvImport, GradeRecord } from "../types";

const COURSE_NAMES = [
  "メディア情報学",
  "経営・社会情報学",
  "情報数理工学",
  "コンピュータサイエンス",
  "デザイン思考・データサイエンス",
  "セキュリティ情報学",
  "情報通信工学",
  "電子情報学",
  "計測・制御システム",
  "先端ロボティクス",
  "機械システム",
  "電子工学",
  "光工学",
  "物理工学",
  "化学生命工学",
];

export const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r" || char === "\u0085") {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
};

const decodeCsv = (buffer: ArrayBuffer) => {
  const decoders = ["shift_jis", "utf-8"] as const;
  for (const encoding of decoders) {
    try {
      const decoded = new TextDecoder(encoding).decode(buffer);
      if (decoded.includes("科目") || decoded.includes("[学生")) return decoded;
    } catch {
      // Try the next decoder.
    }
  }
  return new TextDecoder().decode(buffer);
};

const admissionYearFromStudentId = (studentId?: string) => {
  const match = studentId?.match(/^(\d{2})/);
  if (!match) return undefined;
  const yy = Number(match[1]);
  return yy < 80 ? 2000 + yy : 1900 + yy;
};

const normalizeCell = (value?: string) => (value ?? "").replace(/^\[/, "").replace(/\]$/, "").trim();

const inferClusterAndProgram = (affiliation?: string) => {
  let cluster: string | undefined;
  if (!affiliation) return { cluster, program: undefined };
  if (affiliation.includes("Ⅰ類") || affiliation.includes("I類")) cluster = "Ⅰ類（情報系）";
  if (affiliation.includes("Ⅱ類") || affiliation.includes("II類")) cluster = "Ⅱ類（融合系）";
  if (affiliation.includes("Ⅲ類") || affiliation.includes("III類")) cluster = "Ⅲ類（理工系）";
  const program = COURSE_NAMES.find((name) => affiliation.includes(name)) ?? (affiliation.includes("化学生命") ? "化学生命工学" : undefined);
  return { cluster, program };
};

const inferStudentMetadata = (metadata: Record<string, string>, rows: string[][], headerIndex: number) => {
  const preHeaderCells = rows
    .slice(0, Math.max(0, headerIndex))
    .flatMap((row) => row.flatMap((cell) => cell.split(/\t+/)))
    .map((cell) => normalizeCell(cell))
    .filter(Boolean);
  const preHeaderText = preHeaderCells.join(" ");

  const studentId = metadata["学籍番号"] || preHeaderCells.find((cell) => /^\d{7,}$/.test(cell)) || preHeaderText.match(/\b\d{7,}\b/)?.[0] || "";
  const gradeYear = metadata["年次"] || preHeaderCells.find((cell) => /^[1-6]年$/.test(cell)) || preHeaderText.match(/[1-6]年/)?.[0] || "";
  const affiliation =
    metadata["学生所属"] ||
    preHeaderCells.find((cell) => cell.includes("情報理工学域") || /[ⅠⅡⅢI]{1,3}類/.test(cell)) ||
    preHeaderText.match(/情報理工学域[^\s,，]*/)?.[0] ||
    "";
  return {
    studentId,
    gradeYear,
    affiliation: affiliation.replace(/[1-6]年/g, "").trim(),
  };
};

export const parseKakuteiSeisekiBuffer = (buffer: ArrayBuffer): GradeCsvImport => {
  const rows = parseCsvRows(decodeCsv(buffer));
  const metadata: Record<string, string> = {};
  let headerIndex = -1;
  rows.forEach((row, index) => {
    if (row[0] === "No.") headerIndex = index;
    if (headerIndex === -1) {
      for (let i = 0; i < row.length - 1; i += 2) {
        const key = normalizeCell(row[i]);
        if (key) metadata[key] = row[i + 1] ?? "";
      }
    }
  });
  if (headerIndex < 0) throw new Error("確定成績CSVのヘッダー行が見つかりません。");
  const headers = rows[headerIndex];
  const records: GradeRecord[] = rows.slice(headerIndex + 1).flatMap((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    if (!record["No."]) return [];
    const parts = [record["科目大区分"], record["科目中区分"], record["科目小区分"]].filter(Boolean);
    const passFail = record["合否"] ?? "";
    return [
      {
        id: `grade-${record["No."]}-${record["時間割コード"] || record["科目"]}`,
        no: record["No."],
        categoryMajor: record["科目大区分"] ?? "",
        categoryMiddle: record["科目中区分"] ?? "",
        categoryMinor: record["科目小区分"] ?? "",
        categoryPath: parts.join(" / "),
        timetableCode: record["時間割コード"] ?? "",
        subject: record["科目"] ?? "",
        instructor: record["教員氏名"] ?? "",
        credits: Number.parseFloat(record["単位数"] || "0") || 0,
        earnedYear: record["修得年度"] ?? "",
        earnedTerm: record["修得学期"] ?? "",
        grade: record["評語"] ?? "",
        passFail,
        passed: passFail === "合",
      },
    ];
  });
  const inferredMetadata = inferStudentMetadata(metadata, rows, headerIndex);
  const studentId = inferredMetadata.studentId;
  const affiliation = inferredMetadata.affiliation;
  const inferred = inferClusterAndProgram(affiliation);
  return {
    student: {
      name: metadata["学生氏名"],
      studentId,
      affiliation,
      gradeYear: inferredMetadata.gradeYear,
      admissionYear: admissionYearFromStudentId(studentId),
      cluster: inferred.cluster,
      program: inferred.program,
    },
    records,
    importedAt: new Date().toISOString(),
  };
};

export const parseSubjectImport = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return JSON.parse(trimmed);
  const rows = parseCsvRows(trimmed);
  const headers = rows[0] ?? [];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
};

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
