import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { db } from './dexie';
import { setCurrentUserId, queueOfflineWrite } from './sync';
import { detectPlatform } from './deviceInfo';

const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role_id: string | null;
  role_name?: string;
  permissions?: { [key: string]: { view: boolean; add: boolean; edit: boolean; delete: boolean } };
  app_version?: string;
  platform?: string;
  last_seen_at?: string;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkPermission: (module: string, action: 'view' | 'add' | 'edit' | 'delete') => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load cached auth session on startup
  useEffect(() => {
    const cachedUser = localStorage.getItem('erp_user');
    const cachedProfile = localStorage.getItem('erp_profile');
    if (cachedUser && cachedProfile) {
      setUser(JSON.parse(cachedUser));
      const parsedProfile = JSON.parse(cachedProfile);
      setProfile(parsedProfile);
      setCurrentUserId(parsedProfile.id);
      setLoading(false);
    }

    // Subscribe to supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('erp_user', JSON.stringify(session.user));
        await refreshProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setProfile(null);
        setCurrentUserId(null);
        localStorage.removeItem('erp_user');
        localStorage.removeItem('erp_profile');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Keep a ref alongside profile state so the heartbeat interval always
  // writes the latest profile fields instead of a stale closure snapshot.
  const profileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const recordPresence = async (base: UserProfile) => {
    const updated: UserProfile = {
      ...base,
      app_version: __APP_VERSION__,
      platform: detectPlatform(),
      last_seen_at: new Date().toISOString()
    };
    localStorage.setItem('erp_profile', JSON.stringify(updated));
    await queueOfflineWrite('users', 'update', updated.id, updated);
  };

  // Record app version / last-seen on login, then on a periodic heartbeat
  // while the app stays open, so "Users & Devices" reflects live presence.
  useEffect(() => {
    if (!profile) return;
    recordPresence(profile);
    const interval = setInterval(() => {
      if (profileRef.current) recordPresence(profileRef.current);
    }, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const refreshProfile = async (userId: string, email: string) => {
    try {
      if (navigator.onLine) {
        // Fetch from Supabase
        let { data: prof, error } = await supabase
          .from('users')
          .select('*, roles(*)')
          .eq('id', userId)
          .single();

        if (error || !prof) {
          // Check if any profiles exist in the system. If not, this is the first user -> make them Master Admin!
          const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const isFirst = count === 0;
          const masterRoleId = '88888888-8888-8888-8888-888888888888';

          const newProfile = {
            id: userId,
            email: email,
            name: email.split('@')[0],
            role_id: isFirst ? masterRoleId : null
          };

          const { error: insErr } = await supabase.from('users').insert(newProfile);
          if (!insErr) {
            prof = { ...newProfile, roles: isFirst ? { id: masterRoleId, name: 'Master Admin' } : null };
          }
        }

        if (prof) {
          // Fetch custom permissions if not Master Admin
          const isMaster = prof.roles?.name === 'Master Admin';
          const permissionsObj: any = {};

          if (!isMaster && prof.role_id) {
            const { data: perms } = await supabase
              .from('role_permissions')
              .select('permissions(module, action)')
              .eq('role_id', prof.role_id);

            if (perms) {
              perms.forEach((p: any) => {
                const m = p.permissions?.module;
                const a = p.permissions?.action;
                if (m && a) {
                  if (!permissionsObj[m]) permissionsObj[m] = {};
                  permissionsObj[m][a] = true;
                }
              });
            }
          }

          const fullProfile: UserProfile = {
            id: prof.id,
            email: prof.email,
            name: prof.name || email.split('@')[0],
            role_id: prof.role_id,
            role_name: prof.roles?.name || 'مستخدم',
            permissions: permissionsObj
          };

          setProfile(fullProfile);
          setCurrentUserId(fullProfile.id);
          localStorage.setItem('erp_profile', JSON.stringify(fullProfile));
          // Save to local Dexie for offline access
          await db.users.put(fullProfile);
        }
      } else {
        // Offline: load profile from Dexie
        const localProf = await db.users.get(userId);
        if (localProf) {
          setProfile(localProf);
          setCurrentUserId(localProf.id);
        }
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Offline sign-in bypass if session exists
        const cachedUser = localStorage.getItem('erp_user');
        const cachedProfile = localStorage.getItem('erp_profile');
        if (cachedUser && cachedProfile) {
          const userObj = JSON.parse(cachedUser);
          const profileObj = JSON.parse(cachedProfile);
          if (userObj.email === email) {
            setUser(userObj);
            setProfile(profileObj);
            setCurrentUserId(profileObj.id);
            setLoading(false);
            return;
          }
        }
        throw new Error("لا يمكن تسجيل الدخول بدون إنترنت لعدم وجود جلسة مخزنة مسبقاً.");
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        // First user gets Master Admin automatically
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const masterRoleId = '88888888-8888-8888-8888-888888888888';
        const isFirst = count === 0;

        const newProfile = {
          id: data.user.id,
          email,
          name,
          role_id: isFirst ? masterRoleId : null
        };

        const { error: insErr } = await supabase.from('users').insert(newProfile);
        if (insErr) throw insErr;
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCurrentUserId(null);
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_profile');
  };

  const checkPermission = (module: string, action: 'view' | 'add' | 'edit' | 'delete'): boolean => {
    if (!profile) return false;
    // Master Admin can do anything
    if (profile.role_name === 'Master Admin') return true;
    // Check permission matrix
    return !!profile.permissions?.[module]?.[action];
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
