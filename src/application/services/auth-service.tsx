import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../../infrastructure/api/supabase';
import { db } from '../../infrastructure/database/dexie';
import { setCurrentUserId, queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { detectPlatform } from '../../shared/utils/deviceInfo';
import { User } from '../../core/domain/entities';

const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;

export interface UserProfile extends User {
  role_name?: string;
  permissions?: { [key: string]: { view: boolean; add: boolean; edit: boolean; delete: boolean } };
  is_client_user?: boolean;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signInClient: (clientId: string, pin: string) => Promise<void>;
  registerClient: (clientId: string, email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
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
      console.log('Auth state changed:', _event, session?.user?.email);
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('erp_user', JSON.stringify(session.user));
        await refreshProfile(session.user.id, session.user.email || '', session.user.user_metadata?.name);
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
    // role_name/permissions are derived client-side (joined from roles/role_permissions),
    // not real columns on public.users — sending them makes PostgREST reject the
    // whole write with PGRST204 ("column not found in schema cache").
    const { role_name, permissions, ...userRow } = updated;
    await queueOfflineWrite('users', 'update', userRow.id, userRow);
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

  const refreshProfile = async (userId: string, email: string, metaName?: string) => {
    try {
      console.log('Refreshing profile for user:', userId, email);
      if (navigator.onLine) {
        // Fetch from Supabase
        let { data: prof, error } = await supabase
          .from('users')
          .select('*, roles(*)')
          .eq('id', userId)
          .single();

        console.log('Profile query result:', prof, error);

        if (error || !prof) {
          console.log('Profile not found, creating new profile...');
          // Check if any profiles exist in the system. If not, this is the first user -> make them Master Admin!
          const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const isFirst = count === 0;
          const masterRoleId = '88888888-8888-8888-8888-888888888888';

          console.log('Is first user:', isFirst);

          const newProfile = {
            id: userId,
            email: email,
            name: metaName || email.split('@')[0],
            role_id: isFirst ? masterRoleId : null
          };

          const { error: insErr } = await supabase.from('users').insert(newProfile);
          if (!insErr) {
            prof = { ...newProfile, roles: isFirst ? { id: masterRoleId, name: 'Master Admin' } : null };
            console.log('Profile created successfully:', prof);
          } else {
            console.error('Failed to create user profile:', insErr);
            throw new Error('فشل إنشاء ملف المستخدم: ' + insErr.message);
          }
        }

        if (prof) {
          // Check if this is a client portal user
          const isClientUser = prof.roles?.name === 'client_portal';
          
          // Fetch custom permissions if not Master Admin
          const isMaster = prof.roles?.name === 'Master Admin';
          const permissionsObj: any = {};

          if (!isMaster && prof.role_id && !isClientUser) {
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
            permissions: permissionsObj,
            is_client_user: isClientUser,
            created_at: prof.created_at || new Date().toISOString(),
            updated_at: prof.updated_at || new Date().toISOString()
          };

          console.log('Setting full profile:', fullProfile);
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
      throw e;
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('Attempting sign in for:', email);
      if (navigator.onLine) {
        // Add retry logic for timeout errors
        let lastError: any = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Sign in attempt ${attempt}/${maxRetries}`);
            
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            console.log('Sign in result:', data, error);
            
            if (error) {
              console.error('Sign in error:', error);
              // Provide more specific error messages
              if (error.message.includes('Invalid login credentials')) {
                throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
              } else if (error.message.includes('Email not confirmed')) {
                throw new Error('يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المرسل إليك');
              } else {
                throw new Error(error.message || 'فشل تسجيل الدخول');
              }
            }
            
            console.log('Sign in successful, session:', data.session);
            // Session created successfully - the onAuthStateChange will handle profile loading
            return;
            
          } catch (err: any) {
            lastError = err;
            console.error(`Attempt ${attempt} failed:`, err);
            
            // Check if this is a retryable error (timeout or network)
            const isRetryable = err.message?.includes('timeout') || 
                              err.message?.includes('504') || 
                              err.message?.includes('network') ||
                              err.name === 'AuthRetryableFetchError';
            
            if (!isRetryable || attempt === maxRetries) {
              throw err;
            }
            
            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        throw lastError || new Error('فشل تسجيل الدخول بعد عدة محاولات');
        
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
      console.log('Attempting sign up for:', email, name);

      // No retry here: signUp is not idempotent (each call can create a new
      // auth.users row and queue another confirmation email), so retrying on
      // timeout compounds the problem instead of fixing it. Let the user
      // resubmit explicitly if it fails.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: window.location.origin
        }
      });

      console.log('Sign up result:', data, error);

      if (error) {
        console.error('Sign up error:', error);
        if (error.name === 'AuthRetryableFetchError' || error.message?.includes('504')) {
          throw new Error('خادم المصادقة يستجيب ببطء. يرجى المحاولة مرة أخرى بعد قليل.');
        }
        throw new Error(error.message || 'فشل إنشاء الحساب');
      }

      // If session exists, user is immediately signed in (email confirmation off)
      if (data.session) {
        console.log('Sign up successful with immediate session');
        return false; // No confirmation needed
      }

      // If no session but user was created, email confirmation is required
      if (data.user && !data.session) {
        console.log('Sign up successful but email confirmation required');
        return true; // Confirmation needed
      }

      // Unexpected state
      console.error('Unexpected sign up state:', data);
      throw new Error('فشل إنشاء الحساب، يرجى المحاولة مرة أخرى');
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

  const signInClient = async (clientId: string, pin: string) => {
    setLoading(true);
    try {
      // Use CRM service to authenticate by client_id + PIN (second factor)
      const { CRMService } = await import('./crm-service');
      const result = await CRMService.authenticateByClientId(clientId, pin);
      
      if (!result.success) {
        throw new Error(result.error || 'فشل تسجيل الدخول');
      }

      // The session is already created by CRMService
      // The profile will be loaded by the onAuthStateChange handler
    } catch (err: any) {
      await supabase.auth.signOut();
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerClient = async (clientId: string, email: string, password: string, name: string) => {
    setLoading(true);
    try {
      // Verify the client_id exists and is active
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .single();

      if (customerError || !customerData) {
        return { success: false, error: 'معرف العميل غير صحيح أو غير نشط' };
      }

      // Check if customer already has a user account
      if (customerData.user_id) {
        return { success: false, error: 'هذا العميل لديه حساب بالفعل' };
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('فشل إنشاء حساب المصادقة');

      // Get client portal role
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'client_portal')
        .single();

      if (!roleData) throw new Error('دور العميل غير موجود');

      // Update customer with user_id
      const { error: updateError } = await supabase
        .from('customers')
        .update({ 
          user_id: authData.user.id,
          email: email,
          name: name || customerData.name
        })
        .eq('id', customerData.id);

      if (updateError) throw updateError;

      // Create user profile with client_portal role
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          name: name || customerData.name,
          role_id: roleData.id
        });

      if (userError) throw userError;

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تسجيل العميل' };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signInClient, registerClient, signOut, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
