# Contributing to Mobile Freedom

## Project Rules

- Follow the locked Master Development Roadmap.
- Do not change the approved Hybrid Architecture without
  explicit project-owner approval.
- Keep development mobile-friendly.
- Do not mark a milestone PASS without verification.

## Coding Conventions

- Use TypeScript for application logic.
- Use clear, descriptive names.
- Keep modules focused on a single responsibility.
- Validate external inputs.
- Handle errors explicitly.
- Never commit secrets, passwords, or private API keys.
- Prefer local processing when practical for user privacy.

## Dependencies

- Use npm for dependency management.
- Commit package-lock.json with dependency changes.
- Use `npm ci` for reproducible CI installations.
- Review new dependencies before adding them.

## Build and Verification

Run the production build with:

`npm run build`

The build must pass before changes are considered ready.

GitHub Actions must verify the build for changes
submitted to the main branch or through pull requests.

## Version Control

- Use descriptive commit messages.
- Keep changes focused and reviewable.
- Prefer pull requests for substantial changes.
- Review workflow results before merging.
- Do not overwrite unrelated working code.

## Mobile Development

- Prefer GitHub's mobile web interface.
- Use GitHub Actions for automated verification.
- Test deployed pages in a mobile browser.
- Avoid requiring desktop-only development steps.

## Roadmap Protection

The 23-milestone roadmap is locked.
Do not skip, merge, rename, or reorder milestones
without explicit project-owner approval.
