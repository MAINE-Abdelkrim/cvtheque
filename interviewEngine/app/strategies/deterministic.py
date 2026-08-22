from collections.abc import Iterable

from app.domain.interview_session import (
    Difficulty,
    IntentGrounding,
    InterviewCoverage,
    InterviewSession,
    InterviewType,
    QuestionCategory,
    QuestionGroundingPolicy,
    QuestionIntent,
)
from app.strategies.sanitization import safe_professional_value as safe


class DeterministicInterviewPlanner:
    """Selects assessment intent from evidence, coverage, type, and prior evaluation."""

    def plan_next(self, session: InterviewSession) -> QuestionIntent:
        coverage = self.derive_coverage(session)
        follow_up = self._follow_up(session)
        if follow_up is not None:
            return follow_up

        candidates = self._ordered_candidates(session)
        unused = [
            intent for intent in candidates if self._key(intent) not in self._covered_keys(session)
        ]
        if not unused:
            unused = self._fallbacks(session.interview_type)

        # Cover the type's category mix before revisiting a category or topic.
        selected = next(
            (
                intent
                for intent in unused
                if intent.category not in coverage.categories_asked
                and intent.topic.casefold() not in coverage.topics_asked
            ),
            None,
        )
        if selected is None:
            selected = next(
                (
                    intent
                    for intent in unused
                    if intent.topic.casefold() not in coverage.topics_asked
                ),
                None,
            )
        if selected is None:
            selected = next(
                (intent for intent in unused if intent.category not in coverage.categories_asked),
                unused[0],
            )
        return selected.model_copy(update={"difficulty": self._difficulty(session)})

    def derive_coverage(self, session: InterviewSession) -> InterviewCoverage:
        coverage = InterviewCoverage()
        for turn in session.turns:
            intent = turn.intent
            if intent is None:
                continue
            coverage.categories_asked.add(intent.category)
            coverage.topics_asked.add(intent.topic.casefold())
            coverage.objectives_asked.add(intent.objective.casefold())
            for ref in intent.source_refs:
                if ref.startswith("cv:"):
                    coverage.cv_sources_used.add(ref)
                elif ref.startswith("job:"):
                    coverage.job_requirements_covered.add(ref)
        return coverage

    def _follow_up(self, session: InterviewSession) -> QuestionIntent | None:
        if not session.turns:
            return None
        previous = session.turns[-1]
        if previous.intent is None or previous.evaluation is None:
            return None
        lacks_example = any(
            "concrete example" in weakness.casefold()
            or "more detail" in weakness.casefold()
            or "stated context" in weakness.casefold()
            for weakness in previous.evaluation.weaknesses
        )
        if previous.evaluation.score >= 50 or not lacks_example:
            return None
        objective = f"Obtain concrete evidence about {previous.intent.topic}"
        already_followed = any(
            turn.intent is not None
            and turn.intent.topic.casefold() == previous.intent.topic.casefold()
            and turn.intent.objective == objective
            for turn in session.turns
        )
        if already_followed:
            return None
        return QuestionIntent(
            category=previous.intent.category,
            topic=previous.intent.topic,
            source_refs=previous.intent.source_refs,
            difficulty=self._difficulty(session),
            objective=objective,
            grounding=previous.intent.grounding,
            grounding_policy=previous.intent.grounding_policy,
            evidence=previous.intent.evidence,
            is_follow_up=True,
        )

    def _ordered_candidates(self, session: InterviewSession) -> list[QuestionIntent]:
        evidence = self._evidence_candidates(session)
        generic = self._fallbacks(session.interview_type)
        all_candidates = evidence + generic
        priorities = {
            InterviewType.GENERAL: [
                QuestionCategory.INTRODUCTION,
                QuestionCategory.EXPERIENCE,
                QuestionCategory.MOTIVATION,
                QuestionCategory.SKILLS,
                QuestionCategory.BEHAVIORAL,
                QuestionCategory.EDUCATION,
                QuestionCategory.JOB_FIT,
                QuestionCategory.PROBLEM_SOLVING,
                QuestionCategory.TECHNICAL,
            ],
            InterviewType.TECHNICAL: [
                QuestionCategory.TECHNICAL,
                QuestionCategory.SKILLS,
                QuestionCategory.PROBLEM_SOLVING,
                QuestionCategory.EXPERIENCE,
                QuestionCategory.JOB_FIT,
                QuestionCategory.INTRODUCTION,
                QuestionCategory.BEHAVIORAL,
            ],
            InterviewType.BEHAVIORAL: [
                QuestionCategory.BEHAVIORAL,
                QuestionCategory.EXPERIENCE,
                QuestionCategory.PROBLEM_SOLVING,
                QuestionCategory.MOTIVATION,
                QuestionCategory.INTRODUCTION,
                QuestionCategory.JOB_FIT,
                QuestionCategory.SKILLS,
            ],
            InterviewType.MIXED: [
                QuestionCategory.INTRODUCTION,
                QuestionCategory.EXPERIENCE,
                QuestionCategory.TECHNICAL,
                QuestionCategory.BEHAVIORAL,
                QuestionCategory.MOTIVATION,
                QuestionCategory.SKILLS,
                QuestionCategory.JOB_FIT,
                QuestionCategory.PROBLEM_SOLVING,
                QuestionCategory.EDUCATION,
            ],
        }[session.interview_type]
        rank = {category: index for index, category in enumerate(priorities)}
        grounding_rank = {
            IntentGrounding.BOTH: 0,
            IntentGrounding.JOB: 1,
            IntentGrounding.CV: 2,
            IntentGrounding.GENERIC: 3,
        }
        return sorted(
            all_candidates,
            key=lambda item: (
                rank.get(item.category, len(rank)),
                grounding_rank[item.grounding],
            ),
        )

    def _evidence_candidates(self, session: InterviewSession) -> list[QuestionIntent]:
        intents: list[QuestionIntent] = []
        cv_skills = {
            name.casefold(): name
            for skill in session.cv.skills
            if (name := safe(skill.name)) is not None
        }
        job_skills = self._safe_list(
            (session.job.required_skills + session.job.preferred_skills) if session.job else []
        )

        title = safe(session.cv.identity.job_title)
        if title:
            intents.append(
                self._intent(
                    QuestionCategory.INTRODUCTION,
                    title,
                    f"cv:job_title:{title}",
                    "Contextualize the candidate's professional background",
                    IntentGrounding.CV,
                    QuestionGroundingPolicy.CV_FACT,
                    [title],
                )
            )
        for experience in session.cv.experiences:
            role, company = safe(experience.job_title), safe(experience.company)
            if not role:
                continue
            topic = f"{role} at {company}" if company else role
            ref = f"cv:experience:{topic}"
            evidence = [topic]
            description = safe(experience.description, max_length=500)
            if description:
                evidence.append(description)
            intents.extend(
                [
                    self._intent(
                        QuestionCategory.EXPERIENCE,
                        topic,
                        ref,
                        "Understand responsibilities and outcomes in a documented role",
                        IntentGrounding.CV,
                        QuestionGroundingPolicy.CV_FACT,
                        evidence,
                    ),
                    self._intent(
                        QuestionCategory.TECHNICAL,
                        topic,
                        ref,
                        "Explore technical decisions and challenges in a documented role",
                        IntentGrounding.CV,
                        QuestionGroundingPolicy.CV_FACT,
                        evidence,
                    ),
                ]
            )
        for key, skill in cv_skills.items():
            job_match = next((item for item in job_skills if item.casefold() == key), None)
            refs = [f"cv:skill:{skill}"]
            grounding = IntentGrounding.CV
            if job_match:
                refs.append(f"job:skill:{job_match}")
                grounding = IntentGrounding.BOTH
            intents.extend(
                [
                    self._intent(
                        QuestionCategory.SKILLS,
                        skill,
                        refs,
                        f"Verify practical use of {skill}",
                        grounding,
                        QuestionGroundingPolicy.SKILL_ONLY,
                        [skill],
                    ),
                    self._intent(
                        QuestionCategory.TECHNICAL,
                        skill,
                        refs,
                        f"Assess technical decisions involving {skill}",
                        grounding,
                        QuestionGroundingPolicy.SKILL_ONLY,
                        [skill],
                    ),
                ]
            )
        for skill in job_skills:
            if skill.casefold() in cv_skills:
                continue
            intents.append(
                self._intent(
                    QuestionCategory.TECHNICAL,
                    skill,
                    f"job:skill:{skill}",
                    f"Explore any experience with the role requirement {skill}",
                    IntentGrounding.JOB,
                    QuestionGroundingPolicy.HYPOTHETICAL,
                    [skill],
                )
            )
        for education in session.cv.education:
            subject = safe(education.field_of_study) or safe(education.degree)
            if subject:
                intents.append(
                    self._intent(
                        QuestionCategory.EDUCATION,
                        subject,
                        f"cv:education:{subject}",
                        "Understand how documented education informs professional work",
                        IntentGrounding.CV,
                        QuestionGroundingPolicy.CV_FACT,
                        [subject],
                    )
                )
        if session.job:
            experience_requirements = list(session.job.experience_requirements)
            if session.job.minimum_experience:
                experience_requirements.append(session.job.minimum_experience)
            intents.extend(
                self._job_requirement_intents(
                    experience_requirements,
                    "experience",
                    QuestionCategory.JOB_FIT,
                )
            )
            intents.extend(
                self._job_requirement_intents(
                    session.job.required_education,
                    "education",
                    QuestionCategory.JOB_FIT,
                )
            )
            intents.extend(
                self._job_requirement_intents(
                    session.job.language_requirements,
                    "language",
                    QuestionCategory.JOB_FIT,
                )
            )
            intents.extend(
                self._job_requirement_intents(
                    session.job.mandatory_requirements,
                    "mandatory",
                    QuestionCategory.JOB_FIT,
                )
            )
        return intents

    def _fallbacks(self, interview_type: InterviewType) -> list[QuestionIntent]:
        common = [
            self._generic(
                QuestionCategory.INTRODUCTION,
                "professional background",
                "Summarize relevant professional background",
            ),
            self._generic(
                QuestionCategory.EXPERIENCE,
                "professional achievement",
                "Describe a meaningful professional achievement",
            ),
            self._generic(
                QuestionCategory.MOTIVATION,
                "career motivation",
                "Understand current professional motivation",
            ),
            self._generic(
                QuestionCategory.BEHAVIORAL,
                "teamwork",
                "Assess teamwork through a concrete example",
            ),
            self._generic(
                QuestionCategory.BEHAVIORAL,
                "adaptation",
                "Assess adaptation to change through evidence",
            ),
            self._generic(
                QuestionCategory.PROBLEM_SOLVING,
                "incomplete information",
                "Understand a structured problem-solving approach",
            ),
            self._generic(
                QuestionCategory.TECHNICAL,
                "technical quality",
                "Explore practices used to maintain technical quality",
            ),
        ]
        if interview_type is InterviewType.BEHAVIORAL:
            common.extend(
                [
                    self._generic(
                        QuestionCategory.BEHAVIORAL,
                        "conflict",
                        "Assess constructive conflict handling",
                    ),
                    self._generic(
                        QuestionCategory.BEHAVIORAL,
                        "responsibility",
                        "Assess ownership and accountability",
                    ),
                    self._generic(
                        QuestionCategory.BEHAVIORAL,
                        "communication",
                        "Assess communication in a difficult situation",
                    ),
                ]
            )
        return common

    def _difficulty(self, session: InterviewSession) -> Difficulty:
        index = len(session.turns)
        if index == 0:
            return Difficulty.EASY
        progress = index / max(session.max_questions - 1, 1)
        hard_at = 0.6 if session.interview_type is InterviewType.TECHNICAL else 0.75
        planned = Difficulty.HARD if progress >= hard_at else Difficulty.MEDIUM
        previous_evaluation = session.turns[-1].evaluation
        if previous_evaluation is None:
            return planned
        # Observable response quality may adjust progression by one safe step. A weak
        # response never escalates; a strong technical response may deepen slightly
        # earlier, while sequence position and max_questions remain authoritative.
        if previous_evaluation.score < 50:
            return Difficulty.MEDIUM
        if (
            previous_evaluation.score >= 85
            and session.interview_type is InterviewType.TECHNICAL
            and index >= 2
        ):
            return Difficulty.HARD
        return planned

    def _job_requirement_intents(
        self, values: Iterable[str], kind: str, category: QuestionCategory
    ) -> list[QuestionIntent]:
        return [
            self._intent(
                category,
                value,
                f"job:{kind}:{value}",
                f"Explore evidence related to the role's {kind} requirement",
                IntentGrounding.JOB,
                QuestionGroundingPolicy.HYPOTHETICAL,
                [value],
            )
            for value in self._safe_list(values)
        ]

    @staticmethod
    def _safe_list(values: Iterable[str]) -> list[str]:
        return [cleaned for value in values if (cleaned := safe(value)) is not None]

    @staticmethod
    def _key(intent: QuestionIntent) -> tuple[str, str]:
        return intent.topic.casefold(), intent.objective.casefold()

    def _covered_keys(self, session: InterviewSession) -> set[tuple[str, str]]:
        return {self._key(turn.intent) for turn in session.turns if turn.intent is not None}

    @staticmethod
    def _intent(
        category: QuestionCategory,
        topic: str,
        refs: str | list[str],
        objective: str,
        grounding: IntentGrounding,
        grounding_policy: QuestionGroundingPolicy,
        evidence: list[str],
    ) -> QuestionIntent:
        return QuestionIntent(
            category=category,
            topic=topic,
            source_refs=[refs] if isinstance(refs, str) else refs,
            difficulty=Difficulty.MEDIUM,
            objective=objective,
            grounding=grounding,
            grounding_policy=grounding_policy,
            evidence=evidence,
        )

    @staticmethod
    def _generic(category: QuestionCategory, topic: str, objective: str) -> QuestionIntent:
        return QuestionIntent(
            category=category,
            topic=topic,
            source_refs=[],
            difficulty=Difficulty.MEDIUM,
            objective=objective,
            grounding=IntentGrounding.GENERIC,
            grounding_policy=QuestionGroundingPolicy.GENERIC,
        )
