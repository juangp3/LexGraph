import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_duration: ["p(95)<250"],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
  const wordId = __ENV.WORD_ID || "11111111-1111-1111-8111-111111111111";
  const response = http.get(`${baseUrl}/v1/words/${wordId}`);
  check(response, {
    "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
  });
  sleep(1);
}
