import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile, UserStatus } from '../../types/database';
import { X, Flag, Ban, Shield } from 'lucide-react';
import StatusDot from '../StatusDot';
import VerifiedBadge from '../VerifiedBadge';

interface ReportModalProps {
  targetUser: Profile;
  onClose: () => void;
}

export function ReportModal({ targetUser, onClose }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const REASONS = ['Spam', 'Harassment', 'Hate speech', 'Inappropriate content', 'Impersonation', 'Other'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    await supabase.from('user_reports').insert({
      reporter_id: user!.id,
      reported_user_id: targetUser.id,
      reason,
      details: details.trim(),
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Report Submitted</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Thank you. We will review this report.</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Report @{targetUser.username}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`w-full px-3 py-2 text-sm text-left rounded-lg border transition-colors ${
                  reason === r
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Additional details (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />

          <button
            type="submit"
            disabled={!reason}
            className="w-full py-2 bg-red-500 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-red-600 transition-colors"
          >
            Submit Report
          </button>
        </form>
      </div>
    </div>
  );
}

interface BlockConfirmModalProps {
  targetUser: Profile;
  onClose: () => void;
  onConfirm: () => void;
}

export function BlockConfirmModal({ targetUser, onClose, onConfirm }: BlockConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <Ban className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Block @{targetUser.username}?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          They won't be able to message you or see your online status.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
            Block
          </button>
        </div>
      </div>
    </div>
  );
}
