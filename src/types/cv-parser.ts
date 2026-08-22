export interface CVParserIdentity {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
  location: string | null;
  job_title: string | null;
  other_links: string[];
}

export interface CVParserSkill {
  name: string;
  category: string | null;
  source: string | null;
}

export interface CVParserLanguage {
  language: string;
  level: string | null;
  original_level: string | null;
}

export interface CVParserCertification {
  name: string;
  issuer: string | null;
  date: string | null;
  credential_id: string | null;
}

export interface CVParserEducation {
  degree: string | null;
  field_of_study: string | null;
  institution: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface CVParserExperience {
  job_title: string | null;
  company: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface CVStructuredData {
  identity: CVParserIdentity;
  summary: string | null;
  skills: CVParserSkill[];
  languages: CVParserLanguage[];
  certifications: CVParserCertification[];
  education: CVParserEducation[];
  experiences: CVParserExperience[];
}

export interface CVParserWarning {
  code: string;
  message: string;
}

export interface CVParserSafeResponse {
  id?: string;
  isCurrent?: boolean;
  createdAt?: string;
  status: 'success';
  cv: CVStructuredData;
  warnings: CVParserWarning[];
  metadata: {
    pageCount: number;
    extractionMethod: string;
    mode: CVParsingMode;
  };
}

export type CVParsingMode = 'deterministic' | 'hybrid';

export interface CanonicalCVFileMetadata {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface CanonicalCVParsingMetadata {
  schemaVersion: number;
  parserVersion: string;
  mode: CVParsingMode;
  pageCount: number;
  extractionMethod: string;
  warnings: CVParserWarning[];
}

export interface CanonicalPersistedCV {
  id: string;
  uid: string;
  status: 'PROCESSED';
  isCurrent: boolean;
  parsedData: CVStructuredData;
  file: CanonicalCVFileMetadata;
  parsing: CanonicalCVParsingMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface NewCanonicalCV {
  uid: string;
  parsedData: CVStructuredData;
  file: CanonicalCVFileMetadata;
  parsing: CanonicalCVParsingMetadata;
}

export interface CVParserServerError {
  error: {
    code: string;
    message: string;
    details: string[];
  };
}

export type CVUploadStatus =
  | 'idle'
  | 'selected'
  | 'validating'
  | 'uploading'
  | 'parsing'
  | 'success'
  | 'error'
  | 'cancelled';
