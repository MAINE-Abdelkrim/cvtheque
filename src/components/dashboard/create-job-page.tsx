import React, { useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { dbEngine } from '../../lib/firebase/db';
import { JobPosting, EducationRequirement, LanguageRequirement } from '../../types';
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
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateJobPageProps {
  onNavigate: (path: string) => void;
}

export const CreateJobPage: React.FC<CreateJobPageProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const isPremium = profile?.subscription === 'PREMIUM' || profile?.role === 'ADMIN';

  // Chat Layer state (Gemini LLM)
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant IA Recrutement. Décrivez-moi le poste que vous recherchez (ex: "Je cherche un développeur Backend Python avec 3 ans d\'expérience à Casablanca en mode hybride...") et je générerai la fiche de poste structurée pour vous.'
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastExtractedJson, setLastExtractedJson] = useState<any>(null);

  // Form State (Full Job Schema)
  const [jobTitle, setJobTitle] = useState('Backend Developer');
  const [company, setCompany] = useState('TechFlow Systems');
  const [location, setLocation] = useState('Casablanca');
  const [description, setDescription] = useState('Nous recherchons un développeur backend chevronné pour concevoir et optimiser nos microservices.');
  const [contractType, setContractType] = useState<'CDI' | 'CDD' | 'Freelance' | 'Stage' | 'Alternance'>('CDI');
  const [workMode, setWorkMode] = useState<'onsite' | 'hybrid' | 'remote'>('hybrid');
  const [remoteAllowed, setRemoteAllowed] = useState(true);
  
  const [minExpYears, setMinExpYears] = useState<number>(3);
  const [maxExpYears, setMaxExpYears] = useState<number | ''>('');

  // Skills
  const [requiredSkills, setRequiredSkills] = useState<string[]>(['Python', 'FastAPI', 'PostgreSQL']);
  const [newReqSkill, setNewReqSkill] = useState('');

  const [preferredSkills, setPreferredSkills] = useState<string[]>(['Docker', 'AWS']);
  const [newPrefSkill, setNewPrefSkill] = useState('');

  // Education
  const [eduMinLevel, setEduMinLevel] = useState('Master');
  const [eduFields, setEduFields] = useState<string[]>(['Computer Science', 'Software Engineering']);
  const [newEduField, setNewEduField] = useState('');
  const [eduMandatory, setEduMandatory] = useState(false);

  // Languages
  const [languages, setLanguages] = useState<LanguageRequirement[]>([
    { name: 'French', minimum_level: 'fluent', mandatory: true },
    { name: 'English', minimum_level: 'intermediate', mandatory: false }
  ]);
  const [newLangName, setNewLangName] = useState('');
  const [newLangLevel, setNewLangLevel] = useState('intermediate');
  const [newLangMandatory, setNewLangMandatory] = useState(false);

  // Mandatory requirements
  const [mandatoryReqs, setMandatoryReqs] = useState<string[]>(['Disponibilité sous 30 jours']);
  const [newMandatoryReq, setNewMandatoryReq] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gemini LLM Chat submit handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isGenerating) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/jobs/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          conversationHistory: chatHistory
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur du service IA Gemini');
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.extractedJson) {
        setLastExtractedJson(data.extractedJson);
        toast.success('Fiche de poste générée par l\'IA ! Vous pouvez pré-remplir les champs ci-dessous.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Impossible de joindre Gemini LLM.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Pre-fill form from Gemini Extracted JSON
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

    if (Array.isArray(json.required_languages)) {
      setLanguages(json.required_languages);
    }

    if (Array.isArray(json.mandatory_requirements)) {
      setMandatoryReqs(json.mandatory_requirements);
    }

    toast.success('Champs pré-remplis automatiquement avec succès !');
  };

  // Submit & Save Job
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle || !company || !location || !description) {
      toast.error('Veuillez remplir les informations obligatoires (Titre, Entreprise, Ville, Description).');
      return;
    }

    setIsSubmitting(true);
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
      toast.success('Fiche de poste créée avec succès !');
      onNavigate('/dashboard/recruiter');
    } catch (err: any) {
      toast.error('Erreur lors de la création de la fiche de poste.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('/dashboard/recruiter')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold font-display text-white">Création de Fiche de Poste</h2>
              {isPremium ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  PREMIUM AI
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  STANDARD
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Définissez tous les critères d'adéquation sémantique pour le ciblage des CVs.
            </p>
          </div>
        </div>
      </div>

      {/* MULTI-LAYER 1: PREMIUM GEMINI LLM ASSISTANT CHAT */}
      {isPremium ? (
        <div className="glass-card rounded-2xl border border-purple-500/20 p-6 bg-slate-950/80 relative overflow-hidden shadow-xl shadow-purple-900/10">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-900">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-display">Couche 1 : Assistant Recrutement Gemini LLM</h3>
                <p className="text-[11px] text-slate-400">Échangez avec l'IA pour définir votre poste et pré-remplir automatiquement les paramètres.</p>
              </div>
            </div>
            
            {lastExtractedJson && (
              <button
                type="button"
                onClick={() => applyExtractedJson(lastExtractedJson)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold cursor-pointer transition-all shadow-md shadow-purple-500/20 flex items-center space-x-1.5 animate-bounce"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Pré-remplir la fiche de poste</span>
              </button>
            )}
          </div>

          {/* Chat Messages Container */}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2 mb-4">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white font-medium rounded-br-none shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none font-sans'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 text-purple-400 px-4 py-2.5 rounded-2xl text-xs flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini LLM analyse votre requête et structure les données...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="ex: Je cherche un développeur Backend Python avec 3 ans d'exp à Casablanca en CDI..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all font-sans"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-all flex items-center space-x-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Générer</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start space-x-3 text-xs">
          <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300">Option AI Generation disponible en mode PREMIUM</p>
            <p className="text-[11px] text-amber-300/80 mt-0.5">
              Les utilisateurs PREMIUM bénéficient d'un assistant conversant Gemini LLM multi-couches qui remplit et formate automatiquement l'ensemble des critères ci-dessous. En mode Standard, veuillez remplir le formulaire manuellement.
            </p>
          </div>
        </div>
      )}

      {/* MULTI-LAYER 2 & 3: FULL EDITABLE FORM WITH MANUAL ADJUSTMENTS */}
      <form onSubmit={handleFinalSubmit} className="space-y-8">
        <div className="glass-card rounded-2xl border border-slate-800/80 p-6 space-y-6 bg-slate-950/60">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-900 text-slate-300">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold font-display text-white">Couche 2 : Informations Générales & Contrat</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Intitulé du poste (`job_title`)</label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="ex: Backend Developer"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Entreprise (`company`)</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ex: TechFlow"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Localisation (`location`)</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex: Casablanca"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Type de contrat (`contract_type`)</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Freelance">Freelance</option>
                <option value="Stage">Stage</option>
                <option value="Alternance">Alternance</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Mode de travail (`work_mode`)</label>
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="onsite">Sur site</option>
                <option value="hybrid">Hybride</option>
                <option value="remote">Télétravail à 100%</option>
              </select>
            </div>

            <div className="flex items-center space-x-3 pt-6">
              <input
                type="checkbox"
                id="remote_allowed"
                checked={remoteAllowed}
                onChange={(e) => setRemoteAllowed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="remote_allowed" className="text-xs text-slate-300 cursor-pointer select-none">
                Télétravail autorisé (`remote_allowed`)
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Description générale du poste (`description`)</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explication synthétique de la mission..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-sans"
            />
          </div>
        </div>

        {/* EXPERIENCE & SKILLS SECTION */}
        <div className="glass-card rounded-2xl border border-slate-800/80 p-6 space-y-6 bg-slate-950/60">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-900 text-slate-300">
            <Code className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold font-display text-white">Expérience & Compétences Technologiques</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Expérience minimum en années (`minimum_experience_years`)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={minExpYears}
                onChange={(e) => setMinExpYears(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Expérience maximum (`maximum_experience_years`)</label>
              <input
                type="number"
                min={0}
                max={30}
                placeholder="Optionnel"
                value={maxExpYears}
                onChange={(e) => setMaxExpYears(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* REQUIRED SKILLS */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Compétences obligatoires (`required_skills`)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {requiredSkills.map((skill, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-1.5 font-mono">
                  {skill}
                  <button
                    type="button"
                    onClick={() => setRequiredSkills(requiredSkills.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newReqSkill}
                onChange={(e) => setNewReqSkill(e.target.value)}
                placeholder="ex: Python, FastAPI..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (newReqSkill.trim()) {
                    setRequiredSkills([...requiredSkills, newReqSkill.trim()]);
                    setNewReqSkill('');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* PREFERRED SKILLS */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Compétences appréciées (`preferred_skills`)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {preferredSkills.map((skill, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-1.5 font-mono">
                  {skill}
                  <button
                    type="button"
                    onClick={() => setPreferredSkills(preferredSkills.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newPrefSkill}
                onChange={(e) => setNewPrefSkill(e.target.value)}
                placeholder="ex: Docker, AWS..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (newPrefSkill.trim()) {
                    setPreferredSkills([...preferredSkills, newPrefSkill.trim()]);
                    setNewPrefSkill('');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>

        {/* EDUCATION & LANGUAGES SECTION */}
        <div className="glass-card rounded-2xl border border-slate-800/80 p-6 space-y-6 bg-slate-950/60">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-900 text-slate-300">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold font-display text-white">Éducation & Exigences Linguistiques</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Niveau d'études minimum (`minimum_level`)</label>
              <input
                type="text"
                value={eduMinLevel}
                onChange={(e) => setEduMinLevel(e.target.value)}
                placeholder="ex: Master"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-3 pt-6">
              <input
                type="checkbox"
                id="eduMandatory"
                checked={eduMandatory}
                onChange={(e) => setEduMandatory(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="eduMandatory" className="text-xs text-slate-300 cursor-pointer select-none">
                Diplôme obligatoire (`mandatory`)
              </label>
            </div>
          </div>

          {/* PREFERRED FIELDS */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Filières recommandées (`preferred_fields`)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {eduFields.map((field, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5 font-mono">
                  {field}
                  <button
                    type="button"
                    onClick={() => setEduFields(eduFields.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newEduField}
                onChange={(e) => setNewEduField(e.target.value)}
                placeholder="ex: Computer Science..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (newEduField.trim()) {
                    setEduFields([...eduFields, newEduField.trim()]);
                    setNewEduField('');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* LANGUAGES LIST */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              <span>Langues requises (`required_languages`)</span>
            </label>

            <div className="space-y-2">
              {languages.map((lang, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-850 text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-white font-mono">{lang.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Niveau: {lang.minimum_level}
                    </span>
                    {lang.mandatory && (
                      <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                        Obligatoire
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLanguages(languages.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <input
                type="text"
                value={newLangName}
                onChange={(e) => setNewLangName(e.target.value)}
                placeholder="Nom langue (ex: French)"
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white"
              />
              <select
                value={newLangLevel}
                onChange={(e) => setNewLangLevel(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white"
              >
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="fluent">Courant / Fluent</option>
                <option value="native">Bilingue / Natif</option>
              </select>
              <div className="flex items-center space-x-2 px-2">
                <input
                  type="checkbox"
                  id="newLangMandatory"
                  checked={newLangMandatory}
                  onChange={(e) => setNewLangMandatory(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-900 text-blue-600 cursor-pointer"
                />
                <label htmlFor="newLangMandatory" className="text-[11px] text-slate-300 cursor-pointer">
                  Obligatoire
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (newLangName.trim()) {
                    setLanguages([
                      ...languages,
                      { name: newLangName.trim(), minimum_level: newLangLevel, mandatory: newLangMandatory }
                    ]);
                    setNewLangName('');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
              >
                + Ajouter langue
              </button>
            </div>
          </div>
        </div>

        {/* MANDATORY REQUIREMENTS SECTION */}
        <div className="glass-card rounded-2xl border border-slate-800/80 p-6 space-y-4 bg-slate-950/60">
          <label className="text-xs font-medium text-slate-300">Exigences spécifiques / Impératifs (`mandatory_requirements`)</label>
          <div className="flex flex-wrap gap-2">
            {mandatoryReqs.map((req, idx) => (
              <span key={idx} className="px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-sans">
                {req}
                <button
                  type="button"
                  onClick={() => setMandatoryReqs(mandatoryReqs.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMandatoryReq}
              onChange={(e) => setNewMandatoryReq(e.target.value)}
              placeholder="ex: Disponibilité sous 30 jours, Mobilité internationale..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => {
                if (newMandatoryReq.trim()) {
                  setMandatoryReqs([...mandatoryReqs, newMandatoryReq.trim()]);
                  setNewMandatoryReq('');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
            >
              Ajouter exigence
            </button>
          </div>
        </div>

        {/* FINAL CONFIRMATION & CREATION BUTTON */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-900">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard/recruiter')}
            className="px-5 py-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/20 cursor-pointer transition-all disabled:opacity-50 flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Création de la fiche de poste...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer & Créer la Fiche de Poste</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
