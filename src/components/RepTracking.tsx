import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { db } from '../lib/dexie';
import { MapPin, Clock, Radio } from 'lucide-react';

// Leaflet's default marker icon paths break once bundled; point them at the
// bundler-resolved asset URLs instead.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

const EGYPT_CENTER: [number, number] = [26.8206, 30.8025];
const STOP_RADIUS_METERS = 75;
const MIN_DWELL_MINUTES = 3;

interface LocationPoint {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at: string;
}

interface Stop {
  lat: number;
  lng: number;
  arrival: string;
  departure: string;
  durationMinutes: number;
  pointCount: number;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Groups consecutive points that stay within STOP_RADIUS_METERS of the
// cluster's first point into a single "stop" (arrival/departure/duration),
// derived on read from raw pings — no separate stops table needed.
function computeStops(points: LocationPoint[]): Stop[] {
  const stops: Stop[] = [];
  let clusterStart = 0;

  for (let i = 1; i <= points.length; i++) {
    const stillWithin = i < points.length && haversineMeters(points[clusterStart], points[i]) <= STOP_RADIUS_METERS;
    if (!stillWithin) {
      const cluster = points.slice(clusterStart, i);
      if (cluster.length > 0) {
        const arrival = cluster[0].recorded_at;
        const departure = cluster[cluster.length - 1].recorded_at;
        const durationMinutes = (new Date(departure).getTime() - new Date(arrival).getTime()) / 60000;
        if (durationMinutes >= MIN_DWELL_MINUTES) {
          stops.push({
            lat: cluster.reduce((s, p) => s + p.lat, 0) / cluster.length,
            lng: cluster.reduce((s, p) => s + p.lng, 0) / cluster.length,
            arrival,
            departure,
            durationMinutes,
            pointCount: cluster.length
          });
        }
      }
      clusterStart = i;
    }
  }
  return stops;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export const RepTracking: React.FC = () => {
  const [activeView, setActiveView] = useState<'live' | 'history'>('live');
  const [users, setUsers] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<LocationPoint[]>([]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr());

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const [listUsers, listLocations] = await Promise.all([db.users.toArray(), db.user_locations.toArray()]);
    setUsers(listUsers);
    setAllLocations(listLocations.sort((a: any, b: any) => a.recorded_at.localeCompare(b.recorded_at)));
    if (listUsers.length > 0 && !selectedUserId) setSelectedUserId(listUsers[0].id);
  };

  const latestPerUser = useMemo(() => {
    const map = new Map<string, LocationPoint>();
    for (const loc of allLocations) {
      const existing = map.get(loc.user_id);
      if (!existing || loc.recorded_at > existing.recorded_at) map.set(loc.user_id, loc);
    }
    return Array.from(map.values());
  }, [allLocations]);

  const historyPoints = useMemo(() => {
    if (!selectedUserId || !selectedDate) return [];
    return allLocations.filter((l) => l.user_id === selectedUserId && l.recorded_at.slice(0, 10) === selectedDate);
  }, [allLocations, selectedUserId, selectedDate]);

  const stops = useMemo(() => computeStops(historyPoints), [historyPoints]);
  const pathLatLngs = useMemo(() => historyPoints.map((p) => [p.lat, p.lng] as [number, number]), [historyPoints]);

  const userName = (userId: string) => {
    const u = users.find((x: any) => x.id === userId);
    return u?.name || u?.email || 'مستخدم';
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          تتبع المندوبين (GPS)
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          تتبع الموقع أثناء استخدام التطبيق فقط (لا يعمل بعد إغلاق التطبيق). يمكنك مراجعة المسار الكامل لأي يوم سابق مع نقاط التوقف ومدتها.
        </p>
      </div>

      <div className="flex border-b border-gray-200 bg-white rounded-lg p-1 shadow-sm w-fit">
        <button
          onClick={() => setActiveView('live')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeView === 'live' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Radio className="h-4 w-4" />
          <span>الموقع الحالي</span>
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeView === 'history' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>سجل المسار اليومي</span>
        </button>
      </div>

      {activeView === 'live' && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="h-[420px] rounded overflow-hidden">
            <MapContainer center={EGYPT_CENTER} zoom={6} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {latestPerUser.map((loc) => (
                <Marker key={loc.user_id} position={[loc.lat, loc.lng]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold">{userName(loc.user_id)}</div>
                      <div>{new Date(loc.recorded_at).toLocaleString('ar-EG')}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          {latestPerUser.length === 0 && (
            <div className="text-center text-gray-400 py-6">لا توجد بيانات مواقع مسجلة بعد.</div>
          )}
        </div>
      )}

      {activeView === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المستخدم / المندوب</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="rounded border border-gray-300 py-1.5 px-3 text-sm bg-white"
                >
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">التاريخ</label>
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded border border-gray-300 py-1.5 px-3 text-sm"
                />
              </div>
            </div>

            <div className="h-[420px] rounded overflow-hidden">
              <MapContainer center={pathLatLngs[0] || EGYPT_CENTER} zoom={pathLatLngs.length ? 13 : 6} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {pathLatLngs.length > 1 && <Polyline positions={pathLatLngs} color="#1d4ed8" />}
                {stops.map((s, idx) => (
                  <Marker key={idx} position={[s.lat, s.lng]}>
                    <Popup>
                      <div className="text-sm space-y-1">
                        <div className="font-bold">توقف #{idx + 1}</div>
                        <div>الوصول: {new Date(s.arrival).toLocaleTimeString('ar-EG')}</div>
                        <div>المغادرة: {new Date(s.departure).toLocaleTimeString('ar-EG')}</div>
                        <div>المدة: {Math.round(s.durationMinutes)} دقيقة</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            {historyPoints.length === 0 && (
              <div className="text-center text-gray-400 py-4">لا توجد بيانات مسار لهذا اليوم.</div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">نقاط التوقف ({stops.length})</h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {stops.map((s, idx) => (
                <div key={idx} className="border rounded p-3 text-sm">
                  <div className="font-bold text-gray-800">توقف #{idx + 1}</div>
                  <div className="text-gray-500 text-xs mt-1 space-y-0.5">
                    <div>الوصول: {new Date(s.arrival).toLocaleTimeString('ar-EG')}</div>
                    <div>المغادرة: {new Date(s.departure).toLocaleTimeString('ar-EG')}</div>
                    <div>المدة: {Math.round(s.durationMinutes)} دقيقة</div>
                    <div className="font-mono">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</div>
                  </div>
                </div>
              ))}
              {stops.length === 0 && <div className="text-center text-gray-400 py-4 text-sm">لا توجد نقاط توقف مسجلة.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
