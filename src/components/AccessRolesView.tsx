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
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1210] dark:text-[#f3f0e9]">
          Access Control &amp; Security
        </h1>
        <p className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-1">
          Manage workspace stakeholder roles, cloud synchronization, and AES-256-GCM vault encryption.
        </p>
      </div>

      {/* Current Session Profile & Encryption Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-3">
            <KeyRound className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
            <span>Your Authenticated Identity</span>
          </div>
          <div className="text-sm font-semibold text-[#0f1210] dark:text-[#f3f0e9]">
            {currentUser.displayName}
          </div>
          <div className="text-xs text-[#6a716b] dark:text-[#8d948e] mt-0.5 mb-3">
            {currentUser.email}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6a716b]">Workspace Role:</span>
            <StatusLabel status={currentUser.role} />
          </div>
        </div>

        <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-[#6a716b] mb-3">
            <Lock className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892]" />
            <span>Cryptographic Storage &amp; Sync</span>
          </div>
          <div className="space-y-2 text-xs text-[#0f1210]/85 dark:text-[#f3f0e9]/85">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892] shrink-0" />
              <span>Files encrypted at rest with AES-256-GCM &amp; SHA-256 chain-of-custody hashing</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892] shrink-0" />
              <span>Firestore real-time cloud sync enforced by Zero-Trust RBAC security rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Definitions Matrix */}
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-5">
        <h2 className="text-[13px] font-semibold mb-4">Role-Based Access Matrix</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {roleDefinitions.map((r) => (
            <div
              key={r.role}
              className="p-3.5 border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#0c0e0c]"
            >
              <div className="text-xs font-semibold text-[#2d5a3d] dark:text-[#7fb892] mb-1">
                {r.role}
              </div>
              <p className="text-xs text-[#6a716b] dark:text-[#8d948e] leading-relaxed">
                {r.scope}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace User Directory (Admin Only) */}
      <div className="bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#ddd8ce] dark:border-[#262b27] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#2d5a3d] dark:text-[#7fb892]" />
          <h2 className="text-[13px] font-semibold">Workspace Stakeholders</h2>
        </div>
        {!isAdmin ? (
          <div className="p-6 text-xs text-[#6a716b]">
            Workspace-wide role assignments are restricted to Administrators. Case owners can grant per-case stakeholder permissions inside each Case Workspace under the Stakeholder Roles tab.
          </div>
        ) : workspaceUsers.length === 0 ? (
          <div className="p-6 text-xs text-[#6a716b]">No additional workspace accounts registered yet.</div>
        ) : (
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#ddd8ce] dark:border-[#262b27] bg-black/[0.015] dark:bg-white/[0.02] text-[10px] font-medium uppercase tracking-[0.1em] text-[#6a716b]">
                <th className="py-2.5 px-3.5">User</th>
                <th className="py-2.5 px-3.5">Email</th>
                <th className="py-2.5 px-3.5">Current Role</th>
                <th className="py-2.5 px-3.5 text-right">Assign Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e5db] dark:divide-[#222723]">
              {workspaceUsers.map((u) => (
                <tr key={u.uid}>
                  <td className="py-2.5 px-3.5 font-medium">{u.displayName}</td>
                  <td className="py-2.5 px-3.5 text-[#6a716b]">{u.email}</td>
                  <td className="py-2.5 px-3.5">
                    <StatusLabel status={u.role} />
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    <select
                      value={u.role}
                      disabled={u.uid === currentUser.uid}
                      onChange={(e) => void updateUserRole(u.uid, e.target.value as UserRole)}
                      className="px-2.5 py-1 text-xs bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27]"
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
