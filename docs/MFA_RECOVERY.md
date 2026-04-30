# MFA Recovery — Meridian Portal

> Last updated: 2026-04-30
> Owner: _Privacy Officer / Security Officer (designate one)_

This is the runbook for **lost authenticator** scenarios. The portal mandates
TOTP MFA for every workforce role (admin, support staff, clinical provider,
clinical staff, sales rep), so any user who loses their phone — and has used
up their backup codes — is locked out until someone with admin access
removes their factor server-side.

There are four recovery paths, in order of preference. Always start with the
highest one that's available to the user.

---

## Path 1 — User self-recovery via backup code (preferred)

**When it applies:** user lost their authenticator app but still has at
least one of their 10 backup recovery codes saved (password manager,
printed paper, screenshot).

**Steps the user takes:**

1. Go to `https://meridianportal.io/sign-in` and enter email + password
2. On the 2FA challenge screen, click **"Lost your authenticator? Use a
   backup code →"**
3. Type one of their saved 8-character codes (format: `XXXX-XXXX`)
4. Server burns the code, removes the lost authenticator, and shows the
   enrollment screen
5. User scans the new QR code with their replacement device
6. Server returns 9 fresh backup codes — **save them**

**No admin action needed.** The user can do this entirely on their own.

---

## Path 2 — User self-recovery via in-app "Replace authenticator"

**When it applies:** user still has a working session (signed in within
the last hour, before session expiry) and either:
- got a new phone and wants to migrate, or
- temporarily borrowed a coworker's phone for the QR

**Steps:**

1. While logged in, go to `Settings → Security`
2. Click **"Replace authenticator"**
3. Scan the new QR code with the new device
4. Enter the new 6-digit code
5. Server unenrolls the old factor + signs out other sessions

Backup codes survive this flow — the user keeps the same codes they
already have. They can regenerate from the same Settings tab if they
suspect the old codes were exposed.

**No admin action needed.**

---

## Path 3 — Admin reset (most common recovery case)

**When it applies:** user is locked out, has no remaining backup codes, has
no active session. They need an admin to wipe their MFA state so they can
re-enroll on a new device.

**Who can do this:**
- Anyone with the `admin` role on the portal
- An admin **cannot reset their own MFA via this path** — they'd lock
  themselves out. A second admin must do it for them.

**Steps the admin takes:**

1. Go to `https://meridianportal.io/dashboard/users`
2. Find the locked-out user (search by email or name)
3. Hover the user's row — click the **"Reset MFA"** button (shield-off icon)
4. Confirm in the modal: *"This wipes ALL of the user's authenticator factors AND every backup recovery code, signs out every active session..."*
5. Server clears `auth.mfa_factors` + `mfa_backup_codes` for that user, signs
   them out globally, and emails them about the reset
6. Audit log records `mfa.admin_reset` with `performed_by = <admin user_id>`

**The user then:**

1. Signs in normally with email + password
2. Hits the MFA gate, lands on enrollment
3. Sets up a new authenticator + receives a fresh set of 10 backup codes

---

## Path 4 — Break-glass (last resort, when both admins are locked out)

**When it applies:** every admin has lost their authenticator AND used up
their backup codes simultaneously. With the **two-admin rule** below, this
should be vanishingly rare — you'd both need to lose recovery within the
same window — but the procedure is documented for completeness.

**Who can do this:**
- Anyone with login access to the **Supabase project dashboard** (currently
  Heather Bower; potentially also the engineering owner)

**Steps:**

1. Sign in to **supabase.com** → open the `hbmedical-portal` project
2. Go to **SQL Editor**
3. Look up the locked-out admin's user ID:
   ```sql
   SELECT id, email FROM auth.users WHERE email = '<admin@hbmedicalsupplies.io>';
   ```
   Copy the `id` (UUID) from the result.
4. Run the recovery query (replace the UUID):
   ```sql
   DELETE FROM auth.mfa_factors      WHERE user_id = '00000000-0000-0000-0000-000000000000';
   DELETE FROM public.mfa_backup_codes WHERE user_id = '00000000-0000-0000-0000-000000000000';
   ```
5. Tell the now-recoverable admin to sign in with password — they'll land
   on the enrollment screen.
6. **After recovery**, that admin should regenerate their backup codes
   from `Settings → Security → Regenerate codes` and store them safely.
7. **Audit:** the break-glass action does not flow through `phi_access_log`
   (it bypasses the app entirely). Manually note the recovery event in
   the BAA tracker / security log so the audit trail still has a record.

---

## Two-admin policy (operational requirement)

To avoid the doomsday scenario where **the entire org is locked out**:

- **At all times, at least 2 active users must hold the `admin` role.**
- **All admins must have MFA enrolled** with their backup codes saved
  somewhere distinct from their authenticator device (password manager,
  printed copy in a safe).
- If the org goes from 2 admins to 1 (someone leaves), promote a second
  active user to admin **before** the departure is finalized.
- Each admin's backup codes should be stored independently — one admin's
  password-manager compromise should not give an attacker access to the
  other admin's recovery codes.

The current admin set (as of go-live):
- _Heather Bower (CEO)_
- _Jofel Salado (engineering)_

Update this list as the organization grows.

---

## Logging + audit visibility

Every MFA-related event is recorded in `phi_access_log` with these `action`
values (queryable from the Audit page at `/dashboard/audit`):

| Action | When it fires |
|---|---|
| `mfa.enrolled` | First-time TOTP enrollment completed |
| `mfa.replaced` | Authenticator replaced via in-app flow |
| `mfa.admin_reset` | Admin used "Reset MFA" on the users page |
| `mfa.verify_success` | Successful TOTP code at sign-in |
| `mfa.verify_failed` | Wrong TOTP code at sign-in or enrollment |
| `mfa.backup_codes_generated` | Codes generated at enrollment or regenerate |
| `mfa.backup_code_used` | Backup code redeemed at sign-in |
| `mfa.backup_code_failed` | Wrong backup code at sign-in |

Filter the Audit page by `action LIKE 'mfa.%'` to see the full MFA history
for an account or facility.
