# Biometric Login Integration (WebAuthn)

This plan implements local biometric authentication (Face ID, Touch ID, Fingerprint) for the PWA without requiring a dedicated authentication server, storing credentials securely on the device.

## User Review Required
> [!IMPORTANT]
> The biometric setup will use WebAuthn (Passkeys) which is supported by modern browsers on iOS (Safari) and Android (Chrome). Since the app uses Google Sheets as a backend, the biometric linking will be **device-specific**. If a teacher logs in on a new phone, they will need to log in with a password first and re-enable biometrics for that specific phone.

## Open Questions
> [!NOTE]
> Do you want the biometric prompt to appear **automatically** right after a successful password login, or should there be a **button in the settings/profile** for them to turn it on manually? (The proposed plan is to show a prompt automatically after their first successful login).

## Proposed Changes

### `js/features/auth.js`
- **[MODIFY]**:
  - Add `enableBiometric()` function to handle `navigator.credentials.create()`.
  - Add `loginWithBiometric()` function to handle `navigator.credentials.get()`.
  - Update `loginSuccess()` to check if biometrics are enabled. If not, prompt the user to enable them.
  - Export these new functions to `window`.

### `index.html`
- **[MODIFY]**:
  - Add a "Login with Face ID / Fingerprint" button (fingerprint icon) on the login screen for both Teachers and Students.
  - This button will only be visible if a biometric credential is found in `localStorage` for this device.
  - Add a custom modal or confirm dialog to ask "Do you want to use Face ID/Touch ID for future logins?" after a successful login.

### `js/utils/helpers.js`
- **[MODIFY]**:
  - Add base64 ArrayBuffer conversion utilities required for WebAuthn.

## Verification Plan
- **Manual Verification**:
  1. Open the app on a mobile device (or a browser that supports Windows Hello / Touch ID).
  2. Log in with a password.
  3. Accept the prompt to enable Biometric Login.
  4. Log out.
  5. On the login screen, click the new Biometric Login button.
  6. Authenticate with Face ID / Fingerprint.
  7. Verify successful login into the app.

