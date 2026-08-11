import React, { useState, useEffect } from 'react';
import { Lock, UserCheck, X, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  AllowedUser,
  DEFAULT_ALLOWED_USERS,
  fetchLiveAllowedUsers,
  validateUserNik,
} from '../data/allowedUsers';

interface LoginLeaderModalProps {
  isOpen: boolean;
  lineId: string | null;
  onClose: () => void;
  onLogin: (nik: string, userName?: string) => void;
}

export const LoginLeaderModal: React.FC<LoginLeaderModalProps> = ({
  isOpen,
  lineId,
  onClose,
  onLogin,
}) => {
  const [nik, setNik] = useState('9370');
  const [error, setError] = useState('');
  const [matchedUser, setMatchedUser] = useState<AllowedUser | null>(null);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>(DEFAULT_ALLOWED_USERS);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Load latest users from Google Sheet when modal opens
  useEffect(() => {
    if (isOpen) {
      setNik('9370');
      setError('');
      setMatchedUser(null);
      setIsLoadingUsers(true);

      fetchLiveAllowedUsers()
        .then((users) => {
          setAllowedUsers(users);
        })
        .catch((err) => {
          console.warn('Error fetching live allowed users:', err);
        })
        .finally(() => {
          setIsLoadingUsers(false);
        });
    }
  }, [isOpen]);

  // Live validate user as they type
  useEffect(() => {
    if (!nik.trim()) {
      setMatchedUser(null);
      setError('');
      return;
    }
    const found = validateUserNik(nik.trim(), allowedUsers);
    setMatchedUser(found);
    if (error && found) setError('');
  }, [nik, allowedUsers]);

  if (!isOpen || !lineId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik.trim()) {
      setError('Masukkan NIK Leader!');
      return;
    }

    const validated = validateUserNik(nik.trim(), allowedUsers);
    if (!validated) {
      setError(`Akses Ditolak: NIK "${nik.trim()}" tidak terdaftar di Sheet User Google.`);
      return;
    }

    onLogin(validated.nik, validated.name);
  };

  const samplePresets = [
    { nik: '9370', label: 'Owner (9370)' },
    { nik: '1973', label: 'Line A01 (1973)' },
    { nik: '3446', label: 'Line B01 (3446)' },
    { nik: '1903', label: 'Line C01 (1903)' },
    { nik: '4102', label: 'Line D01 (4102)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 space-y-5 card-shadow">
        {/* Close Icon */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
          id="btn-close-modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mb-1">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Login Leader</h3>
          <p className="text-xs text-slate-500">
            Akses dibatasi hanya untuk NIK yang terdaftar
          </p>
          <div className="pt-1">
            <span className="text-sm font-semibold font-mono text-blue-700 bg-blue-50 inline-block px-3 py-0.5 rounded-full border border-blue-100">
              TARGET LINE: {lineId}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Masukkan NIK / ID Leader:
              </label>
              {isLoadingUsers && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Sync Sheet...
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={nik}
                onChange={(e) => {
                  setNik(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Contoh: 9370 atau MGM 1973"
                autoFocus
                id="input-leader-nik"
                className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-center text-lg font-mono tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                  error
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                    : matchedUser
                    ? 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                }`}
              />
            </div>

            {/* Matched User Display */}
            {matchedUser && !error && (
              <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">{matchedUser.name}</span>
                    <span className="text-[10px] block text-emerald-600 font-mono">
                      {matchedUser.nik} &bull; Line Sheet: {matchedUser.line}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-md">
                  Terverifikasi
                </span>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700 animate-fadeIn font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Quick NIK Presets from Sheet */}
          <div>
            <div className="text-[10px] text-slate-400 font-medium mb-1.5 text-center">
              Contoh NIK Terdaftar di Sheet User:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {samplePresets.map((preset) => (
                <button
                  key={preset.nik}
                  type="button"
                  onClick={() => setNik(preset.nik)}
                  className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition ${
                    nik === preset.nik
                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="submit"
              id="btn-login-submit"
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition active:scale-[0.98]"
            >
              Masuk Leader
            </button>
            <button
              type="button"
              onClick={onClose}
              id="btn-login-cancel"
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

