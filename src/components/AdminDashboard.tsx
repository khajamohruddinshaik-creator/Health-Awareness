import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  LogOut,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ApiError,
  deleteRegisteredUser,
  fetchRegisteredUsers,
  updateRegisteredUser,
} from '../services/api';
import type { UserAccount } from '../types/health';

async function computePhoneHash(phone: string): Promise<string> {
  const input = `${firebaseConfig.projectId}:phone:${phone}`;
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface AdminDashboardProps {
  adminEmail: string;
  onLogout: () => void;
  onUnauthorized: (message: string) => void;
}

export function AdminDashboard({
  adminEmail,
  onLogout,
  onUnauthorized,
}: AdminDashboardProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [pendingDelete, setPendingDelete] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const syncRegisteredUsersToFirestore = useCallback(
    async (existingFirestoreIds: Set<string>) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setSyncing(true);
      try {
        const idToken = await currentUser.getIdToken();
        const backendUsers = await fetchRegisteredUsers(idToken);

        for (const u of backendUsers) {
          const docId = String(u.id);
          if (!existingFirestoreIds.has(docId)) {
            const safeName = u.name.trim().slice(0, 120);
            const safeEmail = u.email.trim().toLowerCase().slice(0, 150);
            const safePhone = u.phone.trim();
            if (!safeName || !safeEmail || !/^[0-9]{10}$/.test(safePhone)) {
              continue;
            }
            const userDocPath = `users/${docId}`;
            try {
              await setDoc(doc(db, 'users', docId), {
                id: u.id,
                name: safeName,
                email: safeEmail,
                phone: safePhone,
                role: 'user',
                createdAt: (u.createdAt || new Date().toISOString()).slice(0, 64),
              });
            } catch (writeErr) {
              handleFirestoreError(
                writeErr,
                OperationType.CREATE,
                userDocPath
              );
            }
          }
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          onUnauthorized(err.message);
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to synchronize registered user records.'
        );
      } finally {
        setSyncing(false);
      }
    },
    [onUnauthorized]
  );

  useEffect(() => {
    if (!auth.currentUser) {
      onUnauthorized('Administrator authentication required.');
      return;
    }

    let initialSyncDone = false;
    const usersPath = 'users';

    const unsubscribe = onSnapshot(
      collection(db, usersPath),
      (snapshot) => {
        const list: UserAccount[] = snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            id: typeof data.id === 'number' ? data.id : Number(snap.id) || Date.now(),
            docId: snap.id,
            uid: typeof data.uid === 'string' ? data.uid : undefined,
            name: String(data.name ?? ''),
            email: String(data.email ?? ''),
            phone: String(data.phone ?? ''),
            createdAt:
              typeof data.createdAt === 'string' ? data.createdAt : undefined,
          };
        });
        list.sort((a, b) => b.id - a.id);
        setUsers(list);
        setLoading(false);

        if (!initialSyncDone) {
          initialSyncDone = true;
          const idSet = new Set<string>();
          for (const d of snapshot.docs) {
            idSet.add(d.id);
            const numericId = d.data()?.id;
            if (typeof numericId === 'number') {
              idSet.add(String(numericId));
            }
          }
          void syncRegisteredUsersToFirestore(idSet);
        }
      },
      (snapshotError) => {
        setLoading(false);
        const message =
          snapshotError instanceof Error
            ? snapshotError.message
            : String(snapshotError);
        if (
          message.includes('permission-denied') ||
          message.includes('Missing or insufficient permissions')
        ) {
          onUnauthorized(
            'Access denied: Firestore rejected administrator permissions for this account.'
          );
          return;
        }
        handleFirestoreError(snapshotError, OperationType.LIST, usersPath);
      }
    );

    return () => unsubscribe();
  }, [onUnauthorized, syncRegisteredUsersToFirestore]);

  const handleManualRefresh = async () => {
    setError(null);
    const idSet = new Set(users.map((u) => String(u.id)));
    await syncRegisteredUsersToFirestore(idSet);
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone.includes(query)
    );
  }, [users, searchQuery]);

  const openEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone);
    setEditError(null);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser || !auth.currentUser) return;

    const trimmedName = editName.trim();
    const normalizedEmail = editEmail.trim().toLowerCase();
    const trimmedPhone = editPhone.trim();

    if (!trimmedName || trimmedName.length > 120) {
      setEditError('Full name must be between 1 and 120 characters.');
      return;
    }
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 150
    ) {
      setEditError('Please enter a valid email address.');
      return;
    }
    if (!/^[0-9]{10}$/.test(trimmedPhone)) {
      setEditError('Enter a valid 10-digit mobile number.');
      return;
    }

    const duplicate = users.some(
      (u) =>
        u.id !== editingUser.id &&
        (u.email.toLowerCase() === normalizedEmail || u.phone === trimmedPhone)
    );
    if (duplicate) {
      setEditError(
        'Another registered account already uses this email or mobile number.'
      );
      return;
    }

    setEditError(null);
    setSavingEdit(true);

    const targetDocId =
      editingUser.docId || editingUser.uid || String(editingUser.id);
    const docPath = `users/${targetDocId}`;
    try {
      const idToken = await auth.currentUser.getIdToken();
      await updateRegisteredUser(idToken, editingUser.id, {
        name: trimmedName,
        email: normalizedEmail,
        phone: trimmedPhone,
      });

      try {
        await updateDoc(doc(db, 'users', targetDocId), {
          name: trimmedName,
          email: normalizedEmail,
          phone: trimmedPhone,
          updatedAt: new Date().toISOString(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.UPDATE, docPath);
      }

      setEditingUser(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onUnauthorized(err.message);
        return;
      }
      setEditError(
        err instanceof Error ? err.message : 'Unable to update user account.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!pendingDelete || !auth.currentUser) return;
    setDeleting(true);
    const targetDocId =
      pendingDelete.docId || pendingDelete.uid || String(pendingDelete.id);
    const docPath = `users/${targetDocId}`;

    try {
      const idToken = await auth.currentUser.getIdToken();
      await deleteRegisteredUser(idToken, pendingDelete.id);

      try {
        await deleteDoc(doc(db, 'users', targetDocId));
        if (/^[0-9]{10}$/.test(pendingDelete.phone)) {
          const phoneHash = await computePhoneHash(pendingDelete.phone);
          await deleteDoc(doc(db, 'phoneLookups', phoneHash)).catch(() => {});
        }
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.DELETE, docPath);
      }

      setPendingDelete(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onUnauthorized(err.message);
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Unable to delete user account.'
      );
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9F7] flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-[#DCE6E0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-[#14241B] whitespace-nowrap shrink-0">
            Health &amp; Hygiene
          </span>
          <span className="hidden sm:inline text-sm font-medium text-[#495D52] truncate">
            Administrator Dashboard · {adminEmail}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-10 text-sm font-medium text-white bg-[#B92B27] rounded-lg hover:bg-[#99211E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6EFEA]">
            <div>
              <h1 className="text-2xl font-bold text-[#14241B]">
                Registered Users Registry
              </h1>
              <p className="text-sm text-[#495D52] mt-1">
                Live Firebase Firestore directory of registered community member
                accounts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#F2F7F4] border border-[#DCE6E0] rounded-xl">
                <Users className="w-4 h-4 text-[#146C43]" aria-hidden="true" />
                <span className="text-sm text-[#495D52]">
                  Total Registered Users:
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-[#14241B]">
                  {users.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleManualRefresh()}
                disabled={loading || syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium text-[#14241B] bg-white border border-[#CFDCD4] rounded-lg hover:bg-[#F3F7F5] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading || syncing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Refresh Users</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDF3F2] border border-[#F2CFCB] text-sm text-[#9E2A22]"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="py-5">
            <label htmlFor="searchUser" className="sr-only">
              Search by name, email or mobile number
            </label>
            <div className="relative max-w-md">
              <Search
                className="w-4 h-4 text-[#6B7F73] absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="searchUser"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email or mobile number"
                className="w-full pl-10 pr-4 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-[#DCE6E0] rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#146C43] text-white text-xs sm:text-sm font-semibold">
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EFEA] text-sm">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 px-4 text-center text-[#5B7064]"
                    >
                      Loading registered user accounts from Firestore...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 px-4 text-center text-[#5B7064]"
                    >
                      No registered users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-[#F8FBF9] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-[#14241B]">
                        {user.name}
                      </td>
                      <td className="py-3.5 px-4 text-[#495D52] break-all">
                        {user.email}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[#374B40]">
                        {user.phone}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-10 text-xs font-medium text-[#14241B] bg-[#F2F7F4] border border-[#CFDCD4] rounded-lg hover:bg-[#E7F0EB] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-10 text-xs font-medium text-[#B92B27] bg-[#FDF3F2] border border-[#F2CFCB] rounded-lg hover:bg-[#FBE6E4] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dialog-title"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#DCE6E0] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2
              id="edit-dialog-title"
              className="text-lg font-bold text-[#14241B]"
            >
              Manage User Account
            </h2>

            {editError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-[#FDF3F2] border border-[#F2CFCB] text-xs text-[#9E2A22]"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="editUserName"
                  className="block text-sm font-medium text-[#14241B] mb-1"
                >
                  Full Name
                </label>
                <input
                  id="editUserName"
                  type="text"
                  maxLength={120}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B]"
                />
              </div>

              <div>
                <label
                  htmlFor="editUserEmail"
                  className="block text-sm font-medium text-[#14241B] mb-1"
                >
                  Email Address
                </label>
                <input
                  id="editUserEmail"
                  type="email"
                  maxLength={150}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B]"
                />
              </div>

              <div>
                <label
                  htmlFor="editUserPhone"
                  className="block text-sm font-medium text-[#14241B] mb-1"
                >
                  Mobile Number
                </label>
                <input
                  id="editUserPhone"
                  type="tel"
                  maxLength={10}
                  value={editPhone}
                  onChange={(e) =>
                    setEditPhone(e.target.value.replace(/[^0-9]/g, ''))
                  }
                  required
                  className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm font-mono tabular-nums text-[#14241B]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 min-h-10 text-sm font-medium text-[#374B40] bg-[#EEF3F0] rounded-lg hover:bg-[#E2EBE5] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 min-h-10 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#DCE6E0] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2
              id="delete-dialog-title"
              className="text-lg font-bold text-[#14241B]"
            >
              Delete Registered User
            </h2>
            <p className="text-sm text-[#495D52] leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-[#14241B]">
                {pendingDelete.name}
              </span>{' '}
              ({pendingDelete.email})? This action permanently removes the
              registered user account from Firestore.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 min-h-10 text-sm font-medium text-[#374B40] bg-[#EEF3F0] rounded-lg hover:bg-[#E2EBE5] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteUser()}
                className="px-4 py-2 min-h-10 text-sm font-semibold text-white bg-[#B92B27] rounded-lg hover:bg-[#99211E] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-[#DCE6E0] bg-white py-5 text-center text-xs text-[#495D52]">
        <p>© 2026 Health &amp; Hygiene Awareness Project · Stay Healthy | Stay Clean | Stay Safe</p>
      </footer>
    </div>
  );
}
