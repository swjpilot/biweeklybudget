import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  db, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { Button } from './Button';
import { Users, Mail, Plus, Check, X, ShieldCheck, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FamilySettingsProps {
  user: any;
  family: any;
}

export const FamilySettings: React.FC<FamilySettingsProps> = ({ user, family }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitations, setInvitations] = useState<any[]>([]);
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);
  const [isCreatingFamily, setIsCreatingFamily] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const invitationsPath = 'invitations';
      const unsubInbound = onSnapshot(
        query(collection(db, 'invitations'), where('email', '==', user.email), where('status', '==', 'pending')),
        (snapshot) => {
          setInvitations(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, invitationsPath);
        }
      );

      const unsubOutbound = onSnapshot(
        query(collection(db, 'invitations'), where('fromUid', '==', user.uid), where('status', '==', 'pending')),
        (snapshot) => {
          setSentInvitations(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, invitationsPath);
        }
      );

      return () => {
        unsubInbound();
        unsubOutbound();
      };
    }
  }, [user?.email, user?.uid]);

  const handleCreateFamily = async () => {
    setIsCreatingFamily(true);
    const familyId = Math.random().toString(36).substr(2, 9);
    const familyPath = `families/${familyId}`;
    const userPath = `users/${user.uid}`;
    try {
      const newFamily = {
        id: familyId,
        members: [user.uid],
        ownerId: user.uid,
        name: `${user.email.split('@')[0]}'s Family`
      };

      await setDoc(doc(db, 'families', familyId), newFamily);
      await updateDoc(doc(db, 'users', user.uid), { familyId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, familyPath);
    } finally {
      setIsCreatingFamily(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !user.familyId) return;

    const inviteId = Math.random().toString(36).substr(2, 9);
    const invitePath = `invitations/${inviteId}`;
    try {
      await setDoc(doc(db, 'invitations', inviteId), {
        id: inviteId,
        email: inviteEmail.toLowerCase(),
        fromUid: user.uid,
        fromEmail: user.email,
        familyId: user.familyId,
        familyName: family?.name || 'Family Group',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Send email invitation via backend
      await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.toLowerCase(),
          fromEmail: user.email,
          familyName: family?.name || 'Family Group',
          appUrl: window.location.origin
        })
      });

      setInviteEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, invitePath);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const invitePath = `invitations/${inviteId}`;
    try {
      await deleteDoc(doc(db, 'invitations', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, invitePath);
    }
  };

  const handleResendInvite = async (invite: any) => {
    const invitePath = `invitations/${invite.id}`;
    try {
      await updateDoc(doc(db, 'invitations', invite.id), {
        createdAt: new Date().toISOString()
      });

      // Re-send email invitation via backend
      await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invite.email,
          fromEmail: user.email,
          familyName: family?.name || 'Family Group',
          appUrl: window.location.origin
        })
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, invitePath);
    }
  };

  const handleAcceptInvite = async (invite: any) => {
    const familyPath = `families/${invite.familyId}`;
    const userPath = `users/${user.uid}`;
    const invitePath = `invitations/${invite.id}`;
    try {
      // 1. Update family members
      const familyRef = doc(db, 'families', invite.familyId);
      await updateDoc(familyRef, {
        members: arrayUnion(user.uid)
      });

      // 2. Update user familyId
      await updateDoc(doc(db, 'users', user.uid), {
        familyId: invite.familyId
      });

      // 3. Mark invite as accepted
      await updateDoc(doc(db, 'invitations', invite.id), {
        status: 'accepted'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, familyPath);
    }
  };

  const handleDeclineInvite = async (invite: any) => {
    const invitePath = `invitations/${invite.id}`;
    try {
      await updateDoc(doc(db, 'invitations', invite.id), {
        status: 'declined'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, invitePath);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Family Sharing</h1>
        {!user.familyId && (
          <Button onClick={handleCreateFamily} disabled={isCreatingFamily}>
            <Plus className={`w-4 h-4 mr-2 ${isCreatingFamily ? 'animate-spin' : ''}`} />
            {isCreatingFamily ? 'Creating...' : 'Create Family Group'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Family Members */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="font-bold text-zinc-900">Members</h2>
            <Users className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="p-6 space-y-4">
            {!user.familyId ? (
              <div className="text-center py-8">
                <p className="text-zinc-400 text-sm">You are not in a family group yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {family?.members.map((memberId: string) => (
                  <div key={memberId} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {memberId === user.uid ? 'ME' : 'U'}
                      </div>
                      <span className="text-sm font-medium text-zinc-700">
                        {memberId === user.uid ? 'You' : `User ${memberId.substr(0, 4)}`}
                      </span>
                    </div>
                    {family.ownerId === memberId && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" />
                        Owner
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invitations */}
        <div className="space-y-8">
          {/* Inbound Invitations */}
          <AnimatePresence>
            {invitations.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200"
              >
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Family Invitations
                </h3>
                <div className="space-y-3">
                  {invitations.map(invite => (
                    <div key={invite.id} className="bg-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{invite.fromEmail}</p>
                        <p className="text-xs text-white/70">Invited you to join their family</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAcceptInvite(invite)}
                          className="w-8 h-8 rounded-lg bg-white text-indigo-600 flex items-center justify-center hover:bg-indigo-50 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeclineInvite(invite)}
                          className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Invite Form */}
          {user.familyId && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="font-bold text-zinc-900 mb-4">Invite Member</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="email" 
                      placeholder="family@example.com"
                      className="flex-1 p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Button onClick={handleInvite} disabled={!inviteEmail} className="w-full sm:w-auto">
                      Invite
                    </Button>
                  </div>
                </div>

                {sentInvitations.length > 0 && (
                  <div className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Invites</p>
                      <button 
                        onClick={async () => {
                          for (const invite of sentInvitations) {
                            await handleDeleteInvite(invite.id);
                          }
                        }}
                        className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider"
                      >
                        Clear All
                      </button>
                    </div>
                    {sentInvitations.map(invite => (
                      <div key={invite.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 group">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-700">{invite.email}</span>
                          <span className="text-[10px] text-zinc-400">Sent {new Date(invite.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">Pending</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleResendInvite(invite)}
                              className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Resend Invite"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteInvite(invite.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Invite"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
