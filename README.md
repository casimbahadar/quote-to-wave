# Quote to Wave

A private quoting tool for Phoenix Applications & Automations. It builds a quote, numbers it, and when the client accepts it lays out everything needed to enter the invoice in Wave.

It is a separate tool built on the arithmetic of the public [quote builder demo](https://github.com/casimbahadar/quote-builder).

## What is in this repo

- `index.html` is the whole tool: page, styles, fonts, logo and script in one file.
- `_headers` tells Cloudflare to send the security policy as real response headers, including a ban on framing.
- `icon-180.png` is the Home Screen icon.
- `quote-to-wave.tests.mjs` is the test file.

There are no prices and no client details in this repo. The price list and every quote are saved only in the browser of the device that uses the tool.

## Data and privacy

- Nothing is sent anywhere. The page's Content-Security-Policy starts from `default-src 'none'` and sets `connect-src 'none'`, so the browser itself refuses any network request the page tries to make.
- The data is protected by the device's lock and nothing else. It is not encrypted and the tool has no password.
- iPhone can clear a web app's saved data, and removing the Home Screen icon deletes it. Use "Back up everything" in Settings after each accepted quote.
- HST is off by default. Nothing in this tool is tax advice.

## Tests

```
node quote-to-wave.tests.mjs
```

The tests read the logic between the `CORE-START` and `CORE-END` markers out of `index.html` and run it, so they test the file that ships. Expected figures were worked out by hand first. The run ends with `PASSED`, `FAILED` or `DID NOT COMPLETE`.

## If you edit index.html

The policy lists a fingerprint of the script and of the styles. Changing either one without updating the fingerprint, in both `index.html` and `_headers`, makes the browser refuse to run the page. The tests check that the fingerprints match, so run them before uploading.
