# Product Thesis: From Data Portability to Meaningful Freedom

## Status

Confirmed product principle. Legal wording has been checked against the European legal sources and regulatory guidance cited below. This document is not legal advice.

## Core argument

The ability to download personal data is necessary but insufficient. A collection of machine-readable files has little practical value when the person lacks trustworthy software to interpret, explore, combine, preserve, and move that information independently of the original provider.

The project's central argument is:

> **GDPR-enabled portability + open-source software = meaningful user freedom.**

The GDPR provides a legal foundation for access and portability in defined circumstances. Open-source software supplies the transparent and reusable technical capability that can make exported data genuinely useful. Neither element alone delivers the full outcome.

## What meaningful freedom requires

- **Access:** people can obtain data about themselves through applicable legal rights and provider export mechanisms.
- **Use:** the exported information can be explored and interpreted without returning to the source platform.
- **Insight:** the product turns a large personal history into excellent, evidence-backed answers and discoveries rather than leaving interpretation work to the person.
- **Control:** the person can inspect evidence, change criteria, compose reports, and export results instead of accepting one opaque prescribed view.
- **Transparency:** the transformation, reconciliation, and calculation rules are inspectable.
- **Continuity:** the personal history remains usable if a provider changes, removes features, or ceases operating.
- **Exit:** the application provides open, documented ways to back up and export the resulting library, including normalized information and the person's own classifications, criteria, and reports. Data freed from a provider must not become trapped in FitFreed.
- **Collective improvement:** contributors can audit, extend, translate, and maintain the software for the public benefit.

## Legal precision

- This is a product motivation and design principle, not legal advice or a compliance assessment.
- Article 20 applies to personal data concerning the data subject that the person has provided to a controller when processing is automated and based on consent or a contract. It does not necessarily cover every field held by a controller.
- Article 20 also protects transmission to another controller without hindrance and, where technically feasible, direct controller-to-controller transmission.
- The GDPR does not prescribe a particular ZIP archive, folder layout, or vendor-specific takeout format.
- Article 15 separately establishes a right of access and a right to receive a copy of personal data undergoing processing. A vendor export may therefore include data supplied under rights of access or portability, other legal obligations, or voluntary product functionality; its existence and entire contents must not automatically be attributed to Article 20 alone.
- Product documentation will distinguish verified technical behavior from legal interpretation and will cite authoritative sources for legal claims.

## Complementary EU Data Act context

The EU Data Act has applied since 12 September 2025 and complements the founding GDPR argument. It gives users rights concerning data generated through connected products and related services, and European Commission guidance expressly includes medical and fitness devices among its examples. The design obligation in Article 3(1) applies to connected products and related services placed on the market after 12 September 2026.

This strengthens the broader case for tools that let people use connected-device data independently and for third parties to build new services around data made available to users. It does not replace GDPR rights, prove that a particular export exists because of one regulation, or place every field in an export within the same legal scope. FitFreed will use the Data Act as supporting context rather than presenting itself as a compliance product or regulator-endorsed service.

## Messaging principles

- Lead with personal agency and the difference between possessing files and being able to use the information within them.
- Treat **excellent results with real user control** as an internal quality bar, not a slogan that the interface can assert about itself. Freedom is incomplete when software exposes raw data without insight or offers polished conclusions without inspectable evidence and choice.
- Present one progressively disclosed experience for different levels of engagement: guided answers by default, accessible supporting evidence for people who want to understand, and configurable criteria and report composition for advanced use. Do not split trust or meaning across incompatible novice and expert modes.
- Use restrained, specific, verifiable language. The product site and other public entrances may explain the proposition, but they inform rather than advertise and distinguish implemented, active, and later work. The application must behave and read like a serious tool rather than repeat promotional claims, celebrate routine operations, or imply intelligence and value it has not demonstrated.
- Build credibility through candor rather than persuasion. Show current capability, evidence, material limitations, and the boundary between available and planned work without manufacturing urgency or hiding inconvenient facts. Keep the full account reachable through progressive disclosure instead of turning every surface into a warning ledger.
- Credit the GDPR as an enabling legal foundation without implying endorsement by, affiliation with, or authority from a regulator.
- Present open source as the mechanism for transparency, continuity, extensibility, and freedom from a new product dependency.
- Do not market the application as a GDPR compliance tool, legal service, medical device, or diagnostic product.
- Keep the product globally useful even though European data rights are central to its origin story.

## Product consequences

- Naming and identity should evoke portability, data rights, reclamation, or practical freedom without tying the product to a single regulation, region, or provider.
- The provider-neutral domain model and importer boundaries are essential product features, not merely implementation preferences.
- Import coverage, unsupported information, provenance, and transformations must be visible and explainable.
- When providers do not publish an adequate export-format specification, the project must document the observed structure openly with synthetic examples so possession of the files does not remain dependent on private reverse engineering.
- External format references must separate official guarantees, clean-room observations, and FitFreed interpretations. FitFreed-owned formats are held to a stronger standard: their complete, normative, versioned contracts must evolve with the implementation.
- Core use must remain local-first, offline-capable, and free of mandatory accounts or hosted services.
- Open normalized-data export, portable backups, documented canonical and persistence schemas, source-to-canonical mappings, and recoverable migrations are architectural obligations so the application does not become another silo.
- Export is part of the visible product promise—free data for independent reuse—not merely a recovery mechanism hidden in maintenance documentation.
- User and contributor documentation must explain both how the product works and why durable control over personal data matters.

## Authoritative sources

- [Regulation (EU) 2016/679, Recital 68 and Articles 15 and 20](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- [European Data Protection Board: Guidelines on the right to data portability under Regulation 2016/679, WP242 rev.01](https://www.edpb.europa.eu/documents/guideline/guidelines-on-the-right-to-data-portability-under-regulation-2016679-wp242_en)
- [Regulation (EU) 2023/2854, including Articles 3 and 50](https://eur-lex.europa.eu/eli/reg/2023/2854/oj/eng)
- [European Commission: Data Act explained](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained)
