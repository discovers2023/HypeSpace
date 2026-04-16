# Requirements: HypeSpace

**Defined:** 2026-04-16
**Core Value:** Event organizers can create an event, invite guests, and send polished email campaigns.

## v1 Requirements

### Security

- [x] **SEC-01**: All /api/organizations/* routes require authenticated session
- [x] **SEC-02**: Registration requires email verification before login is allowed
- [x] **SEC-03**: CSRF protection via SameSite cookies + CSRF token on mutations
- [x] **SEC-04**: RSVP uses crypto-random token per guest instead of sequential id
- [x] **SEC-05**: Public event endpoints only return published events (filter drafts/cancelled)

### Multi-Organization

- [ ] **ORG-01**: Frontend reads org from auth context instead of hardcoded ORG_ID=1
- [ ] **ORG-02**: Org switcher in navbar for users belonging to multiple organizations
- [ ] **ORG-03**: All API calls pass the current org from auth context

### Campaign Enhancements

- [ ] **CAMP-01**: User can schedule a campaign to send at a future date/time
- [ ] **CAMP-02**: Scheduled campaigns auto-send at the specified time
- [ ] **CAMP-03**: Campaign tracks open rate via tracking pixel
- [ ] **CAMP-04**: Campaign tracks click rate via redirect links

### Code Quality

- [ ] **QUAL-01**: All pre-existing TypeScript errors resolved (12 across settings, social, team pages)
- [ ] **QUAL-02**: Consistent error toast handling across all API mutation calls
- [ ] **QUAL-03**: API errors return structured JSON with actionable messages

## v2 Requirements

### Media

- [ ] Image/media upload for campaigns (logos, speaker photos)
- [ ] Media library with reuse across campaigns

### Billing

- [ ] Stripe integration for real payment processing
- [ ] Usage-based billing enforcement

### Advanced Features

- [ ] White-label / custom domains per org
- [ ] Campaign A/B testing
- [ ] QR-code check-in for onsite events
- [ ] Per-guest email personalization tokens

### Infrastructure

- [ ] Production deployment pipeline (CI/CD)
- [ ] Automated test suite (Vitest)
- [ ] Production error tracking (Sentry or similar)

## Out of Scope

- Mobile native app — web responsive is sufficient
- Real-time collaboration — not needed for event workflows
- Video conferencing integration — link-based is sufficient
- Full WYSIWYG email editor — HTML editing + AI generation covers v1

## Traceability

| REQ | Phase | Status |
|-----|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| ORG-01 | Phase 2 | Pending |
| ORG-02 | Phase 2 | Pending |
| ORG-03 | Phase 2 | Pending |
| CAMP-01 | Phase 3 | Pending |
| CAMP-02 | Phase 3 | Pending |
| CAMP-03 | Phase 3 | Pending |
| CAMP-04 | Phase 3 | Pending |
| QUAL-01 | Phase 3 | Pending |
| QUAL-02 | Phase 3 | Pending |
| QUAL-03 | Phase 3 | Pending |
