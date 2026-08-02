import { useEffect, useRef } from 'react';
import { queueOfflineWrite } from '../../infrastructure/sync/sync-service';
import { getSetting, getSettingBool } from '../../shared/utils/settings-helper';
import { useToast } from '../../presentation/components/ui/Toast';
import type { UserProfile } from '../services/auth-service';

const SAMPLE_INTERVAL_MS = 60 * 1000;

/**
 * Foreground-only GPS sampling: only records positions while this tab is
 * open and the browser grants permission. There is no background tracking
 * (that would need a native wrapper, e.g. Capacitor, as a separate effort).
 */
export function useLocationTracking(profile: UserProfile | null) {
  const watchActive = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (!profile || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let hasConfirmedFirstFix = false;
    let hasWarnedOnDenial = false;

    const recordPosition = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          if (!hasConfirmedFirstFix) {
            hasConfirmedFirstFix = true;
            toast.success('تم تفعيل مشاركة الموقع بنجاح.');
          }
          const id = crypto.randomUUID();
          await queueOfflineWrite('user_locations', 'insert', id, {
            id,
            user_id: profile.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            recorded_at: new Date().toISOString()
          });
        },
        (err) => {
          if (cancelled || hasWarnedOnDenial) return;
          // Only surface a permission denial once per session — must never
          // repeatedly interrupt the user's actual work in the app.
          if (err.code === err.PERMISSION_DENIED) {
            hasWarnedOnDenial = true;
            toast.warning(
              'دورك يتطلب مشاركة الموقع الجغرافي. من فضلك اسمح بالوصول للموقع من إعدادات المتصفح لتفعيل تتبع الموقع.',
              8000
            );
          }
        },
        { enableHighAccuracy: false, maximumAge: SAMPLE_INTERVAL_MS, timeout: 20000 }
      );
    };

    (async () => {
      const enabled = await getSettingBool('gps_tracking_enabled', false);
      if (!enabled || cancelled) return;

      const trackedRoleIdsCsv = await getSetting('gps_tracking_role_ids', '');
      const trackedRoleIds = trackedRoleIdsCsv.split(',').map((s) => s.trim()).filter(Boolean);
      const shouldTrack =
        trackedRoleIds.length > 0
          ? !!profile.role_id && trackedRoleIds.includes(profile.role_id)
          : profile.role_name === 'مندوب مبيعات';

      if (!shouldTrack || cancelled) return;

      // Ask up front (rather than waiting silently for the interval) so the
      // browser's native permission prompt appears as soon as the user's
      // session starts, and so a prior denial surfaces immediately via the
      // warning toast above instead of only after the first minute passes.
      if (typeof navigator.permissions?.query === 'function') {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'denied' && !cancelled) {
            hasWarnedOnDenial = true;
            toast.warning(
              'دورك يتطلب مشاركة الموقع الجغرافي، لكن إذن الوصول للموقع مرفوض في هذا المتصفح. من فضلك فعّله من إعدادات الموقع في المتصفح.',
              8000
            );
          }
        } catch {
          // Permissions API not supported for 'geolocation' on this browser
          // — fall through to the direct getCurrentPosition prompt below.
        }
      }

      watchActive.current = true;
      recordPosition();
      intervalId = setInterval(recordPosition, SAMPLE_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      watchActive.current = false;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role_id, profile?.role_name]);
}
