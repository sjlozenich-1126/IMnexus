import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ActivityLog,
  CaseActor,
  CaseCollaborator,
  CaseCollaboratorRole,
  CaseRecord,
  CaseSection,
  CaseStatus,
  CaseType,
  CustomField,
  EvidenceCollection,
  PublicSite,
  TimelineEvent,
  UserProfile,
  UserRole,
  VaultCategory,
  VaultItem,
} from '../types';
import { syncVaultFileVisibility } from '../utils/vaultApi';

const BOOTSTRAPPED_ADMIN_EMAIL = 'demopocrisyrepository@gmail.com';

export function makeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}

export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned.length >= 2 ? cleaned : `case-${Date.now().toString(36)}`;
}

function clampString(val: string | undefined, max: number): string | undefined {
  if (val === undefined) return undefined;
  return val.slice(0, max);
}

function clampStringArray(arr: string[] | undefined, maxItems: number, maxLen = 120): string[] {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((s) => String(s).replace(/^#+/, '').trim().slice(0, maxLen))
        .filter(Boolean)
    )
  ).slice(0, maxItems);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(userRef);
    const isBootstrap =
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

    if (!snap.exists()) {
      const role: UserRole = isBootstrap ? 'admin' : 'editor';
      const profilePayload: Record<string, unknown> = {
        uid: user.uid,
        email: (user.email || 'user@imnexus.local').slice(0, 254),
        displayName: (user.displayName || user.email?.split('@')[0] || 'IMnexus User').slice(
          0,
          120
        ),
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        profilePayload.photoURL = user.photoURL.slice(0, 500);
      }
      await setDoc(userRef, profilePayload);

      if (isBootstrap) {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: (user.email || '').slice(0, 254),
          grantedBy: 'system',
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }

      return {
        uid: user.uid,
        email: profilePayload.email as string,
        displayName: profilePayload.displayName as string,
        photoURL: user.photoURL || undefined,
        role,
      };
    }

    const existing = snap.data() as UserProfile;
    const nextDisplayName = (
      user.displayName ||
      existing.displayName ||
      'IMnexus User'
    ).slice(0, 120);
    const nextPhotoUrl = user.photoURL ? user.photoURL.slice(0, 500) : existing.photoURL;

    const updates: Record<string, unknown> = {};
    if (nextDisplayName !== existing.displayName) {
      updates.displayName = nextDisplayName;
    }
    if (nextPhotoUrl && nextPhotoUrl !== existing.photoURL) {
      updates.photoURL = nextPhotoUrl;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      try {
        await updateDoc(userRef, updates);
      } catch (updateErr) {
        console.warn('Skipped optional profile metadata sync:', updateErr);
      }
    }

    return {
      ...existing,
      displayName: nextDisplayName,
      photoURL: nextPhotoUrl,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeWorkspaceUsers(
  isAdminUser: boolean,
  onChange: (users: UserProfile[]) => void
): Unsubscribe {
  if (!isAdminUser) {
    onChange([]);
    return () => {};
  }
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserProfile);
      onChange(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function updateUserRole(targetUid: string, newRole: UserRole): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    if (newRole === 'admin') {
      const snap = await getDoc(doc(db, 'users', targetUid));
      const profile = snap.data() as UserProfile | undefined;
      if (profile) {
        await setDoc(doc(db, 'admins', targetUid), {
          uid: targetUid,
          email: profile.email,
          grantedBy: 'admin',
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeCases(
  user: User,
  userRole: UserRole,
  onChange: (cases: CaseRecord[]) => void
): Unsubscribe {
  const path = 'cases';
  const baseRef = collection(db, path);
  if (userRole === 'admin') {
    return onSnapshot(
      baseRef,
      (snap) => {
        onChange(snap.docs.map((d) => d.data() as CaseRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
  }

  const memberDocs = new Map<string, CaseRecord>();
  const invitedDocs = new Map<string, CaseRecord>();

  const emitMerged = () => {
    const merged = new Map<string, CaseRecord>();
    memberDocs.forEach((v, k) => merged.set(k, v));
    invitedDocs.forEach((v, k) => merged.set(k, v));
    onChange(Array.from(merged.values()));
  };

  const unsubMember = onSnapshot(
    query(baseRef, where('memberUids', 'array-contains', user.uid)),
    (snap) => {
      memberDocs.clear();
      snap.docs.forEach((d) => memberDocs.set(d.id, d.data() as CaseRecord));
      emitMerged();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );

  const normalizedEmail = (user.email || '').trim().toLowerCase();
  const unsubInvited = normalizedEmail
    ? onSnapshot(
        query(baseRef, where('invitedEmails', 'array-contains', normalizedEmail)),
        (snap) => {
          invitedDocs.clear();
          snap.docs.forEach((d) => invitedDocs.set(d.id, d.data() as CaseRecord));
          emitMerged();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      )
    : () => {};

  return () => {
    unsubMember();
    unsubInvited();
  };
}

export function subscribeVaultItems(
  user: User,
  userRole: UserRole,
  onChange: (items: VaultItem[]) => void
): Unsubscribe {
  const path = 'vaultItems';
  const baseRef = collection(db, path);
  const q =
    userRole === 'admin'
      ? query(baseRef)
      : query(baseRef, where('memberUids', 'array-contains', user.uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as VaultItem);
      onChange(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeCollections(
  user: User,
  userRole: UserRole,
  onChange: (cols: EvidenceCollection[]) => void
): Unsubscribe {
  const path = 'collections';
  const baseRef = collection(db, path);
  const q =
    userRole === 'admin'
      ? query(baseRef)
      : query(baseRef, where('memberUids', 'array-contains', user.uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as EvidenceCollection);
      onChange(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeActivityLogs(
  user: User,
  userRole: UserRole,
  onChange: (logs: ActivityLog[]) => void
): Unsubscribe {
  const path = 'activityLogs';
  const baseRef = collection(db, path);
  const q =
    userRole === 'admin'
      ? query(baseRef)
      : query(baseRef, where('ownerId', '==', user.uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as ActivityLog & { createdAt?: { toMillis?: () => number } })
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        .slice(0, 20);
      onChange(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function logActivity(params: {
  title: string;
  detail: string;
  caseId?: string;
  actorName: string;
  ownerId: string;
}): Promise<void> {
  const id = makeId('act');
  const path = `activityLogs/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      title: params.title.slice(0, 200),
      detail: params.detail.slice(0, 400),
      actorName: params.actorName.slice(0, 120),
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
    };
    if (params.caseId) {
      payload.caseId = params.caseId.slice(0, 128);
    }
    await setDoc(doc(db, 'activityLogs', id), payload);
  } catch {
    // Non-critical log write
  }
}

export async function createCaseRecord(params: {
  ownerId: string;
  actorName: string;
  caseNumber: string;
  title: string;
  caseType: CaseType;
  status?: CaseStatus;
  court?: string;
  judge?: string;
  charge?: string;
  arrestDates?: string;
  closureDate?: string;
  disposition?: string;
  summary?: string;
  withTemplateSections?: boolean;
}): Promise<string> {
  const id = makeId('case');
  const path = `cases/${id}`;
  const baseSlug = slugify(`${params.caseNumber}-${params.title}`.slice(0, 60));
  const publicSlug = `${baseSlug}-${id.slice(-4)}`.toLowerCase();

  try {
    const payload: Record<string, unknown> = {
      id,
      caseNumber: params.caseNumber.trim().slice(0, 64) || id.slice(-6).toUpperCase(),
      title: params.title.trim().slice(0, 240),
      caseType: params.caseType,
      status: params.status || 'Active',
      publicSlug,
      isPublished: false,
      publicHeadline: params.title.trim().slice(0, 240),
      publicSubtitle: `${params.court || 'Official Case Record'} · Case No. ${params.caseNumber}`.slice(
        0,
        320
      ),
      publicIntro: (params.summary || '').slice(0, 8000),
      publicCoverUrl: '/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg',
      customFields: [],
      tags: [],
      ownerId: params.ownerId,
      memberUids: [params.ownerId],
      editorUids: [params.ownerId],
      invitedEmails: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (params.court) payload.court = clampString(params.court, 200);
    if (params.judge) payload.judge = clampString(params.judge, 160);
    if (params.charge) payload.charge = clampString(params.charge, 300);
    if (params.arrestDates) payload.arrestDates = clampString(params.arrestDates, 160);
    if (params.closureDate) payload.closureDate = clampString(params.closureDate, 120);
    if (params.disposition) payload.disposition = clampString(params.disposition, 300);
    if (params.summary) payload.summary = clampString(params.summary, 8000);

    await setDoc(doc(db, 'cases', id), payload);

    if (params.withTemplateSections) {
      const templateTitles = [
        'Executive Summary & Procedural Overview',
        'Key Actors, Institutional Entities & Counsel Matrix',
        'Macro-Environmental & Contextual Origins',
        'Chronological Timeline of Events',
        'Case Narrative & Primary Account',
        'Procedural & Institutional Analysis',
        'Evidentiary Record, Chain of Custody & Verification',
        'Statutory & Policy Compliance Matrix',
        'Impact Assessment & Continuing Record',
      ];
      await Promise.all(
        templateTitles.map((secTitle, idx) =>
          createCaseSection({
            caseId: id,
            ownerId: params.ownerId,
            order: idx + 1,
            title: secTitle,
            content: `Enter structured findings and documented citations for "${secTitle}".`,
            isPublic: idx < 5,
          })
        )
      );
    }

    await logActivity({
      title: 'Case dossier created',
      detail: `Case ${params.caseNumber} · ${params.title}`,
      caseId: id,
      actorName: params.actorName,
      ownerId: params.ownerId,
    });

    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCaseRecord(
  caseId: string,
  updates: Partial<{
    caseNumber: string;
    title: string;
    caseType: CaseType;
    court: string;
    judge: string;
    charge: string;
    arrestDates: string;
    closureDate: string;
    status: CaseStatus;
    disposition: string;
    summary: string;
    customFields: CustomField[];
    tags: string[];
    publicSlug: string;
    isPublished: boolean;
    publicHeadline: string;
    publicSubtitle: string;
    publicIntro: string;
    publicCoverUrl: string;
    memberUids: string[];
    editorUids: string[];
    invitedEmails: string[];
  }>
): Promise<void> {
  const path = `cases/${caseId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.caseNumber !== undefined) clean.caseNumber = updates.caseNumber.slice(0, 64);
    if (updates.title !== undefined) clean.title = updates.title.slice(0, 240);
    if (updates.caseType !== undefined) clean.caseType = updates.caseType;
    if (updates.court !== undefined) clean.court = updates.court.slice(0, 200);
    if (updates.judge !== undefined) clean.judge = updates.judge.slice(0, 160);
    if (updates.charge !== undefined) clean.charge = updates.charge.slice(0, 300);
    if (updates.arrestDates !== undefined) clean.arrestDates = updates.arrestDates.slice(0, 160);
    if (updates.closureDate !== undefined) clean.closureDate = updates.closureDate.slice(0, 120);
    if (updates.status !== undefined) clean.status = updates.status;
    if (updates.disposition !== undefined) clean.disposition = updates.disposition.slice(0, 300);
    if (updates.summary !== undefined) clean.summary = updates.summary.slice(0, 8000);
    if (updates.customFields !== undefined) {
      clean.customFields = updates.customFields.slice(0, 25).map((cf) => ({
        label: String(cf.label).slice(0, 80),
        value: String(cf.value).slice(0, 300),
      }));
    }
    if (updates.tags !== undefined) clean.tags = clampStringArray(updates.tags, 20, 100);
    if (updates.publicSlug !== undefined) clean.publicSlug = slugify(updates.publicSlug);
    if (updates.isPublished !== undefined) clean.isPublished = updates.isPublished;
    if (updates.publicHeadline !== undefined)
      clean.publicHeadline = updates.publicHeadline.slice(0, 240);
    if (updates.publicSubtitle !== undefined)
      clean.publicSubtitle = updates.publicSubtitle.slice(0, 320);
    if (updates.publicIntro !== undefined) clean.publicIntro = updates.publicIntro.slice(0, 8000);
    if (updates.publicCoverUrl !== undefined)
      clean.publicCoverUrl = updates.publicCoverUrl.slice(0, 500);
    if (updates.memberUids !== undefined)
      clean.memberUids = clampStringArray(updates.memberUids, 20, 128);
    if (updates.editorUids !== undefined)
      clean.editorUids = clampStringArray(updates.editorUids, 20, 128);
    if (updates.invitedEmails !== undefined)
      clean.invitedEmails = clampStringArray(
        updates.invitedEmails.map((e) => e.toLowerCase()),
        20,
        254
      );

    await updateDoc(doc(db, 'cases', caseId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCaseRecord(caseId: string): Promise<void> {
  const path = `cases/${caseId}`;
  try {
    const snap = await getDoc(doc(db, 'cases', caseId));
    const caseData = snap.data() as CaseRecord | undefined;
    if (caseData?.publicSlug) {
      await deleteDoc(doc(db, 'publicSites', caseData.publicSlug)).catch(() => {});
    }
    await deleteDoc(doc(db, 'cases', caseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeCaseSubcollections(
  caseId: string,
  callbacks: {
    onSections: (sections: CaseSection[]) => void;
    onTimeline: (events: TimelineEvent[]) => void;
    onActors: (actors: CaseActor[]) => void;
    onCollaborators: (collabs: CaseCollaborator[]) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'cases', caseId, 'sections'),
      (snap) => {
        const rows = snap.docs
          .map((d) => d.data() as CaseSection)
          .sort((a, b) => a.order - b.order);
        callbacks.onSections(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `cases/${caseId}/sections`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'cases', caseId, 'timeline'),
      (snap) => {
        const rows = snap.docs
          .map((d) => d.data() as TimelineEvent)
          .sort((a, b) => a.date.localeCompare(b.date));
        callbacks.onTimeline(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `cases/${caseId}/timeline`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'cases', caseId, 'actors'),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as CaseActor);
        callbacks.onActors(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `cases/${caseId}/actors`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'cases', caseId, 'collaborators'),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as CaseCollaborator);
        callbacks.onCollaborators(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `cases/${caseId}/collaborators`)
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function createCaseSection(params: {
  caseId: string;
  ownerId: string;
  order: number;
  title: string;
  content: string;
  isPublic: boolean;
}): Promise<string> {
  const id = makeId('sec');
  const path = `cases/${params.caseId}/sections/${id}`;
  try {
    await setDoc(doc(db, 'cases', params.caseId, 'sections', id), {
      id,
      caseId: params.caseId,
      order: params.order,
      title: params.title.slice(0, 240),
      content: params.content.slice(0, 30000),
      isPublic: params.isPublic,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCaseSection(
  caseId: string,
  sectionId: string,
  updates: Partial<{ order: number; title: string; content: string; isPublic: boolean }>
): Promise<void> {
  const path = `cases/${caseId}/sections/${sectionId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.order !== undefined) clean.order = updates.order;
    if (updates.title !== undefined) clean.title = updates.title.slice(0, 240);
    if (updates.content !== undefined) clean.content = updates.content.slice(0, 30000);
    if (updates.isPublic !== undefined) clean.isPublic = updates.isPublic;
    await updateDoc(doc(db, 'cases', caseId, 'sections', sectionId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCaseSection(caseId: string, sectionId: string): Promise<void> {
  const path = `cases/${caseId}/sections/${sectionId}`;
  try {
    await deleteDoc(doc(db, 'cases', caseId, 'sections', sectionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createTimelineEvent(params: {
  caseId: string;
  ownerId: string;
  date: string;
  time?: string;
  title: string;
  description: string;
  isPublic: boolean;
}): Promise<string> {
  const id = makeId('evt');
  const path = `cases/${params.caseId}/timeline/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      caseId: params.caseId,
      date: params.date.slice(0, 40),
      title: params.title.slice(0, 240),
      description: params.description.slice(0, 4000),
      isPublic: params.isPublic,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.time) payload.time = params.time.slice(0, 40);
    await setDoc(doc(db, 'cases', params.caseId, 'timeline', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTimelineEvent(
  caseId: string,
  eventId: string,
  updates: Partial<{ date: string; time: string; title: string; description: string; isPublic: boolean }>
): Promise<void> {
  const path = `cases/${caseId}/timeline/${eventId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.date !== undefined) clean.date = updates.date.slice(0, 40);
    if (updates.time !== undefined) clean.time = updates.time.slice(0, 40);
    if (updates.title !== undefined) clean.title = updates.title.slice(0, 240);
    if (updates.description !== undefined) clean.description = updates.description.slice(0, 4000);
    if (updates.isPublic !== undefined) clean.isPublic = updates.isPublic;
    await updateDoc(doc(db, 'cases', caseId, 'timeline', eventId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTimelineEvent(caseId: string, eventId: string): Promise<void> {
  const path = `cases/${caseId}/timeline/${eventId}`;
  try {
    await deleteDoc(doc(db, 'cases', caseId, 'timeline', eventId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createCaseActor(params: {
  caseId: string;
  ownerId: string;
  name: string;
  role: string;
  organization?: string;
  notes?: string;
  isPublic: boolean;
}): Promise<string> {
  const id = makeId('actr');
  const path = `cases/${params.caseId}/actors/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      caseId: params.caseId,
      name: params.name.slice(0, 160),
      role: params.role.slice(0, 160),
      isPublic: params.isPublic,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.organization) payload.organization = params.organization.slice(0, 200);
    if (params.notes) payload.notes = params.notes.slice(0, 2000);
    await setDoc(doc(db, 'cases', params.caseId, 'actors', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCaseActor(
  caseId: string,
  actorId: string,
  updates: Partial<{
    name: string;
    role: string;
    organization: string;
    notes: string;
    isPublic: boolean;
  }>
): Promise<void> {
  const path = `cases/${caseId}/actors/${actorId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) clean.name = updates.name.slice(0, 160);
    if (updates.role !== undefined) clean.role = updates.role.slice(0, 160);
    if (updates.organization !== undefined) clean.organization = updates.organization.slice(0, 200);
    if (updates.notes !== undefined) clean.notes = updates.notes.slice(0, 2000);
    if (updates.isPublic !== undefined) clean.isPublic = updates.isPublic;
    await updateDoc(doc(db, 'cases', caseId, 'actors', actorId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCaseActor(caseId: string, actorId: string): Promise<void> {
  const path = `cases/${caseId}/actors/${actorId}`;
  try {
    await deleteDoc(doc(db, 'cases', caseId, 'actors', actorId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function addCaseCollaborator(params: {
  caseRecord: CaseRecord;
  ownerId: string;
  email: string;
  role: CaseCollaboratorRole;
  knownUid?: string;
}): Promise<void> {
  const normalizedEmail = params.email.trim().toLowerCase().slice(0, 254);
  const id = makeId('col');
  const path = `cases/${params.caseRecord.id}/collaborators/${id}`;
  try {
    await setDoc(doc(db, 'cases', params.caseRecord.id, 'collaborators', id), {
      id,
      caseId: params.caseRecord.id,
      email: normalizedEmail,
      role: params.role,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const nextInvited = clampStringArray([...params.caseRecord.invitedEmails, normalizedEmail], 20, 254);
    const nextMembers = params.knownUid
      ? clampStringArray([...params.caseRecord.memberUids, params.knownUid], 20, 128)
      : params.caseRecord.memberUids;
    const nextEditors =
      params.knownUid && params.role === 'editor'
        ? clampStringArray([...params.caseRecord.editorUids, params.knownUid], 20, 128)
        : params.caseRecord.editorUids;

    await updateCaseRecord(params.caseRecord.id, {
      invitedEmails: nextInvited,
      memberUids: nextMembers,
      editorUids: nextEditors,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeCaseCollaborator(
  caseRecord: CaseRecord,
  collab: CaseCollaborator
): Promise<void> {
  const path = `cases/${caseRecord.id}/collaborators/${collab.id}`;
  try {
    await deleteDoc(doc(db, 'cases', caseRecord.id, 'collaborators', collab.id));
    await updateCaseRecord(caseRecord.id, {
      invitedEmails: caseRecord.invitedEmails.filter((e) => e !== collab.email),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function claimInvitedCaseMembership(caseRecord: CaseRecord, uid: string): Promise<void> {
  if (caseRecord.memberUids.includes(uid)) return;
  const path = `cases/${caseRecord.id}`;
  try {
    await updateDoc(doc(db, 'cases', caseRecord.id), {
      memberUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Silent if not eligible
  }
}

export async function createVaultItem(params: {
  ownerId: string;
  actorName: string;
  title: string;
  description?: string;
  category: VaultCategory;
  mediaType: VaultItem['mediaType'];
  docType?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  sha256?: string;
  encrypted: boolean;
  textContent?: string;
  embedUrl?: string;
  caseIds: string[];
  tags: string[];
  isPublic: boolean;
}): Promise<string> {
  const id = makeId('vi');
  const path = `vaultItems/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      title: params.title.trim().slice(0, 240),
      category: params.category,
      mediaType: params.mediaType,
      encrypted: params.encrypted,
      caseIds: clampStringArray(params.caseIds, 10, 128),
      tags: clampStringArray(params.tags, 15, 60),
      isPublic: params.isPublic,
      ownerId: params.ownerId,
      memberUids: [params.ownerId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.description) payload.description = params.description.slice(0, 4000);
    if (params.docType) payload.docType = params.docType.slice(0, 120);
    if (params.fileId) payload.fileId = params.fileId.slice(0, 128);
    if (params.fileName) payload.fileName = params.fileName.slice(0, 260);
    if (params.mimeType) payload.mimeType = params.mimeType.slice(0, 160);
    if (params.fileSize !== undefined) payload.fileSize = params.fileSize;
    if (params.sha256) payload.sha256 = params.sha256.slice(0, 128);
    if (params.textContent) payload.textContent = params.textContent.slice(0, 20000);
    if (params.embedUrl) payload.embedUrl = params.embedUrl.slice(0, 1000);

    await setDoc(doc(db, 'vaultItems', id), payload);
    if (params.fileId) {
      await syncVaultFileVisibility(params.fileId, params.isPublic);
    }

    await logActivity({
      title: params.category === 'document' ? 'Document uploaded' : 'Evidence added',
      detail: `${params.title}${params.caseIds.length ? ` · linked to ${params.caseIds.length} case(s)` : ' · standalone'}`,
      caseId: params.caseIds[0],
      actorName: params.actorName,
      ownerId: params.ownerId,
    });

    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateVaultItem(
  item: VaultItem,
  updates: Partial<{
    title: string;
    description: string;
    category: VaultCategory;
    docType: string;
    textContent: string;
    embedUrl: string;
    caseIds: string[];
    tags: string[];
    isPublic: boolean;
    memberUids: string[];
  }>
): Promise<void> {
  const path = `vaultItems/${item.id}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) clean.title = updates.title.slice(0, 240);
    if (updates.description !== undefined) clean.description = updates.description.slice(0, 4000);
    if (updates.category !== undefined) clean.category = updates.category;
    if (updates.docType !== undefined) clean.docType = updates.docType.slice(0, 120);
    if (updates.textContent !== undefined) clean.textContent = updates.textContent.slice(0, 20000);
    if (updates.embedUrl !== undefined) clean.embedUrl = updates.embedUrl.slice(0, 1000);
    if (updates.caseIds !== undefined) clean.caseIds = clampStringArray(updates.caseIds, 10, 128);
    if (updates.tags !== undefined) clean.tags = clampStringArray(updates.tags, 15, 60);
    if (updates.isPublic !== undefined) clean.isPublic = updates.isPublic;
    if (updates.memberUids !== undefined)
      clean.memberUids = clampStringArray(updates.memberUids, 20, 128);

    await updateDoc(doc(db, 'vaultItems', item.id), clean);
    if (updates.isPublic !== undefined && item.fileId) {
      await syncVaultFileVisibility(item.fileId, updates.isPublic);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteVaultItem(itemId: string): Promise<void> {
  const path = `vaultItems/${itemId}`;
  try {
    await deleteDoc(doc(db, 'vaultItems', itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createEvidenceCollection(params: {
  ownerId: string;
  actorName: string;
  title: string;
  explanation: string;
  coverImageUrl?: string;
  itemIds: string[];
  caseId?: string;
  tags: string[];
  isPublic: boolean;
}): Promise<string> {
  const id = makeId('col');
  const path = `collections/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      title: params.title.trim().slice(0, 240),
      explanation: params.explanation.trim().slice(0, 8000),
      itemIds: clampStringArray(params.itemIds, 50, 128),
      tags: clampStringArray(params.tags, 15, 60),
      isPublic: params.isPublic,
      ownerId: params.ownerId,
      memberUids: [params.ownerId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.coverImageUrl) payload.coverImageUrl = params.coverImageUrl.slice(0, 500);
    if (params.caseId) payload.caseId = params.caseId.slice(0, 128);

    await setDoc(doc(db, 'collections', id), payload);

    await logActivity({
      title: 'Collection created',
      detail: `${params.title} · ${params.itemIds.length} items grouped`,
      caseId: params.caseId,
      actorName: params.actorName,
      ownerId: params.ownerId,
    });

    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateEvidenceCollection(
  collectionId: string,
  updates: Partial<{
    title: string;
    explanation: string;
    coverImageUrl: string;
    itemIds: string[];
    caseId: string;
    tags: string[];
    isPublic: boolean;
  }>
): Promise<void> {
  const path = `collections/${collectionId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) clean.title = updates.title.slice(0, 240);
    if (updates.explanation !== undefined) clean.explanation = updates.explanation.slice(0, 8000);
    if (updates.coverImageUrl !== undefined)
      clean.coverImageUrl = updates.coverImageUrl.slice(0, 500);
    if (updates.itemIds !== undefined) clean.itemIds = clampStringArray(updates.itemIds, 50, 128);
    if (updates.caseId !== undefined) clean.caseId = updates.caseId.slice(0, 128);
    if (updates.tags !== undefined) clean.tags = clampStringArray(updates.tags, 15, 60);
    if (updates.isPublic !== undefined) clean.isPublic = updates.isPublic;

    await updateDoc(doc(db, 'collections', collectionId), clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteEvidenceCollection(collectionId: string): Promise<void> {
  const path = `collections/${collectionId}`;
  try {
    await deleteDoc(doc(db, 'collections', collectionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function publishCaseToPublicSite(params: {
  caseRecord: CaseRecord;
  sections: CaseSection[];
  timeline: TimelineEvent[];
  actors: CaseActor[];
  vaultItems: VaultItem[];
  collections: EvidenceCollection[];
  actorName: string;
}): Promise<string> {
  const { caseRecord, sections, timeline, actors, vaultItems, collections, actorName } = params;
  const slug = slugify(caseRecord.publicSlug || `${caseRecord.caseNumber}-${caseRecord.title}`);
  const path = `publicSites/${slug}`;

  try {
    const publicDocs = vaultItems.filter(
      (v) => v.category === 'document' && v.isPublic && v.caseIds.includes(caseRecord.id)
    );
    const publicEv = vaultItems.filter(
      (v) => v.category === 'evidence' && v.isPublic && v.caseIds.includes(caseRecord.id)
    );
    const publicCols = collections.filter(
      (c) => c.isPublic && (!c.caseId || c.caseId === caseRecord.id)
    );

    // Ensure all public files, case cover, and collection cover files are marked public in Cloud Firestore
    await Promise.all([
      ...publicDocs.filter((d) => d.fileId).map((d) => syncVaultFileVisibility(d.fileId!, true)),
      ...publicEv.filter((e) => e.fileId).map((e) => syncVaultFileVisibility(e.fileId!, true)),
      ...publicCols
        .filter((c) => c.coverImageUrl)
        .map((c) => syncVaultFileVisibility(c.coverImageUrl!, true)),
      ...(caseRecord.publicCoverUrl
        ? [syncVaultFileVisibility(caseRecord.publicCoverUrl, true)]
        : []),
    ]);

    const itemById = new Map(vaultItems.map((v) => [v.id, v]));

    const sitePayload: Record<string, unknown> = {
      slug,
      caseId: caseRecord.id,
      ownerId: caseRecord.ownerId,
      published: true,
      caseNumber: caseRecord.caseNumber.slice(0, 64),
      title: caseRecord.title.slice(0, 240),
      caseType: caseRecord.caseType,
      status: caseRecord.status,
      headline: (caseRecord.publicHeadline || caseRecord.title).slice(0, 240),
      subtitle: (
        caseRecord.publicSubtitle ||
        `${caseRecord.court || 'Public Archive'} · Case No. ${caseRecord.caseNumber}`
      ).slice(0, 320),
      intro: (
        caseRecord.publicIntro ||
        caseRecord.summary ||
        `${caseRecord.title} (${caseRecord.status})${caseRecord.court ? ` — ${caseRecord.court}` : ''}. Includes ${sections.filter((s) => s.isPublic).length} report section(s), ${timeline.filter((t) => t.isPublic).length} timeline event(s), and ${publicDocs.length + publicEv.length} verified records.`
      ).slice(0, 8000),
      coverUrl: (
        caseRecord.publicCoverUrl || '/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg'
      ).slice(0, 500),
      tags: clampStringArray(caseRecord.tags, 20, 100),
      customFields: (caseRecord.customFields || []).slice(0, 25),
      sections: sections
        .filter((s) => s.isPublic)
        .sort((a, b) => a.order - b.order)
        .slice(0, 40)
        .map((s) => ({
          id: s.id,
          order: s.order,
          title: s.title,
          content: s.content,
        })),
      timeline: timeline
        .filter((t) => t.isPublic)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 120)
        .map((t) => ({
          id: t.id,
          date: t.date,
          time: t.time || '',
          title: t.title,
          description: t.description,
        })),
      actors: actors
        .filter((a) => a.isPublic)
        .slice(0, 60)
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          organization: a.organization || '',
          notes: a.notes || '',
        })),
      documents: publicDocs.slice(0, 100).map((d) => ({
        id: d.id,
        title: d.title,
        docType: d.docType || d.mediaType.toUpperCase(),
        fileId: d.fileId || '',
        fileName: d.fileName || '',
        mimeType: d.mimeType || '',
        fileSize: d.fileSize || 0,
        sha256: d.sha256 || '',
        description: d.description || '',
      })),
      evidence: publicEv.slice(0, 100).map((e) => ({
        id: e.id,
        title: e.title,
        mediaType: e.mediaType,
        fileId: e.fileId || '',
        fileName: e.fileName || '',
        mimeType: e.mimeType || '',
        sha256: e.sha256 || '',
        textContent: e.textContent || '',
        embedUrl: e.embedUrl || '',
        description: e.description || '',
        tags: e.tags || [],
      })),
      collections: publicCols
        .filter((c) => c.caseId === caseRecord.id)
        .slice(0, 40)
        .map((c) => ({
          id: c.id,
          title: c.title,
          explanation: c.explanation,
          coverImageUrl: c.coverImageUrl || '',
          tags: c.tags || [],
          items: c.itemIds
            .map((id) => itemById.get(id))
            .filter((item): item is VaultItem => Boolean(item && item.isPublic))
            .map((item) => ({
              id: item.id,
              title: item.title,
              mediaType: item.mediaType,
              fileId: item.fileId || '',
              fileName: item.fileName || '',
              mimeType: item.mimeType || '',
              sha256: item.sha256 || '',
              textContent: item.textContent || '',
              embedUrl: item.embedUrl || '',
              description: item.description || '',
            })),
        })),
      updatedAt: serverTimestamp(),
    };

    if (caseRecord.court) sitePayload.court = caseRecord.court.slice(0, 200);
    if (caseRecord.judge) sitePayload.judge = caseRecord.judge.slice(0, 160);
    if (caseRecord.charge) sitePayload.charge = caseRecord.charge.slice(0, 300);
    if (caseRecord.arrestDates) sitePayload.arrestDates = caseRecord.arrestDates.slice(0, 160);
    if (caseRecord.closureDate) sitePayload.closureDate = caseRecord.closureDate.slice(0, 120);
    if (caseRecord.disposition) sitePayload.disposition = caseRecord.disposition.slice(0, 300);

    await setDoc(doc(db, 'publicSites', slug), sitePayload);
    await updateCaseRecord(caseRecord.id, { publicSlug: slug, isPublished: true });

    await logActivity({
      title: 'Public site published',
      detail: `Case ${caseRecord.caseNumber} live at /site/${slug}`,
      caseId: caseRecord.id,
      actorName,
      ownerId: caseRecord.ownerId,
    });

    return slug;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function unpublishCaseSite(
  caseRecord: CaseRecord,
  actorName: string
): Promise<void> {
  const path = `publicSites/${caseRecord.publicSlug}`;
  try {
    const snap = await getDoc(doc(db, 'publicSites', caseRecord.publicSlug));
    if (snap.exists()) {
      await updateDoc(doc(db, 'publicSites', caseRecord.publicSlug), {
        published: false,
        updatedAt: serverTimestamp(),
      });
    }
    await updateCaseRecord(caseRecord.id, { isPublished: false });
    await logActivity({
      title: 'Public site unpublished',
      detail: `Case ${caseRecord.caseNumber} removed from public archive`,
      caseId: caseRecord.id,
      actorName,
      ownerId: caseRecord.ownerId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchPublicSiteBySlug(slug: string): Promise<PublicSite | null> {
  const path = `publicSites/${slug}`;
  try {
    const snap = await getDoc(doc(db, 'publicSites', slug));
    if (!snap.exists()) return null;
    const data = snap.data() as PublicSite;
    return data.published ? data : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function fetchAllPublishedSites(): Promise<PublicSite[]> {
  const path = 'publicSites';
  try {
    const q = query(collection(db, path), where('published', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PublicSite);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
