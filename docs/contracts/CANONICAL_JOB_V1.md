# CanonicalJob v1

The main platform owns CanonicalJob v1. `canonicalJobInputSchema` and `CanonicalJob` in
`src/types/job.ts` are the authoritative implementation contract; persisted records use
`schemaVersion = 1`.

| Contract name | Field | Meaning |
|---|---|---|
| `jobId` | `id` | Server-generated Firestore Job document ID |
| `recruiterUserId` | `recruiterId` | Authenticated Firebase recruiter owner UID |
| `schemaVersion` / `jobVersion` | `schemaVersion` | Contract version, currently `1`; not an edit revision |
| title/company/location/description | same names | Required trimmed recruiter-approved text |
| required/preferred skills | `required_skills`, `preferred_skills` | Deduplicated `string[]` |
| experience range | `minimum_experience_years`, `maximum_experience_years` | Integer years; maximum is nullable and cannot be below minimum |
| education | `required_education` | `{minimum_level, preferred_fields, mandatory}` |
| languages | `required_languages` | `{name, minimum_level, mandatory}[]`; levels are controlled enums |
| remote/work mode | `remote_allowed`, `work_mode` | Boolean plus nullable `onsite`, `hybrid`, or `remote` |
| contract | `contract_type` | Nullable controlled contract value |
| mandatory requirements | `mandatory_requirements` | Recruiter requirement text; it does not prove candidate satisfaction |
| lifecycle | `status` | `OPEN` or `CLOSED`, server-owned |
| timestamps | `createdAt`, `updatedAt` | Server-owned timestamps serialized as ISO strings |

Structured education and language requirements remain canonical. They must not be replaced by the
Interview Engine's simpler text lists. Job AI only proposes a draft; canonical validation and
recruiter submission establish the product record.
