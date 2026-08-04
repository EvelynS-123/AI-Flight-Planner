const TO_RADIANS = Math.PI / 180;

export function greatCircleAngle(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
) {
  const startLatitude = startLat * TO_RADIANS;
  const endLatitude = endLat * TO_RADIANS;
  const longitudeDelta = (endLng - startLng) * TO_RADIANS;
  const cosine = Math.sin(startLatitude) * Math.sin(endLatitude)
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

export function equalApexArcAltitude(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  apexAltitude: number,
  endpointAltitude: number,
) {
  const angle = greatCircleAngle(startLat, startLng, endLat, endLng);
  const endpointRadius = 1 + endpointAltitude;
  const apexRadius = 1 + apexAltitude;

  // three-globe builds arcs as a Cartesian cubic Bezier. Its fixed altitude
  // parameter sags toward the globe more as the great-circle angle grows.
  const controlRadius = (
    apexRadius - 0.25 * endpointRadius * Math.cos(angle / 2)
  ) / (0.75 * Math.cos(angle / 4));

  return (controlRadius - 1 + endpointAltitude * 0.5) / 1.5;
}
