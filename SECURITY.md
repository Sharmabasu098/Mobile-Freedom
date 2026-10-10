# Mobile Freedom — Security Policy

**Document:** SECURITY.md
**Version:** 1.0
**Status:** Initial Security Baseline

---

## 1. Purpose

Mobile Freedom aims to protect user privacy, personal files, and sensitive information across its website, AI services, and Android application.

Security must be considered throughout design, implementation, testing, and release.

## 2. Data Minimization

- Collect only the data required for a clearly defined feature.
- Prefer local processing when practical.
- Do not upload personal files without an appropriate user action and disclosure.
- Avoid unnecessary storage of sensitive information.
- Define retention and deletion rules for any data stored by a service.

## 3. File Processing

- Validate file types and input sizes.
- Handle malformed or unsupported files safely.
- Prevent file names from being treated as trusted instructions or executable code.
- Avoid exposing local file contents in logs.
- Limit resource consumption during large-file processing.
- Clearly report processing errors.

## 4. Safe File Deletion

- Never automatically delete personal files based only on an AI recommendation.
- Show the files selected for deletion.
- Explain relevant risks and estimated storage savings.
- Obtain explicit confirmation before destructive actions.
- Report the actual result.
- Do not promise recovery unless a supported recovery mechanism exists.

## 5. AI Security

- Treat user-provided content as untrusted input.
- Do not follow instructions embedded in files as if they were trusted system instructions.
- Do not allow an AI recommendation alone to authorize destructive actions.
- Do not invent scan results, storage statistics, or security guarantees.
- Send data to external AI services only when necessary and with appropriate disclosure and consent.

## 6. Web Application Security

- Use HTTPS for production services.
- Validate inputs on the client and server where applicable.
- Keep dependencies maintained.
- Avoid exposing secrets in frontend code.
- Apply appropriate Content Security Policy and other browser security controls.
- Handle errors without revealing sensitive implementation details.
- Protect any server endpoints against unauthorized access and abuse.

## 7. Android Security

- Request only necessary Android permissions.
- Follow supported Android storage APIs and scoped-storage rules.
- Respect operating-system restrictions.
- Protect locally stored sensitive information.
- Avoid unnecessary background activity.
- Do not access other applications' private data without a legitimate, supported authorization mechanism.
- Explain permission requests to users.

## 8. Accounts and Backend Services

If accounts or backend services are introduced:

- Use appropriate authentication and authorization.
- Protect session credentials.
- Keep API secrets on trusted server infrastructure.
- Apply rate limits and input validation.
- Minimize sensitive logs.
- Define account-data retention and deletion procedures.

## 9. Gmail, SMS, and Third-Party Data

Access to Gmail, SMS, and other application data must use supported APIs and permissions.

The project must comply with applicable platform and distribution policies.

The product must not claim unrestricted access to private messages or other applications' internal data.

## 10. Vulnerability Handling

Security issues should be reported privately to the project maintainer rather than published with exploit details.

The project should establish a dedicated security contact before public production release.

Reported issues must be assessed, prioritized, fixed, and verified.

## 11. Testing Requirements

Before release, test:

- Input validation
- File-processing errors
- Permission boundaries
- Unauthorized requests
- Sensitive-data exposure
- Dependency vulnerabilities
- Destructive-action confirmation
- Relevant Android and browser security behavior

A successful build alone does not establish security.

## 12. Security Claims

Mobile Freedom must not claim that any file, link, message, or device is completely safe without sufficient evidence.

Known limitations must be communicated clearly.

Security controls and claims must be reviewed as the product evolves.

## 13. Current Status

This document defines the initial security baseline.

It does not certify the project as secure. Actual implementation, testing, and review are required before release.
