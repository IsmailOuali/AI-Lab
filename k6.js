import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = 'https://devnetcorp.com/';

// ---- EDIT THESE to match your real form fields ----
const FIELDS = {
  name: 'Load Test',
  email: 'sink+loadtest@wepresseco.com', // use a throwaway/sink inbox
  message: 'test message from k6',
};
// ---------------------------------------------------

export const options = {
  stages: [
    { duration: '20s', target: 10000 },  // ramp up gently
    { duration: '30s', target: 10000 },  // hold
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // flag if 95% slower than 2s
  },
};

export default function () {
  // 1. GET the page to receive the XSRF-TOKEN cookie
  const page = http.get(`${BASE}/contact`);

  // 2. Extract + URL-decode the token (Laravel encodes it)
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(`${BASE}/contact`);
  const token = cookies['XSRF-TOKEN']
    ? decodeURIComponent(cookies['XSRF-TOKEN'][0])
    : '';

  // 3. POST the form with the token header
  const res = http.post(`${BASE}/contact`, FIELDS, {
    headers: {
      'X-XSRF-TOKEN': token,
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  check(res, {
    'not 419 (CSRF ok)': (r) => r.status !== 419,
    'not 500 (server ok)': (r) => r.status !== 500,
    'status was 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });

  sleep(1);
}