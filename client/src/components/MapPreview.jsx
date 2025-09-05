import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

// Lightweight placeholder shown while determining or loading the map
function LoadingPlaceholder({ message = 'Procesando ubicación...' }) {
  return (
    <div style={{
  height: 240,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f6f6f6',
      borderRadius: 6,
      marginBottom: 12,
      color: '#444',
      fontSize: 14,
    }}>
      <div>
        <div style={{ marginBottom: 6 }}>{message}</div>
        <div style={{ width: 24, height: 24, border: '3px solid #ccc', borderTop: '3px solid #333', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

LoadingPlaceholder.propTypes = {
  message: PropTypes.string,
};

export default function MapPreview({ lat, lon, label, height = null, hideToggle = false }) {
  const [leafletComponents, setLeafletComponents] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    // Only load leaflet/react-leaflet when we have coordinates
    if (lat == null || lon == null) return;

    let mounted = true;

    // Dynamically import react-leaflet, leaflet, CSS and marker images to avoid
    // adding them to the initial bundle and speed up first paint.
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
      import('leaflet/dist/leaflet.css'),
      import('leaflet/dist/images/marker-icon-2x.png'),
      import('leaflet/dist/images/marker-icon.png'),
      import('leaflet/dist/images/marker-shadow.png'),
    ])
      .then(([RL, L, leafletCss, icon2x, icon, shadow]) => {
        // ensure imported css module isn't flagged as unused by linters
        void leafletCss;
        if (!mounted) return;
        try {
          // Set marker icon paths
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: icon2x.default || icon2x,
            iconUrl: icon.default || icon,
            shadowUrl: shadow.default || shadow,
          });
        } catch (err) {
          // Non-fatal: continue even if icons can't be set
          // console.warn('Leaflet icon setup failed', err);
        }
        setLeafletComponents(RL);
        setLeafletReady(true);
      })
      .catch((err) => {
        // Loading failed — keep showing placeholder and optionally log
        console.warn('Failed to load leaflet dynamically', err);
      });

    return () => {
      mounted = false;
    };
  }, [lat, lon]);

  // handle responsive default and resize behaviour
  useEffect(() => {
    const update = () => {
      const mobile = typeof window !== 'undefined' && window.innerWidth < 640; // tailwind sm breakpoint
      setIsMobile(mobile);
      // default collapsed on mobile, expanded on larger screens
      setExpanded(!mobile);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Render placeholder when no coords
  if (lat == null || lon == null) {
    return <LoadingPlaceholder message="Esperando coordenadas..." />;
  }

  // While leaflet libs are loading, show placeholder sized according to expanded state
  if (!leafletReady || !leafletComponents) {
    return (
      <div style={{ width: '100%', marginBottom: 12 }}>
        <LoadingPlaceholder message="Cargando mapa..." />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = leafletComponents;
  const position = [lat || 0, lon || 0];

  // heights: collapsed smaller on mobile, expanded larger
  const collapsedHeight = 120;
  const expandedHeight = 240;
  const containerHeight = height != null ? height : (expanded ? expandedHeight : collapsedHeight);

  return (
    <div style={{ width: '100%', marginBottom: 12 }}>
      {/* header with toggle on mobile */}
  {isMobile && !hideToggle && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button onClick={() => setExpanded(!expanded)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 13 }} aria-expanded={expanded}>
            {expanded ? 'Ocultar mapa' : 'Mostrar mapa'}
          </button>
        </div>
      )}

      <div style={{ height: containerHeight, width: '100%' }}>
        <MapContainer center={position} zoom={17} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>{label || 'Ubicación'}</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}

MapPreview.propTypes = {
  lat: PropTypes.number,
  lon: PropTypes.number,
  label: PropTypes.string,
  height: PropTypes.number,
  hideToggle: PropTypes.bool,
};
