import React from 'react';
import { 
  Award, 
  Briefcase, 
  ExternalLink, 
  Github, 
  GraduationCap, 
  Languages, 
  Linkedin, 
  Mail, 
  MapPin, 
  Phone, 
  User, 
  Globe,
  FileText,
  Sparkles,
  CheckCircle2,
  Loader2,
  Wand2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CVParserSafeResponse } from '../../types/cv-parser';
import { CVWarningList } from './cv-warning-list';
import { motion } from 'motion/react';
import { useAuth } from '../../providers/auth-provider';

const clean = (text: string | null | undefined) => text?.trim() || null;
const dateRange = (start: string | null, end: string | null) => [clean(start), clean(end)].filter(Boolean).join(' — ');
const webHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export const CVStructuredResult: React.FC<{ result: CVParserSafeResponse }> = ({ result }) => {
  const { cv } = result;
  const { profile } = useAuth();
  const isPremium = profile?.subscription === 'PREMIUM';
  const [loadingImprovements, setLoadingImprovements] = React.useState(false);
  const [improvements, setImprovements] = React.useState<Array<{category: string, advice: string}> | null>(null);

  const handleImproveCV = async () => {
    if (!isPremium) {
      alert("Cette fonctionnalité est réservée aux abonnés PREMIUM.");
      return;
    }
    
    setLoadingImprovements(true);
    try {
      const response = await fetch('/api/cv/improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token') }`
        },
        body: JSON.stringify({ cvData: cv, isPremium: true })
      });
      const data = await response.json();
      if (data.improvements) {
        setImprovements(data.improvements);
      }
    } catch (error) {
      console.error('Failed to get improvements:', error);
    } finally {
      setLoadingImprovements(false);
    }
  };

  const identity = cv.identity;
  const name = clean(identity.full_name) || 'Profil Professionnel';
  const title = clean(identity.job_title);
  
  const contacts = [
    clean(identity.email) && { icon: Mail, label: identity.email!, href: `mailto:${identity.email}` },
    clean(identity.phone) && { icon: Phone, label: identity.phone!, href: `tel:${identity.phone}` },
    clean(identity.location) && { icon: MapPin, label: identity.location! },
    clean(identity.linkedin) && { icon: Linkedin, label: 'LinkedIn', href: webHref(identity.linkedin!) },
    clean(identity.github) && { icon: Github, label: 'GitHub', href: webHref(identity.github!) },
    clean(identity.website) && { icon: Globe, label: identity.website!, href: webHref(identity.website!) },
    ...identity.other_links.filter(Boolean).map(link => ({ icon: ExternalLink, label: link, href: webHref(link) })),
  ].filter(Boolean) as Array<{ icon: LucideIcon; label: string; href?: string }>;

  // Group skills by category if available
  const categorizedSkills = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    cv.skills.forEach(s => {
      const skillName = clean(s.name);
      if (!skillName) return;
      const cat = clean(s.category) || 'Expertises Générales';
      if (!map[cat]) map[cat] = [];
      map[cat].push(skillName);
    });
    return map;
  }, [cv.skills]);

  return (
    <section aria-labelledby="structured-profile-title" className="space-y-8 select-none">
      
      {/* Header Profile Identity */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border)] relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#0047FF]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#0047FF] bg-[#0047FF]/10 px-2.5 py-1 rounded-md border border-[#0047FF]/20">
              // STRUCTURED PROFILE
            </span>
            {result.metadata?.mode && (
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">
                MODE : {result.metadata.mode}
              </span>
            )}
          </div>

          <div>
            <h2 id="structured-profile-title" className="text-2xl sm:text-4xl font-extrabold text-[var(--foreground)] font-display tracking-tight">
              {name}
            </h2>
            {title && (
              <p className="mt-1 text-sm sm:text-base font-semibold text-[var(--foreground-secondary)] font-sans">
                {title}
              </p>
            )}
          </div>

          {contacts.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2.5 pt-2 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)] font-sans">
              {contacts.map(({ icon: Icon, label, href }, index) => {
                const body = (
                  <>
                    <Icon className="w-3.5 h-3.5 text-[#0047FF] shrink-0" />
                    <span className="break-all">{label}</span>
                  </>
                );
                return href ? (
                  <a
                    key={`${label}-${index}`}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel={href.startsWith('http') ? 'noreferrer' : undefined}
                    className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)] transition-colors"
                  >
                    {body}
                  </a>
                ) : (
                  <span key={`${label}-${index}`} className="inline-flex items-center gap-1.5">
                    {body}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Warnings & Optimization Signals */}
      {result.warnings && result.warnings.length > 0 && (
        <CVWarningList warnings={result.warnings} />
      )}

      {/* AI CV Improvement Service (Premium) */}
      <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-[var(--foreground)] flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-[#0047FF]" />
              Amélioration de CV via IA
            </h3>
            <p className="text-xs text-[var(--foreground-secondary)] font-sans">
              Recevez des conseils personnalisés pour optimiser votre profil (Service réservé aux membres Premium).
            </p>
          </div>
          <button
            onClick={handleImproveCV}
            disabled={!isPremium || loadingImprovements}
            className={`shrink-0 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
              isPremium 
                ? 'bg-[#0047FF] hover:bg-[#0038CC] text-white shadow-[#0047FF]/20 cursor-pointer' 
                : 'bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-[var(--border)] cursor-not-allowed opacity-70'
            }`}
          >
            {loadingImprovements ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isPremium ? 'Générer des conseils' : 'Débloquer avec Premium'}
          </button>
        </div>

        {improvements && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-4 border-t border-[var(--border)] space-y-3"
          >
            {improvements.map((imp, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] space-y-1.5 shadow-sm">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0047FF]">
                  {imp.category}
                </span>
                <p className="text-sm text-[var(--foreground)] font-sans leading-relaxed">
                  {imp.advice}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Summary / Profil Professionnel */}
      {clean(cv.summary) && (
        <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0047FF]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              SYNTHÈSE PROFESSIONNELLE
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed font-sans whitespace-pre-wrap">
            {cv.summary}
          </p>
        </div>
      )}

      {/* Experience Timeline */}
      {cv.experiences.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0047FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                PARCOURS PROFESSIONNEL ({cv.experiences.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">CHRONOLOGIE ÉDITORIALE</span>
          </div>

          <div className="divide-y divide-white/10 border-y border-[var(--border)]">
            {cv.experiences.map((item, index) => {
              const expTitle = clean(item.job_title);
              const company = clean(item.company);
              const loc = clean(item.location);
              const dates = dateRange(item.start_date, item.end_date);
              const desc = clean(item.description);
              const idxNum = index < 9 ? `[0${index + 1}]` : `[${index + 1}]`;

              return (
                <div key={index} className="py-6 first:pt-4 last:pb-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs font-bold text-[#0047FF] shrink-0">
                        {idxNum}
                      </span>
                      <h4 className="text-base font-bold text-[var(--foreground)] font-display">
                        {expTitle || 'Poste occupé'}
                      </h4>
                    </div>
                    {dates && (
                      <span className="text-xs font-mono text-[var(--muted-foreground)] shrink-0">
                        {dates}
                      </span>
                    )}
                  </div>

                  <div className="pl-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)] font-sans">
                    {company && <span className="font-semibold text-[var(--foreground)]">{company}</span>}
                    {loc && (
                      <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                        <MapPin className="w-3 h-3 text-[var(--muted-foreground)]" />
                        {loc}
                      </span>
                    )}
                  </div>

                  {desc && (
                    <div className="pl-8 text-xs sm:text-sm text-[var(--foreground-secondary)] leading-relaxed font-sans whitespace-pre-wrap">
                      {desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Education Timeline */}
      {cv.education.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#0047FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                FORMATION & DIPLÔMES ({cv.education.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">CURSUS ACADÉMIQUE</span>
          </div>

          <div className="divide-y divide-white/10 border-y border-[var(--border)]">
            {cv.education.map((item, index) => {
              const deg = clean(item.degree);
              const inst = clean(item.institution);
              const field = clean(item.field_of_study);
              const loc = clean(item.location);
              const dates = dateRange(item.start_date, item.end_date);
              const desc = clean(item.description);
              const idxNum = index < 9 ? `[0${index + 1}]` : `[${index + 1}]`;

              return (
                <div key={index} className="py-5 first:pt-4 last:pb-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs font-bold text-[#0047FF] shrink-0">
                        {idxNum}
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-[var(--foreground)] font-display">
                        {deg || field || 'Formation'}
                      </h4>
                    </div>
                    {dates && (
                      <span className="text-xs font-mono text-[var(--muted-foreground)] shrink-0">
                        {dates}
                      </span>
                    )}
                  </div>

                  <div className="pl-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)] font-sans">
                    {inst && <span className="font-semibold text-[var(--foreground)]">{inst}</span>}
                    {field && inst && <span className="text-[var(--muted-foreground)]">· {field}</span>}
                    {loc && (
                      <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                        <MapPin className="w-3 h-3 text-[var(--muted-foreground)]" />
                        {loc}
                      </span>
                    )}
                  </div>

                  {desc && (
                    <div className="pl-8 text-xs text-[var(--foreground-secondary)] leading-relaxed font-sans whitespace-pre-wrap">
                      {desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skills Matrix / Layer */}
      {cv.skills.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0047FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                MATRICE DES COMPÉTENCES ({cv.skills.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">INDEX SÉMANTIQUE</span>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-5">
            {(Object.entries(categorizedSkills) as [string, string[]][]).map(([category, skillList], idx) => (
              <div key={category} className="space-y-2.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                  // {category}
                </span>
                <div className="flex flex-wrap gap-2">
                  {skillList.map((skill: string, sIdx: number) => (
                    <span
                      key={`${skill}-${sIdx}`}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] hover:border-[#0047FF]/50 transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Languages & Certifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Languages */}
        {cv.languages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#0047FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                LANGUES
              </h3>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] divide-y divide-white/5">
              {cv.languages.map((item, index) => {
                const lang = clean(item.language);
                const level = clean(item.level) || clean(item.original_level);
                if (!lang) return null;

                return (
                  <div key={index} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)] font-sans">{lang}</span>
                    {level && (
                      <span className="px-2.5 py-0.5 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] font-mono text-[11px] text-[var(--foreground-secondary)]">
                        {level}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certifications */}
        {cv.certifications.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#0047FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                CERTIFICATIONS
              </h3>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] divide-y divide-white/5">
              {cv.certifications.map((item, index) => {
                const certName = clean(item.name);
                const issuer = clean(item.issuer);
                const date = clean(item.date);
                const credId = clean(item.credential_id);
                if (!certName) return null;

                return (
                  <div key={index} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                    <h5 className="text-xs font-bold text-[var(--foreground)] font-sans">{certName}</h5>
                    <div className="flex flex-wrap items-center gap-x-3 text-[11px] font-mono text-[var(--muted-foreground)]">
                      {issuer && <span>{issuer}</span>}
                      {date && <span>· {date}</span>}
                      {credId && <span className="text-[var(--muted-foreground)]">ID: {credId}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
