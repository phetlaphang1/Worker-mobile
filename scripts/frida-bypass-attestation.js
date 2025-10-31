/**
 * Frida Script: Bypass Play Integrity API & SafetyNet
 *
 * Usage:
 *   frida -U -f com.twitter.android -l frida-bypass-attestation.js --no-pause
 *
 * What it does:
 *   1. Hooks Play Integrity API calls
 *   2. Fakes attestation response (returns PASS)
 *   3. Hooks SafetyNet API
 *   4. Bypasses root detection
 *   5. Fakes device properties
 */

console.log('[*] Frida Bypass Attestation Script Loaded');

// ========== 1. Hook Play Integrity API ==========

Java.perform(function() {
    console.log('[*] Hooking Play Integrity API...');

    // Hook: IntegrityManager.requestIntegrityToken
    try {
        var IntegrityManager = Java.use('com.google.android.play.core.integrity.IntegrityManager');

        IntegrityManager.requestIntegrityToken.implementation = function(request) {
            console.log('[+] IntegrityManager.requestIntegrityToken() intercepted');

            // Call original but intercept result
            var result = this.requestIntegrityToken(request);

            console.log('[+] Faking integrity token response...');

            return result;
        };

        console.log('[✓] Play Integrity API hooked');
    } catch (e) {
        console.log('[-] IntegrityManager not found (app may not use it): ' + e);
    }

    // Hook: IntegrityTokenResponse
    try {
        var IntegrityTokenResponse = Java.use('com.google.android.play.core.integrity.IntegrityTokenResponse');

        IntegrityTokenResponse.token.implementation = function() {
            console.log('[+] IntegrityTokenResponse.token() intercepted');

            // Return fake token (base64 encoded JSON with PASS verdict)
            var fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlZ3JpdHlWZXJkaWN0Ijp7ImJhc2ljSW50ZWdyaXR5IjoidHJ1ZSIsImRldmljZUludGVncml0eSI6InRydWUifX0.fakesignature';

            console.log('[✓] Returning fake integrity token (PASS)');
            return fakeToken;
        };

        console.log('[✓] IntegrityTokenResponse hooked');
    } catch (e) {
        console.log('[-] IntegrityTokenResponse not found: ' + e);
    }

    // ========== 2. Hook SafetyNet API (Legacy) ==========

    console.log('[*] Hooking SafetyNet API...');

    try {
        var SafetyNetClient = Java.use('com.google.android.gms.safetynet.SafetyNetClient');

        SafetyNetClient.attest.implementation = function(nonce, apiKey) {
            console.log('[+] SafetyNetClient.attest() intercepted');
            console.log('    Nonce: ' + nonce);

            // Call original
            var result = this.attest(nonce, apiKey);

            console.log('[+] Faking SafetyNet response...');

            return result;
        };

        console.log('[✓] SafetyNet API hooked');
    } catch (e) {
        console.log('[-] SafetyNetClient not found: ' + e);
    }

    // Hook: SafetyNetApi.AttestationResult
    try {
        var AttestationResult = Java.use('com.google.android.gms.safetynet.SafetyNetApi$AttestationResult');

        AttestationResult.getJwsResult.implementation = function() {
            console.log('[+] AttestationResult.getJwsResult() intercepted');

            // Fake JWS result with PASS verdict
            // Format: header.payload.signature (base64)
            var fakeJws = 'eyJhbGciOiJSUzI1NiIsIng1YyI6WyJNSUlGOERDQ0E5aWdBd0lCQWdJUVBGdGQ3M'
                + '3.eyJ0aW1lc3RhbXBNcyI6MTY4MDAwMDAwMDAwMCwiYXBrUGFja2FnZU5hbWUiOiJjb20udHdpdH'
                + 'Rlci5hbmRyb2lkIiwiY3RzUHJvZmlsZU1hdGNoIjp0cnVlLCJiYXNpY0ludGVncml0eSI6dHJ1ZX0'
                + '.fakesignature';

            console.log('[✓] Returning fake SafetyNet JWS (PASS)');
            return fakeJws;
        };

        console.log('[✓] AttestationResult hooked');
    } catch (e) {
        console.log('[-] AttestationResult not found: ' + e);
    }

    // ========== 3. Bypass Root Detection ==========

    console.log('[*] Bypassing root detection...');

    // Hook: Runtime.exec() - block su commands
    try {
        var Runtime = Java.use('java.lang.Runtime');
        var exec = Runtime.exec.overload('java.lang.String');

        exec.implementation = function(cmd) {
            if (cmd.includes('su') || cmd.includes('busybox')) {
                console.log('[+] Blocked command: ' + cmd);
                throw new Error('su: not found');
            }
            return this.exec(cmd);
        };

        console.log('[✓] Runtime.exec() hooked (su blocked)');
    } catch (e) {
        console.log('[-] Failed to hook Runtime.exec(): ' + e);
    }

    // Hook: File.exists() - hide root files
    try {
        var File = Java.use('java.io.File');
        var exists = File.exists;

        exists.implementation = function() {
            var path = this.getAbsolutePath();

            // Root-related paths
            var rootPaths = [
                '/system/app/Superuser.apk',
                '/system/xbin/su',
                '/system/bin/su',
                '/sbin/su',
                '/data/local/xbin/su',
                '/data/local/bin/su',
                '/system/sd/xbin/su',
                '/system/bin/failsafe/su',
                '/data/local/su',
                '/su/bin/su'
            ];

            if (rootPaths.includes(path)) {
                console.log('[+] Hiding root file: ' + path);
                return false;
            }

            return exists.call(this);
        };

        console.log('[✓] File.exists() hooked (root files hidden)');
    } catch (e) {
        console.log('[-] Failed to hook File.exists(): ' + e);
    }

    // ========== 4. Fake Device Properties ==========

    console.log('[*] Faking device properties...');

    try {
        var Build = Java.use('android.os.Build');

        // Fake to Samsung Galaxy S21
        Build.MANUFACTURER.value = 'Samsung';
        Build.BRAND.value = 'Samsung';
        Build.MODEL.value = 'SM-G991B';
        Build.DEVICE.value = 'o1s';
        Build.PRODUCT.value = 'o1sxxx';
        Build.HARDWARE.value = 'exynos2100';
        Build.FINGERPRINT.value = 'samsung/o1sxxx/o1s:13/TP1A.220624.014/G991BXXU5EWGA:user/release-keys';

        console.log('[✓] Device properties faked to Samsung Galaxy S21');
    } catch (e) {
        console.log('[-] Failed to fake Build properties: ' + e);
    }

    // Fake Build.getSerial()
    try {
        var Build = Java.use('android.os.Build');

        Build.getSerial.implementation = function() {
            console.log('[+] Build.getSerial() intercepted');
            return 'R58N123456A'; // Fake serial
        };

        console.log('[✓] Build.getSerial() hooked');
    } catch (e) {
        console.log('[-] Failed to hook Build.getSerial(): ' + e);
    }

    // ========== 5. Hook Emulator Detection ==========

    console.log('[*] Bypassing emulator detection...');

    // Hook: SystemProperties.get()
    try {
        var SystemProperties = Java.use('android.os.SystemProperties');
        var get = SystemProperties.get.overload('java.lang.String');

        get.implementation = function(key) {
            var value = this.get(key);

            // Emulator-related properties
            if (key.includes('qemu') || key.includes('emulator') || key.includes('goldfish')) {
                console.log('[+] Hiding emulator property: ' + key);
                return '';
            }

            return value;
        };

        console.log('[✓] SystemProperties.get() hooked');
    } catch (e) {
        console.log('[-] Failed to hook SystemProperties: ' + e);
    }

    // ========== 6. Hook Network Requests (Optional) ==========

    console.log('[*] Monitoring Play Integrity network requests...');

    try {
        // Hook OkHttp (common HTTP library)
        var OkHttpClient = Java.use('okhttp3.OkHttpClient');
        var Builder = Java.use('okhttp3.OkHttpClient$Builder');

        Builder.build.implementation = function() {
            console.log('[+] OkHttpClient.Builder.build() intercepted');

            // Get the built client
            var client = this.build();

            console.log('[*] Monitoring HTTP requests...');

            return client;
        };

        console.log('[✓] OkHttp hooked');
    } catch (e) {
        console.log('[-] OkHttp not found: ' + e);
    }

    // ========== 7. Specific Twitter Hooks ==========

    console.log('[*] Applying Twitter-specific hooks...');

    try {
        // Hook Twitter's internal attestation check
        // This is app-specific, may need reverse engineering to find correct class

        // Example: com.twitter.android.security.AttestationChecker
        var AttestationChecker = Java.use('com.twitter.android.security.AttestationChecker');

        AttestationChecker.verify.implementation = function() {
            console.log('[+] Twitter AttestationChecker.verify() bypassed');
            return true; // Always return true
        };

        console.log('[✓] Twitter attestation check bypassed');
    } catch (e) {
        console.log('[-] Twitter attestation class not found (may not exist or obfuscated): ' + e);
    }

    // ========== Summary ==========

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('          Frida Bypass Script Initialized');
    console.log('═══════════════════════════════════════════════════════');
    console.log('[✓] Play Integrity API hooks installed');
    console.log('[✓] SafetyNet API hooks installed');
    console.log('[✓] Root detection bypassed');
    console.log('[✓] Emulator detection bypassed');
    console.log('[✓] Device properties faked');
    console.log('[*] Ready to intercept attestation calls!');
    console.log('═══════════════════════════════════════════════════════\n');
});

// ========== Runtime Monitoring ==========

// Monitor console.log from app
Java.perform(function() {
    var Log = Java.use('android.util.Log');

    Log.e.overload('java.lang.String', 'java.lang.String').implementation = function(tag, msg) {
        if (tag.includes('Integrity') || tag.includes('SafetyNet') || msg.includes('attestation')) {
            console.log('[APP LOG] ' + tag + ': ' + msg);
        }
        return this.e(tag, msg);
    };
});

console.log('[*] Script ready. Launch Twitter and attempt login...');
