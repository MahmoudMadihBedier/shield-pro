import { useEffect, useRef } from 'react';
import { queueOfflineWrite } from './sync';
import { getSetting, getSettingBool } from './settingsHelper';
import type { UserProfile } from './authContext';

const SAMPLE_INTERVAL_MS = 60 * 1000;

/**
 * Foreground-only GPS sampling: only records positions while this tab is
 * open and the browser grants permission. There is no background tracking
 * (that would need a native wrapper, e.g. Capacitor, as a separate effort).
 */
export function useLocationTracking(profile: UserProfile | null) {
  const watchActive = useRef(false);

  useEffect(() => {
    if (!profile || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const recordPosition = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
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
        () => {
          // Permission denied or position unavailable — stay silent, this
          // must never interrupt the user's actual work in the app.
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
