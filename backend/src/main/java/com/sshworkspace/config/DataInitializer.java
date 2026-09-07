package com.sshworkspace.config;

import com.sshworkspace.model.*;
import com.sshworkspace.repository.*;
import com.sshworkspace.service.EncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CredentialRepository credentialRepository;
    private final ServerGroupRepository serverGroupRepository;
    private final TagRepository tagRepository;
    private final ServerProfileRepository serverProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final EncryptionService encryptionService;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() == 0) {
            log.info("SQLite database is empty. Seeding initial admin user and demo server...");

            User admin = User.builder()
                    .name("Admin User")
                    .email("admin@example.com")
                    .passwordHash(passwordEncoder.encode("password123"))
                    .build();
            admin = userRepository.save(admin);

            Credential credential = Credential.builder()
                    .userId(admin.getId())
                    .type("PASSWORD")
                    .encryptedData(encryptionService.encrypt("demopassword123"))
                    .build();
            credential = credentialRepository.save(credential);

            ServerGroup group = ServerGroup.builder()
                    .userId(admin.getId())
                    .name("Demo Environment")
                    .build();
            group = serverGroupRepository.save(group);

            Tag dockerTag = tagRepository.save(Tag.builder().userId(admin.getId()).name("docker").build());
            Tag alpineTag = tagRepository.save(Tag.builder().userId(admin.getId()).name("alpine").build());

            ServerProfile demoServer = ServerProfile.builder()
                    .userId(admin.getId())
                    .name("Demo Alpine Host")
                    .hostname("localhost")
                    .port(2222)
                    .username("demo")
                    .authType("PASSWORD")
                    .credentialId(credential.getId())
                    .groupId(group.getId())
                    .tags(Set.of(dockerTag, alpineTag))
                    .build();
            serverProfileRepository.save(demoServer);

            log.info("Seeded admin account (admin@example.com / password123) and Demo Alpine Host on port 2222.");
        }
    }
}
