// src/weather.js
// Open-Meteo with Fahrenheit + inches
export async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_min,precipitation_sum` +
    `&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("weather fetch failed");
  return r.json();
}
