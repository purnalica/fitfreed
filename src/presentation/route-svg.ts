import type { TrainingRoutePoint } from "./training-session-route";

export function routeSvgPoints(points: TrainingRoutePoint[]): string {
  if (points.length === 0) return "";
  const unwrapped: Array<{ latitude: number; longitude: number }> = [];
  points.forEach((point) => {
    let longitude = point.longitudeDegrees;
    const previous = unwrapped.at(-1)?.longitude;
    if (previous !== undefined) {
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
    }
    unwrapped.push({ latitude: point.latitudeDegrees, longitude });
  });
  const longitudes = unwrapped.map((point) => point.longitude);
  const latitudes = unwrapped.map((point) => point.latitude);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const longitudeSpan = maximumLongitude - minimumLongitude;
  const latitudeSpan = maximumLatitude - minimumLatitude;
  const width = 592;
  const height = 272;
  return unwrapped.map((point) => {
    const x = longitudeSpan === 0
      ? 320
      : 24 + (point.longitude - minimumLongitude) / longitudeSpan * width;
    const y = latitudeSpan === 0
      ? 160
      : 24 + (maximumLatitude - point.latitude) / latitudeSpan * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}
