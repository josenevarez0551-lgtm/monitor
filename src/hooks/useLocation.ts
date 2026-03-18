import { useState, useEffect } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed: number | null;
}

export const useLocation = (enabled: boolean) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let watchId: number;

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed } = position.coords;
      const timestamp = position.timestamp;
      const newLocation: LocationData = { latitude, longitude, timestamp, accuracy, speed };
      setLocation(newLocation);
    };

    const handleError = (error: GeolocationPositionError) => {
      setError(error.message);
    };

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 1000,
      });
    } else {
      setError('Geolocation is not supported by this browser.');
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enabled]);

  return { location, error };
};