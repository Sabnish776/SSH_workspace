package com.sshworkspace.config;

import com.sshworkspace.model.User;
import com.sshworkspace.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() == 0) {
            log.info("SQLite database is empty. Seeding initial admin user...");

            User admin = User.builder()
                    .name("Admin User")
                    .email("admin@example.com")
                    .passwordHash(passwordEncoder.encode("password123"))
                    .build();
            userRepository.save(admin);

            log.info("Seeded initial admin account (admin@example.com / password123).");
        }
    }
}
