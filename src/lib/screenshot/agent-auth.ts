import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Agent-browser inspired auth — mirrors:
 *   agent-browser auth save <name> --url --username --password
 *   agent-browser auth login <name>  (navigates with load, waits for selectors, fills, submits)
 *   agent-browser cookies / storage / --session --restore
 *
 * For screenshot-API we keep it simple: if login_url + username/password are set,
 * do a form login before navigating to the target url, then capture.
 * Falls back to HTTP basic auth (page.authenticate) for non-form sites.
 */

export interface AgentAuthOptions {
  login_url?: string;
  username_selector?: string;
  password_selector?: string;
  submit_selector?: string;
  auth_username?: string;
  auth_password?: string;
}

/**
 * Try form login like `agent-browser auth login`:
 *   1. goto login_url with load
 *   2. wait for username/password/submit selectors (SPA-friendly)
 *   3. fill + click
 *   4. wait for navigation/networkidle
 * Returns true if login was attempted.
 */
export async function tryAgentFormLogin(page: Page, opts: AgentAuthOptions): Promise<boolean> {
  if (!opts.login_url || !opts.auth_username || !opts.auth_password) return false;

  const loginUrl = opts.login_url;
  const userSel = opts.username_selector || 'input[type="email"], input[name="email"], #email, #username, input[type="text"]';
  const passSel = opts.password_selector || 'input[type="password"], #password';
  const submitSel = opts.submit_selector || 'button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")';

  try {
    logger.info({ event: "agent_auth_login_start", loginUrl });
    await page.goto(loginUrl, { waitUntil: "load", timeout: 15000 });
    // SPA-friendly wait for selectors like `auth login` does
    await page.waitForSelector(userSel, { visible: true, timeout: 5000 }).catch(() => {});
    await page.waitForSelector(passSel, { visible: true, timeout: 5000 }).catch(() => {});

    // Fill using agent-browser style `fill` (clear + type)
    const filledUser = await page.evaluate(
      (sel, val) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) return false;
        el.focus();
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      userSel,
      opts.auth_username
    ).catch(() => false);

    const filledPass = await page.evaluate(
      (sel, val) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) return false;
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      passSel,
      opts.auth_password
    ).catch(() => false);

    if (!filledUser || !filledPass) {
      logger.warn({ event: "agent_auth_fill_failed", filledUser, filledPass });
      // Try alternative selectors via text
      await page.evaluate(
        (user, pass) => {
          const userEl = (document.querySelector('input[name="username"]') ||
            document.querySelector('input[autocomplete="username"]') ||
            document.querySelector('input[type="email"]')) as HTMLInputElement | null;
          const passEl = document.querySelector('input[type="password"]') as HTMLInputElement | null;
          if (userEl) {
            userEl.value = user;
            userEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if (passEl) {
            passEl.value = pass;
            passEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
        },
        opts.auth_username,
        opts.auth_password
      );
    }

    // Click submit like `agent-browser click --name "Submit"`
    const clicked = await page
      .waitForSelector(submitSel, { visible: true, timeout: 3000 })
      .then((el) => (el as import("puppeteer").ElementHandle<Element>).click().then(() => true).catch(() => false))
      .catch(() => false);

    if (!clicked) {
      // Fallback: press Enter in password field
      await page.keyboard.press("Enter").catch(() => {});
    }

    // Wait for navigation / networkidle like `auth login` does
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    logger.info({ event: "agent_auth_login_done", loginUrl, url: page.url() });
    return true;
  } catch (e) {
    logger.warn({ event: "agent_auth_login_failed", error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
