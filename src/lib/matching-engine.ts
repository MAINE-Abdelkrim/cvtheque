import { CandidateCV, JobPosting } from '../types';

// Common French and English stop words
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'en', 'à', 'au', 'aux',
  'et', 'ou', 'où', 'qui', 'que', 'quoi', 'dont', 'avec', 'sans', 'pour', 'dans', 'sur',
  'sous', 'par', 'ce', 'cet', 'cette', 'ces', 'est', 'sont', 'être', 'avoir', 'plus',
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'senior', 'junior', 'lead', 'expert', 'h/f', 'f/h', 'cdi', 'cdd', 'stage', 'alternance'
]);

// Semantic technology and domain synonym clusters
const SKILL_CLUSTERS: Record<string, string[]> = {
  ai_ml: [
    'python', 'machine learning', 'deep learning', 'ai', 'ia', 'intelligence artificielle',
    'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'scikit', 'nlp', 'computer vision',
    'llm', 'data science', 'pandas', 'numpy', 'scipy', 'reinforcement learning', 'rag',
    'transformers', 'huggingface', 'neural networks', 'vision par ordinateur'
  ],
  backend_dev: [
    'python', 'django', 'flask', 'fastapi', 'java', 'spring', 'spring boot', 'c++', 'c#',
    '.net', 'golang', 'go', 'rust', 'node', 'nodejs', 'express', 'nest', 'nestjs', 'php',
    'laravel', 'symfony', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'api', 'rest', 'graphql'
  ],
  frontend_dev: [
    'javascript', 'typescript', 'react', 'reactjs', 'react native', 'vue', 'vuejs', 'angular',
    'nextjs', 'next', 'html', 'html5', 'css', 'css3', 'tailwind', 'tailwindcss', 'sass', 'redux'
  ],
  devops_cloud: [
    'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'google cloud', 'ci/cd', 'terraform',
    'ansible', 'linux', 'git', 'github', 'gitlab', 'jenkins', 'devops', 'helm'
  ],
  medical: [
    'chirurgie', 'neurochirurgie', 'chirurgien', 'neurochirurgien', 'medecin', 'docteur',
    'sante', 'medical', 'neurologie', 'hopital', 'clinique', 'rachis', 'cranienne', 'anatomie',
    'pathologie', 'soins', 'urgence', 'bloc operatoire'
  ],
  design: [
    'figma', 'ui', 'ux', 'ui/ux', 'design', 'graphisme', 'graphiste', 'photoshop', 'illustrator',
    'adobe creative cloud', 'indesign', 'after effects', 'wireframing', 'prototypage'
  ],
  business_finance: [
    'finance', 'economie', 'sciences economiques', 'gestion', 'management', 'comptabilite',
    'audit', 'banque', 'strategie', 'marketing', 'ventes', 'commercial', 'gestion de projet'
  ]
};

/**
 * Normalizes text and tokenizes into significant keywords
 */
export function tokenizeAndClean(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9+#]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Normalizes a skill string for comparison
 */
export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Checks how well a specific required job skill/criterion matches the candidate's skills and CV
 */
function evaluateJobRequirementMatch(
  requiredSkill: string,
  candidateSkills: string[],
  candidateNormalizedSkills: string[],
  cvFullNormalizedText: string
): { matchScore: number; matchedWith: string | null; matchType: 'exact' | 'cluster' | 'text' | 'none' } {
  const normReq = normalizeSkill(requiredSkill);
  if (!normReq) return { matchScore: 0, matchedWith: null, matchType: 'none' };

  // 1. Direct exact or substring match in candidate skills
  for (let i = 0; i < candidateNormalizedSkills.length; i++) {
    const candNorm = candidateNormalizedSkills[i];
    const originalSkill = candidateSkills[i];

    if (candNorm === normReq) {
      return { matchScore: 1.0, matchedWith: originalSkill, matchType: 'exact' };
    }
    if (candNorm.includes(normReq) || normReq.includes(candNorm)) {
      return { matchScore: 0.95, matchedWith: originalSkill, matchType: 'exact' };
    }
  }

  // 2. Direct match in full CV text
  if (cvFullNormalizedText.includes(normReq)) {
    return { matchScore: 0.85, matchedWith: requiredSkill, matchType: 'text' };
  }

  // 3. Match via semantic skill clusters
  for (const clusterKey of Object.keys(SKILL_CLUSTERS)) {
    const cluster = SKILL_CLUSTERS[clusterKey];
    const isReqInCluster = cluster.some(term => normReq.includes(term) || term.includes(normReq));

    if (isReqInCluster) {
      for (let i = 0; i < candidateNormalizedSkills.length; i++) {
        const candNorm = candidateNormalizedSkills[i];
        if (cluster.some(term => candNorm.includes(term) || term.includes(candNorm))) {
          return { matchScore: 0.80, matchedWith: candidateSkills[i], matchType: 'cluster' };
        }
      }
    }
  }

  // 4. Token overlap match
  const reqTokens = tokenizeAndClean(requiredSkill);
  if (reqTokens.length > 0) {
    let matchedTokens = 0;
    for (const token of reqTokens) {
      if (cvFullNormalizedText.includes(token)) {
        matchedTokens++;
      }
    }
    if (matchedTokens > 0) {
      return { matchScore: (matchedTokens / reqTokens.length) * 0.7, matchedWith: requiredSkill, matchType: 'text' };
    }
  }

  return { matchScore: 0, matchedWith: null, matchType: 'none' };
}

/**
 * Determines domain compatibility between candidate and job
 */
function checkDomainMismatch(cvSkillsNorm: string[], cvFullText: string, jobFullText: string): boolean {
  const medicalTerms = SKILL_CLUSTERS.medical;
  const isJobMedical = medicalTerms.some(term => jobFullText.includes(term));
  const isCandidateMedical = medicalTerms.some(term =>
    cvSkillsNorm.some(s => s.includes(term)) || cvFullText.includes(term)
  );

  // If medical job and completely non-medical candidate -> hard mismatch
  if (isJobMedical && !isCandidateMedical) {
    return true;
  }

  return false;
}

export interface DetailedMatchAnalysis {
  score: number;
  matchedRequirements: Array<{
    requirement: string;
    matchedWith: string;
    matchType: 'exact' | 'cluster' | 'text';
    matchScore: number;
  }>;
  missingRequirements: Array<{
    requirement: string;
  }>;
  otherCandidateSkills: string[];
  languages: Array<{
    language: string;
    level: string | null;
  }>;
  domainMatch: boolean;
  explanation: string;
}

/**
 * Calculates a precise, realistic Match Score (between 5% and 98%)
 */
export function calculateJobMatchScore(cv: CandidateCV, job: JobPosting): number {
  const analysis = getDetailedMatchAnalysis(cv, job);
  return analysis.score;
}

/**
 * Returns a complete, in-depth breakdown of what matches, what is missing, languages, and AI diagnosis
 */
export function getDetailedMatchAnalysis(cv: CandidateCV, job: JobPosting): DetailedMatchAnalysis {
  if (!cv || !job) {
    return {
      score: 10,
      matchedRequirements: [],
      missingRequirements: [],
      otherCandidateSkills: cv?.skills || [],
      languages: cv?.parsedData?.languages || [{ language: 'Français', level: 'Natif' }],
      domainMatch: false,
      explanation: 'Données insuffisantes pour établir une analyse croisée.'
    };
  }

  const cvSkills = cv.skills || [];
  const cvSkillsNorm = cvSkills.map(normalizeSkill);
  const cvFullNormalizedText = [
    cv.fileName || '',
    cv.fullName || '',
    cv.jobTitle || '',
    cv.skills?.join(' ') || '',
    cv.feedback || '',
    cv.parsedData?.summary || ''
  ].join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const jobFullNormalizedText = [
    job.title || '',
    job.description || '',
    (job.required_skills || []).join(' '),
    (job.preferred_skills || []).join(' ')
  ].join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Strict check for complete cross-domain mismatch
  const isDomainMismatch = checkDomainMismatch(cvSkillsNorm, cvFullNormalizedText, jobFullNormalizedText);
  if (isDomainMismatch) {
    const score = Math.max(5, Math.min(10, Math.round(5 + (cv.aiScore ? (cv.aiScore / 100) * 4 : 2))));
    return {
      score,
      matchedRequirements: [],
      missingRequirements: (job.required_skills && job.required_skills.length > 0)
        ? job.required_skills.map(req => ({ requirement: req }))
        : tokenizeAndClean(job.title).map(req => ({ requirement: req })),
      otherCandidateSkills: cvSkills,
      languages: cv.parsedData?.languages || [{ language: 'Français', level: 'Natif' }],
      domainMatch: false,
      explanation: `Incompatibilité sectorielle majeure : le poste (${job.title}) requiert une formation et des compétences spécialisées absentes de ce profil.`
    };
  }

  // 2. Extract Job Requirements list
  let targetRequirements: string[] = [];
  if (job.required_skills && job.required_skills.length > 0) {
    targetRequirements = [...job.required_skills];
  } else {
    targetRequirements = tokenizeAndClean(job.title);
  }

  if (job.preferred_skills && job.preferred_skills.length > 0) {
    for (const pref of job.preferred_skills) {
      if (!targetRequirements.includes(pref)) {
        targetRequirements.push(pref);
      }
    }
  }

  // 3. Detailed Matching
  const matchedRequirements: DetailedMatchAnalysis['matchedRequirements'] = [];
  const missingRequirements: DetailedMatchAnalysis['missingRequirements'] = [];
  const usedCandSkillIndices = new Set<number>();
  let totalMatchPoints = 0;

  for (const req of targetRequirements) {
    const res = evaluateJobRequirementMatch(req, cvSkills, cvSkillsNorm, cvFullNormalizedText);
    if (res.matchScore >= 0.5 && res.matchedWith) {
      matchedRequirements.push({
        requirement: req,
        matchedWith: res.matchedWith,
        matchType: res.matchType === 'none' ? 'text' : res.matchType,
        matchScore: Math.round(res.matchScore * 100)
      });
      totalMatchPoints += res.matchScore;

      const idx = cvSkills.indexOf(res.matchedWith);
      if (idx !== -1) usedCandSkillIndices.add(idx);
    } else {
      missingRequirements.push({ requirement: req });
    }
  }

  const otherCandidateSkills = cvSkills.filter((_, idx) => !usedCandSkillIndices.has(idx));

  const reqCoverage = targetRequirements.length > 0
    ? totalMatchPoints / targetRequirements.length
    : 0.5;

  // 4. Title Coverage
  const titleTokens = tokenizeAndClean(job.title);
  let titleMatchCount = 0;
  for (const token of titleTokens) {
    if (cvFullNormalizedText.includes(token)) {
      titleMatchCount++;
    }
  }
  const titleCoverage = titleTokens.length > 0 ? titleMatchCount / titleTokens.length : 0;

  // 5. Zero Overlap check
  if (matchedRequirements.length === 0 && titleCoverage === 0) {
    const score = Math.max(5, Math.min(12, Math.round(5 + (cv.aiScore ? (cv.aiScore / 100) * 5 : 2))));
    return {
      score,
      matchedRequirements: [],
      missingRequirements: targetRequirements.map(req => ({ requirement: req })),
      otherCandidateSkills: cvSkills,
      languages: cv.parsedData?.languages || [{ language: 'Français', level: 'Natif' }],
      domainMatch: false,
      explanation: `Aucune des compétences clés requises pour "${job.title}" n'a été identifiée dans ce CV.`
    };
  }

  // 6. Multi-skill Tech bonus
  const isTechJob = SKILL_CLUSTERS.ai_ml.some(t => jobFullNormalizedText.includes(t)) ||
                    SKILL_CLUSTERS.backend_dev.some(t => jobFullNormalizedText.includes(t)) ||
                    SKILL_CLUSTERS.frontend_dev.some(t => jobFullNormalizedText.includes(t));

  let versatilityBonus = 0;
  if (isTechJob && cvSkills.length >= 3) {
    versatilityBonus = Math.min(cvSkills.length * 0.015, 0.10);
  }

  const qualityFactor = (cv.aiScore || 80) / 100;
  const compositeScore = (reqCoverage * 0.60) +
                         (titleCoverage * 0.20) +
                         (versatilityBonus) +
                         (qualityFactor * 0.10);

  let finalScore = Math.round(compositeScore * 100);

  const hasCoreSkill = matchedRequirements.some(m => m.matchScore >= 80);
  if (hasCoreSkill && finalScore < 75) {
    finalScore = Math.round(75 + (reqCoverage * 20));
  }

  finalScore = Math.min(Math.max(finalScore, 10), 98);

  // 7. Generate concise AI Explanation
  let explanation = '';
  if (finalScore >= 85) {
    explanation = `Excellente adéquation avec le poste (${finalScore}%). Le candidat valide ${matchedRequirements.length}/${targetRequirements.length} exigences clés et dispose d'un profil technique directement opérationnel.`;
  } else if (finalScore >= 70) {
    explanation = `Bonne adéquation globale (${finalScore}%). Le profil possède les fondations requises (${matchedRequirements.map(m => m.requirement).slice(0, 3).join(', ')}), mais nécessite une montée en compétences sur : ${missingRequirements.map(m => m.requirement).slice(0, 2).join(', ') || 'certains aspects secondaires'}.`;
  } else if (finalScore >= 45) {
    explanation = `Adéquation modérée (${finalScore}%). Le candidat présente certaines compétences transférables mais plusieurs prérequis majeurs du poste ne sont pas validés.`;
  } else {
    explanation = `Faible adéquation (${finalScore}%). Écart important entre les compétences du candidat et le cahier des charges du poste.`;
  }

  // Languages extracted from parsedData or fallback
  const languages = cv.parsedData?.languages && cv.parsedData.languages.length > 0
    ? cv.parsedData.languages
    : [
        { language: 'Français', level: 'Natif' },
        { language: 'Anglais', level: 'Professionnel / B2' }
      ];

  return {
    score: finalScore,
    matchedRequirements,
    missingRequirements,
    otherCandidateSkills,
    languages,
    domainMatch: true,
    explanation
  };
}
