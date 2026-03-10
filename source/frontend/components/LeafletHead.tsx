/**
 * LeafletHead — loads Leaflet + MarkerCluster CSS/JS from CDN.
 * Include this component only on pages that use the map.
 */
export function LeafletHead() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js" defer></script>
    </>
  );
}
