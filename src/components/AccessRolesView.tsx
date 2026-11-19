import React from 'react';
import { KeyRound, Lock, ShieldCheck, Users } from 'lucide-react';
import type { UserProfile, UserRole } from '../types';
import { updateUserRole } from '../services/firestoreService';
import { StatusLabel } from './BrandMark';

interface AccessRolesViewProps {
  currentUser: UserProfile;
  workspaceUsers: UserProfile[];
}

export const AccessRolesView: React.FC<AccessRolesViewProps> = ({
  currentUser,
  workspaceUsers,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const roleDefinitions: Array<{ role: string; scope: string }> = [
    {
      role: 'Administrator',
      scope: 'Full console access, role management, case deletion, and public site publishing.',
    },
    {
      role: 'Editor',
      scope: 'Create and edit cases, upload encrypted vault items, build collections, and export reports.',
    },
    {
      role: 'Reviewer',
      scope: 'Inspect assigned private dossiers, review evidence, and export PDF/CSV reports.',
    },
    {
      role: 'Viewer',
      scope: 'Read-only stakeholder access to assigned cases and shared exhibits.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          Access Control &amp; Security
        </h1>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
          Manage workspace stakeholder roles, cloud synchronization, and AES-256-GCM vault encryption.
        </p>
      </div>

      {/* Current Session Profile & Encryption Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
            <KeyRound className="w-3.5 h-3.5 text-[#3061d0]" />
            <span>Your Authenticated Identity</span>
          </div>
          <div className="text-base font-bold text-zinc-950 dark:text-white">
            {currentUser.displayName}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-3">
            {currentUser.email}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Workspace Role:</span>
            <StatusLabel status={currentUser.role} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
            <Lock className="w-3.5 h-3.5 text-[#3061d0]" />
            <span>Cryptographic Storage &amp; Sync</span>
          </div>
          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Files encrypted at rest with AES-256-GCM &amp; SHA-256 chain-of-custody hashing</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Firestore real-time cloud sync enforced by Zero-Trust RBAC security rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Definitions Matrix */}
      <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <h2 className="text-sm font-bold mb-4">Role-Based Access Matrix</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {roleDefinitions.map((r) => (
            <div
              key={r.role}
              className="p-3.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
            >
              <div className="text-xs font-bold text-[#3061d0] dark:text-blue-400 mb-1">
                {r.role}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {r.scope}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace User Directory (Admin Only) */}
      <div className="bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#3061d0]" />
          <h2 className="text-sm font-bold">Workspace Stakeholders</h2>
        </div>
        {!isAdmin ? (
          <div className="p-6 text-xs text-zinc-500">
            Workspace-wide role assignments are restricted to Administrators. Case owners can grant per-case stakeholder permissions inside each Case Workspace under the Stakeholder Roles tab.
          </div>
        ) : workspaceUsers.length === 0 ? (
          <div className="p-6 text-xs text-zinc-500">No additional workspace accounts registered yet.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4 text-right">Assign Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {workspaceUsers.map((u) => (
                <tr key={u.uid}>
                  <td className="py-3 px-4 font-semibold">{u.displayName}</td>
                  <td className="py-3 px-4 text-zinc-500">{u.email}</td>
                  <td className="py-3 px-4">
                    <StatusLabel status={u.role} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <select
                      value={u.role}
                      disabled={u.uid === currentUser.uid}
                      onChange={(e) => void updateUserRole(u.uid, e.target.value as UserRole)}
                      className="px-2.5 py-1 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
