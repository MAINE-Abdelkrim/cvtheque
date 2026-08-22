import React, { useState } from 'react';
import { ArrowLeft, FileInput, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { LanguagesField } from '../job/languages-field';
import { StringListField } from '../job/string-list-field';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { FormField, Input, Select, Textarea } from '../ui/form-controls';
import { PageHeader, SectionHeader } from '../ui/page-header';
import { createCanonicalJob, generateJobDraft, JobClientError } from '../../lib/api/job-client';
import { useAuth } from '../../providers/auth-provider';
import type { LanguageRequirement } from '../../types';
import { canonicalJobInputSchema, type CanonicalJobInput, type GeminiJobDraft } from '../../types/job';

interface CreateJobPageProps { onNavigate: (path: string) => void; }
type CreationMethod = 'manual' | 'import';
type FieldErrors = Partial<Record<keyof CanonicalJobInput | 'form', string>>;

export const CreateJobPage: React.FC<CreateJobPageProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const canImport = profile?.subscription === 'PREMIUM' || profile?.role === 'ADMIN';
  const [method, setMethod] = useState<CreationMethod>('manual');
  const [sourceDescription, setSourceDescription] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [contractType, setContractType] = useState<CanonicalJobInput['contract_type']>('CDI');
  const [workMode, setWorkMode] = useState<CanonicalJobInput['work_mode']>('hybrid');
  const [remoteAllowed, setRemoteAllowed] = useState(true);
  const [minExpYears, setMinExpYears] = useState(0);
  const [maxExpYears, setMaxExpYears] = useState<number | ''>('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [eduMinLevel, setEduMinLevel] = useState('');
  const [eduFields, setEduFields] = useState<string[]>([]);
  const [eduMandatory, setEduMandatory] = useState(false);
  const [languages, setLanguages] = useState<LanguageRequirement[]>([]);
  const [mandatoryReqs, setMandatoryReqs] = useState<string[]>([]);

  const payload = (): CanonicalJobInput => ({
    title: jobTitle,
    company,
    location,
    description,
    required_skills: requiredSkills,
    preferred_skills: preferredSkills,
    minimum_experience_years: minExpYears,
    maximum_experience_years: maxExpYears === '' ? null : Number(maxExpYears),
    required_education: { minimum_level: eduMinLevel, preferred_fields: eduFields, mandatory: eduMandatory },
    required_languages: languages,
    remote_allowed: remoteAllowed,
    work_mode: workMode,
    contract_type: contractType,
    mandatory_requirements: mandatoryReqs,
  });

  const applyDraft = (draft: GeminiJobDraft) => {
    if (draft.job_title !== undefined) setJobTitle(draft.job_title);
    if (draft.company !== undefined) setCompany(draft.company);
    if (draft.location !== undefined) setLocation(draft.location);
    if (draft.description !== undefined) setDescription(draft.description);
    if (draft.contract_type !== undefined) setContractType(draft.contract_type);
    if (draft.work_mode !== undefined) {
      setWorkMode(draft.work_mode);
      if (draft.work_mode === 'remote') setRemoteAllowed(true);
      else if (draft.work_mode === 'onsite') setRemoteAllowed(false);
      else if (draft.remote_allowed !== undefined) setRemoteAllowed(draft.remote_allowed);
    } else if (draft.remote_allowed !== undefined) setRemoteAllowed(draft.remote_allowed);
    if (draft.minimum_experience_years !== undefined) setMinExpYears(draft.minimum_experience_years);
    if (draft.maximum_experience_years !== undefined) setMaxExpYears(draft.maximum_experience_years ?? '');
    if (draft.required_skills !== undefined) setRequiredSkills(draft.required_skills);
    if (draft.preferred_skills !== undefined) setPreferredSkills(draft.preferred_skills);
    if (draft.required_education !== undefined) {
      setEduMinLevel(draft.required_education.minimum_level);
      setEduFields(draft.required_education.preferred_fields);
      setEduMandatory(draft.required_education.mandatory);
    }
    if (draft.required_languages !== undefined) setLanguages(draft.required_languages);
    if (draft.mandatory_requirements !== undefined) setMandatoryReqs(draft.mandatory_requirements);
  };

  const extractDescription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourceDescription.trim() || extracting || !canImport) return;
    setExtracting(true);
    setImportMessage(null);
    try {
      const result = await generateJobDraft(sourceDescription.trim(), []);
      if (!result.draft || result.invalidDraft) throw new Error('INVALID_DRAFT');
      applyDraft(result.draft);
      setMethod('manual');
      setErrors({});
      setImportMessage({ tone: 'success', text: 'Les informations ont été extraites. Vérifiez-les avant de créer l’offre.' });
    } catch (error) {
      const message = error instanceof JobClientError && error.code === 'PREMIUM_REQUIRED'
        ? 'L’import de description n’est pas disponible avec votre compte.'
        : 'Impossible d’extraire les informations de cette description. Vous pouvez réessayer ou compléter l’offre manuellement.';
      setImportMessage({ tone: 'error', text: message });
    } finally {
      setExtracting(false);
    }
  };

  const changeWorkMode = (mode: NonNullable<CanonicalJobInput['work_mode']>) => {
    setWorkMode(mode);
    if (mode === 'remote') setRemoteAllowed(true);
    if (mode === 'onsite') setRemoteAllowed(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    const parsed = canonicalJobInputSchema.safeParse(payload());
    if (!parsed.success) {
      const next: FieldErrors = {};
      parsed.error.issues.forEach(issue => { const field = issue.path[0] as keyof CanonicalJobInput; if (!next[field]) next[field] = 'Vérifiez cette valeur.'; });
      setErrors({ ...next, form: 'Certains champs doivent être corrigés avant la création.' });
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await createCanonicalJob(parsed.data);
      toast.success('Offre créée avec succès.');
      onNavigate('/dashboard/recruiter');
    } catch (error) {
      const message = error instanceof JobClientError && error.code === 'JOB_VALIDATION_FAILED'
        ? 'Certaines informations ne sont pas valides. Vérifiez le formulaire.'
        : 'Impossible de créer l’offre pour le moment. Vos informations ont été conservées.';
      setErrors({ form: message });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="mx-auto max-w-5xl space-y-8 pb-12">
    <PageHeader title="Créer une offre" description="Renseignez les critères du poste manuellement ou importez une description existante." actions={<Button variant="outline" onClick={() => onNavigate('/dashboard/recruiter')}><ArrowLeft className="h-4 w-4" />Retour aux offres</Button>} />

    <section aria-labelledby="creation-method-title" className="space-y-3">
      <h2 id="creation-method-title" className="text-sm font-medium text-[var(--foreground)]">Méthode de saisie</h2>
      <div className="inline-flex w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-1 sm:w-auto" role="group" aria-label="Méthode de création">
        <Button variant={method === 'manual' ? 'secondary' : 'ghost'} aria-pressed={method === 'manual'} onClick={() => setMethod('manual')} className="flex-1 sm:flex-none"><PenLine className="h-4 w-4" />Remplir manuellement</Button>
        <Button variant={method === 'import' ? 'secondary' : 'ghost'} aria-pressed={method === 'import'} disabled={!canImport} onClick={() => setMethod('import')} className="flex-1 sm:flex-none"><FileInput className="h-4 w-4" />Importer une description</Button>
      </div>
      {!canImport && <p className="text-xs text-[var(--muted-foreground)]">L’import de description est disponible pour les comptes autorisés. Le formulaire manuel reste entièrement accessible.</p>}
    </section>

    {method === 'import' && <Card>
      <CardHeader><SectionHeader title="Importer une description" description="Les informations extraites seront ajoutées au formulaire pour vérification." /></CardHeader>
      <CardContent><form onSubmit={extractDescription} className="space-y-4" aria-busy={extracting}><FormField label="Description de l’offre" htmlFor="source-description" helperText="Collez ici le contenu de l’offre que vous souhaitez structurer." required><Textarea id="source-description" rows={10} value={sourceDescription} onChange={event => setSourceDescription(event.target.value)} disabled={extracting} /></FormField>{importMessage && <p role={importMessage.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${importMessage.tone === 'error' ? 'border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] text-[var(--danger)]' : 'border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_7%,transparent)] text-[var(--success)]'}`}>{importMessage.text}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setMethod('manual')}>Continuer manuellement</Button><Button type="submit" disabled={extracting || !sourceDescription.trim()}>{extracting ? <><Loader2 className="h-4 w-4 animate-spin" />Extraction des informations de l’offre…</> : 'Extraire les informations'}</Button></div></form></CardContent>
    </Card>}

    {importMessage?.tone === 'success' && method === 'manual' && <p role="status" className="rounded-lg border border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_7%,transparent)] p-3 text-sm text-[var(--success)]">{importMessage.text}</p>}

    <form onSubmit={submit} className="space-y-6" aria-busy={isSubmitting} noValidate>
      <FormSection title="Informations générales" description="Présentez clairement le poste et l’entreprise.">
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Intitulé du poste" htmlFor="job-title" required error={errors.title}><Input id="job-title" value={jobTitle} onChange={event => setJobTitle(event.target.value)} disabled={isSubmitting} /></FormField><FormField label="Entreprise" htmlFor="company" required error={errors.company}><Input id="company" value={company} onChange={event => setCompany(event.target.value)} disabled={isSubmitting} /></FormField><FormField label="Localisation" htmlFor="location" required error={errors.location}><Input id="location" value={location} onChange={event => setLocation(event.target.value)} disabled={isSubmitting} /></FormField></div>
      </FormSection>

      <FormSection title="Conditions du poste" description="Définissez le contrat et l’organisation du travail.">
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Type de contrat" htmlFor="contract-type"><Select id="contract-type" value={contractType ?? ''} onChange={event => setContractType(event.target.value as CanonicalJobInput['contract_type'])}><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Freelance">Freelance</option><option value="Stage">Stage</option><option value="Alternance">Alternance</option></Select></FormField><FormField label="Mode de travail" htmlFor="work-mode"><Select id="work-mode" value={workMode ?? ''} onChange={event => changeWorkMode(event.target.value as NonNullable<CanonicalJobInput['work_mode']>)}><option value="onsite">Sur site</option><option value="hybrid">Hybride</option><option value="remote">À distance</option></Select></FormField></div>
        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-sm"><input type="checkbox" checked={remoteAllowed} disabled={workMode === 'remote' || workMode === 'onsite'} onChange={event => setRemoteAllowed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--primary)]" /><span><span className="font-medium text-[var(--foreground)]">Télétravail autorisé</span><span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">Ce réglage est fixé automatiquement pour les modes sur site et à distance.</span></span></label>
      </FormSection>

      <FormSection title="Compétences" description="Séparez les compétences indispensables des compétences appréciées."><div className="grid gap-6 lg:grid-cols-2"><StringListField id="required-skills" label="Compétences requises" values={requiredSkills} onChange={setRequiredSkills} placeholder="Ex. Python" /><StringListField id="preferred-skills" label="Compétences souhaitées" values={preferredSkills} onChange={setPreferredSkills} placeholder="Ex. Docker" /></div></FormSection>

      <FormSection title="Expérience et formation" description="Précisez les prérequis utiles à l’évaluation des candidatures.">
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Expérience minimale (années)" htmlFor="min-experience" error={errors.minimum_experience_years}><Input id="min-experience" type="number" min={0} max={80} value={minExpYears} onChange={event => setMinExpYears(Number(event.target.value))} /></FormField><FormField label="Expérience maximale (années)" htmlFor="max-experience" error={errors.maximum_experience_years} helperText="Laissez vide si aucune limite ne s’applique."><Input id="max-experience" type="number" min={0} max={80} value={maxExpYears} onChange={event => setMaxExpYears(event.target.value === '' ? '' : Number(event.target.value))} /></FormField><FormField label="Niveau d’études minimum" htmlFor="education-level"><Input id="education-level" value={eduMinLevel} onChange={event => setEduMinLevel(event.target.value)} placeholder="Ex. Master" /></FormField><label className="flex min-h-10 items-center gap-2 self-end text-sm text-[var(--foreground)]"><input type="checkbox" checked={eduMandatory} onChange={event => setEduMandatory(event.target.checked)} className="h-4 w-4 rounded accent-[var(--primary)]" />Diplôme obligatoire</label></div>
        <StringListField id="education-fields" label="Filières souhaitées" values={eduFields} onChange={setEduFields} placeholder="Ex. Informatique" />
      </FormSection>

      <FormSection title="Langues"><LanguagesField values={languages} onChange={setLanguages} /></FormSection>

      <FormSection title="Description" description="Décrivez les missions, responsabilités et contexte du poste."><FormField label="Description du poste" htmlFor="job-description" required error={errors.description}><Textarea id="job-description" rows={8} value={description} onChange={event => setDescription(event.target.value)} /></FormField><StringListField id="mandatory-requirements" label="Exigences spécifiques" values={mandatoryReqs} onChange={setMandatoryReqs} placeholder="Ex. Disponibilité sous 30 jours" helperText="Ces exigences restent descriptives dans la version actuelle du matching." /></FormSection>

      {errors.form && <p role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] p-3 text-sm text-[var(--danger)]">{errors.form}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => onNavigate('/dashboard/recruiter')} disabled={isSubmitting}>Annuler</Button><Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Création de l’offre…</> : 'Créer l’offre'}</Button></div>
    </form>
  </main>;
};

const FormSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => <Card><CardHeader><SectionHeader title={title} description={description} /></CardHeader><CardContent className="space-y-5">{children}</CardContent></Card>;
