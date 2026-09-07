package com.sshworkspace;

import com.sshworkspace.service.EncryptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class EncryptionServiceTest {

    private EncryptionService encryptionService;

    @BeforeEach
    void setUp() {
        encryptionService = new EncryptionService();
        ReflectionTestUtils.setField(encryptionService, "masterKeyString", "TestMasterSecretKeyForEncryption2026!");
        encryptionService.init();
    }

    @Test
    void testEncryptionAndDecryption() {
        String originalSecret = "SuperSecretP@ssw0rd!123";
        String encrypted = encryptionService.encrypt(originalSecret);

        assertNotNull(encrypted);
        assertNotEquals(originalSecret, encrypted);

        String decrypted = encryptionService.decrypt(encrypted);
        assertEquals(originalSecret, decrypted);
    }

    @Test
    void testNullAndEmptyHandling() {
        assertNull(encryptionService.encrypt(null));
        assertNull(encryptionService.encrypt(""));
        assertNull(encryptionService.decrypt(null));
        assertNull(encryptionService.decrypt(""));
    }

    @Test
    void testDifferentIVProducesDifferentCiphertext() {
        String secret = "ConsistentSecretData";
        String enc1 = encryptionService.encrypt(secret);
        String enc2 = encryptionService.encrypt(secret);

        assertNotEquals(enc1, enc2, "Each encryption must use a unique random IV");
        assertEquals(secret, encryptionService.decrypt(enc1));
        assertEquals(secret, encryptionService.decrypt(enc2));
    }
}
