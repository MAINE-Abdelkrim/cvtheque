import { jsPDF } from 'jspdf';
import { CandidateCV } from '../types';
import { toast } from 'sonner';

/**
 * Downloads a candidate CV.
 * 1. If original binary/data URL exists, downloads the exact original file.
 * 2. If it's a mock profile or original file is missing, generates a high-fidelity formatted PDF resume.
 */
export async function downloadCandidateCV(cv: CandidateCV): Promise<void> {
  try {
    const rawFileName = cv.fileName || 'CV_Candidat.pdf';
    const targetFileName = rawFileName.endsWith('.pdf') ? rawFileName : `${rawFileName}.pdf`;

    // 1. Check if we have an original base64 Data URL or Blob URL
    const fileSource = cv.fileData || cv.fileURL;

    if (fileSource && fileSource !== '#' && fileSource.startsWith('data:')) {
      try {
        // Convert base64 Data URL to Blob for reliable cross-browser download
        const arr = fileSource.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = targetFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        toast.success(`Téléchargement de "${targetFileName}" effectué.`);
        return;
      } catch (err) {
        console.warn('[CV Downloader] Base64 download failed, falling back to PDF generator:', err);
      }
    }

    if (fileSource && fileSource !== '#' && (fileSource.startsWith('http://') || fileSource.startsWith('https://') || fileSource.startsWith('blob:'))) {
      try {
        const link = document.createElement('a');
        link.href = fileSource;
        link.target = '_blank';
        link.download = targetFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Téléchargement de "${targetFileName}" initié.`);
        return;
      } catch (err) {
        console.warn('[CV Downloader] Direct link download failed, generating PDF document:', err);
      }
    }

    // 2. Generate a professional PDF document with jsPDF
    generateStructuredPdfResume(cv, targetFileName);
    toast.success(`Le dossier CV de "${cv.fullName || cv.fileName}" a été généré et téléchargé en PDF.`);
  } catch (error: any) {
    console.error('[CV Downloader] Critical error:', error);
    toast.error('Erreur lors du téléchargement du CV.');
  }
}

/**
 * Generates a clean, professional, high-density PDF resume using jsPDF
 */
function generateStructuredPdfResume(cv: CandidateCV, fileName: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const parsed = cv.parsedData;
  const identity = parsed?.identity;
  const fullName = identity?.full_name || cv.fullName || cv.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const jobTitle = identity?.job_title || cv.jobTitle || 'Professionnel';
  const email = identity?.email || cv.email || 'candidat@cvtheque.ia';
  const phone = identity?.phone || cv.phone || '+33 6 00 00 00 00';
  const location = identity?.location || cv.location || 'France';
  const linkedin = identity?.linkedin || '';
  const github = identity?.github || '';
  const website = identity?.website || '';

  const summary = parsed?.summary || cv.feedback || '';
  const experiences = parsed?.experiences || [];
  const education = parsed?.education || [];
  const certifications = parsed?.certifications || [];
  const skills = cv.skills || [];
  const languages = parsed?.languages || [
    { language: 'Français', level: 'Natif' },
    { language: 'Anglais', level: 'Professionnel' }
  ];

  let y = 18;
  const margin = 15;
  const pageWidth = 210;
  const contentWidth = pageWidth - (margin * 2);

  // --- HEADER SECTION ---
  // Background Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Accent Line
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 42, pageWidth, 2, 'F');

  // Full Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(fullName, margin, 16);

  // Job Title
  doc.setTextColor(96, 165, 250); // blue-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(jobTitle, margin, 23);

  // Contact Info Row
  doc.setTextColor(203, 213, 225); // slate-300
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const contactText = [
    email ? `Email: ${email}` : '',
    phone ? `Tel: ${phone}` : '',
    location ? `Lieu: ${location}` : ''
  ].filter(Boolean).join('   |   ');
  doc.text(contactText, margin, 31);

  // Links Row
  const links = [linkedin, github, website].filter(Boolean).join('   |   ');
  if (links) {
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(7.5);
    doc.text(links, margin, 37);
  }

  y = 52;

  // Helper: Section Header
  const addSectionHeader = (title: string) => {
    if (y > 260) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(margin, y, 3, 7, 'F');

    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 6, y + 5);
    y += 11;
  };

  // --- SUMMARY / PROFIL ---
  if (summary) {
    addSectionHeader('Résumé & Profil Professionnel');
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const summaryLines = doc.splitTextToSize(summary, contentWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 4.5) + 4;
  }

  // --- COMPÉTENCES & LANGUES (Two Column layout) ---
  addSectionHeader('Compétences Clés & Langues');
  const halfWidth = (contentWidth - 6) / 2;

  // Left Column: Skills
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Compétences Techniques & Métier :', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const skillsText = skills.slice(0, 15).join(' • ');
  const skillsLines = doc.splitTextToSize(skillsText, halfWidth);
  doc.text(skillsLines, margin, y + 4.5);

  // Right Column: Languages
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Langues Pratiquées :', margin + halfWidth + 6, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const langText = languages.map(l => `${l.language} (${l.level || 'Intermédiaire'})`).join('\n');
  doc.text(langText, margin + halfWidth + 6, y + 4.5);

  const maxHeight = Math.max(skillsLines.length * 4, languages.length * 4.5);
  y += maxHeight + 10;

  // --- EXPÉRIENCES PROFESSIONNELLES ---
  if (experiences.length > 0) {
    addSectionHeader(`Expériences Professionnelles (${experiences.length})`);

    for (const exp of experiences) {
      if (y > 255) {
        doc.addPage();
        y = 18;
      }

      // Title and Dates
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(exp.job_title || 'Poste occupé', margin, y);

      const dates = `${exp.start_date || 'N/A'} - ${exp.end_date || 'Présent'}`;
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const dateWidth = doc.getTextWidth(dates);
      doc.text(dates, pageWidth - margin - dateWidth, y);

      // Company and Location
      y += 4;
      doc.setTextColor(37, 99, 235); // blue-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const companyLocation = [exp.company, exp.location].filter(Boolean).join(' • ');
      doc.text(companyLocation, margin, y);

      // Description
      if (exp.description) {
        y += 4.5;
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const descLines = doc.splitTextToSize(exp.description, contentWidth);
        doc.text(descLines, margin, y);
        y += (descLines.length * 3.8);
      }

      y += 5;
    }
  }

  // --- FORMATIONS & DIPLÔMES ---
  if (education.length > 0) {
    addSectionHeader(`Formations & Diplômes (${education.length})`);

    for (const edu of education) {
      if (y > 260) {
        doc.addPage();
        y = 18;
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(edu.degree || 'Diplôme', margin, y);

      const dates = [edu.start_date, edu.end_date].filter(Boolean).join(' - ') || 'Diplômé';
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const dateWidth = doc.getTextWidth(dates);
      doc.text(dates, pageWidth - margin - dateWidth, y);

      y += 4;
      doc.setTextColor(126, 34, 206); // purple-700
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const instInfo = [edu.field_of_study, edu.institution, edu.location].filter(Boolean).join(' • ');
      doc.text(instInfo, margin, y);

      if (edu.description) {
        y += 4;
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(7.5);
        const descLines = doc.splitTextToSize(edu.description, contentWidth);
        doc.text(descLines, margin, y);
        y += (descLines.length * 3.5);
      }

      y += 4;
    }
  }

  // --- CERTIFICATIONS ---
  if (certifications.length > 0) {
    addSectionHeader(`Certifications & Accréditations (${certifications.length})`);
    for (const cert of certifications) {
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`• ${cert.name}`, margin, y);

      const certExtra = [cert.issuer, cert.date].filter(Boolean).join(' | ');
      if (certExtra) {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`(${certExtra})`, margin + doc.getTextWidth(`• ${cert.name} `) + 2, y);
      }
      y += 4.5;
    }
  }

  // --- FOOTER NOTICE ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `CVthèque IA & Plateforme Recrutement - Certifié & Structuré - Page ${i}/${pageCount}`,
      margin,
      290
    );
  }

  // Save the document
  doc.save(fileName);
}
