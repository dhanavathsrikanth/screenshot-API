import { validateTargetUrl, isPrivateIp } from "@/lib/security/ssrf";

const cases: Array<[string, string]> = [
  ["http://127.0.0.1", "blocked"],
  ["http://127.0.0.1:8080/", "blocked"],
  ["http://0.0.0.0", "blocked"],
  ["http://10.0.0.1", "blocked"],
  ["http://172.16.0.1", "blocked"],
  ["http://172.31.255.255", "blocked"],
  ["http://192.168.1.1", "blocked"],
  ["http://169.254.169.254/latest/meta-data/iam/security-credentials/", "blocked"],
  ["http://[::1]", "blocked"],
  ["http://[::]", "blocked"],
  ["http://[fc00::1]", "blocked"],
  ["http://[fd12:3456::1]", "blocked"],
  ["http://[fe80::1]", "blocked"],
  ["http://[::ffff:127.0.0.1]", "blocked"],
  ["http://[::ffff:169.254.169.254]", "blocked"],
  ["http://[::ffff:10.0.0.1]", "blocked"],
  ["http://[::ffff:192.168.0.1]", "blocked"],
  ["http://[::ffff:7f00:1]", "blocked"],
  ["http://[::ffff:7f00:1]/", "blocked"],
  ["http://[::ffff:8.8.8.8]", "allowed"],
  ["http://localhost", "blocked"],
  ["http://localhost:3000/dashboard", "blocked"],
  ["http://foo.localhost", "blocked"],
  ["http://foo.local", "blocked"],
  ["http://foo.internal", "blocked"],
  ["http://foo.lan", "blocked"],
  ["http://metadata.google.internal", "blocked"],
  ["file:///etc/passwd", "blocked"],
  ["ftp://example.com", "blocked"],
  ["javascript://alert(1)", "blocked"],
  ["ws://example.com", "blocked"],
  ["data:text/html,hi", "blocked"],
  ["gopher://127.0.0.1", "blocked"],
  ["not a url", "invalid"],
  ["http://", "invalid"],
  ["https://example.com", "allowed"],
  ["http://example.com", "allowed"],
  ["https://www.google.com", "allowed"],
];

const ipCases: Array<[string, boolean]> = [
  ["10.0.0.1", true],
  ["127.0.0.1", true],
  ["169.254.1.1", true],
  ["172.16.0.1", true],
  ["172.31.255.255", true],
  ["192.168.0.1", true],
  ["224.0.0.1", true],
  ["8.8.8.8", false],
  ["1.1.1.1", false],
  ["172.32.0.1", false],
  ["192.169.0.1", false],
  ["::1", true],
  ["::", true],
  ["fc00::1", true],
  ["fd00::1", true],
  ["fe80::1", true],
  ["2001:4860:4860::8888", false],
];

(async () => {
  let failed = 0;
  for (const [url, expected] of cases) {
    let code = "error";
    try {
      await validateTargetUrl(url);
      code = "allowed";
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "SSRF_BLOCKED") code = "blocked";
      else if (e.code === "INVALID_URL") code = "invalid";
      else code = "error";
    }
    const ok = code === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${expected.padEnd(7)} -> ${code.padEnd(7)}  ${url}`);
  }
  for (const [ip, expected] of ipCases) {
    const got = isPrivateIp(ip);
    const ok = got === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  isPrivateIp(${ip}) expected ${expected}, got ${got}`);
  }
  console.log(failed === 0 ? "\nALL TESTS PASSED" : `\n${failed} TEST(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();
