import React, { useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { JobPosting, LanguageRequirement } from '../../types';
import { LanguagesField } from '../job/languages-field';
import { StringListField } from '../job/string-list-field';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  CheckCircle2, 
  ArrowLeft, 
  Briefcase, 
  Building, 
  MapPin, 
  Code, 
  GraduationCap, 
  Languages, 
  Clock, 
  Zap, 
  Plus, 
  X,
  FileText,
  Lock,
  Layers,
  ChevronRight,
  RefreshCw,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateJobPageProps {
  onNavigate: (path: string) => void;
}

export const CreateJobPage: React.FC<CreateJobPageProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const isPremium = profile?.subscription === 'PREMIUM' || profile?.role === 'ADMIN';

  // Creation Mode: 'ai' or 'manual'
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');

  // AI Chat & Generation State
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(1);
  const [lastExtractedJson, setLastExtractedJson] = useState<any>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Form State (Full Job Schema)
  const [jobTitle, setJobTitle] = useState('Senior Full Stack Engineer');
  const [company, setCompany] = useState('TechFlow Systems');
  const [location, setLocation] = useState('Casablanca · Hybride');
  const [description, setDescription] = useState("Nous recherchons un ingénieur full-stack expérimenté pour concevoir nos architectures cloud distribuées et encadrer l'équipe technique.");
  const [contractType, setContractType] = useState<'CDI' | 'CDD' | 'Freelance' | 'Stage' | 'Alternance'>('CDI');
  const [workMode, setWorkMode] = useState<'onsite' | 'hybrid' | 'remote'>('hybrid');
  const [remoteAllowed, setRemoteAllowed] = useState(true);
  
  const [minExpYears, setMinExpYears] = useState<number>(3);
  const [maxExpYears, setMaxExpYears] = useState<number | ''>(6);

  // Skills
  const [requiredSkills, setRequiredSkills] = useState<string[]>(['React', 'TypeScript', 'Node.js', 'PostgreSQL']);
  const [preferredSkills, setPreferredSkills] = useState<string[]>(['Docker', 'Kubernetes', 'GraphQL']);

  // Education
  const [eduMinLevel, setEduMinLevel] = useState('Master / Bac+5');
  const [eduFields, setEduFields] = useState<string[]>(['Informatique', 'Génie Logiciel']);
  const [eduMandatory, setEduMandatory] = useState(false);

  // Languages
  const [languages, setLanguages] = useState<LanguageRequirement[]>([
    { name: 'Français', minimum_level: 'fluent', mandatory: true },
    { name: 'Anglais', minimum_level: 'fluent', mandatory: true }
  ]);

  // Mandatory requirements
  const [mandatoryReqs, setMandatoryReqs] = useState<string[]>(['Disponibilité sous 30 jours', 'Expérience en architecture microservices']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // AI Generation Handler with simulated multi-step synthesis
  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerationStep(1);

    const stepInterval = setInterval(() => {
      setGenerationStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 400);

    try {
      const response = await fetch('/api/jobs/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptInput.trim(),
          conversationHistory: []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur du service IA Gemini');
      }

      clearInterval(stepInterval);
      setGenerationStep(4);

      if (data.extractedJson) {
        setLastExtractedJson(data.extractedJson);
        applyExtractedJson(data.extractedJson);
        setHasGenerated(true);
        toast.success('Fiche de poste générée et structurée par l\'IA avec succès !');
      } else if (data.reply) {
        setDescription(data.reply);
        setHasGenerated(true);
        toast.success('Description générée par l\'IA !');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      toast.error(err.message || 'Impossible de joindre Gemini LLM.');
      setErrorState(err.message || 'Échec de la génération IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyExtractedJson = (json: any) => {
    if (!json) return;
    if (json.job_title) setJobTitle(json.job_title);
    if (json.company) setCompany(json.company);
    if (json.location) setLocation(json.location);
    if (json.description) setDescription(json.description);
    if (json.contract_type) setContractType(json.contract_type);
    if (json.work_mode) setWorkMode(json.work_mode);
    if (typeof json.remote_allowed === 'boolean') setRemoteAllowed(json.remote_allowed);
    if (typeof json.minimum_experience_years === 'number') setMinExpYears(json.minimum_experience_years);
    if (json.maximum_experience_years !== undefined) setMaxExpYears(json.maximum_experience_years ?? '');
    if (Array.isArray(json.required_skills)) setRequiredSkills(json.required_skills);
    if (Array.isArray(json.preferred_skills)) setPreferredSkills(json.preferred_skills);
    if (json.required_education) {
      if (json.required_education.minimum_level) setEduMinLevel(json.required_education.minimum_level);
      if (Array.isArray(json.required_education.preferred_fields)) setEduFields(json.required_education.preferred_fields);
      if (typeof json.required_education.mandatory === 'boolean') setEduMandatory(json.required_education.mandatory);
    }
    if (Array.isArray(json.required_languages)) setLanguages(json.required_languages);
    if (Array.isArray(json.mandatory_requirements)) setMandatoryReqs(json.mandatory_requirements);
  };

  // Submit & Save Job
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle || !company || !location || !description) {
      toast.error('Veuillez remplir les informations obligatoires (Titre, Entreprise, Ville, Description).');
      setErrorState('Champs obligatoires manquants');
      return;
    }

    setIsSubmitting(true);
    setErrorState(null);

    try {
      const newJobPayload: Omit<JobPosting, 'id' | 'createdAt'> = {
        recruiterId: profile?.uid || 'recruiter-123',
        title: jobTitle,
        company,
        location,
        description,
        required_skills: requiredSkills,
        preferred_skills: preferredSkills,
        minimum_experience_years: minExpYears,
        maximum_experience_years: maxExpYears === '' ? null : Number(maxExpYears),
        required_education: {
          minimum_level: eduMinLevel,
          preferred_fields: eduFields,
          mandatory: eduMandatory
        },
        required_languages: languages,
        remote_allowed: remoteAllowed,
        work_mode: workMode,
        contract_type: contractType,
        mandatory_requirements: mandatoryReqs,
        status: 'OPEN'
      };

      await dbEngine.createJob(newJobPayload);
      setSuccessState(true);
      toast.success('Fiche de poste publiée avec succès !');
    } catch (err: any) {
      toast.error('Erreur lors de la création de la fiche de poste.');
      setErrorState('Erreur lors de l\'enregistrement dans la base de données');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view state
  if (successState) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-6 text-left select-none animate-fadeIn">
        <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF]">
              // POSITION PUBLISHED
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase">
              YOUR POSITION<br />
              <span className="text-[var(--muted-foreground)]">IS LIVE.</span>
            </h1>
            <p className="text-sm text-[var(--foreground-secondary)] font-sans max-w-lg leading-relaxed">
              Candidates can now discover and apply to this opportunity. Sémantique match engine is active.
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => onNavigate('/dashboard/recruiter')}
              className="px-6 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center gap-2 cursor-pointer"
            >
              <span>VOIR DANS LE TABLEAU DE BORD →</span>
            </button>
            <button
              onClick={() => {
                setSuccessState(false);
                setHasGenerated(false);
                setJobTitle('');
                setDescription('');
              }}
              className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[var(--foreground)] font-mono text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer"
            >
              CRÉER UN AUTRE POSTE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24 text-left select-none">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('/dashboard/recruiter')}
            className="p-2.5 rounded-xl bg-white/5 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest text-[#0047FF] uppercase">
              // RECRUITMENT STUDIO
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase">
              ÉDITION & GÉNÉRATION SÉMANTIQUE
            </span>
          </div>
        </div>

        {isPremium ? (
          <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-[#0047FF]/10 text-[#0047FF] border border-[#0047FF]/30 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#0047FF]" />
            GEMINI AI ASSISTED
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-white/5 text-[var(--muted-foreground)] border border-[var(--border)]">
            MODE STANDARD
          </span>
        )}
      </div>

      {/* ================= SECTION 01 — EDITORIAL HERO ================= */}
      <section className="space-y-4 max-w-3xl">
        <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF] block">
          // POSITION STUDIO
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold font-display text-[var(--foreground)] tracking-tight uppercase leading-[1.04]">
          DEFINE THE<br />
          <span className="text-[var(--muted-foreground)]">NEXT POSITION.</span>
        </h1>
        <p className="text-sm sm:text-base text-[var(--foreground-secondary)] font-sans leading-relaxed">
          The recruiter is not simply filling out a form. They are defining the profile of the person they want to find. Structure your role through AI synthesis or manual document editing.
        </p>
      </section>

      {/* ================= SECTION 02 — CREATION MODE SWITCH ================= */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode 01: AI Assisted */}
          <div
            onClick={() => setCreationMode('ai')}
            className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
              creationMode === 'ai'
                ? 'bg-[var(--surface-secondary)] border-[#0047FF] shadow-lg shadow-[#0047FF]/10'
                : 'bg-[var(--surface-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#0047FF]">[01] AI ASSISTED</span>
                {creationMode === 'ai' && <div className="w-2 h-2 rounded-full bg-[#0047FF] animate-pulse" />}
              </div>
              <h3 className="text-lg font-bold font-display text-[var(--foreground)]">Génération Intelligente</h3>
              <p className="text-xs text-[var(--muted-foreground)] font-sans leading-relaxed">
                Describe the position in natural language. Let intelligence structure the first draft and requirements automatically.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--foreground)]">
              <span>Activer l'assistant</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#0047FF]" />
            </div>
          </div>

          {/* Mode 02: Manual */}
          <div
            onClick={() => setCreationMode('manual')}
            className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
              creationMode === 'manual'
                ? 'bg-[var(--surface-secondary)] border-[#0047FF] shadow-lg shadow-[#0047FF]/10'
                : 'bg-[var(--surface-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--muted-foreground)]">[02] MANUAL</span>
                {creationMode === 'manual' && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </div>
              <h3 className="text-lg font-bold font-display text-[var(--foreground)]">Édition Manuelle</h3>
              <p className="text-xs text-[var(--muted-foreground)] font-sans leading-relaxed">
                Build the position field by field. Full control over criteria, experience brackets, skills, and languages.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--foreground)]">
              <span>Activer le mode manuel</span>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            </div>
          </div>
        </div>

        {/* AI GENERATION WORKSPACE (Visible when mode === 'ai') */}
        <AnimatePresence>
          {creationMode === 'ai' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 sm:p-10 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-6 relative overflow-hidden"
            >
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-2">
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#0047FF] block">
                  // AI POSITION GENERATOR
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--foreground)]">
                  WHAT ARE YOU LOOKING FOR?
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] font-sans max-w-2xl">
                  Describe the role, team, experience and expectations in natural language. Gemini LLM will instantly synthesize the structured job criteria below.
                </p>
              </div>

              <form onSubmit={handleAiGenerate} className="space-y-4">
                <div className="relative">
                  <textarea
                    rows={4}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="We are looking for a senior backend engineer to join our Casablanca team, proficient in Python, FastAPI, and PostgreSQL with at least 4 years of experience..."
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs sm:text-sm text-[var(--foreground)] placeholder-slate-600 focus:outline-none focus:border-[#0047FF] transition-all resize-none font-sans"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="text-xs font-mono text-[var(--muted-foreground)]">
                    💡 Appuyez sur générer pour structurer automatiquement la fiche de poste.
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating || !promptInput.trim()}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-40 text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-lg shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>SYNTHÈSE EN COURS...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-blue-200" />
                        <span>GENERATE POSITION →</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Sophisticated Processing Sequence when generating */}
              {isGenerating && (
                <div className="pt-6 border-t border-[var(--border)] space-y-3 animate-fadeIn">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-[#0047FF] uppercase">
                    // POSITION SYNTHESIS IN PROGRESS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className={`p-3 rounded-xl border ${generationStep >= 1 ? 'border-[#0047FF] bg-[#0047FF]/10 text-[var(--foreground)]' : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]'}`}>
                      01 / READING BRIEF
                    </div>
                    <div className={`p-3 rounded-xl border ${generationStep >= 2 ? 'border-[#0047FF] bg-[#0047FF]/10 text-[var(--foreground)]' : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]'}`}>
                      02 / STRUCTURING ROLE
                    </div>
                    <div className={`p-3 rounded-xl border ${generationStep >= 3 ? 'border-[#0047FF] bg-[#0047FF]/10 text-[var(--foreground)]' : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]'}`}>
                      03 / DEFINING REQUIREMENTS
                    </div>
                    <div className={`p-3 rounded-xl border ${generationStep >= 4 ? 'border-[#0047FF] bg-[#0047FF]/10 text-[var(--foreground)]' : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]'}`}>
                      04 / GENERATING DESCRIPTION
                    </div>
                  </div>
                </div>
              )}

              {hasGenerated && !isGenerating && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fiche de poste générée avec succès ! Vous pouvez affiner les critères ci-dessous et publier.</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ================= SECTION 03 — STRUCTURED DOCUMENT EDITOR ================= */}
      <form onSubmit={handleFinalSubmit} className="space-y-12">
        {hasGenerated && (
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">// GENERATED POSITION</span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-[var(--foreground)] tracking-tight uppercase">
              {jobTitle}
            </h2>
          </div>
        )}

        <div className="p-8 sm:p-10 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-8">
          
          {/* SECTION 01 / POSITION */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#0047FF]">01 / POSITION</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  JOB TITLE * (`job_title`)
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="ex: Senior Software Engineer"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  COMPANY * (`company`)
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="ex: TechFlow Systems"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  LOCATION * (`location`)
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="ex: Casablanca · Hybride"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    CONTRACT (`contract_type`)
                  </label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all cursor-pointer"
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Stage">Stage</option>
                    <option value="Alternance">Alternance</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    WORK MODE (`work_mode`)
                  </label>
                  <select
                    value={workMode}
                    onChange={(e) => setWorkMode(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all cursor-pointer"
                  >
                    <option value="onsite">Sur site</option>
                    <option value="hybrid">Hybride</option>
                    <option value="remote">Télétravail</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  EXPÉRIENCE MIN (ANNÉES) (`minimum_experience_years`)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={minExpYears}
                  onChange={(e) => setMinExpYears(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  EXPÉRIENCE MAX (ANNÉES) (`maximum_experience_years`)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  placeholder="Optionnel"
                  value={maxExpYears}
                  onChange={(e) => setMaxExpYears(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* SECTION 02 / DESCRIPTION */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#0047FF]">02 / DESCRIPTION</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                DESCRIPTION ÉDITORIALE DU POSTE * (`description`)
              </label>
              <textarea
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Rédigez ou affinez la description détaillée de la mission..."
                className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs sm:text-sm text-[var(--foreground)] placeholder-slate-600 focus:outline-none focus:border-[#0047FF] transition-all resize-y font-sans leading-relaxed"
              />
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* SECTION 03 / REQUIREMENTS & SKILLS */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#0047FF]">03 / REQUIREMENTS</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <StringListField
                id="required-skills"
                label="COMPÉTENCES OBLIGATOIRES (`required_skills`)"
                values={requiredSkills}
                onChange={setRequiredSkills}
                placeholder="ex: React, TypeScript..."
                helperText="Critères indispensables pour l'adéquation sémantique."
              />

              <StringListField
                id="preferred-skills"
                label="COMPÉTENCES APPRÉCIÉES (`preferred_skills`)"
                values={preferredSkills}
                onChange={setPreferredSkills}
                placeholder="ex: Docker, GraphQL..."
                helperText="Atouts bonus valorisés dans le score de match."
              />
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* SECTION 04 / LANGUAGES */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#0047FF]">04 / LANGUAGES</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <LanguagesField
              values={languages}
              onChange={setLanguages}
            />
          </div>

          <div className="h-px bg-white/10" />

          {/* SECTION 05 / EDUCATION & MANDATORY REQUIREMENTS */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#0047FF]">05 / CRITÈRES & IMPÉRATIFS</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  NIVEAU D'ÉTUDES MINIMUM (`minimum_level`)
                </label>
                <input
                  type="text"
                  value={eduMinLevel}
                  onChange={(e) => setEduMinLevel(e.target.value)}
                  placeholder="ex: Master / Bac+5"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  FILIÈRES RECOMMANDÉES (`preferred_fields`)
                </label>
                <input
                  type="text"
                  value={eduFields.join(', ')}
                  onChange={(e) => setEduFields(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="ex: Informatique, Génie Logiciel"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[#0047FF] transition-all"
                />
              </div>
            </div>

            <StringListField
              id="mandatory-reqs"
              label="EXIGENCES SPÉCIFIQUES / IMPÉRATIFS (`mandatory_requirements`)"
              values={mandatoryReqs}
              onChange={setMandatoryReqs}
              placeholder="ex: Disponibilité sous 30 jours, Mobilité internationale..."
              helperText="Conditions éliminatoires ou prérequis critiques."
            />
          </div>

          {errorState && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
              ⚠️ {errorState}
            </div>
          )}

          {/* PUBLISH & ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/recruiter')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[var(--foreground-secondary)] font-mono text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer"
            >
              ANNULER
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0038CC] disabled:opacity-50 text-[var(--foreground)] font-mono text-xs font-bold transition-all shadow-xl shadow-[#0047FF]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>PUBLICATION EN COURS...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PUBLISH POSITION →</span>
                </>
              )}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};
