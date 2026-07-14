import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_duration: ["p(95)<250"]
  }
};

export default function () {
  const response = http.get("http://localhost:3000/v1/search?q=father");
  check(response, {
    "status is 200": (r) => r.status === 200
  });
  sleep(1);
}
