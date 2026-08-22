import React from 'react';
import { Award, BriefcaseBusiness, ExternalLink, Github, GraduationCap, Languages, Linkedin, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CVParserSafeResponse } from '../../types/cv-parser';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader } from '../ui/card';
import { SectionHeader } from '../ui/page-header';
import { CVWarningList } from './cv-warning-list';

const clean = (text: string | null | undefined) => text?.trim() || null;
const dateRange = (start: string | null, end: string | null) => [clean(start), clean(end)].filter(Boolean).join(' — ');
const webHref = (url: string) => /^https?:\/\//i.test(url) ? url : `https://${url}`;

export const CVStructuredResult: React.FC<{ result: CVParserSafeResponse }> = ({ result }) => {
  const { cv } = result;
  const identity = cv.identity;
  const name = clean(identity.full_name);
  const title = clean(identity.job_title);
  const contacts = [
    clean(identity.email) && { icon: Mail, label: identity.email!, href: `mailto:${identity.email}` },
    clean(identity.phone) && { icon: Phone, label: identity.phone!, href: `tel:${identity.phone}` },
    clean(identity.location) && { icon: MapPin, label: identity.location! },
    clean(identity.linkedin) && { icon: Linkedin, label: 'LinkedIn', href: webHref(identity.linkedin!) },
    clean(identity.github) && { icon: Github, label: 'GitHub', href: webHref(identity.github!) },
    clean(identity.website) && { icon: ExternalLink, label: identity.website!, href: webHref(identity.website!) },
    ...identity.other_links.filter(Boolean).map(link => ({ icon: ExternalLink, label: link, href: webHref(link) })),
  ].filter(Boolean) as Array<{ icon: LucideIcon; label: string; href?: string }>;

  return <section aria-labelledby="structured-profile-title" className="space-y-6">
    <SectionHeader title="Profil extrait du CV" description="Vérifiez les informations structurées à partir de votre document." />
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"><UserRound className="h-5 w-5" /></span>
          <div className="min-w-0"><h2 id="structured-profile-title" className="text-xl font-semibold text-[var(--foreground)]">{name ?? 'Profil professionnel'}</h2>{title && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{title}</p>}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <CVWarningList warnings={result.warnings} />
        {contacts.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-3">{contacts.map(({ icon: Icon, label, href }, index) => {
          const body = <><Icon className="h-4 w-4 shrink-0" /><span className="break-all">{label}</span></>;
          return href ? <a key={`${label}-${index}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">{body}</a> : <span key={`${label}-${index}`} className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]">{body}</span>;
        })}</div>}

        {clean(cv.summary) && <ProfileSection title="Résumé"><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{cv.summary}</p></ProfileSection>}

        {cv.skills.length > 0 && <ProfileSection title="Compétences"><div className="flex flex-wrap gap-2">{cv.skills.filter(skill => clean(skill.name)).map((skill, index) => <Badge key={`${skill.name}-${index}`} title={clean(skill.category) ?? undefined}>{skill.name}</Badge>)}</div></ProfileSection>}

        {cv.experiences.length > 0 && <ProfileSection icon={BriefcaseBusiness} title="Expérience"><div className="divide-y divide-[var(--border)]">{cv.experiences.map((item, index) => <ProfileEntry key={index} title={clean(item.job_title)} subtitle={clean(item.company)} location={clean(item.location)} dates={dateRange(item.start_date, item.end_date)} description={clean(item.description)} />)}</div></ProfileSection>}

        {cv.education.length > 0 && <ProfileSection icon={GraduationCap} title="Formation"><div className="divide-y divide-[var(--border)]">{cv.education.map((item, index) => <ProfileEntry key={index} title={clean(item.degree)} subtitle={clean(item.field_of_study) ?? clean(item.institution)} secondary={clean(item.field_of_study) && clean(item.institution) ? clean(item.institution) : null} location={clean(item.location)} dates={dateRange(item.start_date, item.end_date)} description={clean(item.description)} />)}</div></ProfileSection>}

        {cv.languages.length > 0 && <ProfileSection icon={Languages} title="Langues"><div className="flex flex-wrap gap-2">{cv.languages.filter(item => clean(item.language)).map((item, index) => <Badge key={`${item.language}-${index}`}><span>{item.language}</span>{clean(item.level) || clean(item.original_level) ? <span className="ml-1 text-[var(--muted-foreground)]">· {clean(item.level) ?? clean(item.original_level)}</span> : null}</Badge>)}</div></ProfileSection>}

        {cv.certifications.length > 0 && <ProfileSection icon={Award} title="Certifications"><div className="divide-y divide-[var(--border)]">{cv.certifications.map((item, index) => <ProfileEntry key={index} title={clean(item.name)} subtitle={clean(item.issuer)} dates={clean(item.date) ?? ''} description={clean(item.credential_id) ? `Identifiant : ${item.credential_id}` : null} />)}</div></ProfileSection>}
      </CardContent>
    </Card>
  </section>;
};

const ProfileSection: React.FC<{ icon?: LucideIcon; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => <section aria-label={title}><h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">{Icon && <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />}{title}</h3>{children}</section>;

const ProfileEntry: React.FC<{ title: string | null; subtitle?: string | null; secondary?: string | null; location?: string | null; dates?: string; description?: string | null }> = ({ title, subtitle, secondary, location, dates, description }) => {
  if (!title && !subtitle && !secondary && !location && !dates && !description) return null;
  return <article className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start sm:gap-4"><div>{title && <h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4>}{subtitle && <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{subtitle}</p>}{secondary && <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{secondary}</p>}</div>{dates && <p className="shrink-0 text-xs text-[var(--muted-foreground)]">{dates}</p>}</div>{location && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><MapPin className="h-3.5 w-3.5" />{location}</p>}{description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{description}</p>}</article>;
};
