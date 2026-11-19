export type UserRole = 'admin' | 'editor' | 'reviewer' | 'viewer';
export type CaseCollaboratorRole = 'editor' | 'reviewer' | 'viewer';
export type CaseType = 'legal' | 'investigation' | 'project';
export type CaseStatus = 'Active' | 'Dismissed' | 'Draft' | 'Closed' | 'In Review';
export type VaultCategory = 'document' | 'evidence';
export type MediaType = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'file';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  title: string;
  caseType: CaseType;
  court?: string;
  judge?: string;
  charge?: string;
  arrestDates?: string;
  closureDate?: string;
  status: CaseStatus;
  disposition?: string;
  summary?: string;
  customFields?: CustomField[];
  tags?: string[];
  publicSlug: string;
  isPublished: boolean;
  publicHeadline?: string;
  publicSubtitle?: string;
  publicIntro?: string;
  publicCoverUrl?: string;
  ownerId: string;
  memberUids: string[];
  editorUids: string[];
  invitedEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CaseSection {
  id: string;
  caseId: string;
  order: number;
  title: string;
  content: string;
  isPublic: boolean;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  date: string;
  time?: string;
  title: string;
  description: string;
  isPublic: boolean;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CaseActor {
  id: string;
  caseId: string;
  name: string;
  role: string;
  organization?: string;
  notes?: string;
  isPublic: boolean;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CaseCollaborator {
  id: string;
  caseId: string;
  email: string;
  role: CaseCollaboratorRole;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VaultItem {
  id: string;
  title: string;
  description?: string;
  category: VaultCategory;
  mediaType: MediaType;
  docType?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  sha256?: string;
  encrypted: boolean;
  textContent?: string;
  caseIds: string[];
  tags: string[];
  isPublic: boolean;
  ownerId: string;
  memberUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EvidenceCollection {
  id: string;
  title: string;
  explanation: string;
  coverImageUrl?: string;
  itemIds: string[];
  caseId?: string;
  tags: string[];
  isPublic: boolean;
  ownerId: string;
  memberUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActivityLog {
  id: string;
  title: string;
  detail: string;
  caseId?: string;
  actorName: string;
  ownerId: string;
  createdAt?: unknown;
}

export interface PublicSiteCollectionItem {
  id: string;
  title: string;
  mediaType: MediaType;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  sha256?: string;
  textContent?: string;
  description?: string;
}

export interface PublicSiteCollection {
  id: string;
  title: string;
  explanation: string;
  coverImageUrl?: string;
  tags: string[];
  items: PublicSiteCollectionItem[];
}

export interface PublicSite {
  slug: string;
  caseId: string;
  ownerId: string;
  published: boolean;
  caseNumber?: string;
  title: string;
  caseType: CaseType;
  court?: string;
  judge?: string;
  charge?: string;
  arrestDates?: string;
  closureDate?: string;
  status: string;
  disposition?: string;
  headline?: string;
  subtitle?: string;
  intro?: string;
  coverUrl?: string;
  customFields?: CustomField[];
  sections?: Array<{ id: string; order: number; title: string; content: string }>;
  timeline?: Array<{ id: string; date: string; time?: string; title: string; description: string }>;
  actors?: Array<{ id: string; name: string; role: string; organization?: string; notes?: string }>;
  documents?: Array<{
    id: string;
    title: string;
    docType?: string;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    sha256?: string;
    description?: string;
  }>;
  evidence?: Array<{
    id: string;
    title: string;
    mediaType: MediaType;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    sha256?: string;
    textContent?: string;
    description?: string;
    tags: string[];
  }>;
  collections?: PublicSiteCollection[];
  updatedAt?: unknown;
}
