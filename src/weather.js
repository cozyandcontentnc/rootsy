// src/weather.js
// Open-Meteo with Fahrenheit + inches
export async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    // Daily metrics (include max so High can render)
    daily: [
      'temperature_2m_min',
      'temperature_2m_max',
      'apparent_temperature_min',
      'apparent_temperature_max',
      'precipitation_sum',
    ].join(','),
    // Hourly for robust fallback (compute today min/max if daily absent)
    hourly: 'temperature_2m',
    // Units + tz
    timezone: 'auto',
    temperature_unit: 'fahrenheit',
    precipitation_unit: 'inch',
    // Give a small buffer so today always resolves correctly
    past_days: '1',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('weather fetch failed');
  return r.json();
}
